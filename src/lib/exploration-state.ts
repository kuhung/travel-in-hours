import type { CityLandmark, IsochroneFeature, TravelProfile } from '../types';
import { cities } from '../data/landmarks.ts';

export type ExplorationSource = 'example' | 'current-location' | 'preset' | 'custom' | 'share';

export interface ExplorationConditions {
  landmark: CityLandmark | null;
  profile: TravelProfile;
  rangeMinutes: number[];
}

export interface CommittedSnapshot {
  conditions: {
    landmark: CityLandmark;
    profile: TravelProfile;
    rangeMinutes: number[];
    isExample?: boolean;
    source?: ExplorationSource;
  };
  isochrones: IsochroneFeature[];
  timestamp: number;
  /** Local analytics lifecycle guard, never transmitted. */
  analysisRunId?: number;
}

export interface FetchIsochronesResult {
  success: boolean;
  features: IsochroneFeature[];
  fromCache: boolean;
  isEmpty?: boolean;
  error?: string | null;
  aborted?: boolean;
  requestId: number;
}

export interface RequestManagerDependencies {
  fetchApi?: typeof fetch;
  getCached?: (coordinates: [number, number], profile: TravelProfile, rangeMinutes: number[]) => IsochroneFeature[] | null;
  setCached?: (coordinates: [number, number], profile: TravelProfile, rangeMinutes: number[], data: IsochroneFeature[]) => void;
  snapCoords?: (lng: number, lat: number) => [number, number];
  trackEvent?: (name: string, properties?: Record<string, string | number | boolean | null | undefined>) => void;
}

/**
 * 判断是否为自定义选点（受每日限额限制）
 * 严格遵循旧代码策略：仅 id.startsWith('custom-') 为自定义选点，不包含 current-location
 */
export function isCustomLandmark(landmark: CityLandmark | null): boolean {
  if (!landmark?.id) return false;
  return landmark.id.startsWith('custom-');
}

/**
 * 确定起点与探索来源契约
 * 明确区分：示例 (example)、当前位置 (current-location)、自定义选点 (custom)、预设地标 (preset)、分享恢复 (share)
 * 定位状态绝对不误算为 preset 来源
 */
export function getExplorationSource(
  landmark: CityLandmark | null,
  isExample?: boolean
): ExplorationSource {
  if (isExample) return 'example';
  if (!landmark) return 'preset';
  if (landmark.id === 'current-location') return 'current-location';
  if (landmark.id.startsWith('custom-')) return 'custom';
  return 'preset';
}

/**
 * 判定 URL 是否属于分享链接访问
 * 用于在首次渲染或客户端 mount 时同步判定，避免通用首次引导弹窗闪现或抢先触发定位
 */
export function isShareVisitUrl(searchString?: string): boolean {
  try {
    const search = searchString !== undefined
      ? searchString
      : (typeof window !== 'undefined' ? window.location.search : '');
    if (!search) return false;
    const params = new URLSearchParams(search);
    return Boolean(params.get('lat') && params.get('lng'));
  } catch {
    return false;
  }
}

/**
 * 搜索预设地标无匹配时的解释与替代出口判定
 */
export function formatSearchNoMatchMessage(query: string): {
  message: string;
  scopeExplanation: string;
  alternativeActions: ('map-pick' | 'current-location' | 'example')[];
} {
  const trimmed = query.trim();
  const cityCount = cities.length;
  const cityListStr = cities.join('、');
  return {
    message: trimmed ? `未在已收录的 ${cityCount} 座城市预设地标中找到「${trimmed}」` : '请输入地标名称搜索',
    scopeExplanation: `当前收录了${cityListStr}等城市的核心交通枢纽与精选文旅地标，您也可以在地图上任意点击直接选点探索。`,
    alternativeActions: ['map-pick', 'current-location', 'example'],
  };
}

/**
 * 定位错误状态解释与可操作恢复状态（支持成功/拒绝/超时/不可用/不支持）
 */
export function getGeolocationErrorMessage(
  codeOrType: number | string,
  isSecureContext: boolean = true
): {
  type: 'permission_denied' | 'timeout' | 'position_unavailable' | 'unsupported' | 'unknown';
  message: string;
  recoveryHint: string;
  alternativeActions: ('retry' | 'map-pick' | 'preset')[];
} {
  if (codeOrType === 'unsupported' || codeOrType === 0) {
    return {
      type: 'unsupported',
      message: '当前浏览器或运行环境不支持地理定位',
      recoveryHint: '建议直接在地图上选点，或从预设城市地标中选择出发地。',
      alternativeActions: ['map-pick', 'preset'],
    };
  }

  if (codeOrType === 1 || codeOrType === 'permission_denied') {
    return {
      type: 'permission_denied',
      message: isSecureContext
        ? '定位权限已被拒绝'
        : '定位功能仅在 HTTPS 或 localhost 安全环境下可用',
      recoveryHint: isSecureContext
        ? '请在浏览器地址栏允许网站访问位置信息；或直接在地图上选点。'
        : '当前非安全连接，请直接在地图上选点。',
      alternativeActions: ['map-pick', 'preset'],
    };
  }

  if (codeOrType === 3 || codeOrType === 'timeout') {
    return {
      type: 'timeout',
      message: '获取当前位置超时',
      recoveryHint: '网络或卫星信号较弱，您可以重试定位，或直接在地图上选点。',
      alternativeActions: ['retry', 'map-pick', 'preset'],
    };
  }

  if (codeOrType === 2 || codeOrType === 'position_unavailable') {
    return {
      type: 'position_unavailable',
      message: '当前位置信息不可用',
      recoveryHint: '无法确定您的当前坐标，您可以重试定位，或直接在地图上选点。',
      alternativeActions: ['retry', 'map-pick', 'preset'],
    };
  }

  return {
    type: 'unknown',
    message: '无法获取位置信息',
    recoveryHint: '请重试定位或在地图上选点。',
    alternativeActions: ['retry', 'map-pick', 'preset'],
  };
}

export interface MinimalGeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
  };
}

export interface MinimalGeolocationError {
  code: number;
}

export interface MinimalGeolocationApi {
  getCurrentPosition: (
    success: (pos: MinimalGeolocationPosition) => void,
    error?: (err: MinimalGeolocationError) => void,
    options?: PositionOptions | Record<string, unknown>
  ) => void;
}

/**
 * 生产定位请求生命周期管理器
 * 统一管理全局定位会话，确保所有起点切换、地图选点、示例、取消与卸载均能安全失效在途回调
 */
export class GeolocationLifecycleManager {
  private activeSessionId: number = 0;
  private isLocating: boolean = false;

  getIsLocating(): boolean {
    return this.isLocating;
  }

  cancel(): void {
    this.activeSessionId++;
    this.isLocating = false;
  }

  isCurrent(sessionId: number): boolean {
    return sessionId === this.activeSessionId;
  }

  startSession(): number {
    this.activeSessionId++;
    this.isLocating = true;
    return this.activeSessionId;
  }

  requestLocation(params: {
    geolocationApi: MinimalGeolocationApi;
    isSecureContext?: boolean;
    autoGenerate: boolean;
    handlers: {
      onSuccess: (coords: [number, number], autoGenerate: boolean) => void;
      onError: (errorInfo: ReturnType<typeof getGeolocationErrorMessage>) => void;
      onStatusChange?: (isLocating: boolean) => void;
    };
  }): number {
    const sessionId = this.startSession();
    params.handlers.onStatusChange?.(true);

    params.geolocationApi.getCurrentPosition(
      (pos) => {
        if (!this.isCurrent(sessionId)) {
          return;
        }
        this.isLocating = false;
        params.handlers.onStatusChange?.(false);
        params.handlers.onSuccess([pos.coords.longitude, pos.coords.latitude], params.autoGenerate);
      },
      (err) => {
        if (!this.isCurrent(sessionId)) {
          return;
        }
        this.isLocating = false;
        params.handlers.onStatusChange?.(false);
        const errInfo = getGeolocationErrorMessage(err.code, params.isSecureContext ?? true);
        params.handlers.onError(errInfo);
      }
    );

    return sessionId;
  }
}

/**
 * 定位异步请求生命周期管理器（向前兼容别名）
 */
export class GeolocationSessionTracker {
  private activeSessionId: number = 0;

  startSession(): number {
    return ++this.activeSessionId;
  }

  cancel(): void {
    this.activeSessionId++;
  }

  isCurrent(sessionId: number): boolean {
    return sessionId === this.activeSessionId;
  }
}

/**
 * 判断当前是否具备可分享的有效结果
 */
export function canShareCommitted(committed: CommittedSnapshot | null): boolean {
  return Boolean(committed && committed.isochrones && committed.isochrones.length > 0);
}

/**
 * 检查草稿条件是否与已提交快照存在差异
 */
export function hasPendingChanges(
  draft: ExplorationConditions,
  committed: CommittedSnapshot | null
): boolean {
  if (!committed) return false;

  const landmarkChanged =
    draft.landmark?.id !== committed.conditions.landmark.id ||
    draft.landmark?.coordinates[0] !== committed.conditions.landmark.coordinates[0] ||
    draft.landmark?.coordinates[1] !== committed.conditions.landmark.coordinates[1];

  const profileChanged = draft.profile !== committed.conditions.profile;

  const rangeChanged =
    draft.rangeMinutes.length !== committed.conditions.rangeMinutes.length ||
    draft.rangeMinutes.some((m, idx) => m !== committed.conditions.rangeMinutes[idx]);

  return landmarkChanged || profileChanged || rangeChanged;
}

/**
 * 生产配额扣减判定契约
 * 仅在：自定义选点 + 未命中缓存 + 请求成功 + 返回有效 features + 未被取消/失效 时扣除配额
 */
export function evaluateQuotaDeduction(params: {
  landmark: CityLandmark | null;
  fromCache: boolean;
  success: boolean;
  featuresCount: number;
  aborted?: boolean;
}): boolean {
  if (params.aborted) return false;
  if (!params.success) return false;
  if (params.fromCache) return false;
  if (params.featuresCount <= 0) return false;
  return isCustomLandmark(params.landmark);
}

/**
 * 生产等时圈请求生命周期管理器
 * 统一管理请求序列号、在途中断、过期丢弃、缓存与空数据识别
 */
export class IsochroneRequestManager {
  private latestRequestId: number = 0;
  private activeController: AbortController | null = null;

  getCurrentRequestId(): number {
    return this.latestRequestId;
  }

  isCurrent(requestId: number): boolean {
    return requestId === this.latestRequestId && (!this.activeController || !this.activeController.signal.aborted);
  }

  cancel(): void {
    // 可靠失效 request identity：递增序列号，使任何在途响应被丢弃
    this.latestRequestId++;
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }
  }

  async startRequest(
    rawCoordinates: [number, number],
    profile: TravelProfile,
    rangeMinutes: number[],
    deps: RequestManagerDependencies = {}
  ): Promise<FetchIsochronesResult> {
    const requestId = ++this.latestRequestId;

    // 取消并失效上一个在途请求
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }

    const controller = new AbortController();
    this.activeController = controller;

    const snap = deps.snapCoords || ((lng, lat) => [lng, lat]);
    const coordinates = snap(rawCoordinates[0], rawCoordinates[1]);

    // 检查缓存
    if (deps.getCached) {
      const cached = deps.getCached(coordinates, profile, rangeMinutes);
      if (cached && cached.length > 0) {
        if (requestId === this.latestRequestId && !controller.signal.aborted) {
          return { success: true, features: cached, fromCache: true, requestId };
        } else {
          return { success: false, features: [], fromCache: true, aborted: true, requestId };
        }
      }
    }

    try {
      const fetchFn = deps.fetchApi || fetch;
      const response = await fetchFn('/api/isochrones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates, profile, rangeMinutes }),
        signal: controller.signal,
      });

      // 检查请求是否过期或被取消
      if (controller.signal.aborted || requestId !== this.latestRequestId) {
        return { success: false, features: [], fromCache: false, aborted: true, requestId };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `请求失败: ${response.status}`;
        
        // 保持原分析事件口径（#12前绝不随意修改历史 location 或丢失 429 事件）
        const errorType = 
          response.status === 429 ? 'rate_limit' :
          response.status === 403 ? 'forbidden' :
          response.status === 401 ? 'unauthorized' :
          response.status === 500 ? 'server_error' :
          response.status === 503 ? 'service_unavailable' :
          `http_${response.status}`;

        if (deps.trackEvent) {
          deps.trackEvent('api_error', {
            location: 'isochrones_hook',
            error_type: errorType,
            status_code: response.status,
            profile,
          });

          if (response.status === 429) {
            deps.trackEvent('api_rate_limit_reached', {
              location: 'isochrones_hook',
              profile,
            });
          }
        }
        return { success: false, features: [], fromCache: false, error: errorMessage, requestId };
      }

      const data = await response.json();
      const features: IsochroneFeature[] = data.features || [];

      // 再次检查请求是否过期
      if (controller.signal.aborted || requestId !== this.latestRequestId) {
        return { success: false, features: [], fromCache: false, aborted: true, requestId };
      }

      // 空响应处理
      if (features.length === 0) {
        return {
          success: false,
          features: [],
          fromCache: false,
          isEmpty: true,
          error: '未获取到可达范围数据',
          requestId,
        };
      }

      // 写入缓存
      if (deps.setCached) {
        deps.setCached(coordinates, profile, rangeMinutes, features);
      }

      if (deps.trackEvent) {
        deps.trackEvent('api_call_success', {
          location: 'isochrones_hook',
          profile,
          range_count: rangeMinutes.length,
        });
      }

      return { success: true, features, fromCache: false, requestId };
    } catch (err) {
      if (controller.signal.aborted || requestId !== this.latestRequestId) {
        return { success: false, features: [], fromCache: false, aborted: true, requestId };
      }

      const message = err instanceof Error ? err.message : '获取数据失败';
      if (deps.trackEvent && !(err instanceof Error && err.message.includes('请求失败'))) {
        deps.trackEvent('api_network_error', {
          location: 'isochrones_hook',
          profile,
        });
      }

      return { success: false, features: [], fromCache: false, error: message, requestId };
    }
  }
}
