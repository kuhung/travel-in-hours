import test from 'node:test';
import assert from 'node:assert';
import {
  IsochroneRequestManager,
  isCustomLandmark,
  hasPendingChanges,
  canShareCommitted,
  evaluateQuotaDeduction,
} from '../src/lib/exploration-state.ts';
import { parseStoredCount } from '../src/hooks/useSelectionLimit.ts';

const mockPresetLandmark = {
  id: 'shanghai-yishan-road',
  name: '宜山路地铁站',
  city: '上海',
  province: '上海市',
  coordinates: [121.424, 31.189],
};

const mockPresetLandmark2 = {
  id: 'shanghai-people-square',
  name: '人民广场',
  city: '上海',
  province: '上海市',
  coordinates: [121.4737, 31.2304],
};

const mockCustomLandmark = {
  id: 'custom-1729000000000',
  name: '自定义选点',
  city: '自定义位置',
  province: '',
  coordinates: [121.5, 31.2],
};

const mockCurrentLocationLandmark = {
  id: 'current-location',
  name: '当前位置',
  city: '我的位置',
  province: '',
  coordinates: [121.45, 31.22],
};

const mockIsochroneFeatures = [
  {
    type: 'Feature',
    properties: { value: 900, center: [121.424, 31.189] },
    geometry: { type: 'Polygon', coordinates: [[[121.42, 31.18], [121.43, 31.18], [121.43, 31.19], [121.42, 31.18]]] },
  },
  {
    type: 'Feature',
    properties: { value: 1800, center: [121.424, 31.189] },
    geometry: { type: 'Polygon', coordinates: [[[121.41, 31.17], [121.44, 31.17], [121.44, 31.20], [121.41, 31.17]]] },
  },
];

test('1. 生产请求管理器测试：A慢B快并发竞态，过期A请求被安全废弃，不覆盖B', async () => {
  const manager = new IsochroneRequestManager();

  // 模拟较慢的请求 A
  const fetchSlowA = async (_url, options) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({
          ok: true,
          status: 200,
          json: async () => ({ features: [{ type: 'Feature', properties: { tag: 'A' }, geometry: null }] }),
        });
      }, 60);

      options?.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('The user aborted a request.', 'AbortError'));
      });
    });
  };

  // 模拟较快的请求 B
  const fetchFastB = async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: true,
          status: 200,
          json: async () => ({ features: [{ type: 'Feature', properties: { tag: 'B' }, geometry: null }] }),
        });
      }, 15);
    });
  };

  // 启动请求 A
  const promiseA = manager.startRequest([121.4, 31.1], 'driving-car', [15], { fetchApi: fetchSlowA });

  // 在 A 尚未返回前，启动请求 B（生产 manager 会主动 abort A 并递增 latestRequestId）
  const promiseB = manager.startRequest([121.5, 31.2], 'cycling-regular', [15], { fetchApi: fetchFastB });

  const [resultA, resultB] = await Promise.all([promiseA, promiseB]);

  // B 成功且为当前有效请求
  assert.strictEqual(resultB.success, true);
  assert.strictEqual(resultB.features[0].properties.tag, 'B');
  assert.strictEqual(manager.isCurrent(resultB.requestId), true);

  // A 被中断废弃，非当前有效请求
  assert.strictEqual(resultA.success, false);
  assert.strictEqual(resultA.aborted, true);
  assert.strictEqual(manager.isCurrent(resultA.requestId), false);
});

test('2. 生产请求管理器测试：在途取消与请求身份可靠失效（覆盖恢复原条件/卸载场景）', async () => {
  const manager = new IsochroneRequestManager();

  const fetchInFlight = async (_url, options) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({
          ok: true,
          status: 200,
          json: async () => ({ features: mockIsochroneFeatures }),
        });
      }, 50);

      options?.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('The user aborted a request.', 'AbortError'));
      });
    });
  };

  const reqPromise = manager.startRequest([121.4, 31.1], 'driving-car', [15, 30], { fetchApi: fetchInFlight });
  const inFlightId = manager.getCurrentRequestId();

  // 模拟用户在请求未完成时点击“恢复原条件”或组件卸载：调用 manager.cancel()
  manager.cancel();

  // 验证请求身份已被可靠失效
  assert.strictEqual(manager.isCurrent(inFlightId), false);

  const rawResult = await reqPromise;

  // 模拟 hook 失效分支统一转换契约：若被 cancel 或非当前请求，统一映射为 success=false, aborted=true
  const finalResult = (rawResult.aborted || !manager.isCurrent(rawResult.requestId))
    ? { ...rawResult, success: false, aborted: true }
    : rawResult;

  assert.strictEqual(finalResult.success, false);
  assert.strictEqual(finalResult.aborted, true);

  // 校验在此场景下配额判定契约绝不扣减
  const quotaDeducted = evaluateQuotaDeduction({
    landmark: mockCustomLandmark,
    fromCache: finalResult.fromCache,
    success: finalResult.success,
    featuresCount: finalResult.features.length,
    aborted: finalResult.aborted,
  });
  assert.strictEqual(quotaDeducted, false);
});

test('3. 生产请求管理器测试：空 features（0个）识别为 isEmpty，失败返回 error 并保留原有状态', async () => {
  const manager = new IsochroneRequestManager();

  // 3.1 测试空响应（HTTP 200 但 features 为空）
  const fetchEmpty = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ type: 'FeatureCollection', features: [] }),
  });

  const emptyResult = await manager.startRequest([121.4, 31.1], 'driving-car', [15], { fetchApi: fetchEmpty });
  assert.strictEqual(emptyResult.success, false);
  assert.strictEqual(emptyResult.isEmpty, true);
  assert.strictEqual(emptyResult.error, '未获取到可达范围数据');
  assert.strictEqual(evaluateQuotaDeduction({
    landmark: mockCustomLandmark,
    fromCache: false,
    success: emptyResult.success,
    featuresCount: emptyResult.features.length,
  }), false);

  // 3.2 测试 HTTP 500 失败响应
  const fetchError = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: '服务内部错误' }),
  });

  const errorResult = await manager.startRequest([121.4, 31.1], 'driving-car', [15], { fetchApi: fetchError });
  assert.strictEqual(errorResult.success, false);
  assert.strictEqual(errorResult.error, '服务内部错误');
  assert.strictEqual(evaluateQuotaDeduction({
    landmark: mockCustomLandmark,
    fromCache: false,
    success: errorResult.success,
    featuresCount: errorResult.features.length,
  }), false);
});

test('4. 生产配额判定与自定义地标识别契约（严格遵循旧策略：仅 startsWith custom- 扣次）', () => {
  // 4.1 校验 isCustomLandmark 规则（杜绝误把定位 current-location 算入扣次策略）
  assert.strictEqual(isCustomLandmark(mockPresetLandmark), false);
  assert.strictEqual(isCustomLandmark(mockPresetLandmark2), false);
  assert.strictEqual(isCustomLandmark(mockCurrentLocationLandmark), false, '定位起点不以 custom- 开头，遵循旧策略不扣额度');
  assert.strictEqual(isCustomLandmark(mockCustomLandmark), true, '自定义选点以 custom- 开头，计入额度扣减');
  assert.strictEqual(isCustomLandmark(null), false);

  // 4.2 校验 evaluateQuotaDeduction 生产会计规则
  // 场景 A: 预设地标成功 -> 不扣次
  assert.strictEqual(evaluateQuotaDeduction({
    landmark: mockPresetLandmark,
    fromCache: false,
    success: true,
    featuresCount: 2,
    aborted: false,
  }), false);

  // 场景 B: 浏览器定位成功 -> 不扣次（保持旧策略）
  assert.strictEqual(evaluateQuotaDeduction({
    landmark: mockCurrentLocationLandmark,
    fromCache: false,
    success: true,
    featuresCount: 2,
    aborted: false,
  }), false);

  // 场景 C: 自定义选点未命中缓存且成功返回有效等时圈 -> 严格扣减 1 次
  assert.strictEqual(evaluateQuotaDeduction({
    landmark: mockCustomLandmark,
    fromCache: false,
    success: true,
    featuresCount: 2,
    aborted: false,
  }), true);

  // 场景 D: 自定义选点命中缓存 -> 不扣次
  assert.strictEqual(evaluateQuotaDeduction({
    landmark: mockCustomLandmark,
    fromCache: true,
    success: true,
    featuresCount: 2,
    aborted: false,
  }), false);

  // 场景 E: 自定义选点请求失败 -> 不扣次
  assert.strictEqual(evaluateQuotaDeduction({
    landmark: mockCustomLandmark,
    fromCache: false,
    success: false,
    featuresCount: 0,
    aborted: false,
  }), false);

  // 场景 F: 自定义选点返回 0 features -> 不扣次
  assert.strictEqual(evaluateQuotaDeduction({
    landmark: mockCustomLandmark,
    fromCache: false,
    success: true,
    featuresCount: 0,
    aborted: false,
  }), false);

  // 场景 G: 自定义选点被取消/失效 -> 不扣次
  assert.strictEqual(evaluateQuotaDeduction({
    landmark: mockCustomLandmark,
    fromCache: false,
    success: true,
    featuresCount: 2,
    aborted: true,
  }), false);
});

test('5. 生产条件修改检测（hasPendingChanges）与分享资格（canShareCommitted）', () => {
  const committedSnapshot = {
    conditions: {
      landmark: mockPresetLandmark,
      profile: 'driving-car',
      rangeMinutes: [15, 30, 60],
    },
    isochrones: mockIsochroneFeatures,
    timestamp: Date.now(),
  };

  // 5.1 无 committed 结果时不可分享，且无 pending changes
  assert.strictEqual(canShareCommitted(null), false);
  assert.strictEqual(hasPendingChanges({
    landmark: mockPresetLandmark,
    profile: 'driving-car',
    rangeMinutes: [15, 30, 60],
  }, null), false);

  // 5.2 有 committed 结果且条件一致 -> 可分享，无 pending changes
  assert.strictEqual(canShareCommitted(committedSnapshot), true);
  assert.strictEqual(hasPendingChanges({
    landmark: mockPresetLandmark,
    profile: 'driving-car',
    rangeMinutes: [15, 30, 60],
  }, committedSnapshot), false);

  // 5.3 修改草稿 profile -> 触发 pending changes，但 committed 依然可分享
  assert.strictEqual(hasPendingChanges({
    landmark: mockPresetLandmark,
    profile: 'cycling-regular',
    rangeMinutes: [15, 30, 60],
  }, committedSnapshot), true);

  // 5.4 修改草稿地标 -> 触发 pending changes
  assert.strictEqual(hasPendingChanges({
    landmark: mockPresetLandmark2,
    profile: 'driving-car',
    rangeMinutes: [15, 30, 60],
  }, committedSnapshot), true);

  // 5.5 修改草稿范围 -> 触发 pending changes
  assert.strictEqual(hasPendingChanges({
    landmark: mockPresetLandmark,
    profile: 'driving-car',
    rangeMinutes: [30, 60],
  }, committedSnapshot), true);

  // 5.6 空 features 的快照不可分享
  const emptySnapshot = {
    ...committedSnapshot,
    isochrones: [],
  };
  assert.strictEqual(canShareCommitted(emptySnapshot), false);
});

test('6. 存储计数解析函数（parseStoredCount）合法性校验与容错', () => {
  assert.strictEqual(parseStoredCount(null), 0);
  assert.strictEqual(parseStoredCount(''), 0);
  assert.strictEqual(parseStoredCount('invalid_number'), 0);
  assert.strictEqual(parseStoredCount('-3'), 0, '负数解析为 0 防止配额异常');
  assert.strictEqual(parseStoredCount('NaN'), 0);
  assert.strictEqual(parseStoredCount('0'), 0);
  assert.strictEqual(parseStoredCount('3'), 3);
  assert.strictEqual(parseStoredCount('5'), 5);
});

test('7. 生产埋点事件兼容性核对：429限流事件与api_error location/error_type严格还原', async () => {
  const manager = new IsochroneRequestManager();
  const trackedEvents = [];

  const mockTrack = (name, properties) => {
    trackedEvents.push({ name, properties });
  };

  // 模拟 HTTP 429 限流响应
  const fetchRateLimited = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: 'Too Many Requests' }),
  });

  await manager.startRequest([121.4, 31.1], 'driving-car', [15], {
    fetchApi: fetchRateLimited,
    trackEvent: mockTrack,
    snapCoords: (lng, lat) => [lng, lat],
  });

  // 验证 api_error 严格包含原有 location: 'isochrones_hook' 与 error_type: 'rate_limit'
  const apiErrorEvent = trackedEvents.find(e => e.name === 'api_error');
  assert.ok(apiErrorEvent, '必须触发 api_error 事件');
  assert.strictEqual(apiErrorEvent.properties.location, 'isochrones_hook', 'location 必须维持原有历史口径 isochrones_hook');
  assert.strictEqual(apiErrorEvent.properties.error_type, 'rate_limit', '429 错误类型必须为 rate_limit');
  assert.strictEqual(apiErrorEvent.properties.status_code, 429);

  // #12 保留限流事件，停止上报精确坐标。
  const rateLimitReachedEvent = trackedEvents.find(e => e.name === 'api_rate_limit_reached');
  assert.ok(rateLimitReachedEvent, '429 状态码必须触发 api_rate_limit_reached 事件');
  assert.strictEqual(rateLimitReachedEvent.properties.location, 'isochrones_hook');
  assert.strictEqual(rateLimitReachedEvent.properties.coordinates, undefined);
});

test('8. 缓存立即 resolve 场景下 cancel 必须不提交/不扣次（覆盖微任务提交窗口）', async () => {
  const manager = new IsochroneRequestManager();

  // 模拟命中缓存：同步返回 cached features
  const mockCacheLookup = () => mockIsochroneFeatures;

  const resultPromise = manager.startRequest([121.4, 31.1], 'driving-car', [15, 30], {
    getCached: mockCacheLookup,
    snapCoords: (lng, lat) => [lng, lat],
  });

  // 用户在返回前或微任务续体前点击了 cancel
  manager.cancel();

  const rawResult = await resultPromise;

  // 验证 hook 生产失效分支统一映射
  const finalResult = (rawResult.aborted || !manager.isCurrent(rawResult.requestId))
    ? { ...rawResult, success: false, aborted: true }
    : rawResult;

  assert.strictEqual(finalResult.success, false);
  assert.strictEqual(finalResult.aborted, true);

  // 验证配额判定契约在取消后绝不扣减
  const quotaDeducted = evaluateQuotaDeduction({
    landmark: mockCustomLandmark,
    fromCache: finalResult.fromCache,
    success: finalResult.success,
    featuresCount: finalResult.features.length,
    aborted: finalResult.aborted,
  });
  assert.strictEqual(quotaDeducted, false);
});
