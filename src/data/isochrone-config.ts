import { IsochroneRange, TravelProfile } from '@/types';

// 等时圈时间范围配置 (分钟) - 固定3档：15分钟、30分钟、1小时
export const defaultTimeRanges = [15, 30, 60];

// 颜色方案 - 浅绿(15m) → 浅黄(30m) → 浅红(1h)
export const isochroneColors: IsochroneRange[] = [
  {
    minutes: 15,
    color: '#15803d',
    fillColor: '#86efac', // 浅绿
    opacity: 0.6,
  },
  {
    minutes: 30,
    color: '#a16207',
    fillColor: '#fde68a', // 浅黄
    opacity: 0.5,
  },
  {
    minutes: 60,
    color: '#dc2626',
    fillColor: '#fca5a5', // 浅红
    opacity: 0.4,
  },
];

// 出行方式配置
export const travelProfiles: {
  id: TravelProfile;
  name: string;
  icon: string;
  description: string;
  maxRange: number; // 最大时间范围（分钟）
}[] = [
  {
    id: 'driving-car',
    name: '驾车',
    icon: '🚗',
    description: '自驾出行',
    maxRange: 60, // ORS 限制驾车最多 1 小时
  },
  {
    id: 'cycling-regular',
    name: '骑行',
    icon: '🚴',
    description: '骑行出行',
    maxRange: 300, // 5 小时
  },
  {
    id: 'foot-walking',
    name: '步行',
    icon: '🚶',
    description: '步行出行',
    maxRange: 1200, // 20 小时
  },
];

// 获取颜色配置
export const getColorForRange = (minutes: number): IsochroneRange => {
  const config = isochroneColors.find(c => c.minutes === minutes);
  return config || isochroneColors[0];
};

// 将秒转换为可读时间
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
  }
  return `${minutes}分钟`;
};

// 将分钟转换为秒（ORS API 使用秒）
export const minutesToSeconds = (minutes: number): number => minutes * 60;
