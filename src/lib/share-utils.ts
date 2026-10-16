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
          dashArray: style.dashArray,
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

    // 历史排版：上方地图，左侧地点清单，右下图例，独立底栏与二维码。
    const mapWidth = 960;
    const mapHeight = 600;
    const footerHeight = 100;
    const totalHeight = mapHeight + footerHeight;
    const isLandscape = true;
    const isDestination = Boolean(payload.selectedPOI);

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
    const qrDisplaySize = 72;
    const qrGenerateSize = Math.min(qrDisplaySize * dpr * 2, 320);
    const shareUrl = generateShareUrl(payload);

    const qrDataUrlPromise = generateQrDataUrl(shareUrl, {
      margin: 1,
      width: qrGenerateSize,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
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

    ctx.drawImage(mapCanvas, 0, 0, mapWidth, mapHeight);
    if (payload.poiInfo.totalPOIs > 0) {
      drawPOIPanel(ctx, payload.poiInfo.poiByLayer, mapWidth, mapHeight, isLandscape, payload.conditions.rangeMinutes);
    }
    drawLegend(ctx, payload.conditions.rangeMinutes, mapWidth, mapHeight, isLandscape);
    drawFooter(ctx, payload.conditions.landmark, payload.conditions.profile,
      payload.conditions.rangeMinutes, qrImage, mapWidth, mapHeight,
      footerHeight, isLandscape, qrDisplaySize);

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

// ============ 绘制辅助函数 ============

function drawPOIPanel(
  ctx: CanvasRenderingContext2D,
  poiByLayer: POIByLayer[],
  mapWidth: number,
  mapHeight: number,
  isLandscape: boolean,
  rangeMinutes: number[]
) {
  const totalPOIs = poiByLayer.reduce((sum, layer) => sum + layer.points.length, 0);
  const listPanelWidth = isLandscape
    ? Math.min(180, mapWidth * 0.18)
    : Math.min(200, mapWidth * 0.22);

  const listPadding = isLandscape ? 12 : 16;
  const headerHeight = 56;

  let neededHeight = headerHeight + 16;
  poiByLayer.forEach(layer => {
    neededHeight += 24 + layer.points.length * 22 + 12;
  });

  const maxListHeight = mapHeight - 40;
  const actualListHeight = Math.min(neededHeight, maxListHeight);

  const listX = 16;
  const listY = 16;

  // 背景渐变
  const bgGradient = ctx.createLinearGradient(listX, listY, listX + listPanelWidth, listY + actualListHeight);
  bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  bgGradient.addColorStop(1, 'rgba(248, 250, 252, 0.92)');

  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = bgGradient;
  ctx.beginPath();
  ensureRoundRect(ctx, listX, listY, listPanelWidth, actualListHeight, 16);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.shadowColor = 'transparent';

  // 标题区域
  let currentY = listY + listPadding;

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ensureRoundRect(ctx, listX + listPadding, currentY, 3, 18, 1.5);
  ctx.fill();

  ctx.fillStyle = '#1f2937';
  ctx.font = `bold ${isLandscape ? 13 : 14}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('可达热点', listX + listPadding + 10, currentY + 1);

  ctx.fillStyle = '#9ca3af';
  ctx.font = `400 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(`共 ${totalPOIs} 个地点`, listX + listPadding + 10, currentY + (isLandscape ? 16 : 18));

  currentY += headerHeight - 10;

  // 绘制各圈层
  poiByLayer.forEach((layer) => {
    if (currentY > listY + actualListHeight - 30) return;

    const pillWidth = ctx.measureText(formatExclusiveTierTime(layer.layerMinutes, rangeMinutes)).width + 24;
    const pillHeight = 20;

    ctx.fillStyle = layer.fillColor;
    ctx.beginPath();
    ensureRoundRect(ctx, listX + listPadding, currentY, pillWidth, pillHeight, pillHeight / 2);
    ctx.fill();

    ctx.strokeStyle = layer.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = layer.color;
    ctx.font = `600 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(formatExclusiveTierTime(layer.layerMinutes, rangeMinutes), listX + listPadding + 12, currentY + pillHeight / 2);

    currentY += pillHeight + 8;

    layer.points.forEach((poi) => {
      if (currentY > listY + actualListHeight - 24) return;

      const circleX = listX + listPadding + 9;
      const circleY = currentY + 9;
      const circleRadius = isLandscape ? 7 : 8;

      ctx.shadowColor = layer.color + '40';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;

      ctx.beginPath();
      ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
      ctx.fillStyle = layer.color;
      ctx.fill();

      ctx.shadowColor = 'transparent';

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${isLandscape ? 8 : 9}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(poi.index.toString(), circleX, circleY);

      ctx.fillStyle = '#374151';
      ctx.font = `500 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      let poiName = poi.name;
      const maxWidth = listPanelWidth - listPadding * 2 - 28;
      while (ctx.measureText(poiName).width > maxWidth && poiName.length > 0) {
        poiName = poiName.slice(0, -1);
      }
      if (poiName !== poi.name) poiName += '...';

      ctx.fillText(poiName, listX + listPadding + 22, currentY + 4);
      currentY += isLandscape ? 20 : 22;
    });

    currentY += 8;
  });
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  rangeMinutes: number[],
  mapWidth: number,
  mapHeight: number,
  isLandscape: boolean
) {
  const legendPadding = 10;
  const legendItemHeight = isLandscape ? 20 : 22;
  const legendWidth = isLandscape ? 110 : 120;
  const legendHeight = legendPadding * 2 + 18 + rangeMinutes.length * legendItemHeight;

  const legendX = mapWidth - legendWidth - 16;
  const legendY = mapHeight - legendHeight - 16;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ensureRoundRect(ctx, legendX, legendY, legendWidth, legendHeight, 12);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.shadowColor = 'transparent';

  ctx.fillStyle = '#6b7280';
  ctx.font = `600 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('等时圈范围', legendX + legendPadding, legendY + legendPadding);

  rangeMinutes.forEach((minutes, index) => {
    const { color, fillColor } = getColorForRange(minutes);
    const itemY = legendY + legendPadding + 18 + index * legendItemHeight;

    const boxSize = isLandscape ? 14 : 16;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ensureRoundRect(ctx, legendX + legendPadding, itemY, boxSize, boxSize, 3);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#374151';
    ctx.font = `500 ${isLandscape ? 10 : 11}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(formatExclusiveTierTime(minutes, rangeMinutes), legendX + legendPadding + boxSize + 8, itemY + 2);
  });
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  landmark: CityLandmark,
  profile: TravelProfile,
  rangeMinutes: number[],
  qrImage: HTMLImageElement,
  mapWidth: number,
  mapHeight: number,
  footerHeight: number,
  isLandscape: boolean,
  qrDisplaySize: number
) {
  const footerY = mapHeight;
  const canvasWidth = mapWidth;

  // Footer 背景渐变
  const footerGradient = ctx.createLinearGradient(0, footerY, 0, footerY + footerHeight);
  footerGradient.addColorStop(0, '#fafafa');
  footerGradient.addColorStop(1, '#f5f5f5');
  ctx.fillStyle = footerGradient;
  ctx.fillRect(0, footerY, canvasWidth, footerHeight);

  // 顶部分割线
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(canvasWidth, footerY);
  ctx.stroke();

  const padding = isLandscape ? 24 : 28;
  const qrSize = qrDisplaySize;
  const isNarrowScreen = canvasWidth < 500;

  const modeText = profile === 'driving-car' ? '驾车' :
                   profile === 'cycling-regular' ? '骑行' : '步行';
  const maxMinutes = rangeMinutes[rangeMinutes.length - 1];
  const rangeText = maxMinutes >= 60
    ? `${Math.round(maxMinutes / 60 * 10) / 10}h`
    : `${maxMinutes}min`;

  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const fullDateStr = `${dateStr} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (isNarrowScreen) {
    // 窄屏两栏布局
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(landmark.name, padding, footerY + 28);

    ctx.fillStyle = '#6b7280';
    ctx.font = '500 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${modeText} | ${rangeText} 可达`, padding, footerY + 52);

    ctx.fillStyle = '#10b981';
    ctx.font = '500 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('可达出行', padding, footerY + 76);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '400 10px system-ui, -apple-system, sans-serif';
    ctx.fillText(dateStr, padding + 50, footerY + 76);

    // 右栏：二维码
    const qrX = canvasWidth - padding - qrSize;
    const qrY = footerY + (footerHeight - qrSize - 12) / 2;

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ensureRoundRect(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 8);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    ctx.imageSmoothingEnabled = true;

    ctx.fillStyle = '#9ca3af';
    ctx.font = '400 9px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('扫码查看', qrX + qrSize / 2, qrY + qrSize + 10);

  } else {
    // 宽屏三栏布局
    const leftColumnX = padding;
    const centerX = canvasWidth / 2;
    const rightColumnX = canvasWidth - padding - qrSize;

    // 左栏：地点信息
    ctx.fillStyle = '#1f2937';
    ctx.font = `bold ${isLandscape ? 22 : 26}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const leftLineY1 = footerY + (isLandscape ? 32 : 38);
    ctx.fillText(landmark.name, leftColumnX, leftLineY1);

    ctx.fillStyle = '#6b7280';
    ctx.font = `500 ${isLandscape ? 14 : 16}px system-ui, -apple-system, sans-serif`;
    const leftLineY2 = footerY + (isLandscape ? 58 : 70);
    ctx.fillText(`${modeText}  |  ${rangeText} 可达范围`, leftColumnX, leftLineY2);

    ctx.fillStyle = '#9ca3af';
    ctx.font = `400 ${isLandscape ? 11 : 13}px system-ui, -apple-system, sans-serif`;
    const leftLineY3 = footerY + (isLandscape ? 80 : 96);
    ctx.fillText(fullDateStr, leftColumnX, leftLineY3);

    // 中栏：品牌 Logo
    ctx.textAlign = 'center';

    const logoSize = isLandscape ? 26 : 30;
    const logoY = footerY + (isLandscape ? 28 : 34);

    ctx.fillStyle = '#10b981';
    ctx.shadowColor = 'rgba(16, 185, 129, 0.25)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ensureRoundRect(ctx, centerX - logoSize / 2, logoY - logoSize / 2, logoSize, logoSize, 7);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const iconSize = isLandscape ? 10 : 12;
    ctx.beginPath();
    ctx.moveTo(centerX - iconSize, logoY + iconSize / 2);
    ctx.lineTo(centerX - iconSize / 3, logoY - iconSize / 2);
    ctx.lineTo(centerX + iconSize / 3, logoY + iconSize / 2);
    ctx.lineTo(centerX + iconSize, logoY - iconSize / 2);
    ctx.stroke();

    ctx.fillStyle = '#1f2937';
    ctx.font = `bold ${isLandscape ? 16 : 18}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('可达出行', centerX, footerY + (isLandscape ? 56 : 66));

    ctx.fillStyle = '#9ca3af';
    ctx.font = `400 ${isLandscape ? 10 : 12}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('探索你的小时边界', centerX, footerY + (isLandscape ? 74 : 86));

    ctx.fillStyle = '#10b981';
    ctx.font = `400 ${isLandscape ? 9 : 11}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('https://keda.kuhung.me', centerX, footerY + (isLandscape ? 88 : 102));

    // 右栏：二维码
    const qrX = rightColumnX;
    const qrY = footerY + (footerHeight - qrSize - (isLandscape ? 12 : 16)) / 2;

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ensureRoundRect(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 10);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    ctx.imageSmoothingEnabled = true;

    ctx.fillStyle = '#9ca3af';
    ctx.font = `400 ${isLandscape ? 9 : 10}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('扫码查看本地图', qrX + qrSize / 2, qrY + qrSize + (isLandscape ? 12 : 14));
  }
}

