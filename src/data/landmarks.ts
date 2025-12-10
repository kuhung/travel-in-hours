import { CityLandmark } from '@/types';

// 城市地标数据
export const cityLandmarks: CityLandmark[] = [
  // 上海
  {
    id: 'shanghai-yishan-road',
    name: '宜山路地铁站',
    city: '上海',
    province: '上海市',
    coordinates: [121.427194, 31.186717],
    description: '上海市徐汇区宜山路地铁站',
  },
  {
    id: 'shanghai-hongqiao-station',
    name: '上海虹桥站',
    city: '上海',
    province: '上海市',
    coordinates: [121.320081, 31.193964],
    description: '上海市闵行区重要交通枢纽',
  },
  {
    id: 'shanghai-south-station',
    name: '上海南站',
    city: '上海',
    province: '上海市',
    coordinates: [121.430041, 31.154579],
    description: '上海市徐汇区铁路客运站',
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

  // 杭州
  {
    id: 'hangzhou-east-station',
    name: '杭州东站',
    city: '杭州',
    province: '浙江省',
    coordinates: [120.213116, 30.290966],
    description: '杭州最大的铁路枢纽站',
  },
  {
    id: 'hangzhou-west-lake',
    name: '西湖',
    city: '杭州',
    province: '浙江省',
    coordinates: [120.148583, 30.242847],
    description: '杭州标志性景点，世界文化遗产',
  },
  {
    id: 'hangzhou-wulin-square',
    name: '武林广场',
    city: '杭州',
    province: '浙江省',
    coordinates: [120.169561, 30.276919],
    description: '杭州市中心商业核心区',
  },
  {
    id: 'hangzhou-qianjiang-new-city',
    name: '钱江新城',
    city: '杭州',
    province: '浙江省',
    coordinates: [120.212868, 30.233849],
    description: '杭州CBD，城市新中心',
  },
  {
    id: 'hangzhou-xiaoshan-airport',
    name: '萧山国际机场',
    city: '杭州',
    province: '浙江省',
    coordinates: [120.431793, 30.236489],
    description: '杭州主要航空枢纽',
  },

  // 广州
  {
    id: 'guangzhou-south-station',
    name: '广州南站',
    city: '广州',
    province: '广东省',
    coordinates: [113.269029, 22.988935],
    description: '华南最大高铁站',
  },
  {
    id: 'guangzhou-tianhe',
    name: '天河体育中心',
    city: '广州',
    province: '广东省',
    coordinates: [113.321557, 23.137547],
    description: '广州市天河区标志性建筑',
  },
  {
    id: 'guangzhou-zhujiang-new-town',
    name: '珠江新城',
    city: '广州',
    province: '广东省',
    coordinates: [113.321869, 23.119563],
    description: '广州CBD核心区域',
  },
  {
    id: 'guangzhou-east-station',
    name: '广州东站',
    city: '广州',
    province: '广东省',
    coordinates: [113.324748, 23.150968],
    description: '广州重要交通枢纽',
  },
  {
    id: 'guangzhou-baiyun-airport',
    name: '白云国际机场',
    city: '广州',
    province: '广东省',
    coordinates: [113.298776, 23.392436],
    description: '华南最大航空枢纽',
  },

  // 深圳
  {
    id: 'shenzhen-north-station',
    name: '深圳北站',
    city: '深圳',
    province: '广东省',
    coordinates: [114.029092, 22.609926],
    description: '深圳最大高铁站',
  },
  {
    id: 'shenzhen-futian-cbd',
    name: '福田CBD',
    city: '深圳',
    province: '广东省',
    coordinates: [114.055628, 22.536542],
    description: '深圳金融商务核心区',
  },
  {
    id: 'shenzhen-nanshan-tech-park',
    name: '南山科技园',
    city: '深圳',
    province: '广东省',
    coordinates: [113.948884, 22.537988],
    description: '深圳高新技术产业聚集地',
  },
  {
    id: 'shenzhen-luohu',
    name: '罗湖口岸',
    city: '深圳',
    province: '广东省',
    coordinates: [114.116847, 22.541277],
    description: '深港重要通关口岸',
  },
  {
    id: 'shenzhen-baoan-airport',
    name: '宝安国际机场',
    city: '深圳',
    province: '广东省',
    coordinates: [113.818459, 22.639358],
    description: '深圳主要航空枢纽',
  },

  // 成都
  {
    id: 'chengdu-east-station',
    name: '成都东站',
    city: '成都',
    province: '四川省',
    coordinates: [104.137901, 30.632212],
    description: '成都最大高铁站',
  },
  {
    id: 'chengdu-chunxi-road',
    name: '春熙路',
    city: '成都',
    province: '四川省',
    coordinates: [104.080573, 30.657072],
    description: '成都市中心著名商业步行街',
  },
  {
    id: 'chengdu-tianfu-square',
    name: '天府广场',
    city: '成都',
    province: '四川省',
    coordinates: [104.065758, 30.657485],
    description: '成都市中心地标',
  },
  {
    id: 'chengdu-tianfu-new-area',
    name: '天府新区',
    city: '成都',
    province: '四川省',
    coordinates: [104.063447, 30.509534],
    description: '成都城市新中心',
  },
  {
    id: 'chengdu-shuangliu-airport',
    name: '双流国际机场',
    city: '成都',
    province: '四川省',
    coordinates: [103.946466, 30.578528],
    description: '成都主要航空枢纽',
  },

  // 绍兴
  {
    id: 'shaoxing-north-station',
    name: '绍兴北站',
    city: '绍兴',
    province: '浙江省',
    coordinates: [120.472813, 30.096714],
    description: '绍兴高铁站',
  },
  {
    id: 'shaoxing-luxun-hometown',
    name: '鲁迅故里',
    city: '绍兴',
    province: '浙江省',
    coordinates: [120.582714, 30.002169],
    description: '绍兴著名历史文化景区',
  },
  {
    id: 'shaoxing-keqiao',
    name: '柯桥',
    city: '绍兴',
    province: '浙江省',
    coordinates: [120.495598, 30.082058],
    description: '绍兴柯桥区中心',
  },
  {
    id: 'shaoxing-city-square',
    name: '城市广场',
    city: '绍兴',
    province: '浙江省',
    coordinates: [120.573829, 29.996741],
    description: '绍兴市中心商业区',
  },
  {
    id: 'shaoxing-east-lake',
    name: '东湖风景区',
    city: '绍兴',
    province: '浙江省',
    coordinates: [120.622178, 29.994326],
    description: '绍兴著名自然景区',
  },

  // 重庆
  {
    id: 'chongqing-north-station',
    name: '重庆北站',
    city: '重庆',
    province: '重庆市',
    coordinates: [106.551565, 29.607806],
    description: '重庆最大铁路枢纽',
  },
  {
    id: 'chongqing-jiefangbei',
    name: '解放碑',
    city: '重庆',
    province: '重庆市',
    coordinates: [106.577883, 29.559788],
    description: '重庆市中心标志性地标',
  },
  {
    id: 'chongqing-guanyinqiao',
    name: '观音桥',
    city: '重庆',
    province: '重庆市',
    coordinates: [106.548093, 29.575896],
    description: '重庆江北区商业中心',
  },
  {
    id: 'chongqing-hongyadong',
    name: '洪崖洞',
    city: '重庆',
    province: '重庆市',
    coordinates: [106.581703, 29.563156],
    description: '重庆著名网红景点',
  },
  {
    id: 'chongqing-jiangbei-airport',
    name: '江北国际机场',
    city: '重庆',
    province: '重庆市',
    coordinates: [106.642152, 29.719235],
    description: '重庆主要航空枢纽',
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
