'use client';

import { useState, useEffect } from 'react';

export function WelcomeGuide() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 检查是否是首次访问
    // 使用 try-catch 防止在某些隐私模式下访问 localStorage 报错
    try {
      const hasVisited = localStorage.getItem('has_visited_intro');
      if (!hasVisited) {
        // 稍微延迟显示，让地图先加载出来，体验更好
        const timer = setTimeout(() => setIsVisible(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn('LocalStorage access denied', e);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem('has_visited_intro', 'true');
    } catch (e) {
      // ignore
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-500">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-xs md:max-w-sm w-full p-6 relative overflow-hidden animate-in zoom-in-95 duration-300 border border-white/40"
      >
        {/* 装饰背景 */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-emerald-100 rounded-full opacity-50 blur-2xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-blue-100 rounded-full opacity-50 blur-2xl pointer-events-none"></div>

        {/* 内容 */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4 text-white transform -rotate-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-2 tracking-tight">
            发现你的 1 小时生活圈
          </h2>
          
          <p className="text-gray-500 mb-6 leading-relaxed text-sm">
            一场说走就走的旅行，可以去哪里？<br/>
            选择起点，查看 <span className="font-bold text-emerald-600">步行、骑行或驾车</span> 的可达范围。
          </p>

          <button
            onClick={handleDismiss}
            className="w-full py-3 px-6 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 group"
          >
            <span>开始探索</span>
            <svg className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          
          <div className="mt-6 pt-4 border-t border-gray-100 w-full">
            <p className="text-[10px] text-gray-400">
               Build with ❤️ by <a href="https://kuhung.me" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500 underline decoration-dotted">kuhung</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

