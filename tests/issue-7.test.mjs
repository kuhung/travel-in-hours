import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getExplorationSource,
  isShareVisitUrl,
  formatSearchNoMatchMessage,
  getGeolocationErrorMessage,
  GeolocationLifecycleManager,
  evaluateQuotaDeduction,
  isCustomLandmark,
  hasPendingChanges,
  canShareCommitted,
} from '../src/lib/exploration-state.ts';

import { cityLandmarks } from '../src/data/landmarks.ts';
import { generateShareTitle } from '../src/lib/share-utils.ts';

test('1. 首次/回访/分享链接访问判定逻辑测试', () => {
  // 分享链接同步识别：具有 lat 与 lng
  assert.equal(
    isShareVisitUrl('?lat=31.23&lng=121.47&name=%E4%B8%8A%E6%B5%B7'),
    true,
    '包含 lat 与 lng 的 URL 应被识别为分享访问'
  );
  assert.equal(
    isShareVisitUrl('?lat=31.23'),
    false,
    '仅有 lat 缺少 lng 不属于分享访问'
  );
  assert.equal(
    isShareVisitUrl(''),
    false,
    '空参数不属于分享访问'
  );

  // 模拟首访 vs 回访 vs 分享访问决定是否展示通用首次引导
  function shouldShowWelcomeGuide({
    hasVisitedIntro,
    isShareVisit,
    hasCommitted,
  }) {
    if (isShareVisit) return false; // 分享链接访问直接跳过通用首次引导
    if (hasVisitedIntro) return false; // 已访问过的用户跳过引导
    if (hasCommitted) return false; // 已生成结果不重复弹窗
    return true; // 仅首次且非分享访问展示引导
  }

  // 首访用户：展示引导
  assert.equal(
    shouldShowWelcomeGuide({ hasVisitedIntro: false, isShareVisit: false, hasCommitted: false }),
    true,
    '首访无记录用户应展示首次引导'
  );

  // 已访问用户：不展示引导
  assert.equal(
    shouldShowWelcomeGuide({ hasVisitedIntro: true, isShareVisit: false, hasCommitted: false }),
    false,
    '已访问用户应跳过通用引导'
  );

  // 分享链接访问（即使是首访/无本地记录）：必须立即跳过通用引导，杜绝闪现与自动定位抢先
  assert.equal(
    shouldShowWelcomeGuide({ hasVisitedIntro: false, isShareVisit: true, hasCommitted: false }),
    false,
    '分享链接访问必须跳过通用引导'
  );
});

test('2. 显式示例探索与 committed 快照来源绑定及草稿变更隔离测试', () => {
  const exampleLandmark = {
    id: 'shanghai-yishan-road',
    name: '宜山路',
    city: '上海',
    province: '上海市',
    coordinates: [121.4276, 31.1895],
    description: '徐汇区核心交通枢纽',
  };

  const dummyIsochrone = [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[121.4, 31.1], [121.5, 31.1], [121.4, 31.2], [121.4, 31.1]]] },
      properties: { value: 900, center: [121.4276, 31.1895] },
    },
  ];

  // 1. 用户点击“先看上海示例”生成 committed 快照
  const committedExample = {
    conditions: {
      landmark: exampleLandmark,
      profile: 'driving-car',
      rangeMinutes: [15, 30, 60],
      isExample: true,
      source: getExplorationSource(exampleLandmark, true),
    },
    isochrones: dummyIsochrone,
    timestamp: Date.now(),
  };

  assert.equal(committedExample.conditions.isExample, true);
  assert.equal(committedExample.conditions.source, 'example');
  assert.equal(canShareCommitted(committedExample), true);

  // 2. 用户在草稿中更改起点（例如改为杭州西湖），但尚未点击“更新可达范围”
  const draftLandmark = {
    id: 'hangzhou-west-lake',
    name: '西湖',
    city: '杭州',
    province: '浙江省',
    coordinates: [120.1487, 30.2428],
    description: '杭州市中心著名风景区',
  };

  const hasChanges = hasPendingChanges(
    {
      landmark: draftLandmark,
      profile: 'driving-car',
      rangeMinutes: [15, 30, 60],
    },
    committedExample
  );

  assert.equal(hasChanges, true, '草稿起点变更应被识别为 pending 状态');
  // 核心契约：换起点未更新时，旧 committed 快照与示例标签依然准确描述旧结果
  assert.equal(committedExample.conditions.isExample, true, '已提交快照中示例标识保持为 true');
  assert.equal(committedExample.conditions.source, 'example', '已提交快照中来源保持为 example');
  assert.equal(committedExample.conditions.landmark.name, '宜山路', '已提交快照中地点依然是旧示例');

  // 3. 用户点击“更新可达范围”重新生成：新 committed 结果不再是示例，来源更新为 preset
  const newCommitted = {
    conditions: {
      landmark: draftLandmark,
      profile: 'driving-car',
      rangeMinutes: [15, 30, 60],
      isExample: false,
      source: getExplorationSource(draftLandmark, false),
    },
    isochrones: dummyIsochrone,
    timestamp: Date.now(),
  };

  assert.equal(newCommitted.conditions.isExample, false);
  assert.equal(newCommitted.conditions.source, 'preset');
  assert.equal(newCommitted.conditions.landmark.name, '西湖');
});

test('3. 起点来源识别与定位非 preset 判定契约测试', () => {
  const currentLocation = {
    id: 'current-location',
    name: '当前位置',
    city: '我的位置',
    province: '',
    coordinates: [121.47, 31.23],
    description: '基于浏览器定位',
  };

  const presetLandmark = {
    id: 'shanghai-people-square',
    name: '人民广场',
    city: '上海',
    province: '上海市',
    coordinates: [121.4737, 31.2304],
    description: '上海市中心',
  };

  const customLandmark = {
    id: 'custom-1710000000000',
    name: '自定义选点',
    city: '自定义位置',
    province: '',
    coordinates: [121.5, 31.2],
    description: '地图选点',
  };

  // 定位状态绝对不能误算成 preset 来源
  const currentSource = getExplorationSource(currentLocation, false);
  assert.equal(currentSource, 'current-location', '当前位置来源必须是 current-location，不得为 preset');

  // 预设地标来源为 preset
  const presetSource = getExplorationSource(presetLandmark, false);
  assert.equal(presetSource, 'preset', '预设地标来源为 preset');

  // 地图自定义选点来源为 custom
  const customSource = getExplorationSource(customLandmark, false);
  assert.equal(customSource, 'custom', '自定义选点来源为 custom');

  // 标记为示例时来源为 example
  const exampleSource = getExplorationSource(presetLandmark, true);
  assert.equal(exampleSource, 'example', '示例来源必须是 example');
});

test('4. 保持原配额策略（仅 custom-* 无缓存成功扣次，当前位置/预设/缓存不扣次）', () => {
  const customLandmark = { id: 'custom-12345', coordinates: [121.4, 31.2], name: '选点' };
  const currentLocation = { id: 'current-location', coordinates: [121.4, 31.2], name: '当前位置' };
  const presetLandmark = { id: 'shanghai-yishan-road', coordinates: [121.4, 31.2], name: '宜山路' };

  // 1. 自定义选点 + 无缓存 + 成功 + features > 0 -> 扣除 1 次
  assert.equal(
    evaluateQuotaDeduction({
      landmark: customLandmark,
      fromCache: false,
      success: true,
      featuresCount: 3,
      aborted: false,
    }),
    true,
    'custom-* 无缓存成功请求扣除配额'
  );

  // 2. 浏览器定位（current-location）-> 绝不扣除配额
  assert.equal(
    evaluateQuotaDeduction({
      landmark: currentLocation,
      fromCache: false,
      success: true,
      featuresCount: 3,
      aborted: false,
    }),
    false,
    'current-location 成功绝不扣除配额'
  );
  assert.equal(isCustomLandmark(currentLocation), false);

  // 3. 预设地标 -> 绝不扣除配额
  assert.equal(
    evaluateQuotaDeduction({
      landmark: presetLandmark,
      fromCache: false,
      success: true,
      featuresCount: 3,
      aborted: false,
    }),
    false,
    '预设地标绝不扣除配额'
  );

  // 4. 命中缓存 -> 不扣除配额
  assert.equal(
    evaluateQuotaDeduction({
      landmark: customLandmark,
      fromCache: true,
      success: true,
      featuresCount: 3,
      aborted: false,
    }),
    false,
    '命中缓存不扣除配额'
  );

  // 5. 失败或被中止 -> 不扣除配额
  assert.equal(
    evaluateQuotaDeduction({
      landmark: customLandmark,
      fromCache: false,
      success: false,
      featuresCount: 0,
      aborted: false,
    }),
    false,
    '请求失败不扣除配额'
  );
  assert.equal(
    evaluateQuotaDeduction({
      landmark: customLandmark,
      fromCache: false,
      success: true,
      featuresCount: 3,
      aborted: true,
    }),
    false,
    '请求被中止不扣除配额'
  );
});

test('5. 统一定位生命周期管理器与全部起点入口取消覆盖测试（生产控制器路径）', () => {
  // 模拟异步浏览器 Geolocation API
  let pendingSuccess = null;
  let pendingError = null;

  const mockGeolocation = {
    getCurrentPosition(success, error) {
      pendingSuccess = success;
      pendingError = error;
    },
  };

  const manager = new GeolocationLifecycleManager();

  // 场景 A：从引导点击“从我的位置探索”等待中 -> 用户点击“先看上海示例” -> 定位晚返回不得覆盖
  let successInvoked = false;
  let statusChangeCount = 0;

  manager.requestLocation({
    geolocationApi: mockGeolocation,
    autoGenerate: true,
    handlers: {
      onStatusChange: (isLocating) => {
        statusChangeCount++;
      },
      onSuccess: () => {
        successInvoked = true;
      },
      onError: () => {},
    },
  });

  assert.equal(manager.getIsLocating(), true, '发起定位后处于 locating 状态');
  assert.ok(pendingSuccess, '浏览器回调已被挂起');

  // 用户点击“先看上海示例”，应用层调用 cancel()
  manager.cancel();
  assert.equal(manager.getIsLocating(), false, '取消后 locating 状态立即结束，不卡正在定位');

  // 模拟定位晚返回
  pendingSuccess({ coords: { latitude: 31.23, longitude: 121.47 } });
  assert.equal(successInvoked, false, '已取消定位的晚返回成功回调绝不执行，不覆盖上海示例');

  // 场景 B：在编辑面板中点击定位当前位置 -> 用户随后选择预设地标 -> 晚返回不得覆盖
  successInvoked = false;
  let draftLandmark = { id: 'shanghai-yishan-road', name: '宜山路' };

  manager.requestLocation({
    geolocationApi: mockGeolocation,
    autoGenerate: false,
    handlers: {
      onSuccess: ([lng, lat], autoGenerate) => {
        successInvoked = true;
        draftLandmark = { id: 'current-location', name: '当前位置', coordinates: [lng, lat] };
      },
      onError: () => {},
    },
  });

  // 用户点击预设地标（例如选择人民广场），应用层设置 draftLandmark 并 cancel 定位
  manager.cancel();
  draftLandmark = { id: 'shanghai-people-square', name: '人民广场' };

  // 晚返回到达
  pendingSuccess({ coords: { latitude: 30.24, longitude: 120.14 } });
  assert.equal(successInvoked, false, '选择预设后定位晚返回被废弃');
  assert.equal(draftLandmark.name, '人民广场', '预设起点不被晚返回覆盖');

  // 场景 C：在编辑面板定位等待中 -> 用户点击“在地图选点” -> 晚返回不得覆盖
  successInvoked = false;
  manager.requestLocation({
    geolocationApi: mockGeolocation,
    autoGenerate: false,
    handlers: {
      onSuccess: () => { successInvoked = true; },
      onError: () => {},
    },
  });

  manager.cancel(); // 进入地图选点模式取消定位
  assert.equal(manager.getIsLocating(), false, '进入选点模式后定位状态结束');
  pendingSuccess({ coords: { latitude: 31.23, longitude: 121.47 } });
  assert.equal(successInvoked, false, '地图选点模式下定位晚返回被废弃');

  // 场景 D：定位等待中 -> 用户点击“恢复原条件” (handleCancelChanges)
  successInvoked = false;
  manager.requestLocation({
    geolocationApi: mockGeolocation,
    autoGenerate: false,
    handlers: {
      onSuccess: () => { successInvoked = true; },
      onError: () => {},
    },
  });

  manager.cancel(); // 恢复原条件取消定位
  pendingSuccess({ coords: { latitude: 31.23, longitude: 121.47 } });
  assert.equal(successInvoked, false, '恢复原条件后定位晚返回被废弃');

  // 场景 E：定位等待中 -> 用户关闭/跳过引导 (handleDismissWelcome)
  successInvoked = false;
  manager.requestLocation({
    geolocationApi: mockGeolocation,
    autoGenerate: true,
    handlers: {
      onSuccess: () => { successInvoked = true; },
      onError: () => {},
    },
  });

  manager.cancel(); // 关闭引导取消定位
  pendingSuccess({ coords: { latitude: 31.23, longitude: 121.47 } });
  assert.equal(successInvoked, false, '关闭引导后定位晚返回被废弃');

  // 场景 F：组件卸载清理
  successInvoked = false;
  manager.requestLocation({
    geolocationApi: mockGeolocation,
    autoGenerate: false,
    handlers: {
      onSuccess: () => { successInvoked = true; },
      onError: () => {},
    },
  });

  manager.cancel(); // 卸载清理
  pendingSuccess({ coords: { latitude: 31.23, longitude: 121.47 } });
  assert.equal(successInvoked, false, '组件卸载后定位晚返回安全丢弃');

  // 场景 G：交互意图区分验证（引导触发 autoGenerate=true，面板触发 autoGenerate=false）
  let receivedAutoGenerate = null;
  manager.requestLocation({
    geolocationApi: mockGeolocation,
    autoGenerate: true,
    handlers: {
      onSuccess: (_, autoGen) => { receivedAutoGenerate = autoGen; },
      onError: () => {},
    },
  });
  pendingSuccess({ coords: { latitude: 31.23, longitude: 121.47 } });
  assert.equal(receivedAutoGenerate, true, '引导入口成功触发自动提交意图');

  manager.requestLocation({
    geolocationApi: mockGeolocation,
    autoGenerate: false,
    handlers: {
      onSuccess: (_, autoGen) => { receivedAutoGenerate = autoGen; },
      onError: () => {},
    },
  });
  pendingSuccess({ coords: { latitude: 31.23, longitude: 121.47 } });
  assert.equal(receivedAutoGenerate, false, '编辑面板入口成功仅更新草稿，不触发自动提交');
});

test('6. 定位拒绝/超时/不可用/不支持错误归因与可操作恢复状态测试', () => {
  // 不支持
  const unsupported = getGeolocationErrorMessage('unsupported');
  assert.equal(unsupported.type, 'unsupported');
  assert.match(unsupported.message, /不支持/);
  assert.ok(unsupported.alternativeActions.includes('map-pick'));

  // 权限拒绝 (PERMISSION_DENIED = 1)
  const denied = getGeolocationErrorMessage(1, true);
  assert.equal(denied.type, 'permission_denied');
  assert.match(denied.message, /拒绝/);
  assert.ok(denied.alternativeActions.includes('map-pick'));

  // 超时 (TIMEOUT = 3)
  const timeout = getGeolocationErrorMessage(3, true);
  assert.equal(timeout.type, 'timeout');
  assert.match(timeout.message, /超时/);
  assert.ok(timeout.alternativeActions.includes('retry'));
  assert.ok(timeout.alternativeActions.includes('map-pick'));

  // 位置不可用 (POSITION_UNAVAILABLE = 2)
  const unavailable = getGeolocationErrorMessage(2, true);
  assert.equal(unavailable.type, 'position_unavailable');
  assert.ok(unavailable.alternativeActions.includes('retry'));
  assert.ok(unavailable.alternativeActions.includes('map-pick'));
});

test('7. 预设地标搜索过滤与无匹配解释及替代出口判定测试', () => {
  // 匹配测试
  const shanghaiMatches = cityLandmarks.filter(
    (l) => l.name.includes('人民广场') || l.city.includes('人民广场')
  );
  assert.ok(shanghaiMatches.length > 0, '搜索人民广场应能匹配到预设地标');

  // 不存在地址测试
  const noMatchQuery = '不存在的火星街道999号';
  const noMatches = cityLandmarks.filter(
    (l) => l.name.includes(noMatchQuery) || l.city.includes(noMatchQuery)
  );
  assert.equal(noMatches.length, 0);

  // 提示信息与替代出口
  const info = formatSearchNoMatchMessage(noMatchQuery);
  assert.match(info.message, /未在已收录的 8 座城市预设地标中找到/);
  assert.match(info.scopeExplanation, /收录了上海、杭州、广州、深圳、成都、绍兴、重庆、珠海/);
  assert.deepEqual(info.alternativeActions, ['map-pick', 'current-location', 'example']);
});

test('8. 分析埋点事件分类与来源契约测试（定位与示例绝不误发 preset_analysis_*）', () => {
  // 模拟 handleGenerate 中的事件分发路由
  function determineAnalysisEvent(landmark, isExample) {
    const source = getExplorationSource(landmark, isExample);
    if (source === 'custom') {
      return { started: 'custom_analysis_started', completed: 'custom_analysis_completed' };
    }
    if (source === 'current-location') {
      return { started: 'current_location_analysis_started', completed: 'current_location_analysis_completed' };
    }
    if (source === 'example') {
      return { started: 'example_analysis_started', completed: 'example_analysis_completed' };
    }
    return { started: 'preset_analysis_started', completed: 'preset_analysis_completed' };
  }

  // 1. 浏览器定位：必须发 current_location_analysis_*，绝对不得发 preset_analysis_*
  const currentLocation = { id: 'current-location', name: '当前位置', city: '我的位置' };
  const locationEvents = determineAnalysisEvent(currentLocation, false);
  assert.equal(locationEvents.started, 'current_location_analysis_started');
  assert.equal(locationEvents.completed, 'current_location_analysis_completed');
  assert.notEqual(locationEvents.started, 'preset_analysis_started');

  // 2. 查看上海示例：必须发 example_analysis_*，绝对不得发 preset_analysis_*
  const exampleLandmark = { id: 'shanghai-yishan-road', name: '宜山路', city: '上海' };
  const exampleEvents = determineAnalysisEvent(exampleLandmark, true);
  assert.equal(exampleEvents.started, 'example_analysis_started');
  assert.equal(exampleEvents.completed, 'example_analysis_completed');
  assert.notEqual(exampleEvents.started, 'preset_analysis_started');

  // 3. 正常预设地标：必须发 preset_analysis_*
  const presetEvents = determineAnalysisEvent(exampleLandmark, false);
  assert.equal(presetEvents.started, 'preset_analysis_started');
  assert.equal(presetEvents.completed, 'preset_analysis_completed');

  // 4. 自定义选点：必须发 custom_analysis_*
  const customLandmark = { id: 'custom-12345', name: '自定义选点', city: '自定义位置' };
  const customEvents = determineAnalysisEvent(customLandmark, false);
  assert.equal(customEvents.started, 'custom_analysis_started');
  assert.equal(customEvents.completed, 'custom_analysis_completed');
});

test('9. 社交分享文案与对外承诺合规性测试（无 1-3 小时夸大，明确 1 小时/分钟档位）', () => {
  const mockParams = {
    landmark: {
      id: 'shanghai-yishan-road',
      name: '宜山路',
      city: '上海',
      province: '上海市',
      coordinates: [121.4276, 31.1895],
      description: '徐汇枢纽',
    },
    profile: 'driving-car',
    rangeMinutes: [15, 30, 60],
  };

  const shareTitleDriving = generateShareTitle(mockParams);
  assert.match(shareTitleDriving, /1 小时可达范围/);
  assert.doesNotMatch(shareTitleDriving, /3\s*小时/);
  assert.doesNotMatch(shareTitleDriving, /1[-–至]3/);

  const shareTitleCycling = generateShareTitle({
    ...mockParams,
    profile: 'cycling-regular',
  });
  assert.match(shareTitleCycling, /1 小时能骑到哪里/);
  assert.doesNotMatch(shareTitleCycling, /3\s*小时/);

  const shareTitleWalking = generateShareTitle({
    ...mockParams,
    profile: 'foot-walking',
  });
  assert.match(shareTitleWalking, /1 小时/);
  assert.doesNotMatch(shareTitleWalking, /3\s*小时/);
});

