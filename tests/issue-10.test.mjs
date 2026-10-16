import test from 'node:test';
import assert from 'node:assert';
import {
  createSharePayload,
  generateShareUrl,
  generateShareTitle,
  copyShareLink,
  ensureRoundRect,
  canvasToBlob,
  downloadBlob,
  initTileLoadTracker,
  withTimeout,
  escapeHtml,
  exportShareImage,
} from '../src/lib/share-utils.ts';

// 构造标准测试数据
const mockLandmark = {
  id: 'shanghai-yishan-road',
  name: '宜山路',
  city: '上海',
  province: '上海市',
  coordinates: [121.4276, 31.1895], // [lng, lat]
};

const mockIsochroneFeatures = [
  {
    type: 'Feature',
    properties: { value: 900, center: [121.4276, 31.1895] },
    geometry: {
      type: 'Polygon',
      coordinates: [[[121.4, 31.1], [121.5, 31.1], [121.5, 31.2], [121.4, 31.2], [121.4, 31.1]]],
    },
  },
  {
    type: 'Feature',
    properties: { value: 1800, center: [121.4276, 31.1895] },
    geometry: {
      type: 'Polygon',
      coordinates: [[[121.3, 31.0], [121.6, 31.0], [121.6, 31.3], [121.3, 31.3], [121.3, 31.0]]],
    },
  },
  {
    type: 'Feature',
    properties: { value: 3600, center: [121.4276, 31.1895] },
    geometry: {
      type: 'Polygon',
      coordinates: [[[121.2, 30.9], [121.7, 30.9], [121.7, 31.4], [121.2, 31.4], [121.2, 30.9]]],
    },
  },
];

const mockPOIs = [
  {
    id: 'poi-xujiahui-cathedral',
    name: '徐家汇天主教堂',
    city: '上海',
    coordinates: [121.4371, 31.1923],
    category: 'tourism',
    description: '历史悠久的哥特式双塔天主教堂',
    rating: 5,
    layerMinutes: 15,
    index: 1,
    position: [31.1923, 121.4371],
  },
  {
    id: 'poi-shanghai-museum',
    name: '上海博物馆',
    city: '上海',
    coordinates: [121.4752, 31.2288],
    category: 'tourism',
    description: '中国古代艺术博物馆',
    rating: 5,
    layerMinutes: 30,
    index: 2,
    position: [31.2288, 121.4752],
  },
];

const mockPoiByLayer = [
  {
    layerMinutes: 15,
    color: '#0f766e',
    fillColor: '#2dd4bf',
    points: [mockPOIs[0]],
  },
  {
    layerMinutes: 30,
    color: '#1d4ed8',
    fillColor: '#60a5fa',
    points: [mockPOIs[1]],
  },
];

// 模拟简易 Leaflet TileLayer 事件发射器
class FakeTileLayer {
  constructor() {
    this.listeners = {};
    this.loading = true;
  }
  on(event, fn) {
    (this.listeners[event] = this.listeners[event] || []).push(fn);
  }
  off(event, fn) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((f) => f !== fn);
    }
  }
  emit(event, ...args) {
    (this.listeners[event] || []).forEach((fn) => fn(...args));
  }
  isLoading() {
    return this.loading;
  }
}

test('1. SharePayload 契约与深度冻结不可变性验证 (Immutability & Seam Contract)', () => {
  const payload = createSharePayload({
    landmark: mockLandmark,
    profile: 'driving-car',
    rangeMinutes: [15, 30, 60],
    isochrones: mockIsochroneFeatures,
    selectedPOIId: 'poi-xujiahui-cathedral',
    poiByLayer: mockPoiByLayer,
    totalPOIs: 2,
    coverageStatus: 'matched',
    isPartial: false,
    isExample: true,
  });

  // 1.1 核心结构与版本标记
  assert.strictEqual(payload.version, 1, 'SharePayload 规范版本必须为 1');
  assert.strictEqual(payload.conditions.landmark.name, '宜山路');
  assert.strictEqual(payload.conditions.profile, 'driving-car');
  assert.deepStrictEqual(payload.conditions.rangeMinutes, [15, 30, 60]);
  assert.strictEqual(payload.conditions.isExample, true);
  assert.strictEqual(payload.selectedPOIId, 'poi-xujiahui-cathedral');
  assert.strictEqual(payload.selectedPOI?.name, '徐家汇天主教堂');
  assert.strictEqual(payload.poiInfo.totalPOIs, 2);
  assert.strictEqual(payload.poiInfo.coverageStatus, 'matched');

  // 1.2 深度冻结断言：所有顶层与嵌套字段必须为 frozen
  assert.strictEqual(Object.isFrozen(payload), true, '顶层 payload 必须被 Object.freeze 保护');
  assert.strictEqual(Object.isFrozen(payload.conditions), true, 'conditions 必须被冻结');
  assert.strictEqual(Object.isFrozen(payload.conditions.landmark), true, 'landmark 必须被冻结');
  assert.strictEqual(Object.isFrozen(payload.poiInfo), true, 'poiInfo 必须被冻结');
  assert.strictEqual(Object.isFrozen(payload.isochrones), true, 'isochrones 数组必须被冻结');

  // 1.3 尝试篡改在严格模式下抛错
  assert.throws(() => {
    payload.conditions.landmark.name = '篡改的地标';
  }, TypeError, '修改只读冻结属性必须触发 TypeError');

  // 1.4 深度克隆隔离：修改外部输入源绝对不污染已创建的 payload
  const mutableInputLandmark = { ...mockLandmark };
  const isolatedPayload = createSharePayload({
    landmark: mutableInputLandmark,
    profile: 'foot-walking',
    rangeMinutes: [15, 30, 60],
    isochrones: mockIsochroneFeatures,
  });
  mutableInputLandmark.name = '外部被修改的名字';
  assert.strictEqual(isolatedPayload.conditions.landmark.name, '宜山路', '外部对象改动不得穿透已提交快照');
});

test('2. 分享链接参数对称性与 #11 往返契约验证 (URL Symmetry & Round-Trip)', () => {
  // 2.1 整次探索 URL 生成（无 poi 参数）
  const explorationPayload = createSharePayload({
    landmark: mockLandmark,
    profile: 'driving-car',
    rangeMinutes: [15, 30, 60],
    isochrones: mockIsochroneFeatures,
    selectedPOIId: null,
  });

  const explorationUrl = generateShareUrl(explorationPayload);
  const parsedExpUrl = new URL(explorationUrl, 'https://keda.kuhung.me');
  assert.strictEqual(parsedExpUrl.searchParams.get('name'), '宜山路');
  assert.strictEqual(parsedExpUrl.searchParams.get('city'), '上海');
  assert.strictEqual(parsedExpUrl.searchParams.get('profile'), 'driving-car');
  assert.strictEqual(parsedExpUrl.searchParams.get('range'), '15,30,60');
  assert.strictEqual(parsedExpUrl.searchParams.get('lng'), '121.4276');
  assert.strictEqual(parsedExpUrl.searchParams.get('lat'), '31.1895');
  assert.strictEqual(parsedExpUrl.searchParams.has('poi'), false, '整次探索不可带有 poi 参数');

  // 2.2 所选地点 URL 生成（为 #11 提供可往返 poi 参数）
  const destinationPayload = createSharePayload({
    landmark: mockLandmark,
    profile: 'cycling-regular',
    rangeMinutes: [15, 30, 60],
    isochrones: mockIsochroneFeatures,
    selectedPOIId: 'poi-xujiahui-cathedral',
    poiByLayer: mockPoiByLayer,
  });

  const destinationUrl = generateShareUrl(destinationPayload);
  const parsedDestUrl = new URL(destinationUrl, 'https://keda.kuhung.me');
  assert.strictEqual(parsedDestUrl.searchParams.get('name'), '宜山路');
  assert.strictEqual(parsedDestUrl.searchParams.get('profile'), 'cycling-regular');
  assert.strictEqual(parsedDestUrl.searchParams.get('poi'), 'poi-xujiahui-cathedral', '所选地点必须携带稳定 poi 参数');

  // 2.3 兼容旧版 ShareParams 签名
  const legacyUrl = generateShareUrl({
    landmark: mockLandmark,
    profile: 'foot-walking',
    rangeMinutes: [15, 30, 60],
  });
  const parsedLegacyUrl = new URL(legacyUrl, 'https://keda.kuhung.me');
  assert.strictEqual(parsedLegacyUrl.searchParams.get('profile'), 'foot-walking');
});

test('3. 分享对象明确性与文案承诺验证 (Explicit Destination vs Exploration Title)', () => {
  // 3.1 所选地点卡片分享文案：突出起点、方式、圈层互斥与目的地
  const destinationPayload = createSharePayload({
    landmark: mockLandmark,
    profile: 'driving-car',
    rangeMinutes: [15, 30, 60],
    isochrones: mockIsochroneFeatures,
    selectedPOIId: 'poi-xujiahui-cathedral',
    poiByLayer: mockPoiByLayer,
  });

  const destTitle = generateShareTitle(destinationPayload);
  assert.match(destTitle, /从宜山路出发/);
  assert.match(destTitle, /驾车/);
  assert.match(destTitle, /15分钟内预估可达/);
  assert.match(destTitle, /徐家汇天主教堂/);
  assert.match(destTitle, /来看看路线与周边可达范围/);
  assert.doesNotMatch(destTitle, /1[-–至]3\s*小时|3\s*小时/);

  // 3.2 整次探索分享文案：突出起点与等时圈探索
  const explorationPayload = createSharePayload({
    landmark: mockLandmark,
    profile: 'cycling-regular',
    rangeMinutes: [15, 30, 60],
    isochrones: mockIsochroneFeatures,
    selectedPOIId: null,
  });

  const expTitle = generateShareTitle(explorationPayload);
  assert.match(expTitle, /从宜山路骑行出发/);
  assert.match(expTitle, /1 小时能骑到哪里/);
  assert.doesNotMatch(expTitle, /1[-–至]3\s*小时|3\s*小时/);
});

test('4. 生产瓦片等待控制器就绪契约 (initTileLoadTracker & waitForTiles Strict Readiness)', async () => {
  // 4.1 zero requests timeout：零请求零加载严禁 fulfilled，必须明确拒绝
  const zeroLayer = new FakeTileLayer();
  const zeroTracker = initTileLoadTracker(zeroLayer);
  await assert.rejects(
    zeroTracker.waitForTiles({ timeoutMs: 30 }),
    (err) => err.message.includes('0 tiles loaded'),
    '零请求零加载必须拒绝，防止空地图冒充成功'
  );
  zeroTracker.cleanup();

  // 4.2 partial timeout：10 张瓦片仅加载 1 张即超时，必须拒绝，严禁导出缺块破损地图
  const partialLayer = new FakeTileLayer();
  const partialTracker = initTileLoadTracker(partialLayer);
  for (let i = 0; i < 10; i++) partialLayer.emit('tileloadstart');
  partialLayer.emit('tileload'); // 仅加载 1 张
  await assert.rejects(
    partialTracker.waitForTiles({ timeoutMs: 30 }),
    (err) => err.message.includes('incomplete tiles'),
    '部分瓦片超时必须拒绝'
  );
  partialTracker.cleanup();

  // 4.3 mixed tile errors：请求 5 张，4 张成功 1 张失败，任一失败立即拒绝
  const mixedLayer = new FakeTileLayer();
  const mixedTracker = initTileLoadTracker(mixedLayer);
  for (let i = 0; i < 5; i++) mixedLayer.emit('tileloadstart');
  for (let i = 0; i < 4; i++) mixedLayer.emit('tileload');
  const mixedPromise = mixedTracker.waitForTiles({ timeoutMs: 500 });
  mixedLayer.emit('tileerror');
  await assert.rejects(
    mixedPromise,
    (err) => err.message.includes('tile error(s)'),
    '包含瓦片错误时必须拒绝'
  );
  mixedTracker.cleanup();

  // 4.4 all-success ready：全部 5 张瓦片均成功，load 事件触发后宽限完成
  const successLayer = new FakeTileLayer();
  const successTracker = initTileLoadTracker(successLayer);
  for (let i = 0; i < 5; i++) successLayer.emit('tileloadstart');
  for (let i = 0; i < 5; i++) successLayer.emit('tileload');
  const successPromise = successTracker.waitForTiles({ timeoutMs: 500, graceMs: 20 });
  successLayer.emit('load');
  const successStatus = await successPromise;
  assert.strictEqual(successStatus.loaded, 5);
  assert.strictEqual(successStatus.failed, 0);
  assert.strictEqual(successStatus.settledWith, 'load');
  successTracker.cleanup();

  // 4.5 cached ready：在调用 waitForTiles 之前已完成加载并标记完毕，直接结算为 cached
  const cachedLayer = new FakeTileLayer();
  cachedLayer.loading = false;
  const cachedTracker = initTileLoadTracker(cachedLayer);
  for (let i = 0; i < 3; i++) cachedLayer.emit('tileloadstart');
  for (let i = 0; i < 3; i++) cachedLayer.emit('tileload');
  cachedLayer.emit('load');
  const cachedStatus = await cachedTracker.waitForTiles({ timeoutMs: 500 });
  assert.strictEqual(cachedStatus.settledWith, 'cached');
  assert.strictEqual(cachedStatus.loaded, 3);
  cachedTracker.cleanup();

  // 4.6 abort cancellation：中途收到 AbortSignal 立即中断并清理监听
  const abortLayer = new FakeTileLayer();
  const abortController = new AbortController();
  const abortTracker = initTileLoadTracker(abortLayer, { signal: abortController.signal });
  abortLayer.emit('tileloadstart');
  const abortWaitPromise = abortTracker.waitForTiles({ timeoutMs: 2000, signal: abortController.signal });
  abortController.abort();
  await assert.rejects(
    abortWaitPromise,
    (err) => err.message.includes('Generation aborted')
  );
  assert.strictEqual(Object.keys(abortLayer.listeners['load'] || []).length, 0, '瓦片 load 监听必须被移除');
  assert.strictEqual(Object.keys(abortLayer.listeners['tileloadstart'] || []).length, 0, '瓦片 tileloadstart 监听必须被移除');

  // 4.7 withTimeout 具名监听器移除验证
  const testSignalController = new AbortController();
  let listenersCount = 0;
  const origAdd = testSignalController.signal.addEventListener.bind(testSignalController.signal);
  const origRemove = testSignalController.signal.removeEventListener.bind(testSignalController.signal);
  testSignalController.signal.addEventListener = (ev, fn, opts) => { listenersCount++; return origAdd(ev, fn, opts); };
  testSignalController.signal.removeEventListener = (ev, fn, opts) => { listenersCount--; return origRemove(ev, fn, opts); };
  await assert.rejects(
    withTimeout(new Promise((r) => setTimeout(r, 200)), 20, 'Task timed out', testSignalController.signal)
  );
  assert.strictEqual(listenersCount, 0, 'withTimeout 超时后必须移除 abort 监听器');

  // 4.8 escapeHtml 转义验证（防止长目的地名称 HTML 注入）
  const dangerousName = '<img src=x onerror=alert(1)> & "引号"';
  const escaped = escapeHtml(dangerousName);
  assert.doesNotMatch(escaped, /<img/);
  assert.match(escaped, /&lt;img/);
  assert.match(escaped, /&amp;/);
});

test('5. 吸收远端修复健壮性核验 (Absorbed d368e14 Fallbacks)', async () => {
  // 5.1 ensureRoundRect 降级回退验证
  const mockCtx = {
    moveToCalls: [],
    arcToCalls: [],
    closePathCalls: 0,
    moveTo(x, y) { this.moveToCalls.push([x, y]); },
    arcTo(x1, y1, x2, y2, r) { this.arcToCalls.push([x1, y1, x2, y2, r]); },
    closePath() { this.closePathCalls++; },
  };

  ensureRoundRect(mockCtx, 10, 20, 100, 50, 8);
  assert.strictEqual(mockCtx.moveToCalls.length, 1, '必须通过 moveTo 起笔');
  assert.strictEqual(mockCtx.arcToCalls.length, 4, '必须通过 4 次 arcTo 完成圆角');
  assert.strictEqual(mockCtx.closePathCalls, 1, '必须正常 closePath');

  // 5.2 canvasToBlob 在 toBlob 抛错或超时时的降级验证
  const mockFailingCanvas = {
    toBlob() {
      throw new Error('SecurityError: The canvas has been tainted by cross-origin data.');
    },
    toDataURL() {
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    },
  };

  const blob = await canvasToBlob(mockFailingCanvas);
  assert.ok(blob, 'canvasToBlob 在 toBlob 抛错时必须通过 toDataURL 成功降级生成 Blob');
  assert.strictEqual(blob.type, 'image/png');

  // 5.3 canvasToBlob 在 toBlob 回调迟迟不返回时的有界超时回退
  const mockHangingCanvas = {
    toBlob() {
      // 故意不调用 callback
    },
    toDataURL() {
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    },
  };

  const timeoutBlob = await canvasToBlob(mockHangingCanvas, 50);
  assert.ok(timeoutBlob, 'toBlob 挂死时必须在有界时间内回退为 toDataURL');
  assert.strictEqual(timeoutBlob.type, 'image/png');
});

test('6. copyShareLink 与 downloadBlob 执行及回退逻辑验证', async () => {
  const payload = createSharePayload({
    landmark: mockLandmark,
    profile: 'driving-car',
    rangeMinutes: [15, 30, 60],
    isochrones: mockIsochroneFeatures,
  });

  // 9.1 在未配置剪贴板的环境下，copyShareLink 安全返回 { success: false, url }
  const resInitial = await copyShareLink(payload, 'test_loc');
  assert.ok(typeof resInitial.success === 'boolean');
  assert.ok(resInitial.url.includes('name=%E5%AE%9C%E5%B1%B1%E8%B7%AF'));

  // 9.2 模拟支持 clipboard.writeText
  const origClipboardDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
  let copiedText = null;
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: {
      writeText: async (text) => { copiedText = text; },
    },
    configurable: true,
  });

  const resSuccess = await copyShareLink(payload, 'test_loc');
  assert.strictEqual(resSuccess.success, true);
  assert.ok(copiedText.includes('name=%E5%AE%9C%E5%B1%B1%E8%B7%AF'));

  // 恢复
  if (origClipboardDesc) {
    Object.defineProperty(globalThis.navigator, 'clipboard', origClipboardDesc);
  } else {
    delete globalThis.navigator.clipboard;
  }

  // 9.3 downloadBlob 在无 DOM 环境下的安全保护
  const dummyBlob = new Blob(['test'], { type: 'image/png' });
  const downloadResult = downloadBlob(dummyBlob, 'test.png');
  assert.strictEqual(downloadResult, false, '在无 document 环境下安全返回 false 不崩溃');
});

test('7. 真实生产导出控制器超时、中止与迟到任务防泄漏验证 (exportShareImage Lifecycle & Late Task Guard)', async () => {
  const payload = createSharePayload({
    landmark: mockLandmark,
    profile: 'driving-car',
    rangeMinutes: [15, 30, 60],
    isochrones: mockIsochroneFeatures,
  });

  let lateRenderAborted = false;
  let urlCreated = false;
  let successTracked = false;

  // 10.1 验证 overall timeout 发生时：内部 signal 触发 abort，late task 不创建 URL 也不发 success
  await assert.rejects(
    exportShareImage(payload, {
      timeoutMs: 35,
      deps: {
        renderSnapshot: async (_p, opts) => {
          await new Promise((r) => setTimeout(r, 80));
          lateRenderAborted = Boolean(opts.signal?.aborted);
          const canvas = {
            width: 960,
            height: 600,
            getContext: () => ({
              scale: () => {},
              fillRect: () => {},
              drawImage: () => {},
            }),
          };
          return canvas;
        },
        createObjectURL: () => {
          urlCreated = true;
          return 'blob:mock-late-url';
        },
        trackFn: (event) => {
          if (event === 'share_image_success') successTracked = true;
        },
      },
    }),
    (err) => err.message.includes('Image export overall timeout'),
    '导出控制器必须在整体超时后明确拒绝'
  );

  // 等待迟到任务跑完
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(lateRenderAborted, true, '底层渲染任务接收到的 signal 必须被 abort');
  assert.strictEqual(urlCreated, false, '超时后迟到完成的任务严禁调用 createObjectURL 创建无主 URL');
  assert.strictEqual(successTracked, false, '超时后迟到完成的任务严禁上报 share_image_success 埋点');

  // 10.2 验证调用者 signal 中止时，外部监听器被移除且不创建 URL
  const callerController = new AbortController();
  let callerListenersCount = 0;
  const origAdd = callerController.signal.addEventListener.bind(callerController.signal);
  const origRemove = callerController.signal.removeEventListener.bind(callerController.signal);
  callerController.signal.addEventListener = (ev, fn, opts) => { callerListenersCount++; return origAdd(ev, fn, opts); };
  callerController.signal.removeEventListener = (ev, fn, opts) => { callerListenersCount--; return origRemove(ev, fn, opts); };

  let abortUrlCreated = false;
  const callerAbortPromise = exportShareImage(payload, {
    signal: callerController.signal,
    timeoutMs: 5000,
    deps: {
      renderSnapshot: async () => {
        await new Promise((r) => setTimeout(r, 60));
        return {
          width: 960,
          height: 600,
          getContext: () => ({ scale: () => {}, fillRect: () => {}, drawImage: () => {} }),
        };
      },
      createObjectURL: () => { abortUrlCreated = true; return 'blob:abort-url'; },
    },
  });

  callerController.abort();
  await assert.rejects(
    callerAbortPromise,
    (err) => err.message.includes('Generation aborted')
  );

  assert.strictEqual(abortUrlCreated, false, '外部中止后严禁创建 ObjectURL');
  assert.strictEqual(callerListenersCount, 0, '外部 signal 的 abort 监听器在结束后必须被移除');
});

test('8. 生产等时圈绘制排序 Helper 验证 (sortIsochronesForRender: 任意输入顺序输出 60/30/15 且不变更原 payload)', async () => {
  const { sortIsochronesForRender } = await import('../src/data/isochrone-config.ts');

  const f15 = { properties: { value: 900, name: '15m' } };
  const f30 = { properties: { value: 1800, name: '30m' } };
  const f60 = { properties: { value: 3600, name: '60m' } };

  // 11.1 正序输入 [15, 30, 60] -> 必须降序输出 [60, 30, 15]（大圈先画，小圈后画）
  const inputAscending = [f15, f30, f60];
  const sorted1 = sortIsochronesForRender(inputAscending);
  assert.deepStrictEqual(sorted1.map(f => f.properties.value), [3600, 1800, 900]);
  assert.deepStrictEqual(sorted1.map(f => f.properties.name), ['60m', '30m', '15m']);

  // 11.2 乱序输入 [30, 60, 15] -> 必须输出 [60, 30, 15]
  const inputShuffled = [f30, f60, f15];
  const sorted2 = sortIsochronesForRender(inputShuffled);
  assert.deepStrictEqual(sorted2.map(f => f.properties.value), [3600, 1800, 900]);

  // 11.3 纯函数契约：原数组绝不被原位修改
  assert.deepStrictEqual(inputAscending.map(f => f.properties.name), ['15m', '30m', '60m'], '输入数组顺序严禁被原地 mutation 破坏');
  assert.notStrictEqual(sorted1, inputAscending, '必须返回新浅拷贝数组，不得返回原数组引用');

  // 11.4 容错测试：空数组与非数组保护
  assert.deepStrictEqual(sortIsochronesForRender([]), []);
  assert.deepStrictEqual(sortIsochronesForRender(null), []);
  assert.deepStrictEqual(sortIsochronesForRender(undefined), []);
});

test('9. 样式单一来源与契约验证 (isochrone-config.ts 单一配置源与 LAYER_COLOR_MAP 联动)', async () => {
  const {
    isochroneColors,
    getColorForRange,
    getIsochroneStyle,
    DESTINATION_STYLE,
  } = await import('../src/data/isochrone-config.ts');
  const { LAYER_COLOR_MAP, groupPOIsByLayer } = await import('../src/lib/poi-utils.ts');

  // 三档色相与线型区分；地图和导出共用同一配置。
  assert.strictEqual(isochroneColors.length, 3);
  const [style15, style30, style60] = [15, 30, 60].map(getColorForRange);
  assert.deepEqual([style15.color, style30.color, style60.color], ['#ff4b23', '#2563eb', '#60a5fa']);
  assert.ok(style15.opacity > style30.opacity);
  assert.ok(style30.opacity > style60.opacity);
  const fullStyles = [15, 30, 60].map(getIsochroneStyle);
  assert.deepEqual(fullStyles.map(s => s.dashArray), [undefined, undefined, undefined]);
  assert.ok(fullStyles.every(s => s.strokeOpacity === 0.95));

  // 12.4 LAYER_COLOR_MAP 必须与单一事实源动态对齐
  assert.strictEqual(LAYER_COLOR_MAP[15]?.color, style15.color);
  assert.strictEqual(LAYER_COLOR_MAP[30]?.color, style30.color);
  assert.strictEqual(LAYER_COLOR_MAP[60]?.color, style60.color);

  // 12.5 groupPOIsByLayer 分组颜色必须直接消费同一单一配置源
  const testPoints = [
    ...mockPOIs,
    {
      id: 'poi-disney',
      name: '上海迪士尼度假区',
      city: '上海',
      coordinates: [121.6578, 31.1415],
      category: 'tourism',
    },
  ];
  const grouped = groupPOIsByLayer(testPoints, mockIsochroneFeatures, [15, 30, 60]);
  assert.strictEqual(grouped.find(g => g.layerMinutes === 15)?.color, style15.color);
  assert.strictEqual(grouped.find(g => g.layerMinutes === 30)?.color, style30.color);
  assert.strictEqual(grouped.find(g => g.layerMinutes === 60)?.color, style60.color);

  // 12.6 目的地样式契约：深色标记与圈层区分
  assert.strictEqual(DESTINATION_STYLE.ink, '#111827');
  assert.strictEqual(DESTINATION_STYLE.badgeBg, '#111827');
  assert.strictEqual(DESTINATION_STYLE.badgeText, '#ffffff');
  assert.strictEqual(DESTINATION_STYLE.stroke, '#ffffff');
});

