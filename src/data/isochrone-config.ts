import type { IsochroneRange, TravelProfile } from '../types/index.ts';

// 等时圈时间范围配置 (分钟) - 固定3档：15分钟、30分钟、1小时
export const defaultTimeRanges = [15, 30, 60];

// 视觉主题与调色板规范 (Refactoring UI & Baseline UI 契约)
export const VISUAL_THEME = {
  // 主色 (Primary) - 科技天蓝，用于 30 分钟主圈、核心品牌与主要按钮
  primary: '#2563eb',       // Blue 600
  primaryDark: '#1d4ed8',   // Blue 700
  primaryLight: '#3b82f6',  // Blue 500
  primarySubtle: '#93c5fd', // Blue 300
  primaryBg: '#eff6ff',     // Blue 50

  // 强调色 (Accent) - 活力珊瑚橙，用于 15 分钟核心圈、焦点数值强调（如“30”分钟）、关键亮点
  accent: '#ff4b23',        // Coral Orange 500
  accentDark: '#e03a14',    // Coral Orange 600
  accentInk: '#ff4b23',     // Coral 600
  accentLight: '#ff5722',   // Coral 400
  accentBg: '#fff7ed',      // Orange 50

  // 外延色 (Subtle Extended) - 清新冰蓝，用于 60 分钟外延辐射圈
  extended: '#60a5fa',      // Blue 400
  extendedLight: '#93c5fd', // Blue 300
  extendedBg: '#f0f9ff',    // Sky 50

  // 中性灰阶 (Neutrals) - 文本与层级
  ink: '#111827',           // Gray 900 - 核心大标题、黑色极简图钉
  inkSecondary: '#334155',  // Slate 700 - 正文、次级标题
  muted: '#64748b',         // Slate 500 - 副标题、说明文案
  subtle: '#94a3b8',        // Slate 400 - 辅助标注、签名
  border: '#e2e8f0',        // Slate 200 - 统一边框
  surface: '#ffffff',       // 纯白表面
  surfaceMuted: '#f8fafc',  // Slate 50 - 底色与淡色卡片
} as const;

// 圈层层级色彩（单一事实源）：15m 活力珊瑚橙，30m 科技天蓝，60m 清新冰蓝
// 遵循图2规范：全部采用精细实线，剔除锯齿毛刺虚线（dashArray），保证边缘光滑细腻
export const isochroneColors: IsochroneRange[] = [
  { minutes: 15, color: '#ff4b23', fillColor: '#ff5722', opacity: 0.30 },
  { minutes: 30, color: '#2563eb', fillColor: '#3b82f6', opacity: 0.22 },
  { minutes: 60, color: '#60a5fa', fillColor: '#93c5fd', opacity: 0.12 },
];

// 圈层徽章标签配置（图2同款胶囊标签）
export const TIER_BADGE_CONFIG: Record<number, { text: string; bg: string; color: string; border: string }> = {
  15: { text: '15 分钟', bg: '#ff4b23', color: '#ffffff', border: 'rgba(255,255,255,0.85)' },
  30: { text: '30 分钟', bg: '#2563eb', color: '#ffffff', border: 'rgba(255,255,255,0.85)' },
  60: { text: '60 分钟', bg: '#3b82f6', color: '#ffffff', border: 'rgba(255,255,255,0.85)' },
};

// 极简黑色图钉（图2同款 Origin Pin）
export const MINIMAL_ORIGIN_PIN_SVG = `<svg viewBox="0 0 28 38" width="28" height="38" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 38 14 38C14 38 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#0f172a"/>
  <circle cx="14" cy="14" r="5" fill="#ffffff"/>
</svg>`;

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
  dashArray?: string;     // 实线 / 长虚线 / 短虚线
  strokeOpacity: number;  // 边界描边透明度
}

// 获取圈层颜色配置（单一配置源）
export const getColorForRange = (minutes: number): IsochroneRange => {
  const config = isochroneColors.find(c => c.minutes === minutes);
  return config || isochroneColors[0];
};

// 获取圈层完整样式 helper（地图与离屏导出统一规范：实线微线宽，极致平滑）
export const getIsochroneStyle = (minutes: number): IsochroneStyle => {
  const config = getColorForRange(minutes);
  const weight = config.minutes === 15 ? 2 : config.minutes === 30 ? 1.8 : 1.5;
  return {
    minutes: config.minutes,
    color: config.color,
    fillColor: config.fillColor,
    opacity: config.opacity,
    weight,
    strokeOpacity: 0.95,
    dashArray: undefined,
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
