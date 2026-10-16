/**
 * 外部导航与地点行动工具库 (#9)
 *
 * 官方文档核验记录：
 * - 官方文档源：高德开放平台 URI API / 路径规划
 * - 文档地址：https://lbs.amap.com/api/uri-api/guide/travel/route
 * - 文档标题：路径规划-出行相关-开发指南-URI API | 高德地图API
 * - 官方文档最后更新时间：2025年03月03日
 * - 核查与验证日期：2026-10-16
 * - 服务端点：https://uri.amap.com/navigation
 * - 坐标系要求：高德坐标系（GCJ-02，火星坐标系）
 * - 坐标顺序契约：lon,lat[,name]（经度在前，纬度在后，地点名称可选）
 * - 适用环境：移动端和PC端（特别注意：骑行模式 mode=ride 仅在移动端有效）
 */

import { wgs84ToGcj02 } from './coord-transform.ts';
import type { TravelProfile, POIWithLayer, CityLandmark } from '../types/index.ts';
import { formatExclusiveTierTime } from './poi-utils.ts';

/**
 * 官方高德 URI API 文档元数据（供核查与交接证据）
 */
export const AMAP_URI_DOC_INFO = {
  docUrl: 'https://lbs.amap.com/api/uri-api/guide/travel/route',
  docTitle: '路径规划-出行相关-开发指南-URI API | 高德地图API',
  docLastUpdated: '2025年03月03日',
  verifiedDate: '2026-10-16',
  serviceEndpoint: 'https://uri.amap.com/navigation',
  coordinateSystem: 'GCJ-02 (高德火星坐标系)',
  coordinateOrder: 'lon,lat,name (经度在前，纬度在后)',
  appSource: 'travel-in-hours',
} as const;

/**
 * 独立设备/平台能力判定（解耦 CSS 视口宽度）
 * 优先检测真实用户代理（navigator.userAgent）与移动端特性。
 *
 * 局限性说明（如实记录）：
 * 1. User-Agent 检测属于经验性特征判定，存在客户端伪造或特殊 WebView 篡改可能；
 * 2. 部分 iPadOS 设备在桌面 Safari 模式下会返回 Macintosh 标识（需结合 maxTouchPoints 探测）；
 * 3. 严格保障 SSR 安全：服务端渲染未获取到 UA 时默认返回 false（按桌面环境保守处理，避免向不支持平台假定移动端能力）。
 */
export function isMobileDevice(customUserAgent?: string): boolean {
  if (typeof customUserAgent === 'string') {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(customUserAgent);
  }

  if (typeof navigator === 'undefined') {
    return false;
  }

  // 1. 现代 User-Agent Client Hints API (Chromium-based)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navData = (navigator as any).userAgentData;
  if (navData && typeof navData.mobile === 'boolean') {
    return navData.mobile;
  }

  // 2. 标准 User-Agent 字符串探测
  const ua = navigator.userAgent || navigator.vendor || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true;
  }

  // 3. iPadOS 13+ 桌面模式检测 (Macintosh 且支持触控)
  if (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) {
    return true;
  }

  return false;
}

/**
 * 出行方式映射至高德 URI mode 参数
 * - driving-car -> car (驾车)
 * - foot-walking -> walk (步行)
 * - cycling-regular -> ride (骑行，仅移动端支持)
 */
export function getAmapTravelMode(profile: TravelProfile): 'car' | 'bus' | 'walk' | 'ride' {
  switch (profile) {
    case 'driving-car':
      return 'car';
    case 'foot-walking':
      return 'walk';
    case 'cycling-regular':
      return 'ride';
    default:
      return 'car';
  }
}

/**
 * 检查桌面端骑行限制
 * 依据官方文档说明：“缺省mode=car；骑行仅在移动端有效；当选择骑行模式时，调起客户端仅对高德地图APP V8.0.0以上版本支持”
 * 严格遵照契约：严禁静默改为驾车，必须显式告知用户并提供复制回退
 */
export interface CyclingRestrictionCheckResult {
  isRestricted: boolean;
  message?: string;
  advice?: string;
}

export function checkDesktopCyclingRestriction(
  profile: TravelProfile,
  isMobilePlatform: boolean
): CyclingRestrictionCheckResult {
  if (profile === 'cycling-regular' && !isMobilePlatform) {
    return {
      isRestricted: true,
      message: '高德地图网页版骑行导航仅限移动端支持。',
      advice: '在桌面端建议切换为步行或驾车，或复制地点与坐标在手机地图中打开。',
    };
  }
  return { isRestricted: false };
}

/**
 * 导航可执行动作解析结果（将平台限制转化为真正的生产执行约束）
 */
export type NavigationActionType = 'web_navigate' | 'copy_fallback_restricted';

export interface ResolvedNavigationAction {
  type: NavigationActionType;
  primaryButtonText: string;
  canDirectlyNavigate: boolean;
  warningMessage?: string;
  adviceMessage?: string;
}

export function resolveNavigationAction(options: {
  profile: TravelProfile;
  isMobilePlatform: boolean;
  navUrl: string | null;
}): ResolvedNavigationAction {
  const { profile, isMobilePlatform, navUrl } = options;
  const restriction = checkDesktopCyclingRestriction(profile, isMobilePlatform);

  if (restriction.isRestricted) {
    return {
      type: 'copy_fallback_restricted',
      primaryButtonText: '复制手机导航信息',
      canDirectlyNavigate: false,
      warningMessage: restriction.message,
      adviceMessage: restriction.advice,
    };
  }

  return {
    type: 'web_navigate',
    primaryButtonText: '在外部地图中导航',
    canDirectlyNavigate: Boolean(navUrl),
  };
}

/**
 * POI 类别中文显示映射
 */
export function getPOICategoryLabel(category: string): string {
  switch (category) {
    case 'tourism':
      return '文旅景点';
    case 'food':
      return '特色美食';
    case 'activity':
      return '休闲娱乐';
    case 'shopping':
      return '商业购物';
    case 'other':
      return '生活设施';
    default:
      return '精选地点';
  }
}

/**
 * 导航路径点定义
 */
export interface NavigationPoint {
  coordinates: [number, number]; // [lng, lat] (WGS-84)
  name: string;
}

export interface CreateAmapNavUrlOptions {
  origin: NavigationPoint | null | undefined;
  destination: NavigationPoint | null | undefined;
  profile: TravelProfile;
  src?: string;
  callnative?: boolean;
}

/**
 * 校验坐标有效性
 */
export function isValidCoordinate(coord: unknown): coord is [number, number] {
  if (!Array.isArray(coord) || coord.length < 2) return false;
  const [lng, lat] = coord;
  if (typeof lng !== 'number' || typeof lat !== 'number') return false;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  // 经度范围 -180 ~ 180，纬度范围 -90 ~ 90
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  return true;
}

/**
 * 构造已核验的高德导航 URI
 * 
 * 关键契约：
 * 1. 唯一转换边界：WGS-84 -> GCJ-02 单次转换，格式为 lon,lat,name；
 * 2. 中文名称使用标准 URLSearchParams / encodeURIComponent 安全编码；
 * 3. 起点用 committed 起点，终点用 selected POI；
 * 4. 出现非法或空坐标时返回 null，绝不拼接乱码或 crash。
 */
export function createAmapNavUrl(options: CreateAmapNavUrlOptions): string | null {
  const { origin, destination, profile, src = 'travel-in-hours', callnative = false } = options;

  if (!origin || !destination) return null;
  if (!isValidCoordinate(origin.coordinates) || !isValidCoordinate(destination.coordinates)) {
    return null;
  }

  const originName = origin.name?.trim() || '起点';
  const destName = destination.name?.trim() || '目的地';

  // 坐标单次转换：WGS-84 -> GCJ-02
  const [gcjFromLng, gcjFromLat] = wgs84ToGcj02(origin.coordinates[0], origin.coordinates[1]);
  const [gcjToLng, gcjToLat] = wgs84ToGcj02(destination.coordinates[0], destination.coordinates[1]);

  const mode = getAmapTravelMode(profile);

  // 经度在前、纬度在后，保留 6 位小数
  const fromValue = `${gcjFromLng.toFixed(6)},${gcjFromLat.toFixed(6)},${originName}`;
  const toValue = `${gcjToLng.toFixed(6)},${gcjToLat.toFixed(6)},${destName}`;

  try {
    const url = new URL(AMAP_URI_DOC_INFO.serviceEndpoint);
    url.searchParams.set('from', fromValue);
    url.searchParams.set('to', toValue);
    url.searchParams.set('mode', mode);
    url.searchParams.set('policy', '0');
    url.searchParams.set('src', src);
    url.searchParams.set('callnative', callnative ? '1' : '0');
    return url.toString();
  } catch (err) {
    console.error('Failed to construct Amap navigation URL:', err);
    return null;
  }
}

/**
 * 格式化地点复制文本（供回退使用）
 * 包含真实可读的地点名、类别、简介、圈层预估、WGS-84与GCJ-02双坐标系以及起点信息
 */
export interface FormatPOICopyTextOptions {
  poi: POIWithLayer;
  origin?: CityLandmark | null;
  profile?: TravelProfile;
  rangeMinutes?: number[];
  navUrl?: string | null;
  isMobilePlatform?: boolean;
}

export function formatPOICopyText(options: FormatPOICopyTextOptions): string {
  const { poi, origin, profile = 'driving-car', rangeMinutes = [15, 30, 60], navUrl, isMobilePlatform = false } = options;

  const categoryLabel = getPOICategoryLabel(poi.category);
  const tierLabel = formatExclusiveTierTime(poi.layerMinutes, rangeMinutes);
  const profileName = profile === 'driving-car' ? '驾车' : profile === 'cycling-regular' ? '骑行' : '步行';

  const [wgsLng, wgsLat] = poi.coordinates;
  const [gcjLng, gcjLat] = wgs84ToGcj02(wgsLng, wgsLat);

  const lines: string[] = [
    `【目的地】${poi.name}`,
    `【类别】${categoryLabel}`,
  ];

  if (poi.description) {
    lines.push(`【简介】${poi.description}`);
  }

  lines.push(`【可达圈层】${tierLabel} 预估可达（${profileName}模式）`);

  if (typeof poi.rating === 'number') {
    lines.push(`【推荐指数】${poi.rating}/5（本地精选推荐）`);
  }

  lines.push(`【位置坐标】${gcjLng.toFixed(6)}, ${gcjLat.toFixed(6)}`);

  if (origin?.name) {
    lines.push(`【出发起点】${origin.name}`);
  }

  if (navUrl) {
    if (profile === 'cycling-regular' && !isMobilePlatform) {
      lines.push(`【高德导航链接(仅手机端有效)】${navUrl}`);
    } else {
      lines.push(`【高德导航链接】${navUrl}`);
    }
  }

  return lines.join('\n');
}

/**
 * 安全复制文本到剪贴板
 * 返回 boolean 标识是否由系统剪贴板原生成功写入
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. 优先尝试现代 Clipboard API
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 权限受限或非安全上下文时降级
    }
  }

  // 2. 降级方案：document.execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}
