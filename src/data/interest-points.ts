import { InterestPoint } from '@/types';
import { zhuhaiImmigrationHalls } from './zhuhai-immigration-halls';

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

/** 珠海出入境智能服务厅（签注机）→ 等时圈内可发现的 POI */
export const zhuhaiImmigrationInterestPoints: InterestPoint[] =
  zhuhaiImmigrationHalls.map((hall) => ({
    id: hall.id,
    name: hall.name,
    city: '珠海',
    coordinates: hall.coordinates,
    category: 'other' as const,
    description: `${hall.address} · ${hall.hours}`,
    rating: 5,
  }));

/** 珠海市大致范围（WGS-84），用于自定义选点时匹配签注机 POI */
const ZHUHAI_BBOX = {
  minLng: 113.10,
  maxLng: 113.70,
  minLat: 21.85,
  maxLat: 22.45,
};

export function isInZhuhai(lng: number, lat: number): boolean {
  return (
    lng >= ZHUHAI_BBOX.minLng &&
    lng <= ZHUHAI_BBOX.maxLng &&
    lat >= ZHUHAI_BBOX.minLat &&
    lat <= ZHUHAI_BBOX.maxLat
  );
}

// 获取指定城市的兴趣点
export const getInterestPointsByCity = (city: string): InterestPoint[] => {
  if (city === '上海' || city === '上海市') {
    return shanghaiInterestPoints;
  }
  if (city === '珠海' || city === '珠海市') {
    return zhuhaiImmigrationInterestPoints;
  }
  return [];
};

/**
 * 按出发坐标取兴趣点：城市名优先；自定义选点落在珠海时也返回签注机列表
 */
export const getInterestPointsForLocation = (
  city: string,
  coordinates?: [number, number]
): InterestPoint[] => {
  const byCity = getInterestPointsByCity(city);
  if (byCity.length > 0) return byCity;

  if (coordinates && isInZhuhai(coordinates[0], coordinates[1])) {
    return zhuhaiImmigrationInterestPoints;
  }

  return [];
};
