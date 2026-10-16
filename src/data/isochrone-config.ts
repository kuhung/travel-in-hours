import type { IsochroneRange, TravelProfile } from '../types/index.ts';

// 等时圈时间范围配置 (分钟) - 固定3档：15分钟、30分钟、1小时
export const defaultTimeRanges = [15, 30, 60];

// 视觉参考：白底深色标题，蓝色主操作，橙色强调与核心圈。
export const VISUAL_THEME = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  accent: '#ff4b23',
  accentInk: '#c2410c',
  ink: '#111827',
  surface: '#ffffff',
} as const;

// 15 分钟橙色核心圈，30 分钟蓝色，60 分钟浅蓝；线型辅助区分两层蓝色。
export const isochroneColors: IsochroneRange[] = [
  { minutes: 15, color: VISUAL_THEME.accentInk, fillColor: '#ff673f', opacity: 0.5 },
  { minutes: 30, color: VISUAL_THEME.primaryDark, fillColor: '#3b82f6', opacity: 0.3 },
  { minutes: 60, color: VISUAL_THEME.primary, fillColor: '#93c5fd', opacity: 0.16 },
];

// 选中目的地采用深色标记，与彩色圈层区分。
export const DESTINATION_STYLE = {
  ink: VISUAL_THEME.ink,
  fill: '#f1f5f9',
  badgeBg: VISUAL_THEME.ink,
  badgeText: '#ffffff',
  stroke: '#ffffff',
  strokeWidth: 3,
  scale: 1.15,
} as const;

// 完整样式配置接口
export interface IsochroneStyle {
  minutes: number;
  color: string;
  fillColor: string;
  opacity: number;        // 面填充透明度 (fillOpacity)
  weight: number;         // 边界描边线宽
  dashArray?: string;     // 实线 / 长虚线 / 短虚线，辅助区分圈层
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
    weight: 3,
    strokeOpacity: 1,
    dashArray: config.minutes === 30 ? '10 6' : config.minutes === 60 ? '3 6' : undefined,
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
