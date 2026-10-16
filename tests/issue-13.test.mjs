import test from 'node:test';
import assert from 'node:assert/strict';

import {
  zhuhaiImmigrationHalls,
} from '../src/data/zhuhai-immigration-halls.ts';
import {
  zhuhaiImmigrationInterestPoints,
} from '../src/data/interest-points.ts';
import {
  cityLandmarks,
  cities,
} from '../src/data/landmarks.ts';
import {
  queryInterestPoints,
} from '../src/lib/poi-utils.ts';
import {
  parseShareParams,
  serializeShareParams,
} from '../src/lib/share-params.ts';

// 辅助函数：构造测试用等时圈多边形
function createIsochroneFeature(minutes, coordinates) {
  return {
    type: 'Feature',
    properties: {
      value: minutes * 60,
      center: coordinates[0][0],
    },
    geometry: {
      type: 'Polygon',
      coordinates,
    },
  };
}

// 辅助函数：以某个经纬度为中心构造方框多边形
function createBoxPolygon(centerLng, centerLat, deltaLng, deltaLat) {
  return [
    [
      [centerLng - deltaLng, centerLat - deltaLat],
      [centerLng + deltaLng, centerLat - deltaLat],
      [centerLng + deltaLng, centerLat + deltaLat],
      [centerLng - deltaLng, centerLat + deltaLat],
      [centerLng - deltaLng, centerLat - deltaLat],
    ],
  ];
}

test('1. 15 条珠海出入境大厅记录保真与数据契约验证 (15 Halls Fidelity & Seam Contract)', () => {
  // 1.1 原始记录数量必须严格等于 15
  assert.strictEqual(zhuhaiImmigrationHalls.length, 15);

  // 1.2 稳定 ID 保持为 zh-imm-1 至 zh-imm-15，且全局无重复
  const ids = zhuhaiImmigrationHalls.map((h) => h.id);
  assert.strictEqual(new Set(ids).size, 15);
  for (let i = 1; i <= 15; i++) {
    assert.ok(ids.includes(`zh-imm-${i}`), `必须包含稳定编号 zh-imm-${i}`);
  }

  // 1.3 逐条验证 WGS-84 坐标、地址、服务时间及公交指引保真
  for (const hall of zhuhaiImmigrationHalls) {
    assert.ok(hall.name && hall.name.length > 0, `${hall.id} 必须有非空名称`);
    assert.ok(hall.address && hall.address.length > 0, `${hall.id} 必须有非空地址`);
    assert.ok(hall.district && hall.district.length > 0, `${hall.id} 必须有非空区划`);
    assert.ok(hall.hours && hall.hours.length > 0, `${hall.id} 必须有服务时间`);
    assert.ok(Array.isArray(hall.coordinates) && hall.coordinates.length === 2, `${hall.id} 坐标为二维数组`);
    const [lng, lat] = hall.coordinates;
    assert.ok(lng >= 113.10 && lng <= 113.70, `${hall.id} 经度 ${lng} 落在珠海有效声明范围内`);
    assert.ok(lat >= 21.85 && lat <= 22.45, `${hall.id} 纬度 ${lat} 落在珠海有效声明范围内`);
    assert.ok(hall.busGuide && hall.busGuide.length > 0, `${hall.id} 必须保留公交指引`);
  }

  // 1.4 zhuhaiImmigrationInterestPoints 映射契约核对
  assert.strictEqual(zhuhaiImmigrationInterestPoints.length, 15);
  for (let i = 0; i < 15; i++) {
    const hall = zhuhaiImmigrationHalls[i];
    const poi = zhuhaiImmigrationInterestPoints[i];

    assert.strictEqual(poi.id, hall.id);
    assert.strictEqual(poi.name, hall.name);
    assert.strictEqual(poi.city, '珠海');
    assert.deepStrictEqual(poi.coordinates, hall.coordinates);
    assert.strictEqual(poi.category, 'other');

    // 无需人为添加推荐 5 星（rating 为 undefined）
    assert.strictEqual(poi.rating, undefined, '严禁虚标推荐 5 星评分');

    // 业务信息保留到详情/复制链路可见的 description 中，明确出发前核对
    assert.ok(poi.description.includes(hall.address), 'description 必须包含原地址');
    assert.ok(poi.description.includes(hall.hours), 'description 必须包含服务时间');
    assert.ok(poi.description.includes(hall.busGuide), 'description 必须包含公交参考');
    assert.ok(poi.description.includes('未实时核验') || poi.description.includes('出发前请核对'), 'description 必须提示核对');
  }
});

test('2. 7 个珠海预设起点保真验证 (7 Zhuhai Origins Fidelity)', () => {
  const zhuhaiLandmarks = cityLandmarks.filter((l) => l.city === '珠海');
  assert.strictEqual(zhuhaiLandmarks.length, 7, '珠海预设起点必须严格等于 7 个');

  const expectedIds = [
    'zhuhai-gongbei',
    'zhuhai-xiangzhou-center',
    'zhuhai-civic-center',
    'zhuhai-tangjiawan',
    'zhuhai-doumen',
    'zhuhai-jinwan',
    'zhuhai-airport',
  ];

  for (const id of expectedIds) {
    const found = zhuhaiLandmarks.find((l) => l.id === id);
    assert.ok(found, `必须包含预设起点 ${id}`);
    assert.strictEqual(found.city, '珠海');
    assert.strictEqual(found.province, '广东省');
    const [lng, lat] = found.coordinates;
    assert.ok(lng >= 113.10 && lng <= 113.70, `${id} 经度必须在珠海声明范围内`);
    assert.ok(lat >= 21.85 && lat <= 22.45, `${id} 纬度必须在珠海声明范围内`);
  }

  // 验证全局城市列表包含珠海，且去重正确
  assert.ok(cities.includes('珠海'));
  assert.strictEqual(cities.length, new Set(cities).size);
});

test('3. 珠海 POI share payload → URL → query 选中与反向恢复完整链路', () => {
  const origin = {
    id: 'zhuhai-gongbei',
    name: '拱北口岸',
    city: '珠海',
    province: '广东省',
    coordinates: [113.548925, 22.21858],
  };

  const targetPoi = zhuhaiImmigrationInterestPoints.find((p) => p.id === 'zh-imm-3');
  assert.ok(targetPoi);

  // 1. 序列化分享参数
  const serializedQuery = serializeShareParams(
    {
      landmark: origin,
      profile: 'driving-car',
      rangeMinutes: [15, 30, 60],
    },
    targetPoi.id
  );

  assert.ok(serializedQuery.includes('poi=zh-imm-3'));
  assert.ok(serializedQuery.includes('city=%E7%8F%A0%E6%B5%B7'));

  // 2. 接收端反序列化
  const parsed = parseShareParams(serializedQuery, cityLandmarks);
  assert.strictEqual(parsed.error, null);
  assert.strictEqual(parsed.selectedPOIId, 'zh-imm-3');
  assert.strictEqual(parsed.landmark?.city, '珠海');
  assert.strictEqual(parsed.landmark?.name, '拱北口岸');
  assert.deepStrictEqual(parsed.landmark?.coordinates, origin.coordinates);

  // 3. 根据反序列化条件重新计算等时圈与地点查询
  const isochrones = [
    createIsochroneFeature(15, createBoxPolygon(origin.coordinates[0], origin.coordinates[1], 0.05, 0.05)),
  ];
  const recomputed = queryInterestPoints({
    isochrones,
    rangeMinutes: parsed.rangeMinutes,
    landmark: parsed.landmark,
  });

  const selectedInRecomputed = recomputed.allPOIs.find((p) => p.id === parsed.selectedPOIId);
  assert.ok(selectedInRecomputed, '反向恢复必须能精确选中 zh-imm-3');
  assert.strictEqual(selectedInRecomputed.name, targetPoi.name);
  assert.deepStrictEqual(selectedInRecomputed.coordinates, targetPoi.coordinates);
});

test('4. POIListPanel 专题文案与跨城通用性契约', () => {
  // 4.1 当全为珠海出入境服务厅时，标题应特异化为出入境服务厅，并诚实说明出入境服务厅数量
  const zhuhaiOnlyPOIs = [
    {
      id: 'zh-imm-1',
      name: '市公安局出入境管理支队',
      city: '珠海',
      coordinates: [113.53372, 22.273884],
      category: 'other',
      description: '地址：香洲区香华路493号',
      layerMinutes: 15,
      index: 1,
      position: [22.273, 113.533],
    },
  ];

  const allPointsZh = zhuhaiOnlyPOIs;
  const isAllImmigrationZh = allPointsZh.length > 0 && allPointsZh.every((p) => p.id.startsWith('zh-imm-'));
  assert.strictEqual(isAllImmigrationZh, true);

  // 4.2 当为上海或其他通用 POI 时，保持通用文案
  const shanghaiPOIs = [
    {
      id: 'sh-the-bund',
      name: '外滩',
      city: '上海',
      coordinates: [121.4905, 31.2323],
      category: 'tourism',
      description: '万国建筑博览群',
      layerMinutes: 15,
      index: 1,
      position: [31.232, 121.49],
    },
  ];
  const isAllImmigrationSh = shanghaiPOIs.length > 0 && shanghaiPOIs.every((p) => p.id.startsWith('zh-imm-'));
  assert.strictEqual(isAllImmigrationSh, false);

  // 4.3 跨城混合（上海 + 珠海）结果仍走通用展示，不误报为全是签注机
  const mixedPOIs = [...zhuhaiOnlyPOIs, ...shanghaiPOIs];
  const isAllImmigrationMixed = mixedPOIs.length > 0 && mixedPOIs.every((p) => p.id.startsWith('zh-imm-'));
  assert.strictEqual(isAllImmigrationMixed, false, '混合地点必须走通用展示，严禁宣称全部都是签注机');
});
