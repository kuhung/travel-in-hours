/**
 * 分享功能工具函数与导出契约 (#10 / #11)
 * 统一管理分享快照 payload、链接生成、二维码与离屏隔离图片导出
 */

import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { track } from './analytics.ts';
import type {
  CityLandmark,
  TravelProfile,
  IsochroneFeature,
  POIWithLayer,
  POIByLayer,
  CoverageStatus,
  SharePayload,
  SharePayloadConditions,
  SharePayloadPOIInfo,
} from '../types/index.ts';
import { wgs84ToGcj02 } from './coord-transform.ts';
import { serializeShareParams } from './share-params.ts';
import { formatExclusiveTierTime } from './poi-utils.ts';
import {
  getColorForRange,
  getIsochroneStyle,
  sortIsochronesForRender,
  DESTINATION_STYLE,
} from '../data/isochrone-config.ts';

// ============ 类型定义 ============

export interface ShareParams {
  landmark: CityLandmark;
  profile: TravelProfile;
  rangeMinutes: number[];
}

export interface CreateSharePayloadOptions {
  landmark: CityLandmark;
  profile: TravelProfile;
  rangeMinutes: number[];
  isochrones: IsochroneFeature[];
  selectedPOIId?: string | null;
  selectedPOI?: POIWithLayer | null;
  totalPOIs?: number;
  poiByLayer?: POIByLayer[];
  coverageStatus?: CoverageStatus;
  isPartial?: boolean;
  isExample?: boolean;
  createdAt?: number;
}

export interface ExportImageResult {
  blob: Blob;
  url: string;
  filename: string;
}

export interface ExportShareImageDeps {
  renderSnapshot?: (payload: SharePayload, options: { width: number; height: number; signal?: AbortSignal }) => Promise<HTMLCanvasElement>;
  generateQrDataUrl?: (url: string, options: Record<string, unknown>) => Promise<string>;
  canvasToBlob?: (canvas: HTMLCanvasElement, timeoutMs?: number) => Promise<Blob | null>;
  createObjectURL?: (blob: Blob) => string;
  trackFn?: typeof track;
}

export interface ExportShareImageOptions {
  trackingLocation?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  deps?: ExportShareImageDeps;
}

// ============ 深度冻结工具函数 ============

export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

// ============ HTML 字符转义工具 ============

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============ 异步超时与中止包装器 ============

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) {
    throw new Error('Generation aborted');
  }

  let timer: NodeJS.Timeout | null = null;
  let onAbort: (() => void) | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  const abortPromise = signal
    ? new Promise<never>((_, reject) => {
        onAbort = () => reject(new Error('Generation aborted'));
        signal.addEventListener('abort', onAbort, { once: true });
      })
    : null;

  try {
    const races = abortPromise ? [promise, timeoutPromise, abortPromise] : [promise, timeoutPromise];
    return await Promise.race(races);
  } finally {
    if (timer) clearTimeout(timer);
    if (signal && onAbort) {
      signal.removeEventListener('abort', onAbort);
    }
  }
}

// ============ SharePayload 工厂契约 ============

/**
 * 生产最小类型 SharePayload 快照
 * 进行深度克隆并冻结，保证生成期间草稿修改、结果切换不可污染当前分享快照
 */
export function createSharePayload(options: CreateSharePayloadOptions): Readonly<SharePayload> {
  const {
    landmark,
    profile,
    rangeMinutes,
    isochrones,
    selectedPOIId = null,
    selectedPOI = null,
    totalPOIs = 0,
    poiByLayer = [],
    coverageStatus = totalPOIs > 0 ? 'matched' : 'covered-empty',
    isPartial = false,
    isExample = false,
    createdAt = Date.now(),
  } = options;

  // 尝试在 poiByLayer 中补充 selectedPOI
  let resolvedSelectedPOI: POIWithLayer | null = selectedPOI;
  if (!resolvedSelectedPOI && selectedPOIId) {
    for (const layer of poiByLayer) {
      const found = layer.points.find((p) => p.id === selectedPOIId);
      if (found) {
        resolvedSelectedPOI = found;
        break;
      }
    }
  }

  const conditions: SharePayloadConditions = {
    landmark: JSON.parse(JSON.stringify(landmark)),
    profile,
    rangeMinutes: [...rangeMinutes],
    isExample: Boolean(isExample),
  };

  const poiInfo: SharePayloadPOIInfo = {
    totalPOIs,
    poiByLayer: JSON.parse(JSON.stringify(poiByLayer)),
    coverageStatus,
    isPartial: Boolean(isPartial),
  };

  const payload: SharePayload = {
    version: 1,
    conditions,
    isochrones: JSON.parse(JSON.stringify(isochrones)),
    selectedPOIId,
    selectedPOI: resolvedSelectedPOI ? JSON.parse(JSON.stringify(resolvedSelectedPOI)) : null,
    poiInfo,
    createdAt,
  };

  return deepFreeze(payload);
}

// ============ URL 生成 ============

/**
 * 生成分享 URL
 * 消费 SharePayload 或兼容旧版 ShareParams
 * 当 selectedPOIId 存在时，通过 poi 参数提供可往返契约（供 #11 恢复）
 */
export function generateShareUrl(input: SharePayload | ShareParams): string {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || '';

  const landmark = 'conditions' in input ? input.conditions.landmark : input.landmark;
  const profile = 'conditions' in input ? input.conditions.profile : input.profile;
  const rangeMinutes = 'conditions' in input ? input.conditions.rangeMinutes : input.rangeMinutes;
  const selectedPOIId = 'selectedPOIId' in input ? input.selectedPOIId : undefined;

  return `${baseUrl}?${serializeShareParams({ landmark, profile, rangeMinutes }, selectedPOIId)}`;
}

// ============ 社交分享文案 ============

/**
 * 生成分享文案
 * 支持所选地点明确对象与整次探索对象
 * 严格保持与 #7 承诺对齐（无虚假时长夸大，明确 1 小时以内）
 */
export function generateShareTitle(input: SharePayload | ShareParams): string {
  const landmark = 'conditions' in input ? input.conditions.landmark : input.landmark;
  const profile = 'conditions' in input ? input.conditions.profile : input.profile;
  const rangeMinutes = 'conditions' in input ? input.conditions.rangeMinutes : input.rangeMinutes;
  const selectedPOI = 'selectedPOI' in input ? input.selectedPOI : null;

  const modeText = profile === 'driving-car' ? '驾车' : profile === 'cycling-regular' ? '骑行' : '步行';
  const maxMinutes = rangeMinutes[rangeMinutes.length - 1];
  const durationText = maxMinutes >= 60 ? `${Math.round((maxMinutes / 60) * 10) / 10} 小时` : `${maxMinutes} 分钟`;

  // 若明确分享特定所选地点
  if (selectedPOI) {
    const tierText = formatExclusiveTierTime(selectedPOI.layerMinutes, rangeMinutes);
    return `从${landmark.name}出发，${modeText}${tierText}预估可达${selectedPOI.name}，来看看路线与周边可达范围。`;
  }

  // 整次探索分享文案
  if (profile === 'driving-car') {
    return `从${landmark.name}驾车出发，${durationText}可达范围有多大？来看看我的出行地图。`;
  } else if (profile === 'cycling-regular') {
    return `从${landmark.name}骑行出发，${durationText}能骑到哪里？来看看我的可达范围。`;
  } else {
    return `从${landmark.name}步行出发，${durationText}生活圈有多大？这是我的周边可达范围。`;
  }
}

// ============ 复制链接 ============

/**
 * 复制链接到剪贴板，支持手动回退
 */
export async function copyShareLink(
  input: SharePayload | ShareParams,
  trackingLocation: string = 'share_dialog'
): Promise<{ success: boolean; url: string }> {
  const url = generateShareUrl(input);
  let success = false;

  // 尝试现代 Clipboard API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(url);
      success = true;
    }
  } catch (err) {
    console.warn('Clipboard API failed:', err);
  }

  // 降级 execCommand
  if (!success && typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);

      if (typeof navigator !== 'undefined' && navigator.userAgent.match(/ipad|iphone/i)) {
        const range = document.createRange();
        range.selectNodeContents(textarea);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        textarea.setSelectionRange(0, 999999);
      } else {
        textarea.select();
      }

      success = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (fallbackErr) {
      console.warn('Fallback copy failed:', fallbackErr);
    }
  }

  const profile = 'conditions' in input ? input.conditions.profile : input.profile;

  if (success) {
    track('share_copy_link', {
      location: trackingLocation,
      travel_mode: profile,
      share_target: 'selectedPOIId' in input && input.selectedPOIId ? 'poi' : 'whole',
    });
  }

  return { success, url };
}

// ============ 兼容性与导出辅助函数 (吸收自远端 d368e14) ============

/** 兼容不支持 roundRect 的浏览器（部分微信内置浏览器及旧版内核） */
export function ensureRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: number | number[]
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radii);
    return;
  }
  const r = typeof radii === 'number' ? radii : radii[0] || 0;
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * 安全导出 Canvas 为 PNG Blob
 * 包含有界超时回退，避免 toBlob 回调迟迟不触发挂死
 */
export function canvasToBlob(canvas: HTMLCanvasElement, timeoutMs: number = 4000): Promise<Blob | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | null = null;

    const fallbackToDataUrl = () => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1] || '';
        const byteString = atob(base64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        return new Blob([ab], { type: 'image/png' });
      } catch {
        return null;
      }
    };

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn('canvas.toBlob timed out, falling back to toDataURL');
      resolve(fallbackToDataUrl());
    }, timeoutMs);

    try {
      canvas.toBlob((blob) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (blob) {
          resolve(blob);
        } else {
          resolve(fallbackToDataUrl());
        }
      }, 'image/png');
    } catch (err) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      console.warn('canvas.toBlob threw, trying toDataURL fallback', err);
      resolve(fallbackToDataUrl());
    }
  });
}

/**
 * 触发静态文件下载
 * 明确声明为已发起下载，绝不声称已保存入相册或已发送
 */
export function downloadBlob(blob: Blob, filename: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.error('Download initiation failed:', err);
    return false;
  }
}

// ============ 瓦片加载追踪与等待控制器 (TileLoadController) ============

export interface TileLoadStatus {
  totalRequested: number;
  loaded: number;
  failed: number;
  isComplete: boolean;
  settledWith: 'load' | 'timeout' | 'error' | 'aborted' | 'cached';
}

export interface WaitForTilesOptions {
  timeoutMs?: number;
  graceMs?: number;
  minLoadedTiles?: number;
  signal?: AbortSignal;
}

export interface TileLoadTracker {
  getStatus: () => TileLoadStatus;
  waitForTiles: (options?: WaitForTilesOptions) => Promise<TileLoadStatus>;
  cleanup: () => void;
}

/**
 * 生产实际调用的瓦片加载追踪控制器
 * 监听先于加载与视角触发，追踪必需瓦片加载成功/失败/超时，拒绝全失败灰底冒充成功
 */
export function initTileLoadTracker(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tileLayer: any,
  initialOptions: WaitForTilesOptions = {}
): TileLoadTracker {
  let requested = 0;
  let loaded = 0;
  let failed = 0;
  let allLoadedFired = false;
  let cleanedUp = false;

  let activeCheckError: (() => void) | null = null;
  let activeGraceLoad: (() => void) | null = null;

  const onTileLoadStart = () => { requested++; };
  const onTileLoad = () => { loaded++; };
  const onTileError = () => {
    failed++;
    activeCheckError?.();
  };
  const onLoad = () => {
    allLoadedFired = true;
    activeGraceLoad?.();
  };

  // 监听在视角变换或瓦片请求前挂载
  if (tileLayer && typeof tileLayer.on === 'function') {
    tileLayer.on('tileloadstart', onTileLoadStart);
    tileLayer.on('tileload', onTileLoad);
    tileLayer.on('tileerror', onTileError);
    tileLayer.on('load', onLoad);
  }

  const cleanupListeners = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    activeCheckError = null;
    activeGraceLoad = null;
    if (tileLayer && typeof tileLayer.off === 'function') {
      tileLayer.off('tileloadstart', onTileLoadStart);
      tileLayer.off('tileload', onTileLoad);
      tileLayer.off('tileerror', onTileError);
      tileLayer.off('load', onLoad);
    }
  };

  const getStatus = (): TileLoadStatus => ({
    totalRequested: requested,
    loaded,
    failed,
    isComplete: allLoadedFired,
    settledWith: allLoadedFired ? 'load' : 'cached',
  });

  const waitForTiles = (options: WaitForTilesOptions = {}): Promise<TileLoadStatus> => {
    const timeoutMs = options.timeoutMs ?? initialOptions.timeoutMs ?? 5000;
    const graceMs = options.graceMs ?? initialOptions.graceMs ?? 300;
    const signal = options.signal ?? initialOptions.signal;

    return new Promise<TileLoadStatus>((resolve, reject) => {
      if (signal?.aborted) {
        cleanupListeners();
        reject(new Error('Generation aborted'));
        return;
      }

      let timer: NodeJS.Timeout | null = null;
      let graceTimer: NodeJS.Timeout | null = null;
      let settled = false;

      const clearAllTimers = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
      };

      const settle = (
        outcome: 'fulfilled' | 'rejected',
        reasonOrStatus: Error | TileLoadStatus
      ) => {
        if (settled) return;
        settled = true;
        clearAllTimers();
        if (signal) signal.removeEventListener('abort', onAbort);
        cleanupListeners();
        if (outcome === 'fulfilled') {
          resolve(reasonOrStatus as TileLoadStatus);
        } else {
          reject(reasonOrStatus as Error);
        }
      };

      const onAbort = () => {
        settle('rejected', new Error('Generation aborted'));
      };

      if (signal) {
        signal.addEventListener('abort', onAbort);
      }

      // 严格完整就绪校验策略：严禁缺块、错误或空地图冒充成功
      const checkCompleteness = (settledWith: 'load' | 'timeout' | 'cached'): TileLoadStatus => {
        if (failed > 0) {
          throw new Error(`Map tiles failed to load (${failed} tile error(s))`);
        }
        if (requested === 0 || loaded === 0) {
          throw new Error('Map tiles not ready (0 tiles loaded)');
        }
        if (loaded < requested) {
          throw new Error(`Map tiles timed out with incomplete tiles (${loaded}/${requested} loaded)`);
        }
        return {
          totalRequested: requested,
          loaded,
          failed: 0,
          isComplete: true,
          settledWith,
        };
      };

      // 检查缓存或同步已就绪状态
      const isAlreadyDone = allLoadedFired || (tileLayer?.isLoading && !tileLayer.isLoading() && requested > 0);
      if (isAlreadyDone) {
        try {
          const status = checkCompleteness('cached');
          settle('fulfilled', status);
          return;
        } catch (err) {
          settle('rejected', err as Error);
          return;
        }
      }

      const onReady = (settledWith: 'load' | 'timeout') => {
        try {
          const status = checkCompleteness(settledWith);
          settle('fulfilled', status);
        } catch (err) {
          settle('rejected', err as Error);
        }
      };

      // 激活瓦片错误检测：任一瓦片失败立即中断拒绝，防止导出残缺卡片
      activeCheckError = () => {
        if (settled) return;
        settle('rejected', new Error(`Map tile load failed (${failed} tile error(s))`));
      };

      activeGraceLoad = () => {
        if (settled) return;
        if (graceTimer) clearTimeout(graceTimer);
        graceTimer = setTimeout(() => {
          if (!settled) {
            onReady('load');
          }
        }, graceMs);
      };

      // 超时定时器
      timer = setTimeout(() => {
        if (settled) return;
        onReady('timeout');
      }, timeoutMs);
    });
  };

  return {
    getStatus,
    waitForTiles,
    cleanup: cleanupListeners,
  };
}

// ============ 离屏隔离地图快照渲染 (保证不修改活动地图) ============

function transformCoordinates(coords: unknown, transformFn: (lng: number, lat: number) => [number, number]): unknown {
  if (!Array.isArray(coords)) return coords;
  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    return transformFn(coords[0], coords[1]);
  }
  return coords.map((c) => transformCoordinates(c, transformFn));
}

/**
 * 独立渲染离屏地图快照
 * 严格在独立 Leaflet 容器内进行，绝不修改 window.__leaflet_map，绝不改变活动地图中心与缩放
 */
export async function renderIsolatedMapSnapshot(
  payload: SharePayload,
  options: {
    width: number;
    height: number;
    signal?: AbortSignal;
  }
): Promise<HTMLCanvasElement> {
  if (typeof document === 'undefined') {
    throw new Error('renderIsolatedMapSnapshot requires browser DOM environment');
  }

  if (options.signal?.aborted) {
    throw new Error('Generation aborted');
  }

  // 创建离屏容器（非 display:none，确保可由 html2canvas 正确捕获几何布局）
  const container = document.createElement('div');
  container.id = `export-isolated-map-${Date.now()}`;
  container.setAttribute('aria-hidden', 'true');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${options.width}px`;
  container.style.height = `${options.height}px`;
  container.style.visibility = 'visible';
  container.style.opacity = '1';
  container.style.zIndex = '-99999';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mapInstance: any = null;
  let tileTracker: TileLoadTracker | null = null;

  try {
    if (options.signal?.aborted) throw new Error('Generation aborted');

    // 动态载入 Leaflet 模块
    const L = (await import('leaflet')).default;

    mapInstance = L.map(container, {
      preferCanvas: true,
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: false,
      zoomAnimation: false,
    });

    // 1. 高德瓦片图层 (crossOrigin="anonymous" 避免画布污染)
    const tileLayer = L.tileLayer(
      'https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
      {
        crossOrigin: 'anonymous',
        maxZoom: 18,
      }
    );
    tileLayer.addTo(mapInstance);

    // 瓦片追踪控制器必须在视角变化与请求发起之前初始化
    tileTracker = initTileLoadTracker(tileLayer, { signal: options.signal });

    // 2. 转换等时圈几何坐标 (WGS-84 -> GCJ-02) 并按面积大到小排序绘制（大圈先绘制底图，小圈后绘制上层）
    const transformedFeatures = payload.isochrones.map((feature) => {
      const transformedCoords = transformCoordinates(feature.geometry.coordinates, (lng, lat) => {
        const [gLng, gLat] = wgs84ToGcj02(lng, lat);
        return [gLng, gLat];
      });
      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: transformedCoords,
        },
      };
    });

    // 生产排序控制器：严格从大圈到小圈绘制，消除大圈覆盖内圈的根因
    const sortedFeatures = sortIsochronesForRender(transformedFeatures);

    sortedFeatures.forEach((feature) => {
      const minutes = Math.round(feature.properties.value / 60);
      const style = getIsochroneStyle(minutes);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      L.geoJSON(feature as any, {
        style: {
          color: style.color,
          fillColor: style.fillColor,
          weight: style.weight,
          opacity: style.strokeOpacity,
          fillOpacity: style.opacity,
        },
      }).addTo(mapInstance);
    });

    // 3. 绘制起点 Marker
    const originCoords = payload.conditions.landmark.coordinates;
    const [origGcjLng, origGcjLat] = wgs84ToGcj02(originCoords[0], originCoords[1]);
    const originIcon = L.divIcon({
      className: 'isolated-origin-marker',
      html: `
        <div style="width: 24px; height: 24px; border-radius: 50%; background: #10b981; border: 3px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    L.marker([origGcjLat, origGcjLng], { icon: originIcon }).addTo(mapInstance);

    // 4. 绘制所选地点或全量地点 Marker（防 XSS 注入并给予合理宽度）
    if (payload.selectedPOI) {
      const destCoords = payload.selectedPOI.coordinates;
      const [destGcjLng, destGcjLat] = wgs84ToGcj02(destCoords[0], destCoords[1]);
      const escapedPoiName = escapeHtml(payload.selectedPOI.name);
      const destIcon = L.divIcon({
        className: 'isolated-dest-marker',
        html: `
          <div style="max-width: 180px; padding: 4px 8px; background: ${DESTINATION_STYLE.ink}; color: #ffffff; border-radius: 12px; font-size: 11px; font-weight: bold; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.3); word-break: break-all; white-space: normal; line-height: 1.25; text-align: center;">
            📍 ${escapedPoiName}
          </div>
        `,
        iconSize: [120, 32],
        iconAnchor: [60, 16],
      });
      L.marker([destGcjLat, destGcjLng], { icon: destIcon }).addTo(mapInstance);
    } else {
      payload.poiInfo.poiByLayer.forEach((layer) => {
        const colors = getColorForRange(layer.layerMinutes);
        layer.points.forEach((poi) => {
          const [pGcjLng, pGcjLat] = wgs84ToGcj02(poi.coordinates[0], poi.coordinates[1]);
          const poiIcon = L.divIcon({
            className: 'isolated-poi-marker',
            html: `
              <div style="width: 20px; height: 20px; border-radius: 50%; background: ${colors.color}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid #ffffff; box-shadow: 0 1px 4px rgba(0,0,0,0.25);">
                ${poi.index}
              </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          L.marker([pGcjLat, pGcjLng], { icon: poiIcon }).addTo(mapInstance);
        });
      });
    }

    // 5. 视角包络适配 (Union: 起点 + 等时圈几何 + 所选目的地或所有地点)
    const bounds = L.latLngBounds([origGcjLat, origGcjLng], [origGcjLat, origGcjLng]);
    transformedFeatures.forEach((feature) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const groupItem = L.geoJSON(feature as any);
      bounds.extend(groupItem.getBounds());
    });

    if (payload.selectedPOI) {
      const [destGcjLng, destGcjLat] = wgs84ToGcj02(
        payload.selectedPOI.coordinates[0],
        payload.selectedPOI.coordinates[1]
      );
      bounds.extend([destGcjLat, destGcjLng]);
    } else {
      payload.poiInfo.poiByLayer.forEach((layer) => {
        layer.points.forEach((poi) => {
          const [pGcjLng, pGcjLat] = wgs84ToGcj02(poi.coordinates[0], poi.coordinates[1]);
          bounds.extend([pGcjLat, pGcjLng]);
        });
      });
    }

    mapInstance.fitBounds(bounds, { padding: [36, 36], animate: false });

    // 6. 瓦片等待：若所有瓦片均失败或超时且 0 瓦片加载，明确拒绝
    if (options.signal?.aborted) throw new Error('Generation aborted');
    await tileTracker.waitForTiles({
      timeoutMs: 4000,
      graceMs: 300,
      minLoadedTiles: 1,
      signal: options.signal,
    });

    if (options.signal?.aborted) throw new Error('Generation aborted');

    // 7. 使用 html2canvas 对离屏容器截图 (allowTaint: false, useCORS: true)
    const canvasPromise = html2canvas(container, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#e5e7eb',
      logging: false,
      imageTimeout: 15000,
    });

    const canvas = await withTimeout(
      canvasPromise,
      16000,
      'Map screenshot timed out',
      options.signal
    );

    return canvas;
  } finally {
    if (tileTracker) {
      tileTracker.cleanup();
    }
    if (mapInstance) {
      try {
        mapInstance.remove();
      } catch (err) {
        console.warn('Isolated map remove error:', err);
      }
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

// ============ 图片导出主控制器契约 ============

/**
 * 完整导出分享卡片图片资源
 * 严格分离生成与保存，生成仅返回 Blob 与 ObjectURL 供预览，不写剪贴板、不伪称保存
 */
export async function exportShareImage(
  payload: SharePayload,
  options: ExportShareImageOptions = {}
): Promise<ExportImageResult> {
  const {
    trackingLocation = 'share_dialog',
    signal: callerSignal,
    timeoutMs = 25000,
    deps = {},
  } = options;

  const trackFn = deps.trackFn ?? track;
  const renderSnapshot = deps.renderSnapshot ?? renderIsolatedMapSnapshot;
  const generateQrDataUrl = deps.generateQrDataUrl ?? QRCode.toDataURL;
  const blobFn = deps.canvasToBlob ?? canvasToBlob;
  const createUrl = deps.createObjectURL ?? (typeof URL !== 'undefined' ? URL.createObjectURL.bind(URL) : () => '');

  trackFn('share_image_started', {
    location: trackingLocation,
    travel_mode: payload.conditions.profile,
    max_range: payload.conditions.rangeMinutes[payload.conditions.rangeMinutes.length - 1],
    has_poi: payload.poiInfo.totalPOIs > 0,
    is_destination_share: Boolean(payload.selectedPOI),
  });

  if (callerSignal?.aborted) {
    throw new Error('Generation aborted');
  }

  // 内部专用 AbortController，联合外部 callerSignal 与整体 timeoutMs
  const internalController = new AbortController();
  const internalSignal = internalController.signal;

  let onCallerAbort: (() => void) | null = null;
  if (callerSignal) {
    onCallerAbort = () => internalController.abort();
    callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }

  let overallTimer: NodeJS.Timeout | null = null;
  let timedOut = false;
  overallTimer = setTimeout(() => {
    timedOut = true;
    internalController.abort();
  }, timeoutMs);

  const cleanupTimersAndListeners = () => {
    if (overallTimer) {
      clearTimeout(overallTimer);
      overallTimer = null;
    }
    if (callerSignal && onCallerAbort) {
      callerSignal.removeEventListener('abort', onCallerAbort);
      onCallerAbort = null;
    }
  };

  try {
    if (internalSignal.aborted) {
      throw new Error(callerSignal?.aborted ? 'Generation aborted' : 'Image export overall timeout');
    }

    // 1. 离屏渲染地图快照 (宽度统一 960，高度默认 600)
    const mapWidth = 960;
    const isDestination = Boolean(payload.selectedPOI);
    const footerHeight = 130;
    const headerHeight = isDestination ? 120 : 0;
    const mapHeight = 600;

    const mapCanvas = await renderSnapshot(payload, {
      width: mapWidth,
      height: mapHeight,
      signal: internalSignal,
    });

    if (internalSignal.aborted) {
      throw new Error(callerSignal?.aborted ? 'Generation aborted' : 'Image export overall timeout');
    }

    // 2. 高清二维码生成 (最大 320px)
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const qrDisplaySize = 84;
    const qrGenerateSize = Math.min(qrDisplaySize * dpr * 2, 320);
    const shareUrl = generateShareUrl(payload);

    const qrDataUrlPromise = generateQrDataUrl(shareUrl, {
      margin: 1,
      width: qrGenerateSize,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    });

    const qrDataUrl = await withTimeout(
      qrDataUrlPromise,
      5000,
      'QR code generation timed out',
      internalSignal
    );

    if (internalSignal.aborted) {
      throw new Error(callerSignal?.aborted ? 'Generation aborted' : 'Image export overall timeout');
    }

    // QR Image 解码加载
    const qrImage = new Image();
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        qrImage.onload = () => resolve();
        qrImage.onerror = () => reject(new Error('QR code image load failed'));
        qrImage.src = qrDataUrl;
      }),
      5000,
      'QR code image decoding timed out',
      internalSignal
    );

    if (internalSignal.aborted) {
      throw new Error(callerSignal?.aborted ? 'Generation aborted' : 'Image export overall timeout');
    }

    // 3. 组合最终高 DPI 画布 (限制最大单边 4096，防止移动端内存溢出)
    const totalHeight = headerHeight + mapHeight + footerHeight;
    const finalCanvas = document.createElement('canvas');
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    const maxEdge = 4096;
    const rawScale = Math.max(dpr, 2);
    const scaledW = mapWidth * rawScale;
    const scaledH = totalHeight * rawScale;
    const scale = Math.max(scaledW, scaledH) > maxEdge
      ? (rawScale * maxEdge) / Math.max(scaledW, scaledH)
      : rawScale;

    finalCanvas.width = Math.floor(mapWidth * scale);
    finalCanvas.height = Math.floor(totalHeight * scale);
    ctx.scale(scale, scale);

    // 绘制纯白底色
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, mapWidth, totalHeight);

    // 4.1 若为所选地点卡：绘制顶部目的地与起点关系
    if (isDestination && payload.selectedPOI) {
      drawDestinationHeader(ctx, payload, mapWidth, headerHeight);
    }

    // 4.2 绘制地图快照
    ctx.drawImage(mapCanvas, 0, headerHeight, mapWidth, mapHeight);

    // 4.3 若为整次探索卡：绘制左侧 POI 圈层清单
    if (!isDestination) {
      drawPOIPanel(ctx, payload, mapWidth, mapHeight, headerHeight);
    }

    // 4.4 绘制右下角等时圈图例与估算声明
    drawLegendAndAttribution(ctx, payload, mapWidth, mapHeight, headerHeight);

    // 4.5 绘制底部 Footer 与交互二维码
    drawShareFooter(ctx, payload, qrImage, mapWidth, totalHeight, footerHeight, qrDisplaySize);

    if (internalSignal.aborted) {
      throw new Error(callerSignal?.aborted ? 'Generation aborted' : 'Image export overall timeout');
    }

    // 5. 导出 Blob (通过有界 canvasToBlob 回退保障)
    const blob = await withTimeout(
      blobFn(finalCanvas, 4000),
      5000,
      'Canvas toBlob timed out',
      internalSignal
    );

    if (!blob) {
      throw new Error('Canvas export blocked (tainted or unsupported)');
    }

    // 终态前再次核查：如果已超时或被用户中止，绝对不发布 ObjectURL，不发送 success 埋点
    if (internalSignal.aborted) {
      throw new Error(callerSignal?.aborted ? 'Generation aborted' : 'Image export overall timeout');
    }

    const url = createUrl(blob);

    // 分析事件仅代表图片资源已生成且可预览，不宣称已发送给朋友
    trackFn('share_image_success', {
      location: trackingLocation,
      method: 'blob_generated',
      travel_mode: payload.conditions.profile,
      is_destination_share: isDestination,
    });

    const filename = isDestination && payload.selectedPOI
      ? `keda-${payload.conditions.landmark.name}-to-${payload.selectedPOI.name}.png`
      : `keda-map-${payload.conditions.landmark.name}.png`;

    return { blob, url, filename };
  } catch (err) {
    if (timedOut) {
      throw new Error('Image export overall timeout');
    }
    throw err;
  } finally {
    cleanupTimersAndListeners();
  }
}

// ============ 绘制辅助细节 ============

function drawDestinationHeader(
  ctx: CanvasRenderingContext2D,
  payload: SharePayload,
  width: number,
  height: number
) {
  const poi = payload.selectedPOI;
  if (!poi) return;

  const modeText = payload.conditions.profile === 'driving-car' ? '驾车' : payload.conditions.profile === 'cycling-regular' ? '骑行' : '步行';
  const tierText = formatExclusiveTierTime(poi.layerMinutes, payload.conditions.rangeMinutes);

  // 背景
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f8fafc');
  gradient.addColorStop(1, '#f1f5f9');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(width, height);
  ctx.stroke();

  // 标签（采用深青色 DESTINATION_STYLE 避免误导为危险/错误红）
  const paddingX = 28;
  let currentY = 28;

  ctx.fillStyle = DESTINATION_STYLE.badgeBg;
  ctx.beginPath();
  ensureRoundRect(ctx, paddingX, currentY - 2, 72, 22, 6);
  ctx.fill();

  ctx.fillStyle = DESTINATION_STYLE.badgeText;
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('所选目的地', paddingX + 36, currentY + 9);

  // 目的地名称
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let displayName = poi.name;
  if (ctx.measureText(displayName).width > width - 260) {
    while (ctx.measureText(displayName + '...').width > width - 260 && displayName.length > 0) {
      displayName = displayName.slice(0, -1);
    }
    displayName += '...';
  }
  ctx.fillText(displayName, paddingX + 82, currentY + 9);

  currentY += 34;

  // 起点与估算出行时间关系
  ctx.fillStyle = '#334155';
  ctx.font = '500 14px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `从「${payload.conditions.landmark.name}」出发 · ${modeText} · ${tierText}预估可达`,
    paddingX,
    currentY + 6
  );

  currentY += 26;

  // 描述或本地推荐说明
  ctx.fillStyle = '#64748b';
  ctx.font = '400 12px system-ui, -apple-system, sans-serif';
  const desc = poi.description ? `简介：${poi.description}` : '预估时间基于 500m 网格对齐计算，非单点精确导航';
  let displayDesc = desc;
  if (ctx.measureText(displayDesc).width > width - paddingX * 2) {
    while (ctx.measureText(displayDesc + '...').width > width - paddingX * 2 && displayDesc.length > 0) {
      displayDesc = displayDesc.slice(0, -1);
    }
    displayDesc += '...';
  }
  ctx.fillText(displayDesc, paddingX, currentY + 4);
}

function drawPOIPanel(
  ctx: CanvasRenderingContext2D,
  payload: SharePayload,
  mapWidth: number,
  mapHeight: number,
  offsetY: number
) {
  const { poiInfo } = payload;
  const listPanelWidth = 220;
  const listPadding = 14;
  const listX = 20;
  const listY = offsetY + 20;
  const maxListHeight = mapHeight - 40;

  // 若无 POI 或未覆盖
  if (poiInfo.totalPOIs === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.beginPath();
    ensureRoundRect(ctx, listX, listY, listPanelWidth, 76, 12);
    ctx.fill();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('可达地点', listX + listPadding, listY + listPadding);

    ctx.fillStyle = '#64748b';
    ctx.font = '400 11px system-ui, -apple-system, sans-serif';
    const explanation = poiInfo.coverageStatus === 'uncovered'
      ? '超出当前收录范围（未收录非无设施）'
      : '当前收录范围内未找到匹配地点';
    ctx.fillText(explanation, listX + listPadding, listY + listPadding + 20);
    return;
  }

  // 计算所需高度
  let neededHeight = 48;
  poiInfo.poiByLayer.forEach((layer) => {
    neededHeight += 24 + layer.points.length * 20 + 8;
  });
  const actualHeight = Math.min(neededHeight, maxListHeight);

  // 绘制背景面板
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ensureRoundRect(ctx, listX, listY, listPanelWidth, actualHeight, 14);
  ctx.fill();

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 头部标题
  let curY = listY + listPadding;
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ensureRoundRect(ctx, listX + listPadding, curY, 3, 16, 1.5);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('可达热点', listX + listPadding + 8, curY);

  ctx.fillStyle = '#64748b';
  ctx.font = '400 11px system-ui, -apple-system, sans-serif';
  ctx.fillText(`共 ${poiInfo.totalPOIs} 处`, listX + listPadding + 64, curY + 1);

  curY += 28;

  let hasOverflow = false;

  // 各圈层分组
  for (const layer of poiInfo.poiByLayer) {
    if (curY > listY + actualHeight - 34) {
      hasOverflow = true;
      break;
    }

    const tierTitle = formatExclusiveTierTime(layer.layerMinutes, payload.conditions.rangeMinutes);
    ctx.fillStyle = layer.fillColor;
    ctx.beginPath();
    ensureRoundRect(ctx, listX + listPadding, curY, 80, 18, 9);
    ctx.fill();

    ctx.strokeStyle = layer.color;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = layer.color;
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tierTitle, listX + listPadding + 40, curY + 9);

    curY += 24;

    for (const pt of layer.points) {
      if (curY > listY + actualHeight - 24) {
        hasOverflow = true;
        break;
      }

      // 序号圆点
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.arc(listX + listPadding + 8, curY + 8, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pt.index.toString(), listX + listPadding + 8, curY + 8);

      // 名称截断
      ctx.fillStyle = '#1e293b';
      ctx.font = '500 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      let name = pt.name;
      const maxWidth = listPanelWidth - listPadding * 2 - 24;
      while (ctx.measureText(name).width > maxWidth && name.length > 0) {
        name = name.slice(0, -1);
      }
      if (name !== pt.name) name += '...';
      ctx.fillText(name, listX + listPadding + 20, curY + 1);

      curY += 20;
    }

    curY += 6;
  }

  if (hasOverflow) {
    ctx.fillStyle = '#64748b';
    ctx.font = '500 10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('...更多地点扫码见交互链接', listX + listPadding, listY + actualHeight - 6);
  }
}

function drawLegendAndAttribution(
  ctx: CanvasRenderingContext2D,
  payload: SharePayload,
  mapWidth: number,
  mapHeight: number,
  offsetY: number
) {
  const legendWidth = 148;
  const legendHeight = 112;
  const legendX = mapWidth - legendWidth - 20;
  const legendY = offsetY + mapHeight - legendHeight - 20;

  // 图例背景
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.beginPath();
  ensureRoundRect(ctx, legendX, legendY, legendWidth, legendHeight, 10);
  ctx.fill();

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 标题
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('可达时间预估 (互斥)', legendX + 10, legendY + 8);

  const ranges = payload.conditions.rangeMinutes;
  ranges.forEach((min, idx) => {
    const itemY = legendY + 28 + idx * 18;
    const tierText = formatExclusiveTierTime(min, ranges);
    const colors = getColorForRange(min);

    ctx.fillStyle = colors.fillColor;
    ctx.beginPath();
    ensureRoundRect(ctx, legendX + 10, itemY, 14, 14, 3);
    ctx.fill();

    ctx.strokeStyle = colors.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '500 10px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(tierText, legendX + 30, itemY + 7);
  });

  // 署名与估算含义
  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 9px system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.fillText('© 高德地图 · 500m网格对齐预估', legendX + 10, legendY + legendHeight - 6);
}

function drawShareFooter(
  ctx: CanvasRenderingContext2D,
  payload: SharePayload,
  qrImage: HTMLImageElement,
  mapWidth: number,
  totalHeight: number,
  footerHeight: number,
  qrDisplaySize: number
) {
  const footerY = totalHeight - footerHeight;

  // 背景
  const gradient = ctx.createLinearGradient(0, footerY, 0, totalHeight);
  gradient.addColorStop(0, '#f8fafc');
  gradient.addColorStop(1, '#f1f5f9');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, footerY, mapWidth, footerHeight);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(mapWidth, footerY);
  ctx.stroke();

  const paddingX = 28;
  const isDestination = Boolean(payload.selectedPOI);
  const modeText = payload.conditions.profile === 'driving-car' ? '驾车' : payload.conditions.profile === 'cycling-regular' ? '骑行' : '步行';

  const now = new Date(payload.createdAt);
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  // 左侧品牌与信息
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('可达出行', paddingX, footerY + 34);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('探索 1 小时出行圈', paddingX + 90, footerY + 34);

  ctx.fillStyle = '#475569';
  ctx.font = '500 13px system-ui, -apple-system, sans-serif';
  const subtitle = isDestination && payload.selectedPOI
    ? `目的地: ${payload.selectedPOI.name} (从 ${payload.conditions.landmark.name} 出发 · ${modeText})`
    : `出发起点: ${payload.conditions.landmark.name} · ${modeText} · 15/30/60m 可达探索`;
  ctx.fillText(subtitle, paddingX, footerY + 62);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 11px system-ui, -apple-system, sans-serif';
  ctx.fillText(`生成时间: ${dateStr} · 静态快照 · https://keda.kuhung.me`, paddingX, footerY + 86);

  // 右侧二维码
  const qrX = mapWidth - paddingX - qrDisplaySize;
  const qrY = footerY + (footerHeight - qrDisplaySize) / 2;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ensureRoundRect(ctx, qrX - 4, qrY - 4, qrDisplaySize + 8, qrDisplaySize + 8, 8);
  ctx.fill();

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrImage, qrX, qrY, qrDisplaySize, qrDisplaySize);
  ctx.imageSmoothingEnabled = true;

  ctx.fillStyle = '#64748b';
  ctx.font = '500 10px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(isDestination ? '扫码看路线' : '扫码看交互地图', qrX + qrDisplaySize / 2, qrY + qrDisplaySize + 4);
}
