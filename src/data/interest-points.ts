import type { InterestPoint, CuratedRegion } from '../types/index.ts';
import { zhuhaiImmigrationHalls } from './zhuhai-immigration-halls.ts';

// 上海热门兴趣点
export const shanghaiInterestPoints: InterestPoint[] = [
  // 旅游景点
  {
    id: 'sh-the-bund',
    name: '外滩',
    city: '上海',
    coordinates: [121.4905, 31.2323],
    category: 'tourism',
    description: '万国建筑博览群',
    rating: 5
  },
  {
    id: 'sh-oriental-pearl',
    name: '东方明珠',
    city: '上海',
    coordinates: [121.4997, 31.2397],
    category: 'tourism',
    description: '上海地标性建筑',
    rating: 5
  },
  {
    id: 'sh-yu-garden',
    name: '豫园',
    city: '上海',
    coordinates: [121.4920, 31.2272],
    category: 'tourism',
    description: '明代古典园林',
    rating: 4
  },
  {
    id: 'sh-wukang-mansion',
    name: '武康大楼',
    city: '上海',
    coordinates: [121.4347, 31.2052],
    category: 'tourism',
    description: '网红打卡地标',
    rating: 4
  },
  {
    id: 'sh-disney',
    name: '迪士尼乐园',
    city: '上海',
    coordinates: [121.6675, 31.1415],
    category: 'activity',
    description: '童话世界',
    rating: 5
  },
  // 商圈
  {
    id: 'sh-xintiandi',
    name: '新天地',
    city: '上海',
    coordinates: [121.4758, 31.2230],
    category: 'shopping',
    description: '石库门时尚地标',
    rating: 4
  },
  {
    id: 'sh-jingan-temple',
    name: '静安寺',
    city: '上海',
    coordinates: [121.4462, 31.2234],
    category: 'tourism',
    description: '千年古刹与现代商圈',
    rating: 4
  },
  // 文化艺术
  {
    id: 'sh-west-bund',
    name: '西岸美术馆',
    city: '上海',
    coordinates: [121.4632, 31.1718],
    category: 'activity',
    description: '艺术展览聚集地',
    rating: 4
  }
];

// 珠海出入境智能服务厅（专题 POI）
// 业务信息保留到详情/复制链路可见的 description（原地址、服务时间、公交参考，并明确出发前核对），category 沿用 other，无需人为添加推荐5星
export const zhuhaiImmigrationInterestPoints: InterestPoint[] = zhuhaiImmigrationHalls.map((hall) => ({
  id: hall.id,
  name: hall.name,
  city: '珠海',
  coordinates: hall.coordinates,
  category: 'other' as const,
  description: `地址：${hall.address} · 服务时间：${hall.hours}${hall.busGuide ? ` · 公交参考：${hall.busGuide}` : ''}（前期收录未实时核验，出发前请核对）`,
}));

// 获取指定城市的兴趣点（保留兼容旧调用，新场景请优先使用 queryInterestPoints）
export const getInterestPointsByCity = (city: string): InterestPoint[] => {
  if (city === '上海' || city === '上海市') {
    return shanghaiInterestPoints;
  }
  if (city === '珠海' || city === '珠海市') {
    return zhuhaiImmigrationInterestPoints;
  }
  return [];
};

// 获取全部已收录兴趣点（跨城市地理筛选候选池）
export const getAllInterestPoints = (): InterestPoint[] => {
  return [...shanghaiInterestPoints, ...zhuhaiImmigrationInterestPoints];
};

/**
 * 按出发坐标与城市名获取兴趣点（向后兼容远端旧助手签名）
 * 核心 queryInterestPoints 仍严格走 WGS-84 等时圈几何筛选，不依赖此函数
 */
export const getInterestPointsForLocation = (
  city: string,
  coordinates?: [number, number]
): InterestPoint[] => {
  const byCity = getInterestPointsByCity(city);
  if (byCity.length > 0) return byCity;
  if (coordinates) {
    const [lng, lat] = coordinates;
    if (lng >= 113.10 && lng <= 113.70 && lat >= 21.85 && lat <= 22.45) {
      return zhuhaiImmigrationInterestPoints;
    }
  }
  return [];
};

// ==========================================
// 本地维护收录区域声明（声明性多边形，非行政测绘边界）
// ==========================================

export const SHANGHAI_CURATED_BOUNDARY_COORDINATES: number[][] = [
  [120.85, 31.05],
  [121.00, 31.35],
  [121.15, 31.55],
  [121.40, 31.85],
  [121.75, 31.80],
  [121.98, 31.55],
  [122.00, 31.00],
  [121.85, 30.70],
  [121.40, 30.68],
  [121.15, 30.68],
  [120.85, 30.90],
  [120.85, 31.05],
];

export const SHANGHAI_CURATED_REGION: CuratedRegion = {
  id: 'shanghai',
  name: '上海',
  province: '上海市',
  description: '上海市及周边已收录热门地标与文旅场所',
  disclaimer: '本地维护精选收录数据',
  source: 'travel-in-3hours 本地维护整理 (WGS-84)',
  bounds: {
    minLng: 120.85,
    minLat: 30.68,
    maxLng: 122.00,
    maxLat: 31.85,
  },
  boundary: {
    type: 'Polygon',
    coordinates: [SHANGHAI_CURATED_BOUNDARY_COORDINATES],
  },
};

// 当前系统已收录的所有区域声明列表
export const ZHUHAI_CURATED_BOUNDARY_COORDINATES: number[][] = [
  [113.10, 21.85],
  [113.70, 21.85],
  [113.70, 22.45],
  [113.10, 22.45],
  [113.10, 21.85],
];

export const ZHUHAI_CURATED_REGION: CuratedRegion = {
  id: 'zhuhai',
  name: '珠海',
  province: '广东省',
  description: '珠海市出入境智能服务厅专题收录区域',
  disclaimer: '本地维护出入境智能服务厅专题数据',
  source: 'travel-in-3hours 珠海出入境专题整理 (WGS-84)',
  bounds: {
    minLng: 113.10,
    minLat: 21.85,
    maxLng: 113.70,
    maxLat: 22.45,
  },
  boundary: {
    type: 'Polygon',
    coordinates: [ZHUHAI_CURATED_BOUNDARY_COORDINATES],
  },
};

export const CURATED_REGIONS: CuratedRegion[] = [
  SHANGHAI_CURATED_REGION,
  ZHUHAI_CURATED_REGION,
];

