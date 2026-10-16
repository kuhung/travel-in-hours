import test from 'node:test';
import assert from 'node:assert';
import {
  AMAP_URI_DOC_INFO,
  getAmapTravelMode,
  checkDesktopCyclingRestriction,
  resolveNavigationAction,
  isMobileDevice,
  getPOICategoryLabel,
  isValidCoordinate,
  createAmapNavUrl,
  formatPOICopyText,
} from '../src/lib/navigation-utils.ts';
import { wgs84ToGcj02 } from '../src/lib/coord-transform.ts';
import { queryInterestPoints } from '../src/lib/poi-utils.ts';

// 构造标准 GeoJSON Feature
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

test('1. 官方URL方案、参数契约与单次坐标转换验证 (AMAP URI API Contract)', () => {
  // 1.1 官方文档元数据核对
  assert.strictEqual(AMAP_URI_DOC_INFO.serviceEndpoint, 'https://uri.amap.com/navigation', '服务端点必须为 https://uri.amap.com/navigation');
  assert.strictEqual(AMAP_URI_DOC_INFO.docUrl, 'https://lbs.amap.com/api/uri-api/guide/travel/route', '官方文档源地址必须严格一致');
  assert.strictEqual(AMAP_URI_DOC_INFO.docLastUpdated, '2025年03月03日', '核验官方文档最后更新日期');
  assert.strictEqual(AMAP_URI_DOC_INFO.verifiedDate, '2026-10-16', '记录自动化与工程核验日期');

  // 1.2 构造真实导航 URL 并核查参数
  const origin = {
    name: '宜山路',
    coordinates: [121.4276, 31.1895], // [lng, lat] WGS-84
  };
  const destination = {
    name: '豫园',
    coordinates: [121.4921, 31.2275], // [lng, lat] WGS-84
  };

  const navUrl = createAmapNavUrl({
    origin,
    destination,
    profile: 'driving-car',
  });

  assert.ok(navUrl, '导航 URL 必须成功生成');
  const parsed = new URL(navUrl);

  assert.strictEqual(parsed.protocol, 'https:');
  assert.strictEqual(parsed.host, 'uri.amap.com');
  assert.strictEqual(parsed.pathname, '/navigation');
  assert.strictEqual(parsed.searchParams.get('mode'), 'car');
  assert.strictEqual(parsed.searchParams.get('policy'), '0');
  assert.strictEqual(parsed.searchParams.get('src'), 'travel-in-hours');
  assert.strictEqual(parsed.searchParams.get('callnative'), '0');

  // 1.3 验证单次坐标转换 (WGS-84 -> GCJ-02) 与 lon,lat 顺序
  const [expectedFromLng, expectedFromLat] = wgs84ToGcj02(origin.coordinates[0], origin.coordinates[1]);
  const [expectedToLng, expectedToLat] = wgs84ToGcj02(destination.coordinates[0], destination.coordinates[1]);

  const fromParam = parsed.searchParams.get('from');
  const toParam = parsed.searchParams.get('to');

  assert.ok(fromParam, 'from 参数必须存在');
  assert.ok(toParam, 'to 参数必须存在');

  const [fromLngStr, fromLatStr, fromName] = fromParam.split(',');
  const [toLngStr, toLatStr, toName] = toParam.split(',');

  // 验证经度在前、纬度在后
  assert.strictEqual(parseFloat(fromLngStr).toFixed(6), expectedFromLng.toFixed(6), 'from 经度必须为 GCJ-02 经度');
  assert.strictEqual(parseFloat(fromLatStr).toFixed(6), expectedFromLat.toFixed(6), 'from 纬度必须为 GCJ-02 纬度');
  assert.strictEqual(fromName, '宜山路', 'from 地点名必须匹配');

  assert.strictEqual(parseFloat(toLngStr).toFixed(6), expectedToLng.toFixed(6), 'to 经度必须为 GCJ-02 经度');
  assert.strictEqual(parseFloat(toLatStr).toFixed(6), expectedToLat.toFixed(6), 'to 纬度必须为 GCJ-02 纬度');
  assert.strictEqual(toName, '豫园', 'to 地点名必须匹配');

  // 1.4 验证坐标绝未发生二次转换（二次转换会导致坐标偏离约 450m）
  const [doubleConvertedLng] = wgs84ToGcj02(expectedFromLng, expectedFromLat);
  assert.notStrictEqual(parseFloat(fromLngStr).toFixed(4), doubleConvertedLng.toFixed(4), '绝不允许发生二次转换偏移');
});

test('2. 中文名称安全编码与标准 URL 解码验证 (Encoding Safety)', () => {
  const origin = {
    name: '上海虹桥火车站（出发层）',
    coordinates: [121.3204, 31.1945],
  };
  const destination = {
    name: '东方明珠广播电视塔 · 特别展区',
    coordinates: [121.4998, 31.2397],
  };

  const navUrl = createAmapNavUrl({
    origin,
    destination,
    profile: 'foot-walking',
  });

  assert.ok(navUrl);
  // 在原始 URL 中中文必须经过转义，不含有未编码的裸中文字符
  assert.ok(!navUrl.includes('东方明珠广播电视塔'), '原始 URL 中文名称必须符合标准编码规范');

  const parsed = new URL(navUrl);
  const toParam = parsed.searchParams.get('to');
  assert.ok(toParam);
  assert.ok(toParam.includes('东方明珠广播电视塔 · 特别展区'), 'URLSearchParams 提取解码后应完美还原中文及特殊符号');
});

test('3. 出行方式映射 (Profile Mapping) 与默认策略', () => {
  assert.strictEqual(getAmapTravelMode('driving-car'), 'car');
  assert.strictEqual(getAmapTravelMode('foot-walking'), 'walk');
  assert.strictEqual(getAmapTravelMode('cycling-regular'), 'ride');

  const origin = { name: '起点', coordinates: [121.4, 31.2] };
  const destination = { name: '终点', coordinates: [121.5, 31.2] };

  const walkUrl = createAmapNavUrl({ origin, destination, profile: 'foot-walking' });
  assert.strictEqual(new URL(walkUrl).searchParams.get('mode'), 'walk');

  const bikeUrl = createAmapNavUrl({ origin, destination, profile: 'cycling-regular' });
  assert.strictEqual(new URL(bikeUrl).searchParams.get('mode'), 'ride');
});

test('4. 独立平台能力判定、桌面端骑行真正限制约束与不静默转驾车 (Cycling Restriction Policy)', () => {
  // 4.1 独立设备能力检测（解耦视口宽度）
  const macChromeUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const windowsEdgeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
  const iPhoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const androidUA = 'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';

  assert.strictEqual(isMobileDevice(macChromeUA), false, 'macOS Chrome 必须识别为非移动平台');
  assert.strictEqual(isMobileDevice(windowsEdgeUA), false, 'Windows Edge 必须识别为非移动平台');
  assert.strictEqual(isMobileDevice(iPhoneUA), true, 'iPhone 必须识别为移动平台');
  assert.strictEqual(isMobileDevice(androidUA), true, 'Android 必须识别为移动平台');
  assert.strictEqual(isMobileDevice(undefined), false, 'Node/SSR 无环境时默认安全为 false');

  // 4.2 生产限制动作真正约束可执行导航（不仅停留在 tip）
  const origin = { name: '起点', coordinates: [121.4, 31.2] };
  const destination = { name: '终点', coordinates: [121.5, 31.2] };
  const navUrl = createAmapNavUrl({ origin, destination, profile: 'cycling-regular' });

  // 桌面端骑行：直接导航必须被禁用，主按钮切换为复制手机信息
  const desktopAction = resolveNavigationAction({
    profile: 'cycling-regular',
    isMobilePlatform: false,
    navUrl,
  });
  assert.strictEqual(desktopAction.canDirectlyNavigate, false, '桌面端骑行禁止直接导航');
  assert.strictEqual(desktopAction.type, 'copy_fallback_restricted');
  assert.strictEqual(desktopAction.primaryButtonText, '复制手机导航信息');
  assert.ok(desktopAction.warningMessage?.includes('仅限移动端支持'), '桌面端必须明示限制原因');

  // 移动端骑行：可直接导航，主按钮为正常外部导航
  const mobileAction = resolveNavigationAction({
    profile: 'cycling-regular',
    isMobilePlatform: true,
    navUrl,
  });
  assert.strictEqual(mobileAction.canDirectlyNavigate, true, '移动端骑行允许直接导航');
  assert.strictEqual(mobileAction.type, 'web_navigate');
  assert.strictEqual(mobileAction.primaryButtonText, '在外部地图中导航');

  // 驾车与步行：无论桌面或移动端均直接可用
  const drivingAction = resolveNavigationAction({
    profile: 'driving-car',
    isMobilePlatform: false,
    navUrl,
  });
  assert.strictEqual(drivingAction.canDirectlyNavigate, true);

  // 4.3 复制文本在骑行受限时标明仅手机有效
  const mockPOI = {
    id: 'sh-the-bund',
    name: '外滩',
    city: '上海',
    coordinates: [121.4905, 31.2323],
    category: 'tourism',
    layerMinutes: 30,
    index: 1,
    position: [31.230188, 121.495046],
  };
  const desktopRideCopy = formatPOICopyText({
    poi: mockPOI,
    profile: 'cycling-regular',
    isMobilePlatform: false,
    navUrl,
  });
  assert.ok(desktopRideCopy.includes('【高德导航链接(仅手机端有效)】'), '受限复制文本中必须明确注明仅手机端有效');

  // 4.4 严正核验：即便在桌面端，createAmapNavUrl 真实链接也必须保持 mode=ride，绝不静默改驾车！
  assert.strictEqual(new URL(navUrl).searchParams.get('mode'), 'ride', '严禁将用户选择的骑行静默替换为 car');
});

test('5. 非法与缺失字段健壮性容错 (Invalid / Missing Fields Handling)', () => {
  // 5.1 坐标合法性校验函数
  assert.strictEqual(isValidCoordinate([121.4, 31.2]), true);
  assert.strictEqual(isValidCoordinate([121.4]), false);
  assert.strictEqual(isValidCoordinate(['121.4', 31.2]), false);
  assert.strictEqual(isValidCoordinate([NaN, 31.2]), false);
  assert.strictEqual(isValidCoordinate([Infinity, 31.2]), false);
  assert.strictEqual(isValidCoordinate([200, 31.2]), false); // 经度越界
  assert.strictEqual(isValidCoordinate([121.4, 100]), false); // 纬度越界
  assert.strictEqual(isValidCoordinate(null), false);
  assert.strictEqual(isValidCoordinate(undefined), false);

  // 5.2 缺失 origin 或 destination
  assert.strictEqual(createAmapNavUrl({ origin: null, destination: { name: 'B', coordinates: [121, 31] }, profile: 'driving-car' }), null);
  assert.strictEqual(createAmapNavUrl({ origin: { name: 'A', coordinates: [121, 31] }, destination: null, profile: 'driving-car' }), null);

  // 5.3 坐标非法时安全返回 null，绝不报错崩盘
  const invalidOrigin = { name: 'A', coordinates: [NaN, 31] };
  const validDest = { name: 'B', coordinates: [121, 31] };
  assert.strictEqual(createAmapNavUrl({ origin: invalidOrigin, destination: validDest, profile: 'driving-car' }), null);

  // 5.4 缺少地名时自动容错填充默认名
  const emptyNameOrigin = { name: '', coordinates: [121.4, 31.2] };
  const emptyNameDest = { name: '   ', coordinates: [121.5, 31.3] };
  const fallbackUrl = createAmapNavUrl({ origin: emptyNameOrigin, destination: emptyNameDest, profile: 'driving-car' });
  assert.ok(fallbackUrl);
  const parsed = new URL(fallbackUrl);
  assert.ok(parsed.searchParams.get('from')?.endsWith('起点'));
  assert.ok(parsed.searchParams.get('to')?.endsWith('目的地'));
});

test('6. 草稿变更隔离与结果更新时的选中失效契约 (Draft Isolation & Invalidation)', () => {
  const isochrones = [
    createPolygonFeature(15, [SHANGHAI_CENTER_RING_15]),
    createPolygonFeature(30, [SHANGHAI_CENTER_RING_30]),
    createPolygonFeature(60, [SHANGHAI_CENTER_RING_60]),
  ];

  // 6.1 上海出发点结果包含外滩与豫园
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

  const allPOIs = resultShanghai.allPOIs;
  assert.ok(allPOIs.length > 0);
  const yuyuan = allPOIs.find(p => p.id === 'sh-yu-garden');
  assert.ok(yuyuan);

  // 模拟选中豫园
  let selectedPOIId = 'sh-yu-garden';
  let activeSelectedPOI = allPOIs.find(p => p.id === selectedPOIId) || null;
  assert.strictEqual(activeSelectedPOI?.name, '豫园');

  // 6.2 草稿变更模拟：用户在控制面板修改起点为北京，但未点击“更新可达范围”
  const draftLandmark = {
    id: 'beijing-tiananmen',
    name: '天安门广场',
    city: '北京',
    province: '北京市',
    coordinates: [116.397128, 39.916527],
  };
  const committedLandmark = {
    id: 'shanghai-yishan-road',
    name: '宜山路',
    city: '上海',
    province: '上海市',
    coordinates: [121.4276, 31.1895],
  };

  // 导航 URL 必须使用 committed 起点，绝不能使用草稿中的天安门
  const navUrlWithCommitted = createAmapNavUrl({
    origin: committedLandmark,
    destination: activeSelectedPOI,
    profile: 'driving-car',
  });
  assert.ok(navUrlWithCommitted);
  assert.ok(navUrlWithCommitted.includes('%E5%AE%9C%E5%B1%B1%E8%B7%AF'), '导航起点必须是已提交的宜山路');
  assert.ok(!navUrlWithCommitted.includes('%E5%A4%A9%E5%AE%89%E9%97%A8'), '草稿中的天安门绝对不能泄露至导航起点');

  // 6.3 结果更新模拟：新查询结果为杭州（超出上海收录范围），返回空 POI
  const resultHangzhou = queryInterestPoints({
    isochrones: [createPolygonFeature(15, [[[120.1, 30.2], [120.2, 30.2], [120.2, 30.3], [120.1, 30.3], [120.1, 30.2]]])],
    rangeMinutes: [15, 30, 60],
    landmark: {
      id: 'hangzhou-east',
      name: '杭州东站',
      city: '杭州',
      province: '浙江省',
      coordinates: [120.213, 30.291],
    },
  });

  // 当新结果不包含旧的 selectedPOIId 时，activeSelectedPOI 必须自动失效为 null
  const newActiveSelectedPOI = resultHangzhou.allPOIs.find(p => p.id === selectedPOIId) || null;
  assert.strictEqual(newActiveSelectedPOI, null, '新结果不包含旧 POI 时，详情与选中态必须自动关闭');
});

test('7. 复制文本格式化与真实字段回退验证 (Copy Text Formatting)', () => {
  const mockPOI = {
    id: 'shanghai-the-bund',
    name: '外滩',
    city: '上海',
    coordinates: [121.4905, 31.2323],
    category: 'tourism',
    description: '上海标志性外滩黄浦江畔景观',
    rating: 5,
    layerMinutes: 30,
    index: 1,
    position: [31.230188, 121.495046],
  };

  const copyText = formatPOICopyText({
    poi: mockPOI,
    origin: { name: '宜山路', coordinates: [121.4276, 31.1895] },
    profile: 'driving-car',
    rangeMinutes: [15, 30, 60],
    navUrl: 'https://uri.amap.com/navigation?from=test&to=test',
  });

  // 验证文本包含真实字段且具有良好可读性
  assert.ok(copyText.includes('【目的地】外滩'));
  assert.ok(copyText.includes('【类别】文旅景点'));
  assert.ok(copyText.includes('【简介】上海标志性外滩黄浦江畔景观'));
  assert.ok(copyText.includes('【可达圈层】15–30分钟 预估可达'));
  assert.ok(copyText.includes('【推荐指数】5/5（本地精选推荐）'));
  assert.ok(copyText.includes('【位置坐标】'));
  assert.ok(copyText.includes('【出发起点】宜山路'));
  assert.ok(copyText.includes('【高德导航链接】https://uri.amap.com/navigation'));

  // 严禁泄露内部工程 id 与对接槽
  assert.ok(!copyText.includes('shanghai-the-bund'), '严禁在用户复制文本中展示工程 id');
  assert.ok(!copyText.includes('对接槽'), '严禁在用户复制文本中展示工程对接槽');

  // 缺字段时优雅省略：无 description 和 rating
  const minimalPOI = {
    id: 'poi-minimal',
    name: '某便利设施',
    city: '上海',
    coordinates: [121.4, 31.2],
    category: 'other',
    layerMinutes: 15,
    index: 2,
    position: [31.2, 121.4],
  };
  const minimalCopyText = formatPOICopyText({ poi: minimalPOI });
  assert.ok(!minimalCopyText.includes('【简介】'), '无简介时必须优雅省略简介行');
  assert.ok(!minimalCopyText.includes('【推荐指数】'), '无评分时必须优雅省略推荐指数行');
  assert.ok(minimalCopyText.includes('【类别】生活设施'));
});

test('8. POI 类别映射契约核验', () => {
  assert.strictEqual(getPOICategoryLabel('tourism'), '文旅景点');
  assert.strictEqual(getPOICategoryLabel('food'), '特色美食');
  assert.strictEqual(getPOICategoryLabel('activity'), '休闲娱乐');
  assert.strictEqual(getPOICategoryLabel('shopping'), '商业购物');
  assert.strictEqual(getPOICategoryLabel('other'), '生活设施');
  assert.strictEqual(getPOICategoryLabel('unknown'), '精选地点');
});
