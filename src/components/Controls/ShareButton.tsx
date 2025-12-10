'use client';

import { useState } from 'react';
import { CityLandmark, TravelProfile } from '@/types';
import ShareMenu from './ShareMenu';

interface ShareButtonProps {
  landmark: CityLandmark | null;
  profile: TravelProfile;
  rangeMinutes: number[];
  hasData?: boolean;
}

/**
 * 分享按钮组件
 * 用于控制面板中，显示分享按钮和下拉菜单
 */
export default function ShareButton({ 
  landmark, 
  profile, 
  rangeMinutes, 
  hasData = false 
}: ShareButtonProps) {
  const [showOptions, setShowOptions] = useState(false);

  // 如果没有地点，显示禁用状态
  if (!landmark) {
    return (
      <button 
        disabled
        className="w-full py-3 px-4 rounded-xl bg-gray-100 text-gray-400 
                   cursor-not-allowed flex items-center justify-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        选择地点后可分享
      </button>
    );
  }

  // 有地点但没数据
  if (!hasData) {
    return (
      <button 
        disabled
        className="w-full py-3 px-4 rounded-xl bg-gray-100 text-gray-400 
                   cursor-not-allowed flex items-center justify-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        分析范围后可分享
      </button>
    );
  }

  return (
    <div className="relative">
      <button 
        onClick={() => setShowOptions(!showOptions)}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 
                   text-white text-sm font-medium hover:from-emerald-400 hover:to-teal-500 
                   transition-all flex items-center justify-center gap-2 
                   shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        分享可达地图
      </button>

      {showOptions && (
        <ShareMenu
          landmark={landmark}
          profile={profile}
          rangeMinutes={rangeMinutes}
          trackingLocation="share_button"
          direction="up"
          showCopyLink={true}
          onClose={() => setShowOptions(false)}
        />
      )}
    </div>
  );
}
