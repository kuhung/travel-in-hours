import { CityLandmark } from '@/types';

// 中国各大城市核心地标
export const cityLandmarks: CityLandmark[] = [
  // 一线城市
  {
    id: 'shanghai-peoples-square',
    name: '人民广场',
    city: '上海',
    province: '上海市',
    coordinates: [121.4737, 31.2304],
    description: '上海市中心地标，城市核心区域',
  },
  {
    id: 'beijing-tiananmen',
    name: '天安门广场',
    city: '北京',
    province: '北京市',
    coordinates: [116.3912, 39.9055],
    description: '北京市中心，中国政治文化中心',
  },
  {
    id: 'guangzhou-tianhe',
    name: '天河体育中心',
    city: '广州',
    province: '广东省',
    coordinates: [113.3211, 23.1379],
    description: '广州城市新中轴线核心',
  },
  {
    id: 'shenzhen-civic-center',
    name: '市民中心',
    city: '深圳',
    province: '广东省',
    coordinates: [114.0567, 22.5468],
    description: '深圳城市中心地标',
  },
  
  // 新一线城市
  {
    id: 'hangzhou-west-lake',
    name: '西湖',
    city: '杭州',
    province: '浙江省',
    coordinates: [120.1485, 30.2428],
    description: '杭州著名景点，城市核心',
  },
  {
    id: 'chengdu-tianfu-square',
    name: '天府广场',
    city: '成都',
    province: '四川省',
    coordinates: [104.0665, 30.6573],
    description: '成都市中心广场',
  },
  {
    id: 'chongqing-jiefangbei',
    name: '解放碑',
    city: '重庆',
    province: '重庆市',
    coordinates: [106.5783, 29.5595],
    description: '重庆市中心地标',
  },
  {
    id: 'wuhan-huanghelou',
    name: '黄鹤楼',
    city: '武汉',
    province: '湖北省',
    coordinates: [114.3044, 30.5456],
    description: '武汉标志性建筑',
  },
  {
    id: 'nanjing-xinjiekou',
    name: '新街口',
    city: '南京',
    province: '江苏省',
    coordinates: [118.7831, 32.0419],
    description: '南京市中心商业区',
  },
  {
    id: 'suzhou-guanqian',
    name: '观前街',
    city: '苏州',
    province: '江苏省',
    coordinates: [120.6329, 31.3101],
    description: '苏州市中心商业区',
  },
  
  // 二线城市
  {
    id: 'tianjin-haihe',
    name: '海河广场',
    city: '天津',
    province: '天津市',
    coordinates: [117.2015, 39.0842],
    description: '天津市中心',
  },
  {
    id: 'zhengzhou-erqi',
    name: '二七广场',
    city: '郑州',
    province: '河南省',
    coordinates: [113.6590, 34.7537],
    description: '郑州市中心地标',
  },
  {
    id: 'hefei-dadongmen',
    name: '大东门',
    city: '合肥',
    province: '安徽省',
    coordinates: [117.2824, 31.8630],
    description: '合肥市中心',
  },
  {
    id: 'ningbo-tianyi',
    name: '天一广场',
    city: '宁波',
    province: '浙江省',
    coordinates: [121.5502, 29.8694],
    description: '宁波市中心商业区',
  },
  {
    id: 'changsha-wuyi',
    name: '五一广场',
    city: '长沙',
    province: '湖南省',
    coordinates: [112.9823, 28.1972],
    description: '长沙市中心',
  },
  {
    id: 'shenyang-zhongjie',
    name: '中街',
    city: '沈阳',
    province: '辽宁省',
    coordinates: [123.4569, 41.7992],
    description: '沈阳市中心商业区',
  },
  {
    id: 'dalian-xinghai',
    name: '星海广场',
    city: '大连',
    province: '辽宁省',
    coordinates: [121.5929, 38.8635],
    description: '大连著名广场',
  },
  {
    id: 'qingdao-wusi',
    name: '五四广场',
    city: '青岛',
    province: '山东省',
    coordinates: [120.3847, 36.0611],
    description: '青岛市中心地标',
  },
  {
    id: 'xiamen-zhongshan',
    name: '中山路步行街',
    city: '厦门',
    province: '福建省',
    coordinates: [118.0830, 24.4516],
    description: '厦门市中心商业区',
  },
  {
    id: 'fuzhou-wuyi',
    name: '五一广场',
    city: '福州',
    province: '福建省',
    coordinates: [119.2978, 26.0751],
    description: '福州市中心',
  },
  {
    id: 'nanchang-bayi',
    name: '八一广场',
    city: '南昌',
    province: '江西省',
    coordinates: [115.8937, 28.6820],
    description: '南昌市中心地标',
  },
  {
    id: 'zhanjiang-guanhai',
    name: '观海长廊',
    city: '湛江',
    province: '广东省',
    coordinates: [110.3594, 21.2707],
    description: '湛江市中心滨海区',
  },
];

// 按省份分组
export const landmarksByProvince = cityLandmarks.reduce((acc, landmark) => {
  if (!acc[landmark.province]) {
    acc[landmark.province] = [];
  }
  acc[landmark.province].push(landmark);
  return acc;
}, {} as Record<string, CityLandmark[]>);

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

