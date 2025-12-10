'use client';

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { CityLandmark, TravelProfile } from '@/types';
import { defaultTimeRanges } from '@/data/isochrone-config';
import { getLandmarkById } from '@/data/landmarks';
import { getInterestPointsByCity } from '@/data/interest-points';
import { MapWrapper, MapLegend } from '@/components/Map';
import { 
  CitySelector, 
  TravelModeSelector, 
  ShareButton,
  ResultToolbar,
  POIListPanel 
} from '@/components/Controls';
import { ErrorMessage, WelcomeGuide } from '@/components/UI';
import { useIsochrones, useShareParams, useSelectionLimit } from '@/hooks';
import { startBackgroundPreload } from '@/lib/cache-preloader';
import { getCachedIsochrones } from '@/lib/isochrone-cache';
import { groupPOIsByLayer, getAllPOIsWithIndex, POIByLayer } from '@/lib/poi-utils';

function IsochroneAppContent() {
  // 从 URL 参数读取初始值
  const shareParams = useShareParams();
  
  // 状态管理
  const [selectedLandmark, setSelectedLandmark] = useState<CityLandmark | null>(() => getLandmarkById('shanghai-yishan-road') || null);
  const [profile, setProfile] = useState<TravelProfile>('driving-car');
  const [rangeMinutes] = useState<number[]>(defaultTimeRanges);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  
  // 高亮的 POI 索引
  const [highlightedPOI, setHighlightedPOI] = useState<number | null>(null);

  // 次数限制
  const { remaining, increment, checkLimit } = useSelectionLimit();
  
  // 等时圈数据
  const { 
    isochrones, 
    loading, 
    error, 
    fetchIsochrones, 
    clearIsochrones,
    clearError 
  } = useIsochrones();

  // 获取当前城市的兴趣点
  const interestPoints = useMemo(() => {
    if (!selectedLandmark) return [];
    return getInterestPointsByCity(selectedLandmark.city);
  }, [selectedLandmark]);

  // 按圈层分组的 POI（只在有等时圈数据时计算）
  const poiByLayer: POIByLayer[] = useMemo(() => {
    if (isochrones.length === 0 || interestPoints.length === 0) return [];
    return groupPOIsByLayer(interestPoints, isochrones, rangeMinutes);
  }, [interestPoints, isochrones, rangeMinutes]);

  // 扁平化的带编号 POI 列表
  const poiWithLayers = useMemo(() => {
    return getAllPOIsWithIndex(poiByLayer);
  }, [poiByLayer]);

  // 派生状态：是否处于查看结果模式（有数据且面板折叠）
  // 只有在面板折叠且有数据时，才认为是“纯净结果浏览模式”
  const isResultView = isochrones.length > 0 && !isPanelOpen;

  // 启动后台预加载
  useEffect(() => {
    startBackgroundPreload();
  }, []);

  // 获取等时圈数据
  const handleGenerate = useCallback(async () => {
    if (!selectedLandmark) return;
    
    // 检查缓存
    const cached = getCachedIsochrones(
      selectedLandmark.coordinates,
      profile,
      rangeMinutes
    );

    // 只有自定义选点才受次数限制
    const isCustomLandmark = selectedLandmark.id.startsWith('custom-');

    // 如果没有缓存且超过限制（仅限自定义选点）
    if (isCustomLandmark && !cached && !checkLimit()) {
      alert('今日自定义选点次数已达上限（5次）。请明天再试！');
      return;
    }
    
    const success = await fetchIsochrones(
      selectedLandmark.coordinates,
      profile,
      rangeMinutes
    );
    
    // 如果成功且未使用缓存，扣除次数（仅限自定义选点）
    if (success && !cached && isCustomLandmark) {
      increment();
    }
    
    // 生成成功后，折叠面板
    if (success) {
      setIsPanelOpen(false); 
    }
  }, [selectedLandmark, profile, rangeMinutes, fetchIsochrones, checkLimit, increment]);

  // 地图点击处理
  const handleMapClick = useCallback((lat: number, lng: number) => {
    const customLandmark: CityLandmark = {
      id: `custom-${Date.now()}`,
      name: '自定义选点',
      city: '自定义位置',
      province: '',
      coordinates: [lng, lat],
      description: '点击地图选择的位置'
    };
    setSelectedLandmark(customLandmark);
    if (!isPanelOpen) {
      setIsPanelOpen(true);
    }
  }, [isPanelOpen]);

  // 首次访问自动演示：为了让新用户直接看到效果，如果是首次访问（没有记录），则自动触发一次查询
  useEffect(() => {
    if (!shareParams.hasParams && selectedLandmark) {
      try {
        const hasVisited = localStorage.getItem('has_visited_intro');
        if (!hasVisited) {
          // 延迟一点触发，让用户先看到地图加载
          const timer = setTimeout(() => {
            handleGenerate();
          }, 1500);
          return () => clearTimeout(timer);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [shareParams.hasParams, handleGenerate]);

  // 从分享参数初始化（仅执行一次）
  const [shareParamsApplied, setShareParamsApplied] = useState(false);
  
  useEffect(() => {
    if (shareParams.hasParams && !shareParamsApplied) {
      if (shareParams.landmark) setSelectedLandmark(shareParams.landmark);
      setProfile(shareParams.profile);
      setShareParamsApplied(true);
    }
  }, [shareParams, shareParamsApplied]);
  
  // 当分享参数应用完成后，自动触发数据加载
  useEffect(() => {
    if (shareParamsApplied && selectedLandmark && isochrones.length === 0 && !loading) {
      // 延迟一点，确保状态都已更新
      const timer = setTimeout(() => {
        handleGenerate();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [shareParamsApplied, selectedLandmark, isochrones.length, loading, handleGenerate]);

  // 当参数改变时自动清除结果
  useEffect(() => {
    if (isochrones.length > 0) {
    clearIsochrones();
      setIsPanelOpen(true);
    }
  }, [selectedLandmark, profile, clearIsochrones]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-gray-50">
      <WelcomeGuide />
      {/* 地图层 - 全屏 */}
      <div id="app-map-container" className="absolute inset-0 z-0">
        <MapWrapper
          landmark={selectedLandmark}
          poiWithLayers={poiWithLayers}
          isochrones={isochrones}
          profile={profile}
          rangeMinutes={rangeMinutes}
          onMapClick={handleMapClick}
          highlightedPOI={highlightedPOI}
        />
      </div>

      {/* 图例 - 仅在纯净结果浏览模式下显示 */}
      {isResultView && (
        <MapLegend rangeMinutes={rangeMinutes} />
      )}

      {/* POI 清单面板 - 仅在有 POI 数据时显示 */}
      {isResultView && poiByLayer.length > 0 && (
        <POIListPanel
          poiByLayer={poiByLayer}
          onPOIHover={setHighlightedPOI}
        />
      )}

      {/* 顶部标题 - 极简风格 */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none transition-opacity duration-300">
         <h1 className="text-2xl font-bold text-gray-800 drop-shadow-sm flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-emerald-500/30 shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </span>
            <span className={`${isResultView ? 'hidden md:inline' : 'inline'}`}>可达出行</span>
         </h1>
      </div>

      {/* 控制面板 - 悬浮卡片 */}
      <div 
        className={`
          fixed bottom-0 left-0 right-0 z-20 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
          md:absolute md:top-4 md:right-4 md:bottom-auto md:left-auto md:w-80
          ${isPanelOpen 
            ? 'translate-y-0 opacity-100' 
            : 'translate-y-[120%] opacity-0 pointer-events-none'
          }
        `}
      >
        <div className={`
          bg-white/90 backdrop-blur-md shadow-xl border border-white/20 p-5 overflow-y-auto
          w-full rounded-t-2xl max-h-[85vh]
          md:rounded-2xl md:max-h-[calc(100vh-2rem)]
        `}>
           {/* Mobile Close Button - 仅在非结果模式下显示，方便用户暂时收起 */}
           {!isResultView && (
           <button
             onClick={() => setIsPanelOpen(false)}
             className="absolute top-2 right-2 p-2 rounded-full bg-gray-100/50 text-gray-500 hover:bg-gray-100 md:hidden"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
             </svg>
           </button>
           )}

           <div className="space-y-6">
              {/* 地点选择 */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-sm font-semibold text-gray-700">出发地点</h2>
                </div>
                <CitySelector
                  selectedLandmark={selectedLandmark}
                  onSelect={setSelectedLandmark}
                />
              </section>

              {/* 出行方式 */}
              <section>
                 <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-sm font-semibold text-gray-700">出行方式</h2>
                </div>
                <TravelModeSelector
                  selected={profile}
                  onSelect={setProfile}
                />
              </section>

               {/* 生成按钮 */}
              <section>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xs text-gray-500">今日剩余自定义次数: <span className={remaining > 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>{remaining}</span></h2>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={loading || (remaining <= 0 && selectedLandmark?.id?.startsWith('custom-') && !getCachedIsochrones(selectedLandmark?.coordinates || [0,0], profile, rangeMinutes))}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-lg 
                            transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                            ${loading || (remaining <= 0 && selectedLandmark?.id?.startsWith('custom-') && !getCachedIsochrones(selectedLandmark?.coordinates || [0,0], profile, rangeMinutes))
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'
                            }`}
                >
                  {loading ? '生成中...' : (remaining <= 0 && selectedLandmark?.id?.startsWith('custom-') && !getCachedIsochrones(selectedLandmark?.coordinates || [0,0], profile, rangeMinutes)) ? '次数耗尽' : '开始分析'}
                </button>
              </section>

              <div className="border-t border-gray-100 pt-4">
                 <ShareButton
                  landmark={selectedLandmark}
                  profile={profile}
                  rangeMinutes={rangeMinutes}
                  hasData={isochrones.length > 0}
                />
              </div>

              {/* 底部信息 */}
              <div className="text-[10px] text-gray-400 text-center flex justify-between items-center pt-2">
                 <span>数据: OpenRouteService</span>
                 <a href="https://kuhung.me/about" className="hover:text-emerald-500">kuhung</a>
              </div>
           </div>
        </div>

        {/* 错误提示 - 跟随面板 */}
        {error && (
          <div className="absolute w-full z-50 bottom-full left-0 mb-2 px-4 md:top-full md:bottom-auto md:left-auto md:right-0 md:mt-2 md:mb-0 md:px-0">
            <ErrorMessage message={error} onDismiss={clearError} />
          </div>
        )}
      </div>
      
      {/* 结果浏览模式下的工具栏：编辑 + 分享 */}
      {isResultView && (
        <ResultToolbar
          landmark={selectedLandmark}
          profile={profile}
          rangeMinutes={rangeMinutes}
          poiByLayer={poiByLayer}
          onEdit={() => setIsPanelOpen(true)}
        />
      )}

      {/* 非结果模式但面板关闭时的打开按钮 */}
      {!isResultView && !isPanelOpen && (
        <button 
          onClick={() => setIsPanelOpen(true)}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-xl bg-white/90 backdrop-blur shadow-lg text-gray-600 hover:bg-white transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

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
