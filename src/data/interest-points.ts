import { InterestPoint } from '@/types';

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

// 获取指定城市的兴趣点
export const getInterestPointsByCity = (city: string): InterestPoint[] => {
  if (city === '上海' || city === '上海市') {
    return shanghaiInterestPoints;
  }
  return [];
};

