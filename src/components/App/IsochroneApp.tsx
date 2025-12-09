'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { CityLandmark, TravelProfile } from '@/types';
import { travelProfiles } from '@/data/isochrone-config';
import { MapWrapper } from '@/components/Map';
import { 
  CitySelector, 
  TravelModeSelector, 
  TimeRangeSelector, 
  ShareButton 
} from '@/components/Controls';
import { LoadingOverlay, ErrorMessage } from '@/components/UI';
import { useIsochrones, useShareParams } from '@/hooks';

function IsochroneAppContent() {
  // 从 URL 参数读取初始值
  const shareParams = useShareParams();
  
  // 状态管理 - 默认选中1小时和2小时
  const [selectedLandmark, setSelectedLandmark] = useState<CityLandmark | null>(null);
  const [profile, setProfile] = useState<TravelProfile>('driving-car');
  const [rangeMinutes, setRangeMinutes] = useState<number[]>([60, 120]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // 等时圈数据
  const { 
    isochrones, 
    loading, 
    error, 
    fetchIsochrones, 
    clearIsochrones,
    clearError 
  } = useIsochrones();

  // 当前出行方式的最大时间范围
  const currentProfileConfig = travelProfiles.find(p => p.id === profile);
  const maxRange = currentProfileConfig?.maxRange || 60;

  // 从分享参数初始化
  useEffect(() => {
    if (shareParams.hasParams) {
      setSelectedLandmark(shareParams.landmark);
      setProfile(shareParams.profile);
      setRangeMinutes(shareParams.rangeMinutes.filter(r => r <= maxRange));
    }
  }, [shareParams, maxRange]);

  // 当切换出行方式时，过滤超出范围的时间选项
  useEffect(() => {
    setRangeMinutes(prev => {
      const filtered = prev.filter(r => r <= maxRange);
      return filtered.length > 0 ? filtered : [Math.min(30, maxRange)];
    });
  }, [maxRange]);

  // 获取等时圈数据
  const handleFetchIsochrones = useCallback(async () => {
    if (!selectedLandmark) return;
    
    await fetchIsochrones(
      selectedLandmark.coordinates,
      profile,
      rangeMinutes
    );
  }, [selectedLandmark, profile, rangeMinutes, fetchIsochrones]);

  // 选择地标后自动获取数据
  useEffect(() => {
    if (selectedLandmark) {
      handleFetchIsochrones();
    } else {
      clearIsochrones();
    }
  }, [selectedLandmark, profile, rangeMinutes, handleFetchIsochrones, clearIsochrones]);

  // 处理地图点击
  const handleMapClick = useCallback((lat: number, lng: number) => {
    const customLandmark: CityLandmark = {
      id: `custom-${Date.now()}`,
      name: '自定义位置',
      city: '点击位置',
      province: '',
      coordinates: [lng, lat],
      description: `经度: ${lng.toFixed(4)}, 纬度: ${lat.toFixed(4)}`,
    };
    setSelectedLandmark(customLandmark);
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-900">
      {/* 地图 */}
      <div className="absolute inset-0">
        <MapWrapper
          landmark={selectedLandmark}
          isochrones={isochrones}
          profile={profile}
          rangeMinutes={rangeMinutes}
          onMapClick={handleMapClick}
        />
      </div>

      {/* 顶部标题栏 */}
      <header className="absolute top-0 left-0 right-0 z-[2000] pointer-events-none">
        <div className="bg-gradient-to-b from-slate-900/90 to-transparent p-4 pb-16">
          <div className="flex items-center justify-between max-w-screen-2xl mx-auto pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 
                              flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">出行可达地图</h1>
                <p className="text-xs text-gray-400">3小时内 · 去哪都行</p>
              </div>
            </div>
            
            {/* 移动端侧边栏切换按钮 */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2.5 rounded-xl bg-white/10 backdrop-blur-sm 
                       text-white hover:bg-white/20 transition-all active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* 控制面板侧边栏 */}
      <aside 
        className={`absolute top-0 right-0 h-full z-[3000] w-full max-w-[340px]
                   transform transition-transform duration-300 ease-in-out
                   ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
                   lg:translate-x-0`}
      >
        <div className="h-full bg-slate-900/95 backdrop-blur-xl border-l border-white/10 
                       overflow-y-auto pt-20 pb-6 px-5">
          <div className="space-y-5">
            {/* 移动端关闭按钮 */}
            <div className="lg:hidden flex justify-end -mt-2 mb-2">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                aria-label="关闭侧边栏"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 地点选择 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-white">出发地点</h2>
              </div>
              <CitySelector
                selectedLandmark={selectedLandmark}
                onSelect={setSelectedLandmark}
              />
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                点击地图可选择任意位置
              </p>
            </section>

            {/* 出行方式 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-white">出行方式</h2>
              </div>
              <TravelModeSelector
                selected={profile}
                onSelect={setProfile}
              />
            </section>

            {/* 时间范围 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-white">可达时间</h2>
              </div>
              <TimeRangeSelector
                selected={rangeMinutes}
                onSelect={setRangeMinutes}
                maxRange={maxRange}
              />
              {profile === 'driving-car' && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-amber-300/90">
                    ORS API 限制驾车等时圈最多 1 小时
                  </p>
                </div>
              )}
            </section>

            {/* 错误提示 */}
            {error && (
              <ErrorMessage message={error} onDismiss={clearError} />
            )}

            {/* 分享按钮 */}
            <section className="pt-3 border-t border-white/5">
              <ShareButton
                landmark={selectedLandmark}
                profile={profile}
                rangeMinutes={rangeMinutes}
              />
            </section>

            {/* 关于信息 */}
            <section className="pt-3 border-t border-white/5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>数据来源：OpenRouteService</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>模拟非高峰时段理想可达范围</span>
                </div>
              </div>
            </section>

            {/* 版权信息 */}
            <footer className="pt-3 text-center border-t border-white/5">
              <p className="text-xs text-gray-600">
                Made with <span className="text-rose-400">♥</span> by{' '}
                <a 
                  href="mailto:hi@kuhung.me" 
                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  kuhung
                </a>
              </p>
              <p className="text-xs text-gray-600 mt-1">© 2025</p>
            </footer>
          </div>
        </div>
      </aside>

      {/* 加载遮罩 */}
      {loading && <LoadingOverlay />}

      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div 
          className="lg:hidden absolute inset-0 bg-black/50 z-[2500]"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default function IsochroneApp() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    }>
      <IsochroneAppContent />
    </Suspense>
  );
}

