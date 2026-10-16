import type { IsochroneRange, TravelProfile } from '../types/index.ts';

// 等时圈时间范围配置 (分钟) - 固定3档：15分钟、30分钟、1小时
export const defaultTimeRanges = [15, 30, 60];

// 恢复 2026-10-16 之前的浅绿 / 浅黄 / 浅红圈层配色。
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

// 目的地标记样式统一契约（深青色，摆脱危险错误红混淆）
export const DESTINATION_STYLE = {
  ink: '#0f766e',        // 深青色标记底色 (Teal-700)
  fill: '#ccfbf1',       // 浅青色填充背景 (Teal-100)
  badgeBg: '#0f766e',    // 导出卡片目的地徽章底色
  badgeText: '#ffffff',  // 白色文字 (对比度 >= 5.4:1)
  stroke: '#ffffff',     // 边框描边
  strokeWidth: 3,        // 加粗描边
  scale: 1.15,           // 放大倍率
} as const;

// 完整样式配置接口
export interface IsochroneStyle {
  minutes: number;
  color: string;
  fillColor: string;
  opacity: number;        // 面填充透明度 (fillOpacity)
  dashArray?: string;
  weight: number;         // 边界描边线宽
  strokeOpacity: number;  // 边界描边透明度
}

// 获取圈层颜色配置（单一配置源）
export const getColorForRange = (minutes: number): IsochroneRange => {
  const config = isochroneColors.find(c => c.minutes === minutes);
  return config || isochroneColors[0];
};

// 获取圈层完整样式 helper（地图与离屏导出统一规范）
export const getIsochroneStyle = (minutes: number): IsochroneStyle => {
  const config = getColorForRange(minutes);
  return {
    minutes: config.minutes,
    color: config.color,
    fillColor: config.fillColor,
    opacity: config.opacity,
    weight: 2,
    strokeOpacity: 0.85,
  };
};

/**
 * 生产排序 helper：
 * 将等时圈特征要素按 properties.value 从大到小（降序）排序，
 * 确保活动地图与离屏导出画布固定先绘制大圈 (60m) 后绘制小圈 (15m)，
 * 避免外圈覆盖内圈，且输入任意顺序不改变原始 payload / 数组（纯函数）。
 */
export function sortIsochronesForRender<T extends { properties: { value: number } }>(
  features: readonly T[]
): T[] {
  if (!features || !Array.isArray(features)) return [];
  return [...features].sort((a, b) => (b?.properties?.value ?? 0) - (a?.properties?.value ?? 0));
}

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
