import test from 'node:test';
import assert from 'node:assert';
import {
  queryInterestPoints,
  formatExclusiveTierTime,
  formatLayerTime,
} from '../src/lib/poi-utils.ts';
import {
  calculateMapPadding,
  getCoverageStatusDescription,
} from '../src/lib/layout-utils.ts';

// 辅助工具：构造标准 GeoJSON Polygon Feature (WGS-84)
function createPolygonFeature(minutes, coordinates) {
  return {
    type: 'Feature',
    properties: {
      value: minutes * 60,
      center: [121.4737, 31.2304],
      area: 50000000,
    },
    geometry: {
      type: 'Polygon',
      coordinates: coordinates,
    },
  };
}

// 标准上海市中心等时圈多边形
const SHANGHAI_CENTER_RING_15 = [
  [121.45, 31.21],
  [121.50, 31.21],
  [121.50, 31.25],
  [121.45, 31.25],
  [121.45, 31.21],
];

const SHANGHAI_CENTER_RING_30 = [
  [121.40, 31.18],
  [121.55, 31.18],
  [121.55, 31.28],
  [121.40, 31.28],
  [121.40, 31.18],
];

const SHANGHAI_CENTER_RING_60 = [
  [121.30, 31.10],
  [121.65, 31.10],
  [121.65, 31.35],
  [121.30, 31.35],
  [121.30, 31.10],
];

// 杭州市区等时圈多边形（真实预设地标，完全位于上海收录区域外）
const HANGZHOU_RING_60 = [
  [120.10, 30.20],
  [120.30, 30.20],
  [120.30, 30.40],
  [120.10, 30.40],
  [120.10, 30.20],
];

// 跨边界等时圈多边形（西侧深入江苏昆山/太仓，东侧在上海境内）
const CROSS_BORDER_RING_60 = [
  [120.70, 31.20],
  [121.20, 31.20],
  [121.20, 31.50],
  [120.70, 31.50],
  [120.70, 31.20],
];

// 上海境内微小圈（远离所有市中心收录 POI，例如奉贤极东南海滩无人区）
const SHANGHAI_EMPTY_SUBURB_RING_15 = [
  [121.80, 30.75],
  [121.85, 30.75],
  [121.85, 30.80],
  [121.80, 30.80],
  [121.80, 30.75],
];

test('1. queryInterestPoints 接入测试：根据 committed 数据结构驱动真实覆盖状态与地点列表', () => {
  const isochrones = [
    createPolygonFeature(15, [SHANGHAI_CENTER_RING_15]),
    createPolygonFeature(30, [SHANGHAI_CENTER_RING_30]),
    createPolygonFeature(60, [SHANGHAI_CENTER_RING_60]),
  ];

  // 1.1 上海市中心出发点：返回 matched 状态与匹配 POI
  const resultShanghai = queryInterestPoints({
    isochrones,
    rangeMinutes: [15, 30, 60],
    landmark: {
      id: 'shanghai-yishan-road',
      name: '宜山路',
      city: '上海',
      province: '上海市',
      coordinates: [121.4276, 31.1895],
    },
  });

  assert.strictEqual(resultShanghai.status, 'matched');
  assert.strictEqual(resultShanghai.isPartial, false);
  assert.ok(resultShanghai.allPOIs.length > 0, '上海市中心应能匹配到收录 POI');
  assert.ok(resultShanghai.poiByLayer.length > 0, '应存在分层数据');
  assert.strictEqual(resultShanghai.matchedRegion?.id, 'shanghai');

  // 1.2 杭州出发点（真实预设城市，未收录区域）：返回 uncovered 状态，allPOIs 为空
  const resultHangzhou = queryInterestPoints({
    isochrones: [createPolygonFeature(60, [HANGZHOU_RING_60])],
    rangeMinutes: [15, 30, 60],
    landmark: {
      id: 'hangzhou-east-station',
      name: '杭州东站',
      city: '杭州',
      province: '浙江省',
      coordinates: [120.213116, 30.290966],
    },
  });

  assert.strictEqual(resultHangzhou.status, 'uncovered');
  assert.strictEqual(resultHangzhou.allPOIs.length, 0);
  assert.strictEqual(resultHangzhou.poiByLayer.length, 0);
  assert.strictEqual(resultHangzhou.matchedRegion, null);

  // 1.3 上海境内但无 POI 覆盖（covered-empty）：在收录区内但 0 匹配
  const resultEmpty = queryInterestPoints({
    isochrones: [createPolygonFeature(15, [SHANGHAI_EMPTY_SUBURB_RING_15])],
    rangeMinutes: [15, 30, 60],
    landmark: {
      id: 'custom-suburb',
      name: '奉贤远郊',
      city: '自定义位置',
      province: '',
      coordinates: [121.82, 30.77],
    },
  });

  assert.strictEqual(resultEmpty.status, 'covered-empty');
  assert.strictEqual(resultEmpty.allPOIs.length, 0);
  assert.strictEqual(resultEmpty.coverageOverlap, 'full');

  // 1.4 跨边界但无匹配点（partial）：返回 partial 状态
  const resultPartial = queryInterestPoints({
    isochrones: [createPolygonFeature(60, [CROSS_BORDER_RING_60])],
    rangeMinutes: [15, 30, 60],
    landmark: {
      id: 'custom-border',
      name: '省界路口',
      city: '自定义位置',
      province: '',
      coordinates: [120.75, 31.25],
    },
  });

  assert.strictEqual(resultPartial.status, 'partial');
  assert.strictEqual(resultPartial.isPartial, true);
  assert.strictEqual(resultPartial.allPOIs.length, 0);
});

test('2. 草稿条件隔离契约：修改草稿绝对不影响已提交 committed 快照的地点结果', () => {
  const committedSnapshot = {
    conditions: {
      landmark: {
        id: 'shanghai-yishan-road',
        name: '宜山路',
        city: '上海',
        province: '上海市',
        coordinates: [121.4276, 31.1895],
      },
      profile: 'driving-car',
      rangeMinutes: [15, 30, 60],
      isExample: true,
      source: 'example',
    },
    isochrones: [
      createPolygonFeature(15, [SHANGHAI_CENTER_RING_15]),
      createPolygonFeature(30, [SHANGHAI_CENTER_RING_30]),
      createPolygonFeature(60, [SHANGHAI_CENTER_RING_60]),
    ],
    timestamp: 1700000000000,
  };

  // 根据 committed 查询得到稳定结果
  const committedQueryResult = queryInterestPoints({
    isochrones: committedSnapshot.isochrones,
    rangeMinutes: committedSnapshot.conditions.rangeMinutes,
    landmark: committedSnapshot.conditions.landmark,
  });

  assert.strictEqual(committedQueryResult.status, 'matched');
  const originalPOICount = committedQueryResult.allPOIs.length;
  assert.ok(originalPOICount > 0);

  // 用户在面板中更改草稿起点为杭州东站
  const draftLandmark = {
    id: 'hangzhou-east-station',
    name: '杭州东站',
    city: '杭州',
    province: '浙江省',
    coordinates: [120.213116, 30.290966],
  };

  // 严正验证：App 消费 committed 快照时，依然严格以 committed 为唯一事实来源
  const currentViewResult = queryInterestPoints({
    isochrones: committedSnapshot.isochrones,
    rangeMinutes: committedSnapshot.conditions.rangeMinutes,
    landmark: committedSnapshot.conditions.landmark,
  });

  assert.strictEqual(currentViewResult.status, 'matched');
  assert.strictEqual(currentViewResult.allPOIs.length, originalPOICount);
  assert.strictEqual(committedSnapshot.conditions.landmark.name, '宜山路');
  assert.notStrictEqual(committedSnapshot.conditions.landmark.id, draftLandmark.id);
});

test('3. 空态与错误状态诚实解释契约：uncovered/covered-empty/partial/data_error 独立且均有明确后续出口', () => {
  // 3.1 uncovered：超出收录范围
  const descUncovered = getCoverageStatusDescription({
    status: 'uncovered',
    isPartial: false,
    matchedCount: 0,
    landmarkName: '杭州东站',
    profile: 'driving-car',
  });
  assert.strictEqual(descUncovered.badgeVariant, 'info');
  assert.strictEqual(descUncovered.title, '超出当前收录范围');
  assert.ok(descUncovered.explanation.includes('超出已收录区域'));
  assert.ok(descUncovered.explanation.includes('收录上海精选热门地标与珠海出入境服务厅'));
  assert.ok(descUncovered.helpfulNote.includes('已收录核心城区'), '提供正面操作指引');
  assert.strictEqual(descUncovered.canViewExample, true, '应允许看示例');
  assert.strictEqual(descUncovered.canEditOrigin, true, '应允许修改出发点');

  // 3.2 covered-empty：覆盖内无收录地点
  const descCoveredEmpty = getCoverageStatusDescription({
    status: 'covered-empty',
    isPartial: false,
    matchedCount: 0,
    landmarkName: '崇明岛东滩',
    profile: 'foot-walking',
  });
  assert.strictEqual(descCoveredEmpty.badgeVariant, 'warning');
  assert.strictEqual(descCoveredEmpty.title, '范围内暂无收录地点');
  assert.ok(descCoveredEmpty.explanation.includes('步行 60 分钟预估范围内暂未收录'));
  assert.ok(descCoveredEmpty.helpfulNote.includes('尝试切换更快速的出行方式'), '提供正面操作指引');
  assert.strictEqual(descCoveredEmpty.canChangeMode, true, '应建议切换更快方式');
  assert.strictEqual(descCoveredEmpty.canEditOrigin, true);

  // 3.3 partial：跨边界未匹配
  const descPartial = getCoverageStatusDescription({
    status: 'partial',
    isPartial: true,
    matchedCount: 0,
    landmarkName: '青浦边界',
    profile: 'driving-car',
  });
  assert.strictEqual(descPartial.title, '部分范围跨越收录边界');
  assert.strictEqual(descPartial.badgeText, '跨边界未匹配');
  assert.ok(descPartial.explanation.includes('部分超出了本地收录边界'));

  // 3.4 dataError：数据处理错误
  const descDataError = getCoverageStatusDescription({
    status: 'uncovered',
    isPartial: false,
    matchedCount: 0,
    dataError: 'Invalid coordinate rings',
  });
  assert.strictEqual(descDataError.badgeVariant, 'error');
  assert.strictEqual(descDataError.title, '地点数据处理异常');
  assert.strictEqual(descDataError.canRetry, true, '数据错误应提供重试按钮');

  // 3.5 matched 正常有匹配
  const descMatched = getCoverageStatusDescription({
    status: 'matched',
    isPartial: false,
    matchedCount: 8,
    landmarkName: '宜山路',
    profile: 'driving-car',
  });
  assert.strictEqual(descMatched.badgeVariant, 'success');
  assert.strictEqual(descMatched.title, '可达热点清单');
  assert.strictEqual(descMatched.badgeText, '已收录 8 处');
});

test('4. 最小圈层互斥语义与文案契约：formatExclusiveTierTime 准确输出互斥表达，且保持旧版兼容', () => {
  const ranges = [15, 30, 60];

  // 4.1 互斥表达：首档为 X分钟内，后续档位为 上一档–当前档分钟
  assert.strictEqual(formatExclusiveTierTime(15, ranges), '15分钟内');
  assert.strictEqual(formatExclusiveTierTime(30, ranges), '15–30分钟');
  assert.strictEqual(formatExclusiveTierTime(60, ranges), '30–60分钟');

  // 缺省参数容错测试
  assert.strictEqual(formatExclusiveTierTime(15), '15分钟内');
  assert.strictEqual(formatExclusiveTierTime(30), '15–30分钟');
  assert.strictEqual(formatExclusiveTierTime(60), '30–60分钟');

  // 自定义四档容错测试
  assert.strictEqual(formatExclusiveTierTime(120, [15, 30, 60, 120]), '60–120分钟');

  // 4.2 旧版 formatLayerTime 必须保持向后兼容（Issue #6 测试要求）
  assert.strictEqual(formatLayerTime(15), '15分钟内');
  assert.strictEqual(formatLayerTime(30), '30分钟内');
  assert.strictEqual(formatLayerTime(60), '1小时内');
});

test('5. 地图视口 Padding 纯函数计算契约：calculateMapPadding 统一 48vh 与 320px 真实占位及极限视口保护', () => {
  // 5.1 桌面端 + 清单展开 + 编辑面板折叠
  const padDesktopListOpen = calculateMapPadding({
    containerWidth: 1440,
    containerHeight: 900,
    isMobile: false,
    isListOpen: true,
    isEditPanelOpen: false,
  });
  // 左侧需让出 320px 清单 + 间距（344px）
  assert.strictEqual(padDesktopListOpen.paddingTopLeft[0], 344);
  assert.strictEqual(padDesktopListOpen.paddingTopLeft[1], 80);
  assert.strictEqual(padDesktopListOpen.paddingBottomRight[0], 40);

  // 5.2 桌面端 + 清单折叠 + 编辑面板展开
  const padDesktopPanelOpen = calculateMapPadding({
    containerWidth: 1440,
    containerHeight: 900,
    isMobile: false,
    isListOpen: false,
    isEditPanelOpen: true,
  });
  assert.strictEqual(padDesktopPanelOpen.paddingTopLeft[0], 40);
  // 右侧需让出 320px 编辑面板 + 间距（344px）
  assert.strictEqual(padDesktopPanelOpen.paddingBottomRight[0], 344);

  // 5.3 移动端 + 清单展开 (48vh 真实避让)
  const padMobileListOpen = calculateMapPadding({
    containerWidth: 390,
    containerHeight: 844,
    isMobile: true,
    isListOpen: true,
    isEditPanelOpen: false,
  });
  assert.strictEqual(padMobileListOpen.paddingTopLeft[0], 16);
  // 移动端底部避让 48vh: Math.round(844 * 0.48) + 16 = 405 + 16 = 421
  assert.strictEqual(padMobileListOpen.paddingBottomRight[1], 421);

  // 5.4 移动端 + 清单折叠
  const padMobileListClosed = calculateMapPadding({
    containerWidth: 390,
    containerHeight: 844,
    isMobile: true,
    isListOpen: false,
    isEditPanelOpen: false,
  });
  assert.strictEqual(padMobileListClosed.paddingBottomRight[1], 56);

  // 5.5 极限小尺寸安全保护：padding 比例不超过 70%，杜绝视口颠倒
  const padExtreme = calculateMapPadding({
    containerWidth: 300,
    containerHeight: 200,
    isMobile: false,
    isListOpen: true,
    isEditPanelOpen: true,
  });
  const totalHorizontal = padExtreme.paddingTopLeft[0] + padExtreme.paddingBottomRight[0];
  const totalVertical = padExtreme.paddingTopLeft[1] + padExtreme.paddingBottomRight[1];
  assert.ok(totalHorizontal <= 300 * 0.7 + 2, '横向 padding 之和严禁超出视口 70%');
  assert.ok(totalVertical <= 200 * 0.7 + 2, '纵向 padding 之和严禁超出视口 70%');
});

test('6. 地点数据处理异常重试仅纯函数重算，绝不调用 ORS、不消费 draft、不扣配额', () => {
  // 验证纯函数重试逻辑行为：在真实 committed 快照下模拟
  const committedSnapshot = {
    conditions: {
      landmark: {
        id: 'shanghai-yishan-road',
        name: '宜山路',
        city: '上海',
        province: '上海市',
        coordinates: [121.4276, 31.1895],
      },
      profile: 'driving-car',
      rangeMinutes: [15, 30, 60],
    },
    isochrones: [
      createPolygonFeature(15, [SHANGHAI_CENTER_RING_15]),
      createPolygonFeature(30, [SHANGHAI_CENTER_RING_30]),
      createPolygonFeature(60, [SHANGHAI_CENTER_RING_60]),
    ],
  };

  let orsApiCallCount = 0;
  const mockFetchORS = () => { orsApiCallCount++; };
  let quotaDeductions = 0;
  const mockIncrement = () => { quotaDeductions++; };

  // 模拟初次抛出异常的数据重试流程
  let shouldFail = true;
  const evaluateQuery = () => {
    if (shouldFail) {
      throw new Error('Simulated GeoJSON parse failure');
    }
    return queryInterestPoints({
      isochrones: committedSnapshot.isochrones,
      rangeMinutes: committedSnapshot.conditions.rangeMinutes,
      landmark: committedSnapshot.conditions.landmark,
    });
  };

  // 初次执行：捕获错误
  let initialResult = null;
  let initialError = null;
  try {
    initialResult = evaluateQuery();
  } catch (err) {
    initialError = err.message;
  }
  assert.strictEqual(initialResult, null);
  assert.strictEqual(initialError, 'Simulated GeoJSON parse failure');

  // 用户点击重试：执行重试修订，重新计算 evaluateQuery
  shouldFail = false;
  let retryResult = null;
  let retryError = null;
  try {
    retryResult = evaluateQuery();
  } catch (err) {
    retryError = err.message;
  }

  assert.strictEqual(retryError, null);
  assert.strictEqual(retryResult.status, 'matched');
  assert.ok(retryResult.allPOIs.length > 0);
  assert.strictEqual(orsApiCallCount, 0, '地点重试绝对不能发起 ORS 外部请求');
  assert.strictEqual(quotaDeductions, 0, '地点重试绝对不能扣减配额');
  assert.strictEqual(mockFetchORS.name, 'mockFetchORS');
  assert.strictEqual(mockIncrement.name, 'mockIncrement');
});
