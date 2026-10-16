'use client';

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { track, JourneyAnalytics, getJourneyContext } from '@/lib/analytics';
import type { CityLandmark, TravelProfile, IsochroneFeature } from '@/types';
import { defaultTimeRanges } from '@/data/isochrone-config';
import { getLandmarkById } from '@/data/landmarks';
import { MapWrapper, MapLegend } from '@/components/Map';
import { 
  CitySelector, 
  TravelModeSelector, 
  ShareButton,
  ShareDialog,
  ResultToolbar,
  POIListPanel,
  POIDetailCard,
} from '@/components/Controls';
import { WelcomeGuide, VersionBadge } from '@/components/UI';
import { useIsochrones, useShareParams, useSelectionLimit } from '@/hooks';
import { startBackgroundPreload } from '@/lib/cache-preloader';
import { getCachedIsochrones } from '@/lib/isochrone-cache';
import {
  queryInterestPoints,
  POIByLayer,
  CoverageStatus,
} from '@/lib/poi-utils';
import { calculateMapPadding } from '@/lib/layout-utils';
import { createSharePayload } from '@/lib/share-utils';
import { ShareVisitInitializer, resolveSharedPOI } from '@/lib/share-params';
import type { SharePayload, POIWithLayer } from '@/types';
import {
  CommittedSnapshot,
  isCustomLandmark,
  canShareCommitted,
  hasPendingChanges as checkHasPendingChanges,
  evaluateQuotaDeduction,
  getExplorationSource,
  GeolocationLifecycleManager,
} from '@/lib/exploration-state';

const EMPTY_ISOCHRONES: IsochroneFeature[] = [];

function IsochroneAppContent() {
  const shareParams = useShareParams();
  const journeyRef = useRef(new JourneyAnalytics(track));

  // 1. 草稿条件（编辑态：用户正在调整但尚未重新生成的参数）
  const [draftLandmark, setDraftLandmark] = useState<CityLandmark | null>(() =>
    shareParams.hasParams ? shareParams.landmark : getLandmarkById('shanghai-yishan-road') || null
  );
  const [draftProfile, setDraftProfile] = useState<TravelProfile>(shareParams.profile);
  const [isShareView, setIsShareView] = useState(shareParams.hasParams);
  const [sharePOIWarning, setSharePOIWarning] = useState<string | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  const [draftRangeMinutes, setDraftRangeMinutes] = useState<number[]>(defaultTimeRanges);

  // 2. 已提交结果快照（展示态：地图、图例、清单、分享一律消费此快照）
  const [committed, setCommitted] = useState<CommittedSnapshot | null>(null);

  // 3. 地图显式选点模式
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [candidateCoordinates, setCandidateCoordinates] = useState<[number, number] | null>(null);

  // 4. 首次访问引导状态与定位反馈（统一单一定位生命周期）
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locatingError, setLocatingError] = useState<string | null>(null);
  const geoManagerRef = useRef<GeolocationLifecycleManager>(new GeolocationLifecycleManager());

  // 面板展开/折叠状态
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // 高亮的 POI 索引
  const [highlightedPOI, setHighlightedPOI] = useState<number | null>(null);

  // 5. 稳定 POI ID 选中状态（为 #9 预留单一事实来源 Seam）
  const [selectedPOIId, setSelectedPOIId] = useState<string | null>(null);

  // 6. 全局统一分享弹窗状态（单一所有者，解耦父级菜单与面板）
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareInitialTarget, setShareInitialTarget] = useState<'whole' | 'poi'>('whole');

  // 7. 清单折叠/展开状态（折叠再展开不丢失结果）
  const [isListOpen, setIsListOpen] = useState(true);

  // 7. 地图容器真实尺寸监听（按实际挂载 DOM 计算 padding，杜绝仅用 window 尺寸的偏差）
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1024, height: 768, isMobile: false });

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;

    const updateSize = (w: number, h: number) => {
      const width = Math.round(w) || el.clientWidth || window.innerWidth || 1024;
      const height = Math.round(h) || el.clientHeight || window.innerHeight || 768;
      setContainerSize({ width, height, isMobile: width < 768 });
    };

    updateSize(el.clientWidth, el.clientHeight);

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect) {
            updateSize(entry.contentRect.width, entry.contentRect.height);
          }
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  const handleSelectPOI = useCallback((poiId: string | null) => {
    const next = selectedPOIId === poiId ? null : poiId;
    journeyRef.current.requestSelection(next);
    setSelectedPOIId(next);
  }, [selectedPOIId]);

  // 8. 本地 POI 数据重试修订号（仅重算当前 committed，不调用 ORS、不消费 draft、不扣配额）
  const [poiQueryRevision, setPoiQueryRevision] = useState(0);
  const handleRetryPOIQuery = useCallback(() => {
    setPoiQueryRevision(v => v + 1);
  }, []);

  // 每日次数限制
  const { remaining, increment, checkLimit } = useSelectionLimit();

  // 等时圈异步请求 Hook
  const { 
    loading, 
    error, 
    isEmpty,
    fetchIsochrones, 
    cancelRequest,
    clearError 
  } = useIsochrones();

  // 判断是否有已提交的有效结果（结果存在性不依赖面板折叠）
  const hasCommittedResult = canShareCommitted(committed);

  // 检查草稿条件是否有未提交的变动（使用生产共享函数）
  const hasPendingChanges = useMemo(() => {
    return checkHasPendingChanges(
      {
        landmark: draftLandmark,
        profile: draftProfile,
        rangeMinutes: draftRangeMinutes,
      },
      committed
    );
  }, [committed, draftLandmark, draftProfile, draftRangeMinutes]);

  // 地图/清单/图例/分享消费的快照数据：优先消费 committed 快照，杜绝草稿混搭旧结果
  const displayLandmark = committed ? committed.conditions.landmark : draftLandmark;
  const displayProfile = committed ? committed.conditions.profile : draftProfile;
  const displayRangeMinutes = committed ? committed.conditions.rangeMinutes : draftRangeMinutes;
  const displayIsochrones = committed ? committed.isochrones : EMPTY_ISOCHRONES;

  // 接入 #6 唯一 queryInterestPoints 结构化查询地点并评估覆盖状态
  // 严格消费 committed 快照，绝不拿 draft 配旧结果
  const { poiQueryResult, poiQueryError } = useMemo(() => {
    void poiQueryRevision; // 响应本地 POI 数据处理异常重试请求
    if (!committed || displayIsochrones.length === 0 || !displayLandmark) {
      return { poiQueryResult: null, poiQueryError: null };
    }
    try {
      const result = queryInterestPoints({
        isochrones: committed.isochrones,
        rangeMinutes: committed.conditions.rangeMinutes,
        landmark: committed.conditions.landmark,
      });
      return { poiQueryResult: result, poiQueryError: null };
    } catch (err) {
      console.error('queryInterestPoints failed:', err);
      return {
        poiQueryResult: null,
        poiQueryError: err instanceof Error ? err.message : '地点数据处理异常',
      };
    }
  }, [committed, displayIsochrones.length, displayLandmark, poiQueryRevision]);

  const poiByLayer: POIByLayer[] = useMemo(() => {
    return poiQueryResult?.poiByLayer || [];
  }, [poiQueryResult]);

  const poiWithLayers = useMemo(() => {
    return poiQueryResult?.allPOIs || [];
  }, [poiQueryResult]);

  const coverageStatus: CoverageStatus = poiQueryResult?.status || 'uncovered';
  const isPartial: boolean = Boolean(poiQueryResult?.isPartial);
  const totalPOIs: number = poiQueryResult?.allPOIs.length ?? 0;

  // 查找当前选中的 POI 实体（若新结果集不包含已选 id，自动过滤为 null，保证草稿与结果更新时旧 id 失效）
  const selectedPOI = useMemo(() => {
    if (!selectedPOIId || !poiQueryResult) return null;
    return poiQueryResult.allPOIs.find(p => p.id === selectedPOIId) || null;
  }, [poiQueryResult, selectedPOIId]);

  // 对外暴露的有效已选 POI ID（保证草稿隔离与结果更新时失效一致）
  const activeSelectedPOIId = selectedPOI ? selectedPOI.id : null;
  const journeyContext = committed ? getJourneyContext(
    committed.conditions.landmark, committed.conditions.source, committed.conditions.profile
  ) : undefined;

  // Effects observe committed/renderable state, not API promises or hover handlers.
  useEffect(() => {
    if (!committed?.analysisRunId) return;
    if (poiQueryError) journeyRef.current.finish(committed.analysisRunId, 'poi_error');
    else if (poiQueryResult) journeyRef.current.finish(committed.analysisRunId, 'ready', {
      coverage_status: poiQueryResult.status,
      is_partial: Boolean(poiQueryResult.isPartial),
      poi_count: poiQueryResult.allPOIs.length,
    });
  }, [committed, poiQueryResult, poiQueryError]);

  useEffect(() => {
    if (!selectedPOI || !committed) return;
    journeyRef.current.confirmSelection(selectedPOI.id, getJourneyContext(
      committed.conditions.landmark, committed.conditions.source, committed.conditions.profile
    ), selectedPOI.layerMinutes);
  }, [selectedPOI, committed]);

  // 统一从 committed 快照与有效选中地点生产不可变 SharePayload 快照
  const sharePayload = useMemo<SharePayload | null>(() => {
    if (!committed) return null;
    return createSharePayload({
      landmark: committed.conditions.landmark,
      profile: committed.conditions.profile,
      rangeMinutes: committed.conditions.rangeMinutes,
      isochrones: committed.isochrones,
      selectedPOIId: activeSelectedPOIId,
      selectedPOI,
      poiByLayer,
      totalPOIs,
      coverageStatus,
      isPartial,
      isExample: Boolean(committed.conditions.isExample),
      createdAt: committed.timestamp,
    });
  }, [committed, activeSelectedPOIId, selectedPOI, poiByLayer, totalPOIs, coverageStatus, isPartial]);

  const handleOpenShareWhole = useCallback(() => {
    setShareInitialTarget('whole');
    setIsShareOpen(true);
  }, []);

  const handleSharePOI = useCallback((poi: POIWithLayer) => {
    if (selectedPOIId !== poi.id) journeyRef.current.requestSelection(poi.id);
    setSelectedPOIId(poi.id);
    setShareInitialTarget('poi');
    setIsShareOpen(true);
  }, [selectedPOIId]);

  // 地图视口适配 Padding 计算：按实际可用视口避让面板，避免固定 50px 遮挡
  const mapPadding = useMemo(() => {
    return calculateMapPadding({
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
      isMobile: containerSize.isMobile,
      isListOpen,
      isEditPanelOpen: isPanelOpen,
    });
  }, [containerSize, isListOpen, isPanelOpen]);

  // 分享接收端仅恢复当前条件，避免后台批量请求干扰限流与手动重试。
  useEffect(() => {
    if (!shareParams.hasParams) startBackgroundPreload();
  }, [shareParams.hasParams]);

  // 跟踪当前分析执行的 runId，连通应用取消与晚返回失效
  const activeRunIdRef = useRef<number>(0);

  const invalidateActiveRun = useCallback(() => {
    activeRunIdRef.current++;
    journeyRef.current.cancel();
  }, []);

  // 统一取消定位生命周期并结束 loading 状态
  const cancelGeolocation = useCallback(() => {
    geoManagerRef.current.cancel();
    setIsLocating(false);
  }, []);

  // 显式选择地标（预设或外部选择）立即取消在途定位
  const handleSelectLandmark = useCallback((landmark: CityLandmark | null) => {
    cancelGeolocation();
    setDraftLandmark(landmark);
  }, [cancelGeolocation]);

  // 放弃草稿修改，还原为当前已提交的结果条件（连通 cancelRequest、runId 失效与定位取消）
  const handleCancelChanges = useCallback(() => {
    cancelGeolocation();
    invalidateActiveRun(); // 立即失效当前在途分析任务
    cancelRequest(); // 可靠取消在途 fetch 并失效 hook 内部请求身份
    if (committed) {
      setDraftLandmark(committed.conditions.landmark);
      setDraftProfile(committed.conditions.profile);
      setDraftRangeMinutes([...committed.conditions.rangeMinutes]);
    }
    clearError();
  }, [cancelGeolocation, committed, invalidateActiveRun, cancelRequest, clearError]);

  // 组件卸载时安全失效与取消
  useEffect(() => {
    const geoManager = geoManagerRef.current;
    return () => {
      geoManager.cancel();
      invalidateActiveRun();
      cancelRequest();
    };
  }, [invalidateActiveRun, cancelRequest]);

  // 进入显式选点模式（立即取消在途定位，避免覆盖）
  const handleStartPicking = useCallback(() => {
    cancelGeolocation();
    setIsPickingLocation(true);
    setCandidateCoordinates(null);
    setIsPanelOpen(false); // 收起面板，让出地图操作空间
    clearError();
  }, [cancelGeolocation, clearError]);

  // 取消选点模式：丢弃候选点，原有起点与探索结果完全保留
  const handleCancelPicking = useCallback(() => {
    cancelGeolocation();
    setIsPickingLocation(false);
    setCandidateCoordinates(null);
    setIsPanelOpen(true);
  }, [cancelGeolocation]);

  // 确认候选点：将候选点载入草稿，退出选点模式（旧结果依然保持）
  const handleConfirmCandidate = useCallback(() => {
    if (!candidateCoordinates) return;
    cancelGeolocation();

    track('map_custom_point_confirmed', {
      location: 'map_picking',
      latitude: candidateCoordinates[1].toFixed(4),
      longitude: candidateCoordinates[0].toFixed(4),
    });

    const customLandmark: CityLandmark = {
      id: `custom-${Date.now()}`,
      name: '自定义选点',
      city: '自定义位置',
      province: '',
      coordinates: candidateCoordinates,
      description: '点击地图选择的位置',
    };

    setDraftLandmark(customLandmark);
    setIsPickingLocation(false);
    setCandidateCoordinates(null);
    setIsPanelOpen(true);
  }, [candidateCoordinates, cancelGeolocation]);

  // 地图点击：仅在显式选点模式下更新候选坐标，普通浏览与拖拽绝不修改起点或清空结果
  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!isPickingLocation) return;
    
    track('map_candidate_point_selected', {
      location: 'map_picking',
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
    });

    setCandidateCoordinates([lng, lat]);
  }, [isPickingLocation]);

  // 执行等时圈分析
  const handleGenerate = useCallback(async (overrideConditions?: {
    landmark?: CityLandmark | null;
    profile?: TravelProfile;
    rangeMinutes?: number[];
    isExample?: boolean;
    isShare?: boolean;
    selectedPOIId?: string | null;
  }) => {
    setAnalysisNotice(null);
    const isShare = overrideConditions?.isShare ?? false;
    setIsShareView(isShare);
    const runId = ++activeRunIdRef.current;
    const currentLandmark = overrideConditions?.landmark !== undefined ? overrideConditions.landmark : draftLandmark;
    const currentProfile = overrideConditions?.profile !== undefined ? overrideConditions.profile : draftProfile;
    const currentRangeMinutes = overrideConditions?.rangeMinutes !== undefined ? overrideConditions.rangeMinutes : draftRangeMinutes;
    const isExample = overrideConditions?.isExample !== undefined ? overrideConditions.isExample : false;

    if (!currentLandmark) return;

    // 检查缓存
    const cached = getCachedIsochrones(
      currentLandmark.coordinates,
      currentProfile,
      currentRangeMinutes
    );

    const isCustom = isCustomLandmark(currentLandmark);
    const source = isShare ? 'share' : getExplorationSource(currentLandmark, isExample);
    journeyRef.current.start(runId, getJourneyContext(currentLandmark, source, currentProfile), Boolean(cached));

    // 未命中缓存且为自定义选点时检查每日额度
    if (isCustom && !cached && !checkLimit()) {
      track('analysis_limit_reached', {
        location: 'generate_button',
        landmark: currentLandmark.name,
        remaining_quota: remaining,
      });
      cancelRequest();
      journeyRef.current.finish(runId, 'quota');
      setAnalysisNotice('今日自定义选点次数已达上限（5次）。可选择预设起点或使用当前位置探索，也可明天再试。');
      setIsPanelOpen(true);
      return;
    }

    const result = await fetchIsochrones(
      currentLandmark.coordinates,
      currentProfile,
      currentRangeMinutes
    );

    // 取消或过期响应不触碰界面；失败只显示手动恢复入口。
    if (runId !== activeRunIdRef.current || result.aborted) return;
    if (!result.success) {
      journeyRef.current.finish(runId, result.isEmpty ? 'empty' : 'failed');
      setIsPanelOpen(true);
      return;
    }

    // 成功且返回有效 features：原子更新 committed 结果快照
    if (result.success && result.features.length > 0) {
      setCommitted({
        conditions: {
          landmark: currentLandmark,
          profile: currentProfile,
          rangeMinutes: [...currentRangeMinutes],
          isExample,
          source,
        },
        isochrones: result.features,
        timestamp: Date.now(),
        analysisRunId: runId,
      });

      // 仅在真实发起 API 请求成功且为自定义选点且未被取消时扣除配额（生产通用判定契约）
      if (evaluateQuotaDeduction({
        landmark: currentLandmark,
        fromCache: result.fromCache,
        success: result.success,
        featuresCount: result.features.length,
        aborted: result.aborted,
      })) {
        increment();
        track('custom_quota_used', {
          location: 'generate_button',
          new_remaining: remaining - 1,
          travel_mode: currentProfile,
        });
      }

      // 生成成功后折叠面板，进入结果模式，并重置选中状态与展开列表
      let restoredPOIId: string | null = null;
      let warning: string | null = null;
      if (isShare && overrideConditions?.selectedPOIId) {
        try {
          const query = queryInterestPoints({
            isochrones: result.features,
            rangeMinutes: currentRangeMinutes,
            landmark: currentLandmark,
          });
          const resolved = resolveSharedPOI(overrideConditions.selectedPOIId, query.allPOIs);
          restoredPOIId = resolved.selected?.id || null;
          warning = resolved.warning;
        } catch {
          warning = '地点清单暂未加载，请重试地点查询。起点与可达范围已保留。';
          restoredPOIId = overrideConditions.selectedPOIId;
        }
      }
      setSharePOIWarning(warning);
      setSelectedPOIId(restoredPOIId);
      setIsListOpen(true);
      setIsPanelOpen(isShare && (Boolean(warning) || shareParams.warnings.length > 0));
    }
    // 失败或空响应：fetchIsochrones 已记录错误/空状态，旧 committed 结果被完整保留
  }, [draftLandmark, draftProfile, draftRangeMinutes, checkLimit, remaining, fetchIsochrones, increment, shareParams.warnings.length, cancelRequest]);

  // 保持 handleGenerate 最新引用的 ref，避免 timer 闭包陈旧，同时避免 effect 依赖 handleGenerate 频繁重跑
  const handleGenerateRef = useRef(handleGenerate);
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

  // 显式重看入口与一次性初始化共用同一恢复路径；始终使用抵达时保存的参数。
  const handleRestoreShare = useCallback(() => {
    if (!shareParams.landmark || shareParams.error) return;
    cancelGeolocation();
    invalidateActiveRun();
    cancelRequest();
    setIsShareView(true);
    setIsWelcomeOpen(false);
    setIsPickingLocation(false);
    setCandidateCoordinates(null);
    setLocatingError(null);
    setSharePOIWarning(null);
    setDraftLandmark(shareParams.landmark);
    setDraftProfile(shareParams.profile);
    setDraftRangeMinutes([...shareParams.rangeMinutes]);
    setIsPanelOpen(true);
    void handleGenerateRef.current({
      landmark: shareParams.landmark,
      profile: shareParams.profile,
      rangeMinutes: shareParams.rangeMinutes,
      isShare: true,
      selectedPOIId: shareParams.selectedPOIId,
    });
  }, [shareParams, cancelGeolocation, invalidateActiveRun, cancelRequest]);

  const shareInitializerRef = useRef(new ShareVisitInitializer());
  useEffect(() => {
    if (shareParams.hasParams) journeyRef.current.openShare(!shareParams.error, Boolean(shareParams.selectedPOIId));
  }, [shareParams]);
  useEffect(() => {
    if (!shareParams.hasParams || shareParams.error) return;
    return shareInitializerRef.current.schedule(handleRestoreShare);
  }, [shareParams.hasParams, shareParams.error, handleRestoreShare]);

  // 首次访问引导显示逻辑（无自动默认查询竞争，分享链接直接跳过）
  useEffect(() => {
    if (shareParams.hasParams) {
      return;
    }
    try {
      const hasVisited = localStorage.getItem('has_visited_intro');
      if (!hasVisited && !committed) {
        const timer = setTimeout(() => {
          setIsWelcomeOpen(true);
        }, 0);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [shareParams.hasParams, committed]);

  const handleDismissWelcome = useCallback(() => {
    cancelGeolocation();
    setIsWelcomeOpen(false);
    setLocatingError(null);
    try {
      localStorage.setItem('has_visited_intro', 'true');
    } catch {
      // ignore
    }
  }, [cancelGeolocation]);

  const handleViewExample = useCallback(() => {
    cancelGeolocation();
    setIsWelcomeOpen(false);
    setLocatingError(null);
    try {
      localStorage.setItem('has_visited_intro', 'true');
    } catch {
      // ignore
    }

    const shanghaiExample = getLandmarkById('shanghai-yishan-road') || {
      id: 'shanghai-yishan-road',
      name: '宜山路',
      city: '上海',
      province: '上海市',
      coordinates: [121.4276, 31.1895],
      description: '徐汇区核心交通枢纽',
    };

    setDraftLandmark(shanghaiExample);
    setDraftProfile('driving-car');
    setDraftRangeMinutes(defaultTimeRanges);

    handleGenerateRef.current({
      landmark: shanghaiExample,
      profile: 'driving-car',
      rangeMinutes: defaultTimeRanges,
      isExample: true,
    });
  }, [cancelGeolocation]);

  // 统一发起浏览器定位（按交互意图区分：引导成功自动生成，编辑面板成功仅更新草稿）
  const requestGeolocation = useCallback((options?: { autoGenerate?: boolean; source?: string }) => {
    const autoGenerate = options?.autoGenerate ?? false;
    const trackingSource = options?.source || 'city_selector';

    cancelGeolocation();
    invalidateActiveRun();
    cancelRequest();
    setIsPickingLocation(false);
    setCandidateCoordinates(null);
    setIsPanelOpen(true);
    setLocatingError(null);

    if (!('geolocation' in navigator)) {
      track('geolocation_unsupported', { location: trackingSource });
      setLocatingError('当前浏览器环境不支持地理定位，建议在地图上选点');
      return;
    }

    track('geolocation_requested', { location: trackingSource });

    geoManagerRef.current.requestLocation({
      geolocationApi: navigator.geolocation,
      isSecureContext: window.isSecureContext,
      autoGenerate,
      handlers: {
        onStatusChange: (locating) => {
          setIsLocating(locating);
        },
        onSuccess: ([lng, lat], shouldAutoGenerate) => {
          track('geolocation_success', {
            location: trackingSource,
            latitude: lat.toFixed(4),
            longitude: lng.toFixed(4),
          });

          const currentLocation: CityLandmark = {
            id: 'current-location',
            name: '当前位置',
            city: '我的位置',
            province: '',
            coordinates: [lng, lat],
            description: '基于浏览器定位',
          };

          setDraftLandmark(currentLocation);

          if (shouldAutoGenerate) {
            setIsWelcomeOpen(false);
            try {
              localStorage.setItem('has_visited_intro', 'true');
            } catch {
              // ignore
            }
            handleGenerateRef.current({
              landmark: currentLocation,
              isExample: false,
            });
          }
        },
        onError: (errInfo) => {
          track('geolocation_error', {
            location: trackingSource,
            error_type: errInfo.type,
          });
          setLocatingError(errInfo.message);
        },
      },
    });
  }, [cancelGeolocation, invalidateActiveRun, cancelRequest]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-gray-50">
      <WelcomeGuide
        isOpen={isWelcomeOpen}
        onExploreMyLocation={() => requestGeolocation({ autoGenerate: true, source: 'welcome_guide' })}
        onViewExample={handleViewExample}
        onDismiss={handleDismissWelcome}
        isLocating={isLocating}
        locatingError={locatingError}
        onRetryLocating={() => requestGeolocation({ autoGenerate: true, source: 'welcome_guide' })}
      />

      {/* 地图层 - 全屏，渲染快照数据与选点交互 */}
      <div ref={mapContainerRef} id="app-map-container" className="absolute inset-0 z-0">
        <MapWrapper
          landmark={displayLandmark}
          poiWithLayers={poiWithLayers}
          isochrones={displayIsochrones}
          profile={displayProfile}
          rangeMinutes={displayRangeMinutes}
          onMapClick={handleMapClick}
          highlightedPOI={highlightedPOI}
          selectedPOIId={activeSelectedPOIId}
          onSelectPOI={handleSelectPOI}
          isPickingLocation={isPickingLocation}
          candidateCoordinates={candidateCoordinates}
          mapPadding={mapPadding}
          committedTimestamp={committed?.timestamp}
        />
      </div>

      {/* 显式选点模式确认栏 */}
      {isPickingLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl px-4 py-3 border border-emerald-500/20 flex items-center gap-3 animate-fade-in max-w-[90vw]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
            <div className="text-xs sm:text-sm font-medium text-gray-800 truncate">
              {candidateCoordinates
                ? `已选坐标: ${candidateCoordinates[0].toFixed(4)}, ${candidateCoordinates[1].toFixed(4)}`
                : '请在地图上点击选择出发点'}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCancelPicking}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirmCandidate}
              disabled={!candidateCoordinates}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white shadow-md transition-colors"
            >
              确认出发点
            </button>
          </div>
        </div>
      )}

      {/* 图例 - 有结果且面板折叠时显示 */}
      {hasCommittedResult && !isPanelOpen && !isPickingLocation && (
        <MapLegend rangeMinutes={displayRangeMinutes} />
      )}

      {/* POI 清单面板 - 有结果且非选点模式下显示（空态独立呈现，收起再开不丢结果） */}
      {hasCommittedResult && !isPickingLocation && (!isPanelOpen || !containerSize.isMobile) && (
        <POIListPanel
          poiByLayer={poiByLayer}
          totalPOIs={totalPOIs}
          coverageStatus={coverageStatus}
          isPartial={isPartial}
          disclaimer={poiQueryResult?.disclaimer}
          dataError={poiQueryError}
          onPOIHover={setHighlightedPOI}
          selectedPOIId={activeSelectedPOIId}
          onSelectPOI={handleSelectPOI}
          rangeMinutes={displayRangeMinutes}
          isOpen={isListOpen}
          onToggleOpen={setIsListOpen}
          onEdit={() => setIsPanelOpen(true)}
          onViewExample={handleViewExample}
          onRetry={handleRetryPOIQuery}
          profile={displayProfile}
          landmarkName={displayLandmark?.name}
          committedLandmark={committed ? committed.conditions.landmark : draftLandmark}
          isMobile={containerSize.isMobile}
          onSharePOI={handleSharePOI}
          analyticsContext={journeyContext}
        />
      )}

      {/* POI 独立详情浮层：当清单面板折叠但有选中地点时显示（避让现有清单、编辑面板与结果工具栏，手机端在底部悬浮栏上方） */}
      {hasCommittedResult && !isListOpen && !isPickingLocation && !isPanelOpen && selectedPOI && (
        <div className="fixed bottom-16 inset-x-4 max-w-sm mx-auto md:bottom-auto md:top-28 md:left-4 md:right-auto md:w-80 z-30 animate-fade-in shadow-xl">
          <POIDetailCard
            key={selectedPOI.id}
            poi={selectedPOI}
            origin={committed ? committed.conditions.landmark : draftLandmark}
            profile={displayProfile}
            rangeMinutes={displayRangeMinutes}
            onClose={() => setSelectedPOIId(null)}
            onShare={handleSharePOI}
            variant="floating"
            analyticsContext={journeyContext}
          />
        </div>
      )}

      {/* 顶部标题 */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none transition-opacity duration-300">
        <h1 className="text-2xl font-bold text-gray-800 drop-shadow-sm flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-emerald-500/30 shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </span>
          <span className={`${hasCommittedResult && !isPanelOpen ? 'hidden md:inline' : 'inline'}`}>可达出行</span>
        </h1>
      </div>

      {/* 控制面板 - 悬浮卡片 */}
      <div 
        className={`
          fixed bottom-0 left-0 right-0 z-20 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
          md:absolute md:top-4 md:right-4 md:bottom-auto md:left-auto md:w-80
          ${isPanelOpen && !isPickingLocation
            ? 'translate-y-0 opacity-100' 
            : 'translate-y-[120%] opacity-0 pointer-events-none'
          }
        `}
      >
        <div className="bg-white/95 backdrop-blur-md shadow-xl border border-white/20 p-5 overflow-y-auto w-full rounded-t-2xl max-h-[85vh] md:rounded-2xl md:max-h-[calc(100vh-2rem)]">
          {/* 移动端与已有结果时的收起按钮 */}
          <button
            type="button"
            onClick={() => setIsPanelOpen(false)}
            className={`absolute top-2 right-2 p-2 rounded-full bg-gray-100/50 text-gray-500 hover:bg-gray-100 cursor-pointer ${hasCommittedResult ? 'flex' : 'md:hidden'}`}
            aria-label="收起面板"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div className="space-y-5">
            {shareParams.hasParams && (
              <section aria-label="分享探索说明" className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-2">
                <h2 className="font-semibold">{isShareView ? '分享的探索' : '继续探索'}</h2>
                <p>链接会按分享条件重新计算范围与地点；分享图片记录生成时刻的结果。</p>
                {isShareView && shareParams.landmark && (
                  <p>起点：{shareParams.landmark.name} · {shareParams.profile === 'driving-car' ? '驾车' : shareParams.profile === 'cycling-regular' ? '骑行' : '步行'} · 15 / 30 / 60 分钟</p>
                )}
                <div role="status" aria-live="polite" className="space-y-1 text-amber-800">
                  {isShareView && shareParams.error && <p>{shareParams.error}</p>}
                  {isShareView && shareParams.warnings.map(message => <p key={message}>{message}</p>)}
                  {isShareView && sharePOIWarning && <p>{sharePOIWarning}</p>}
                  {analysisNotice && <p>{analysisNotice}</p>}
                  {locatingError && <p>{locatingError}。可以返回分享或手动选择起点。</p>}
                  {isShareView && (error || isEmpty) && <p>分享条件已保留，请手动重试，或选择其他起点。</p>}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" disabled={isLocating || loading} onClick={() => requestGeolocation({ autoGenerate: true, source: 'share_recipient' })} className="font-semibold text-emerald-700 underline disabled:opacity-50">
                    {isLocating ? '正在定位…' : '探索我的附近'}
                  </button>
                  {shareParams.landmark && !shareParams.error && (
                    <button type="button" disabled={loading} onClick={handleRestoreShare} className="font-semibold text-slate-700 underline disabled:opacity-50">
                      {isShareView ? '重新加载分享' : '返回原分享'}
                    </button>
                  )}
                  <button type="button" onClick={handleStartPicking} className="text-emerald-700 underline">手动选择起点</button>
                </div>
              </section>
            )}
            {!shareParams.hasParams && analysisNotice && <p role="status" className="text-xs text-amber-800">{analysisNotice}</p>}
            {/* 当前已提交结果上下文摘要卡片（打开编辑保留结果理解上下文） */}
            {hasCommittedResult && committed && (
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-xs animate-fade-in">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    当前地图展示的结果
                  </span>
                  {committed.conditions.isExample && (
                    <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-amber-100 text-amber-800 rounded">
                      示例
                    </span>
                  )}
                </div>
                <div className="text-slate-900 font-bold truncate text-sm" title={committed.conditions.landmark.name}>
                  起点：{committed.conditions.landmark.name}
                </div>
                <div className="text-slate-500 text-[11px] mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
                  <span>方式: {committed.conditions.profile === 'driving-car' ? '驾车' : committed.conditions.profile === 'cycling-regular' ? '骑行' : '步行'}</span>
                  <span>范围: 15 / 30 / 60 分钟</span>
                  <span className="text-emerald-700 font-medium">地点: {totalPOIs} 处已收录</span>
                </div>
              </div>
            )}

            {/* 条件已修改提示栏 */}
            {hasPendingChanges && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-800 animate-fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span className="font-semibold truncate">草稿已修改，待点击“更新”生效</span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelChanges}
                  className="font-medium text-amber-700 hover:text-amber-900 underline ml-2 cursor-pointer shrink-0"
                >
                  恢复原条件
                </button>
              </div>
            )}

            {/* 出发地点选择 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-700">出发地点</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleViewExample}
                    className="text-[11px] font-medium text-gray-500 hover:text-emerald-700 underline cursor-pointer"
                  >
                    看上海示例
                  </button>
                  <button
                    type="button"
                    onClick={handleStartPicking}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    在地图选点
                  </button>
                </div>
              </div>
              <CitySelector
                selectedLandmark={draftLandmark}
                onSelect={handleSelectLandmark}
                onStartMapPick={handleStartPicking}
                remainingQuota={remaining}
                isExample={Boolean(committed?.conditions.isExample && draftLandmark?.id === committed.conditions.landmark.id)}
                isLocating={isLocating}
                locatingError={locatingError}
                onRequestLocation={() => requestGeolocation({ autoGenerate: false, source: 'city_selector' })}
                onClearLocatingError={() => setLocatingError(null)}
              />
            </section>

            {/* 出行方式选择 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-700">出行方式</h2>
                <span className="text-[11px] text-gray-500">固定 15 / 30 / 60 分钟</span>
              </div>
              <TravelModeSelector
                selected={draftProfile}
                onSelect={setDraftProfile}
              />
            </section>

            {/* 固定时间范围能力说明 */}
            <section className="bg-gray-50/80 border border-gray-200/70 rounded-xl p-3 text-xs">
              <div className="flex items-center justify-between text-gray-700 font-semibold mb-1.5">
                <span>可达时间范围</span>
                <span className="text-[10px] text-emerald-700 font-normal">固定三档 · 1小时内</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="py-1 px-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-medium text-[11px]">
                  15 分钟
                </div>
                <div className="py-1 px-1 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 font-medium text-[11px]">
                  30 分钟
                </div>
                <div className="py-1 px-1 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-800 font-medium text-[11px]">
                  60 分钟 (1h)
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                可达范围采用道路网络实估，经 500 米网格对齐并应用折扣系数（驾车 80%、骑行 70%、步行 60%），供出行参考。
              </p>
            </section>

            {/* 错误提示与重试/取消出口（HTTP/网络异常） */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-xs text-red-600 animate-fade-in">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium">{error}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => isShareView ? handleRestoreShare() : handleGenerate()}
                        disabled={loading}
                        className="px-2.5 py-1 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer"
                      >
                        重试
                      </button>
                      {hasPendingChanges && (
                        <button
                          type="button"
                          onClick={handleCancelChanges}
                          className="px-2.5 py-1 text-xs font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors cursor-pointer"
                        >
                          取消修改
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={clearError}
                        className="text-xs text-gray-500 hover:text-gray-700 ml-auto cursor-pointer"
                      >
                        关闭
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 空数据提示（分析成功但 0 可达区域） */}
            {isEmpty && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-700 animate-fade-in">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium">当前条件下未获取到可达范围数据</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => isShareView ? handleRestoreShare() : handleGenerate()}
                        disabled={loading}
                        className="px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer"
                      >
                        重试
                      </button>
                      {hasPendingChanges && (
                        <button
                          type="button"
                          onClick={handleCancelChanges}
                          className="px-2.5 py-1 text-xs font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors cursor-pointer"
                        >
                          恢复原条件
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <section>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500">
                  自定义选点配额: <span className={remaining > 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>{remaining} 次/日</span>
                </span>
                <span className="text-[10px] text-gray-400">预设与定位免配额</span>
              </div>
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={loading || (remaining <= 0 && isCustomLandmark(draftLandmark) && !getCachedIsochrones(draftLandmark?.coordinates || [0, 0], draftProfile, draftRangeMinutes))}
                className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-lg
                          transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.98] cursor-pointer
                          ${loading || (remaining <= 0 && isCustomLandmark(draftLandmark) && !getCachedIsochrones(draftLandmark?.coordinates || [0, 0], draftProfile, draftRangeMinutes))
                            ? 'bg-gray-400 cursor-not-allowed hover:scale-100'
                            : 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'
                          }`}
              >
                {loading ? '计算可达范围中...' : (hasPendingChanges ? '更新可达范围' : '查看可达范围')}
              </button>
            </section>

            {/* 分享入口：始终消费 committed 快照，未生成前不可分享 */}
            <div className="border-t border-gray-100 pt-4">
              <ShareButton
                landmark={committed ? committed.conditions.landmark : null}
                profile={committed ? committed.conditions.profile : draftProfile}
                rangeMinutes={committed ? committed.conditions.rangeMinutes : draftRangeMinutes}
                hasData={hasCommittedResult}
                selectedPOIId={activeSelectedPOIId}
                onOpenShare={handleOpenShareWhole}
              />
            </div>

            {/* 底部信息 */}
            <div className="text-[10px] text-gray-400 text-center flex justify-between items-center pt-2">
              <span>数据: OpenRouteService</span>
              <a href="https://kuhung.me/about" className="hover:text-emerald-500">kuhung</a>
            </div>
          </div>
        </div>
      </div>
      
      {/* 结果浏览模式下的工具栏：编辑 + 分享 */}
      {hasCommittedResult && !isPanelOpen && !isPickingLocation && (
        <ResultToolbar
          landmark={committed ? committed.conditions.landmark : null}
          profile={committed ? committed.conditions.profile : draftProfile}
          rangeMinutes={committed ? committed.conditions.rangeMinutes : draftRangeMinutes}
          poiByLayer={poiByLayer}
          totalPOIs={totalPOIs}
          coverageStatus={coverageStatus}
          isPartial={isPartial}
          onEdit={() => setIsPanelOpen(true)}
          isExample={Boolean(committed?.conditions.isExample)}
          isShared={committed?.conditions.source === 'share'}
          onExploreMyLocation={() => requestGeolocation({ autoGenerate: true, source: 'share_recipient' })}
          selectedPOIId={activeSelectedPOIId}
          onOpenShare={handleOpenShareWhole}
        />
      )}

      {/* 面板折叠且无结果工具栏时的唤起按钮 */}
      {!hasCommittedResult && !isPanelOpen && !isPickingLocation && (
        <button 
          type="button"
          onClick={() => setIsPanelOpen(true)}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-xl bg-white/90 backdrop-blur shadow-lg text-gray-600 hover:bg-white transition-all cursor-pointer"
          aria-label="打开设置面板"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Git 版本号微章 */}
      <VersionBadge />

      {/* 全局统一分享弹窗（单一状态所有者，父组件折叠或面板切换不丢失预览与导出状态） */}
      <ShareDialog
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        payload={sharePayload}
        initialTarget={shareInitialTarget}
      />
    </div>
  );
}

export default function IsochroneApp() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    }>
      <IsochroneAppContent />
    </Suspense>
  );
}
