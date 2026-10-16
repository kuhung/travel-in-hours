import test from 'node:test';
import assert from 'node:assert';
import {
  groupPOIsByLayer,
  getAllPOIsWithIndex,
  formatLayerTime,
  isPointInIsochrone,
  isPointInPolygon,
  queryInterestPoints,
} from '../src/lib/poi-utils.ts';
import {
  shanghaiInterestPoints,
  getInterestPointsByCity,
  getAllInterestPoints,
  SHANGHAI_CURATED_REGION,
  CURATED_REGIONS,
} from '../src/data/interest-points.ts';
import {
  isPointInGeometry,
  isPointInPolygonRings,
  isPointInMultiPolygonRings,
  evaluateGeometryOverlap,
} from '../src/lib/geo-utils.ts';
import { wgs84ToGcj02 } from '../src/lib/coord-transform.ts';

// 辅助工具：构造标准 GeoJSON Polygon Feature (WGS-84)
function createPolygonFeature(minutes, coordinates) {
  return {
    type: 'Feature',
    properties: {
      value: minutes * 60,
      center: [121.4737, 31.2304],
    },
    geometry: {
      type: 'Polygon',
      coordinates: coordinates,
    },
  };
}

// 辅助工具：构造标准 GeoJSON MultiPolygon Feature (WGS-84)
function createMultiPolygonFeature(minutes, multiCoordinates) {
  return {
    type: 'Feature',
    properties: {
      value: minutes * 60,
      center: [121.4737, 31.2304],
    },
    geometry: {
      type: 'MultiPolygon',
      coordinates: multiCoordinates,
    },
  };
}

// 围绕指定中心构造闭合矩形环
function createBoxRing(minLng, minLat, maxLng, maxLat) {
  return [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat], // 闭合
  ];
}

const square = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
  [a, b],
];

const polygon = (rings) => ({ type: 'Polygon', coordinates: rings });

test('1. 起点 city 变化一致性：预设、定位、自定义输入产生相同的候选点与圈层结果，不受 city 文案影响', () => {
  const isochrones = [
    createPolygonFeature(15, [[
      [121.47, 31.22],
      [121.51, 31.22],
      [121.51, 31.25],
      [121.47, 31.25],
      [121.47, 31.22],
    ]]),
    createPolygonFeature(30, [[
      [121.42, 31.18],
      [121.52, 31.18],
      [121.52, 31.26],
      [121.42, 31.26],
      [121.42, 31.18],
    ]]),
  ];

  const presetLandmark = {
    id: 'shanghai-people-square',
    name: '人民广场',
    city: '上海',
    province: '上海市',
    coordinates: [121.4737, 31.2304],
  };

  const customLandmark = {
    id: 'custom-1729000000000',
    name: '自定义选点',
    city: '自定义位置',
    province: '',
    coordinates: [121.4737, 31.2304],
  };

  const currentLocationLandmark = {
    id: 'current-location',
    name: '当前位置',
    city: '我的位置',
    province: '',
    coordinates: [121.4737, 31.2304],
  };

  const arbitraryCityLandmark = {
    id: 'arbitrary-hub',
    name: '特定起点',
    city: '任意测试城市字符串',
    province: '',
    coordinates: [121.4737, 31.2304],
  };

  const resPreset = queryInterestPoints({ isochrones, landmark: presetLandmark });
  const resCustom = queryInterestPoints({ isochrones, landmark: customLandmark });
  const resCurrent = queryInterestPoints({ isochrones, landmark: currentLocationLandmark });
  const resArbitrary = queryInterestPoints({ isochrones, landmark: arbitraryCityLandmark });

  assert.strictEqual(resPreset.status, 'matched');
  assert.strictEqual(resCustom.status, 'matched');
  assert.strictEqual(resCurrent.status, 'matched');
  assert.strictEqual(resArbitrary.status, 'matched');

  assert.strictEqual(resPreset.allPOIs.length, resCustom.allPOIs.length);
  assert.strictEqual(resPreset.allPOIs.length, resCurrent.allPOIs.length);
  assert.strictEqual(resPreset.allPOIs.length, resArbitrary.allPOIs.length);

  const presetIds = resPreset.allPOIs.map(p => `${p.id}@${p.layerMinutes}`).join(',');
  const customIds = resCustom.allPOIs.map(p => `${p.id}@${p.layerMinutes}`).join(',');
  const currentIds = resCurrent.allPOIs.map(p => `${p.id}@${p.layerMinutes}`).join(',');
  const arbitraryIds = resArbitrary.allPOIs.map(p => `${p.id}@${p.layerMinutes}`).join(',');

  assert.strictEqual(presetIds, customIds);
  assert.strictEqual(presetIds, currentIds);
  assert.strictEqual(presetIds, arbitraryIds);
});

test('2. 覆盖状态独立构造：覆盖内无匹配 (covered-empty) 与未覆盖 (uncovered) 严格区分', () => {
  const coveredEmptyIsochrone = [
    createPolygonFeature(15, [[
      [121.60, 31.60],
      [121.65, 31.60],
      [121.65, 31.65],
      [121.60, 31.65],
      [121.60, 31.60],
    ]]),
  ];

  const resCoveredEmpty = queryInterestPoints({
    isochrones: coveredEmptyIsochrone,
  });

  assert.strictEqual(resCoveredEmpty.status, 'covered-empty', '收录区域内无匹配点应返回 covered-empty');
  assert.strictEqual(resCoveredEmpty.coverageOverlap, 'full');
  assert.strictEqual(resCoveredEmpty.allPOIs.length, 0);
  assert.ok(resCoveredEmpty.matchedRegion !== null, '应附带收录区域信息');
  assert.strictEqual(resCoveredEmpty.matchedRegion?.id, 'shanghai');

  const uncoveredIsochrone = [
    createPolygonFeature(15, [[
      [120.10, 30.20],
      [120.20, 30.20],
      [120.20, 30.30],
      [120.10, 30.30],
      [120.10, 30.20],
    ]]),
  ];

  const resUncovered = queryInterestPoints({
    isochrones: uncoveredIsochrone,
  });

  assert.strictEqual(resUncovered.status, 'uncovered', '未收录区域应返回 uncovered');
  assert.strictEqual(resUncovered.coverageOverlap, 'none');
  assert.strictEqual(resUncovered.allPOIs.length, 0);
  assert.strictEqual(resUncovered.matchedRegion, null);

  const resNoIsoInShanghai = queryInterestPoints({
    isochrones: [],
    originCoordinates: [121.4737, 31.2304],
  });
  assert.strictEqual(resNoIsoInShanghai.status, 'covered-empty');
  assert.strictEqual(resNoIsoInShanghai.coverageOverlap, 'full');

  const resNoIsoOutside = queryInterestPoints({
    isochrones: [],
    originCoordinates: [120.15, 30.25],
  });
  assert.strictEqual(resNoIsoOutside.status, 'uncovered');
  assert.strictEqual(resNoIsoOutside.coverageOverlap, 'none');
});

test('3. 部分覆盖与跨边界 (partial)：跨边界且无匹配点返回 partial，跨边界且有匹配点返回 matched + isPartial', () => {
  const borderCrossingIsochroneNoPOI = [
    createPolygonFeature(60, [[
      [120.80, 31.20],
      [121.10, 31.20],
      [121.10, 31.40],
      [120.80, 31.40],
      [120.80, 31.20],
    ]]),
  ];

  const resPartialNoPOI = queryInterestPoints({
    isochrones: borderCrossingIsochroneNoPOI,
  });

  assert.strictEqual(resPartialNoPOI.status, 'partial', '部分重叠收录区域且未命中点时返回 partial');
  assert.strictEqual(resPartialNoPOI.coverageOverlap, 'partial');
  assert.strictEqual(resPartialNoPOI.isPartial, true);
  assert.strictEqual(resPartialNoPOI.allPOIs.length, 0);
  assert.ok(resPartialNoPOI.matchedRegion !== null);

  const borderCrossingIsochroneWithPOI = [
    createPolygonFeature(60, [[
      [120.80, 31.10],
      [121.50, 31.10],
      [121.50, 31.30],
      [120.80, 31.30],
      [120.80, 31.10],
    ]]),
  ];

  const resPartialWithPOI = queryInterestPoints({
    isochrones: borderCrossingIsochroneWithPOI,
  });

  assert.strictEqual(resPartialWithPOI.status, 'matched', '有匹配点时主状态为 matched');
  assert.strictEqual(resPartialWithPOI.coverageOverlap, 'partial');
  assert.strictEqual(resPartialWithPOI.isPartial, true, '跨边界匹配应将 isPartial 标记为 true');
  assert.ok(resPartialWithPOI.allPOIs.length > 0);
});

test('4. 每点归属最小分钟层：在多个圈层几何内的 POI 仅归属最小分钟层，全局 index 严格单调递增', () => {
  const isochrones = [
    createPolygonFeature(15, [createBoxRing(121.48, 31.22, 121.51, 31.25)]),
    createPolygonFeature(30, [createBoxRing(121.44, 31.20, 121.52, 31.26)]),
    createPolygonFeature(60, [createBoxRing(121.40, 31.10, 121.70, 31.30)]),
  ];

  const testPOIs = [
    {
      id: 'poi-the-bund',
      name: '外滩',
      city: '上海',
      coordinates: [121.4905, 31.2323],
      category: 'tourism',
    },
    {
      id: 'poi-jingan',
      name: '静安寺',
      city: '上海',
      coordinates: [121.4462, 31.2234],
      category: 'tourism',
    },
    {
      id: 'poi-disney',
      name: '迪士尼乐园',
      city: '上海',
      coordinates: [121.6675, 31.1415],
      category: 'activity',
    },
  ];

  const shuffledIsochrones = [isochrones[2], isochrones[0], isochrones[1]];
  const layers = groupPOIsByLayer(testPOIs, shuffledIsochrones, [15, 30, 60]);

  assert.strictEqual(layers.length, 3, '应包含 15, 30, 60 三个非空圈层');

  const layer15 = layers.find(l => l.layerMinutes === 15);
  const layer30 = layers.find(l => l.layerMinutes === 30);
  const layer60 = layers.find(l => l.layerMinutes === 60);

  assert.strictEqual(layer15?.points.length, 1);
  assert.strictEqual(layer15?.points[0].id, 'poi-the-bund');
  assert.strictEqual(layer15?.points[0].index, 1);

  assert.strictEqual(layer30?.points.length, 1);
  assert.strictEqual(layer30?.points[0].id, 'poi-jingan');
  assert.strictEqual(layer30?.points[0].index, 2);

  assert.strictEqual(layer60?.points.length, 1);
  assert.strictEqual(layer60?.points[0].id, 'poi-disney');
  assert.strictEqual(layer60?.points[0].index, 3);

  const allFlattened = getAllPOIsWithIndex(layers);
  assert.deepStrictEqual(allFlattened.map(p => p.index), [1, 2, 3]);
});

test('5. 孔洞 (Interior Rings) 排除与明确边界策略 (外边界闭区间包含，孔边界开区间排除)', () => {
  const exteriorRing = createBoxRing(0, 0, 10, 10);
  const holeRing = createBoxRing(3, 3, 7, 7);
  const polygonWithHole = [exteriorRing, holeRing];

  assert.strictEqual(isPointInPolygonRings([2, 2], polygonWithHole), true);
  assert.strictEqual(isPointInPolygonRings([8, 8], polygonWithHole), true);
  assert.strictEqual(isPointInPolygonRings([5, 1], polygonWithHole), true);

  assert.strictEqual(isPointInPolygonRings([5, 5], polygonWithHole), false);
  assert.strictEqual(isPointInPolygonRings([4, 4], polygonWithHole), false);

  assert.strictEqual(isPointInPolygonRings([0, 5], polygonWithHole), true, '点在外边界线上应被包含');
  assert.strictEqual(isPointInPolygonRings([10, 5], polygonWithHole), true, '点在外边界线上应被包含');
  assert.strictEqual(isPointInPolygonRings([5, 0], polygonWithHole), true, '点在外边界线上应被包含');
  assert.strictEqual(isPointInPolygonRings([0, 0], polygonWithHole), true, '外边界顶点应被包含');

  assert.strictEqual(isPointInPolygonRings([3, 5], polygonWithHole), false, '点在孔洞边界上应被排除');
  assert.strictEqual(isPointInPolygonRings([7, 5], polygonWithHole), false, '点在孔洞边界上应被排除');
  assert.strictEqual(isPointInPolygonRings([5, 3], polygonWithHole), false, '点在孔洞边界上应被排除');
  assert.strictEqual(isPointInPolygonRings([3, 3], polygonWithHole), false, '孔洞顶点应被排除');

  assert.strictEqual(isPointInPolygonRings([12, 12], polygonWithHole), false);
  assert.strictEqual(isPointInPolygonRings([-1, 5], polygonWithHole), false);
});

test('6. MultiPolygon 几何包含与跨岛屿归属判定', () => {
  const island1 = [createBoxRing(10, 10, 20, 20)];
  const island2 = [createBoxRing(30, 30, 40, 40)];
  const multiPolyCoords = [island1, island2];

  assert.strictEqual(isPointInMultiPolygonRings([15, 15], multiPolyCoords), true);
  assert.strictEqual(isPointInMultiPolygonRings([35, 35], multiPolyCoords), true);
  assert.strictEqual(isPointInMultiPolygonRings([25, 25], multiPolyCoords), false);
  assert.strictEqual(isPointInMultiPolygonRings([5, 5], multiPolyCoords), false);

  const multiFeature = createMultiPolygonFeature(15, multiPolyCoords);
  assert.strictEqual(isPointInIsochrone([15, 15], multiFeature), true);
  assert.strictEqual(isPointInIsochrone([35, 35], multiFeature), true);
  assert.strictEqual(isPointInIsochrone([25, 25], multiFeature), false);
});

test('7. 地点去重 (Deduplication) 与稳定 id 保持', () => {
  const isochrone = [createPolygonFeature(15, [createBoxRing(121.40, 31.20, 121.60, 31.30)])];

  const duplicatedPOIs = [
    {
      id: 'poi-dup-1',
      name: '外滩正身',
      city: '上海',
      coordinates: [121.4905, 31.2323],
      category: 'tourism',
      rating: 5,
    },
    {
      id: 'poi-dup-1',
      name: '外滩副本',
      city: '上海',
      coordinates: [121.4905, 31.2323],
      category: 'tourism',
      rating: 4,
    },
    {
      id: 'poi-unique-2',
      name: '豫园',
      city: '上海',
      coordinates: [121.4920, 31.2272],
      category: 'tourism',
      rating: 4,
    },
  ];

  const result = groupPOIsByLayer(duplicatedPOIs, isochrone, [15]);

  assert.strictEqual(result.length, 1);
  const points = result[0].points;
  assert.strictEqual(points.length, 2);
  assert.strictEqual(points[0].id, 'poi-dup-1');
  assert.strictEqual(points[0].name, '外滩正身', '应保留首个出现的实体');
  assert.strictEqual(points[0].rating, 5);
  assert.strictEqual(points[1].id, 'poi-unique-2');
});

test('8. 坐标契约验证：计算统一在 WGS-84，渲染位置输出合法 GCJ-02 [lat, lng]，rating 保持推荐属性', () => {
  const bund = shanghaiInterestPoints.find(p => p.id === 'sh-the-bund');
  assert.ok(bund);
  assert.deepStrictEqual(bund.coordinates, [121.4905, 31.2323]);

  const preciseWgs84Isochrone = [
    createPolygonFeature(15, [[
      [121.488, 31.230],
      [121.493, 31.230],
      [121.493, 31.235],
      [121.488, 31.235],
      [121.488, 31.230],
    ]]),
  ];

  const result = groupPOIsByLayer([bund], preciseWgs84Isochrone, [15]);
  assert.strictEqual(result.length, 1, 'WGS-84 点必须在 WGS-84 等时圈内成功匹配');

  const matchedPOI = result[0].points[0];
  assert.strictEqual(matchedPOI.id, 'sh-the-bund');
  assert.strictEqual(matchedPOI.rating, 5, 'rating 必须保持为本地推荐指数 5');

  const [expectedGcjLng, expectedGcjLat] = wgs84ToGcj02(bund.coordinates[0], bund.coordinates[1]);
  assert.strictEqual(matchedPOI.position[0], expectedGcjLat, 'position[0] 必须是 GCJ-02 纬度 lat');
  assert.strictEqual(matchedPOI.position[1], expectedGcjLng, 'position[1] 必须是 GCJ-02 经度 lng');

  assert.deepStrictEqual(matchedPOI.coordinates, [121.4905, 31.2323]);
});

test('9. 向后兼容性验证：旧版 API 签名、返回值及辅助函数平稳过渡', () => {
  assert.strictEqual(getInterestPointsByCity('上海').length, 8);
  assert.strictEqual(getInterestPointsByCity('上海市').length, 8);
  assert.strictEqual(getInterestPointsByCity('珠海').length, 15);
  assert.strictEqual(getInterestPointsByCity('珠海市').length, 15);
  assert.strictEqual(getInterestPointsByCity('北京').length, 0);
  assert.strictEqual(getInterestPointsByCity('自定义位置').length, 0);

  assert.strictEqual(getAllInterestPoints().length, 23);

  const triangle = [[0, 0], [10, 0], [5, 10], [0, 0]];
  assert.strictEqual(isPointInPolygon([5, 3], triangle), true);
  assert.strictEqual(isPointInPolygon([20, 20], triangle), false);

  assert.strictEqual(formatLayerTime(15), '15分钟内');
  assert.strictEqual(formatLayerTime(30), '30分钟内');
  assert.strictEqual(formatLayerTime(60), '1小时内');
  assert.strictEqual(formatLayerTime(120), '2小时内');
});

test('10. 声明性收录边界与元数据：不伪称全国行政边界，清晰界定维护范围', () => {
  assert.strictEqual(SHANGHAI_CURATED_REGION.id, 'shanghai');
  assert.strictEqual(SHANGHAI_CURATED_REGION.name, '上海');
  assert.ok(SHANGHAI_CURATED_REGION.disclaimer.includes('本地维护精选收录数据'));
  assert.ok(CURATED_REGIONS.length >= 2);

  const bounds = SHANGHAI_CURATED_REGION.bounds;
  assert.ok(bounds.minLng <= 121.0);
  assert.ok(bounds.maxLng >= 121.8);
  assert.ok(bounds.minLat <= 30.8);
  assert.ok(bounds.maxLat >= 31.8);

  for (const poi of shanghaiInterestPoints) {
    const isInside = isPointInGeometry(poi.coordinates, SHANGHAI_CURATED_REGION.boundary);
    assert.strictEqual(
      isInside,
      true,
      `POI ${poi.name} (${poi.coordinates}) 必须落在声明的上海收录区域多边形内`
    );
  }
});

// ==========================================
// 11. 父级复核几何缺陷专门回归与高阶拓扑用例 (P1 已复现几何缺陷修复证据)
// ==========================================

test('11. 几何回归用例 1：完全相同的多边形重叠 overlap(target, target) 应得 full（外边界包含，非越界）', () => {
  const target = polygon([square(0, 0, 10, 10)]);
  const result = evaluateGeometryOverlap(target, target);
  assert.strictEqual(result, 'full', '相同目标自相交必须判定为 full，仅边界重合不能误判为 partial 越界');
});

test('11. 几何回归用例 2：源多边形覆盖目标多边形未收录孔洞应得 partial', () => {
  const subject = polygon([square(1, 1, 9, 9)]);
  const target = polygon([square(0, 0, 10, 10), square(3, 3, 7, 7)]);
  const result = evaluateGeometryOverlap(subject, target);
  assert.strictEqual(result, 'partial', '源几何覆盖了目标多边形内部的未收录孔洞，必须判定为 partial');
});

test('11. 几何回归用例 3：目标为 MultiPolygon 时源包含第二块目标应得 partial（不能漏判多块）', () => {
  const subject = polygon([square(19, 19, 22, 22)]);
  const target = {
    type: 'MultiPolygon',
    coordinates: [[square(0, 0, 1, 1)], [square(20, 20, 21, 21)]],
  };
  const result = evaluateGeometryOverlap(subject, target);
  assert.strictEqual(result, 'partial', '源覆盖 MultiPolygon 的第二块陆地时，不能仅查第一块首顶点而误判为 none');
});

test('11. 几何拓扑边界用例：纯外部边界接触得 none、避开孔洞得 full、孔内完全无重叠得 none、凹形穿越得 partial', () => {
  // A. 纯外部边缘接触（相切但无内部 2D 面积重叠）
  const sTouching = polygon([square(10, 0, 20, 10)]);
  const tBase = polygon([square(0, 0, 10, 10)]);
  assert.strictEqual(evaluateGeometryOverlap(sTouching, tBase), 'none', '纯外部边缘相接无内部重叠应为 none');

  // B. 位于带孔多边形有效区域角落，完全避开孔洞
  const sCorner = polygon([square(0.5, 0.5, 2.5, 2.5)]);
  const tWithHole = polygon([square(0, 0, 10, 10), square(3, 3, 7, 7)]);
  assert.strictEqual(evaluateGeometryOverlap(sCorner, tWithHole), 'full', '完全避开孔洞且在有效区内应为 full');

  // C. 完全落入目标孔洞内部（有效收录区完全无重叠）
  const sInHole = polygon([square(4, 4, 6, 6)]);
  assert.strictEqual(evaluateGeometryOverlap(sInHole, tWithHole), 'none', '完全位于不可达孔洞内部应为 none');

  // D. 凹形 U 形多边形穿越（桥接凹槽，顶点在边但中线穿越外部）
  const uTarget = polygon([[
    [0, 0], [10, 0], [10, 10], [7, 10], [7, 3], [3, 3], [3, 10], [0, 10], [0, 0],
  ]]);
  const uBridge = polygon([square(2, 7, 8, 9)]);
  assert.strictEqual(evaluateGeometryOverlap(uBridge, uTarget), 'partial', '凹形多边形越界穿越必须判定为 partial');
});

test('12. 几何回归用例 4：identical donut 与 identical concave 在首点旋转、环反向时均稳定判定为 full', () => {
  // A. 带孔多边形 (Donut) 自相交及其旋转、反转
  const donut = polygon([square(0, 0, 10, 10), square(3, 3, 7, 7)]);

  // 首点旋转（外环以不同顶点起笔）
  const donutRotated = polygon([
    [[10, 10], [0, 10], [0, 0], [10, 0], [10, 10]],
    square(3, 3, 7, 7),
  ]);

  // 环反向（顺时针/逆时针调换）
  const donutReversed = polygon([
    square(0, 0, 10, 10).slice().reverse(),
    square(3, 3, 7, 7).slice().reverse(),
  ]);

  assert.strictEqual(evaluateGeometryOverlap(donut, donut), 'full', 'identical donut 重叠必须判定为 full');
  assert.strictEqual(evaluateGeometryOverlap(donutRotated, donut), 'full', '首点旋转的 identical donut 必须判定为 full');
  assert.strictEqual(evaluateGeometryOverlap(donutReversed, donut), 'full', '环反向的 identical donut 必须判定为 full');

  // B. 凹形多边形 (Concave) 自相交及其旋转、反转（顶点算术均值在外部凹口处）
  const concave = polygon([
    [[0, 0], [10, 0], [10, 2], [2, 2], [2, 8], [10, 8], [10, 10], [0, 10], [0, 0]],
  ]);

  const concaveRing = concave.coordinates[0];
  const concaveRotated = polygon([
    concaveRing.slice(2, -1).concat(concaveRing.slice(0, 2)).concat([concaveRing[2]]),
  ]);

  const concaveReversed = polygon([concaveRing.slice().reverse()]);

  assert.strictEqual(evaluateGeometryOverlap(concave, concave), 'full', 'identical concave 重叠必须判定为 full');
  assert.strictEqual(evaluateGeometryOverlap(concaveRotated, concave), 'full', '首点旋转的 identical concave 必须判定为 full');
  assert.strictEqual(evaluateGeometryOverlap(concaveReversed, concave), 'full', '环反向的 identical concave 必须判定为 full');
});

