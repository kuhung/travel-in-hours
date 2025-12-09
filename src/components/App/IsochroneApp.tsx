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
  
  // 状态管理
  const [selectedLandmark, setSelectedLandmark] = useState<CityLandmark | null>(null);
  const [profile, setProfile] = useState<TravelProfile>('driving-car');
  const [rangeMinutes, setRangeMinutes] = useState<number[]>([30, 60]);
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
                <span className="text-xl">🗺️</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">出行可达地图</h1>
                <p className="text-xs text-gray-400">基于 OpenRouteService 实时计算</p>
              </div>
            </div>
            
            {/* 移动端侧边栏切换按钮 */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg bg-white/10 backdrop-blur-sm 
                       text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* 控制面板侧边栏 */}
      <aside 
        className={`absolute top-0 right-0 h-full z-[3000] w-full max-w-sm 
                   transform transition-transform duration-300 ease-in-out
                   ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
                   lg:translate-x-0`}
      >
        <div className="h-full bg-slate-900/95 backdrop-blur-md border-l border-white/10 
                       overflow-y-auto pt-20 pb-6 px-4">
          <div className="space-y-6">
            {/* 移动端关闭按钮 */}
            <div className="lg:hidden flex justify-end mb-4">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="关闭侧边栏"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 地点选择 */}
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                出发地点
              </h2>
              <CitySelector
                selectedLandmark={selectedLandmark}
                onSelect={setSelectedLandmark}
              />
              <p className="mt-2 text-xs text-gray-500">
                💡 也可以直接点击地图选择任意位置
              </p>
            </section>

            {/* 出行方式 */}
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                出行方式
              </h2>
              <TravelModeSelector
                selected={profile}
                onSelect={setProfile}
              />
            </section>

            {/* 时间范围 */}
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                可达时间
              </h2>
              <TimeRangeSelector
                selected={rangeMinutes}
                onSelect={setRangeMinutes}
                maxRange={maxRange}
              />
              {profile === 'driving-car' && (
                <p className="mt-2 text-xs text-amber-400">
                  ⚠️ ORS API 限制驾车等时圈最多 1 小时
                </p>
              )}
            </section>

            {/* 错误提示 */}
            {error && (
              <ErrorMessage message={error} onDismiss={clearError} />
            )}

            {/* 分享按钮 */}
            <section className="pt-4 border-t border-white/10">
              <ShareButton
                landmark={selectedLandmark}
                profile={profile}
                rangeMinutes={rangeMinutes}
              />
            </section>

            {/* 关于信息 */}
            <section className="pt-4 border-t border-white/10">
              <div className="text-xs text-gray-500 space-y-2">
                <p>
                  📊 数据来源：OpenRouteService 实时交通数据
                </p>
                <p>
                  🚗 模拟非高峰时段理想状态下的可达范围
                </p>
                <p>
                  📍 实际情况因交通状况有所波动
                </p>
              </div>
            </section>

            {/* 版权信息 */}
            <footer className="pt-4 text-center">
              <p className="text-xs text-gray-600">
                Made with ❤️ by{' '}
                <a 
                  href="mailto:hi@kuhung.me" 
                  className="text-emerald-400 hover:underline"
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

