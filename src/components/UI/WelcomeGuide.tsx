'use client';

export interface WelcomeGuideProps {
  isOpen: boolean;
  onExploreMyLocation: () => void;
  onViewExample: () => void;
  onDismiss: () => void;
  isLocating?: boolean;
  locatingError?: string | null;
  onRetryLocating?: () => void;
}

export function WelcomeGuide({
  isOpen = false,
  onExploreMyLocation,
  onViewExample,
  onDismiss,
  isLocating = false,
  locatingError = null,
  onRetryLocating,
}: Partial<WelcomeGuideProps>) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-[3px] animate-in fade-in duration-300">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-sm md:max-w-md w-full p-6 relative overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100"
      >
        {/* 关闭按钮 */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="关闭引导"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* 装饰背景 */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-36 h-36 bg-blue-100 rounded-full opacity-60 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-36 h-36 bg-blue-100 rounded-full opacity-50 blur-2xl pointer-events-none" />

        {/* 内容 */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 mb-4 text-white">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">
            发现你的 1 小时生活圈
          </h2>
          
          <p className="text-gray-600 mb-5 leading-relaxed text-xs sm:text-sm">
            支持固定 <span className="font-semibold text-blue-700">15 / 30 / 60 分钟</span> 三档可达范围估算。
            <br />
            按用户意图从真实起点出发，或先看典型示例：
          </p>

          {/* 定位异常反馈 */}
          {locatingError && (
            <div className="w-full mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-800 animate-fade-in">
              <div className="font-medium flex items-center gap-1.5 mb-1 text-amber-900">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{locatingError}</span>
              </div>
              <p className="text-amber-700 leading-normal">
                您可重试定位，或先查看上海示例，也可以直接在地图上选点。
              </p>
              {onRetryLocating && (
                <button
                  type="button"
                  onClick={onRetryLocating}
                  className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-800 underline cursor-pointer"
                >
                  重试定位
                </button>
              )}
            </div>
          )}

          {/* 两个明确操作入口 */}
          <div className="w-full space-y-3">
            {/* 1. 从我的位置探索 */}
            <button
              type="button"
              onClick={onExploreMyLocation}
              disabled={isLocating}
              className="w-full p-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-medium transition-all shadow-md shadow-blue-600/20 flex items-center justify-between group disabled:opacity-75 disabled:cursor-wait"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  {isLocating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-sm">
                    {isLocating ? '正在获取位置...' : '从我的位置探索'}
                  </div>
                  <div className="text-[11px] text-blue-100">
                    需浏览器位置权限 · 免配额快速探索
                  </div>
                </div>
              </div>
              <svg className="w-4 h-4 text-blue-200 group-hover:translate-x-0.5 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* 2. 先看上海示例 */}
            <button
              type="button"
              onClick={onViewExample}
              className="w-full p-3.5 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-200 text-gray-900 rounded-xl font-medium transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs">
                  示例
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-900">先看上海示例</div>
                  <div className="text-[11px] text-gray-500">
                    免权限快速体验 · 包含 15/30/60 分钟范围与精选地点
                  </div>
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* 辅助出口：跳过引导直接选点 */}
          {onDismiss && (
            <div className="mt-4 pt-3 border-t border-gray-100 w-full flex items-center justify-center text-xs text-gray-400">
              <button
                type="button"
                onClick={onDismiss}
                className="hover:text-gray-700 underline underline-offset-2 transition-colors cursor-pointer"
              >
                直接在地图上选点
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
