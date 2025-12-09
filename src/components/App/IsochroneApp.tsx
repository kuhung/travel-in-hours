'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { CityLandmark, TravelProfile } from '@/types';
import { defaultTimeRanges } from '@/data/isochrone-config';
import { getLandmarkById } from '@/data/landmarks';
import { MapWrapper, MapLegend } from '@/components/Map';
import { 
  CitySelector, 
  TravelModeSelector, 
  ShareButton 
} from '@/components/Controls';
import { ErrorMessage, WelcomeGuide } from '@/components/UI';
import { useIsochrones, useShareParams } from '@/hooks';
import { startBackgroundPreload } from '@/lib/cache-preloader';

function IsochroneAppContent() {
  // 从 URL 参数读取初始值
  const shareParams = useShareParams();
  
  // 状态管理
  const [selectedLandmark, setSelectedLandmark] = useState<CityLandmark | null>(() => getLandmarkById('shanghai-yishan-road') || null);
  const [profile, setProfile] = useState<TravelProfile>('driving-car');
  const [rangeMinutes] = useState<number[]>(defaultTimeRanges);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  
  // 等时圈数据
  const { 
    isochrones, 
    loading, 
    error, 
    fetchIsochrones, 
    clearIsochrones,
    clearError 
  } = useIsochrones();

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
    
    await fetchIsochrones(
      selectedLandmark.coordinates,
      profile,
      rangeMinutes
    );
    
    // 生成成功后，折叠面板
    setIsPanelOpen(false); 
  }, [selectedLandmark, profile, rangeMinutes, fetchIsochrones]);

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

  // 从分享参数初始化
  useEffect(() => {
    if (shareParams.hasParams) {
      if (shareParams.landmark) setSelectedLandmark(shareParams.landmark);
      setProfile(shareParams.profile);
      // 如果有分享参数，可能也想直接进入结果模式，但目前逻辑是等待用户点击生成
    }
  }, [shareParams]);

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
          isochrones={isochrones}
          profile={profile}
          rangeMinutes={rangeMinutes}
        />
      </div>

      {/* 图例 - 仅在纯净结果浏览模式下显示 */}
      {isResultView && (
        <MapLegend rangeMinutes={rangeMinutes} />
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
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-lg 
                            transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                            ${loading 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'
                            }`}
                >
                  {loading ? '生成中...' : '开始分析'}
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
      
      {/* 折叠后的状态显示 / 重新打开按钮 (右上角折叠效果) */}
      <button 
        onClick={() => {
          setIsPanelOpen(true);
          // 重新打开面板时不自动清除数据，允许用户在查看结果时打开面板进行分享
        }}
        className={`
            absolute top-4 right-4 z-30 
            bg-white/90 backdrop-blur shadow-lg border border-white/20
            text-gray-700 hover:bg-white hover:text-emerald-600
            transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
            flex items-center gap-3 overflow-hidden
            ${!isPanelOpen 
              ? 'translate-y-0 opacity-100 scale-100 py-3 px-4 rounded-xl' 
              : 'translate-y-[-120%] opacity-0 scale-90 py-0 px-0 rounded-full h-0 w-0'
            }
        `}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
        </div>
        <div className="flex flex-col items-start whitespace-nowrap">
            <span className="text-sm font-bold">编辑查询</span>
            <span className="text-[10px] text-gray-500 opacity-80">
                {selectedLandmark?.name.slice(0, 6)} · {profile === 'driving-car' ? '驾车' : profile === 'cycling-regular' ? '骑行' : '步行'}
            </span>
        </div>
      </button>

      {/* 纯图标开关 (当非ResultMode且Panel关闭时显示，作为备份入口) */}
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
