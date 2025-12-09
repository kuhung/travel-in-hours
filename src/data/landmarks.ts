import { CityLandmark } from '@/types';

// 上海地标
export const cityLandmarks: CityLandmark[] = [
  // 上海
  {
    id: 'shanghai-yishan-road',
    name: '宜山路',
    city: '上海',
    province: '上海市',
    coordinates: [121.412027, 31.173611],
    description: '上海市闵行区宜山路',
  },
  {
    id: 'shanghai-peoples-square',
    name: '人民广场',
    city: '上海',
    province: '上海市',
    coordinates: [121.4737, 31.2304],
    description: '上海市中心地标，城市核心区域',
  },
  {
    id: 'shanghai-lujiazui',
    name: '陆家嘴',
    city: '上海',
    province: '上海市',
    coordinates: [121.5055, 31.2397],
    description: '上海金融中心，浦东标志性区域',
  },
];

// 按城市分组
export const landmarksByCity = cityLandmarks.reduce((acc, landmark) => {
  if (!acc[landmark.city]) {
    acc[landmark.city] = [];
  }
  acc[landmark.city].push(landmark);
  return acc;
}, {} as Record<string, CityLandmark[]>);

// 获取所有城市列表
export const cities = [...new Set(cityLandmarks.map(l => l.city))];

// 根据ID获取地标
export const getLandmarkById = (id: string): CityLandmark | undefined => {
  return cityLandmarks.find(l => l.id === id);
};
