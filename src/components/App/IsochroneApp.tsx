'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { CityLandmark, TravelProfile } from '@/types';
import { defaultTimeRanges } from '@/data/isochrone-config';
import { getLandmarkById } from '@/data/landmarks';
import { MapWrapper } from '@/components/Map';
import { 
  CitySelector, 
  TravelModeSelector, 
  ShareButton 
} from '@/components/Controls';
import { ErrorMessage } from '@/components/UI';
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
    fromCache,
    fetchIsochrones, 
    clearIsochrones,
    clearError 
  } = useIsochrones();

  // 启动后台预加载
  useEffect(() => {
    startBackgroundPreload();
  }, []);

  // 从分享参数初始化
  useEffect(() => {
    if (shareParams.hasParams) {
      if (shareParams.landmark) setSelectedLandmark(shareParams.landmark);
      setProfile(shareParams.profile);
    }
  }, [shareParams]);

  // 获取等时圈数据
  const handleGenerate = useCallback(async () => {
    if (!selectedLandmark) return;
    
    await fetchIsochrones(
      selectedLandmark.coordinates,
      profile,
      rangeMinutes
    );
  }, [selectedLandmark, profile, rangeMinutes, fetchIsochrones]);

  // 当参数改变时自动清除结果，但不自动重新生成，以免过多请求
  // 用户需要点击生成按钮
  useEffect(() => {
    clearIsochrones();
  }, [selectedLandmark, profile, clearIsochrones]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-50">
      {/* 地图层 - 全屏 */}
      <div className="absolute inset-0 z-0">
        <MapWrapper
          landmark={selectedLandmark}
          isochrones={isochrones}
          profile={profile}
          rangeMinutes={rangeMinutes}
        />
      </div>

      {/* 顶部标题 - 极简风格 */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
         <h1 className="text-2xl font-bold text-gray-800 drop-shadow-sm flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-emerald-500/30 shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </span>
            <span>出行可达地图</span>
         </h1>
      </div>

      {/* 控制面板 - 悬浮卡片 */}
      <div className={`absolute top-4 right-4 z-20 transition-all duration-300 ${isPanelOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'}`}>
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-5 w-80 max-h-[calc(100vh-2rem)] overflow-y-auto">
           {/* 面板开关 (Mobile/Desktop toggle handled by parent div position, but we need a button to reopen if closed) */}
           
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
                 {/* 时间范围说明 (简化版) */}
                 <div className="flex justify-between items-center text-xs text-gray-500 mb-4">
                    <span>显示范围：</span>
                    <div className="flex gap-2">
                       <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-300 border border-green-600/20"></span>15分</span>
                       <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-200 border border-yellow-600/20"></span>30分</span>
                       <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-300 border border-red-600/20"></span>60分</span>
                    </div>
                 </div>

                 <ShareButton
                  landmark={selectedLandmark}
                  profile={profile}
                  rangeMinutes={rangeMinutes}
                />
              </div>

              {/* 底部信息 */}
              <div className="text-[10px] text-gray-400 text-center flex justify-between items-center pt-2">
                 <span>数据: OpenRouteService</span>
                 <a href="mailto:hi@kuhung.me" className="hover:text-emerald-500">kuhung</a>
              </div>
           </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="absolute top-full right-0 mt-2 w-full">
            <ErrorMessage message={error} onDismiss={clearError} />
          </div>
        )}
      </div>
      
      {/* 移动端/折叠时的开关按钮 */}
      <button 
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className={`absolute top-4 right-4 z-30 p-2.5 rounded-xl bg-white/90 backdrop-blur shadow-lg text-gray-600 hover:bg-white transition-all ${isPanelOpen ? 'hidden' : 'block'}`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* 关闭面板按钮 (在面板内) */}
      {isPanelOpen && (
        <button
          onClick={() => setIsPanelOpen(false)}
          className="absolute top-8 right-8 z-30 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-all lg:hidden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
