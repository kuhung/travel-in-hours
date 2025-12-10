'use client';

import { useState } from 'react';
import { track } from '@vercel/analytics';
import { CityLandmark, TravelProfile } from '@/types';
import { POIByLayer } from '@/lib/poi-utils';
import ShareMenu from './ShareMenu';

interface ResultToolbarProps {
  landmark: CityLandmark | null;
  profile: TravelProfile;
  rangeMinutes: number[];
  poiByLayer?: POIByLayer[];
  onEdit: () => void;
}

/**
 * 结果工具栏组件
 * 用于结果浏览模式，显示编辑按钮和分享按钮
 */
export default function ResultToolbar({
  landmark,
  profile,
  rangeMinutes,
  poiByLayer = [],
  onEdit,
}: ResultToolbarProps) {
  const [showShareOptions, setShowShareOptions] = useState(false);
  
  const handleEdit = () => {
    track('edit_button_clicked', {
      location: 'result_toolbar',
      landmark: landmark?.name || '',
      city: landmark?.city || '',
      travel_mode: profile
    });
    
    onEdit();
  };

  const profileName = profile === 'driving-car' 
    ? '驾车' 
    : profile === 'cycling-regular' 
      ? '骑行' 
      : '步行';

  return (
    <div className="absolute top-4 right-4 z-30 flex items-stretch gap-2">
      {/* 编辑按钮 */}
      <button
        onClick={handleEdit}
        className="
          bg-white/90 backdrop-blur shadow-lg border border-white/20
          text-gray-700 hover:bg-white hover:text-emerald-600
          transition-all duration-200
          flex items-center gap-2.5 py-2.5 px-3.5 rounded-xl
        "
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
        <div className="hidden sm:flex flex-col items-start whitespace-nowrap">
          <span className="text-sm font-bold leading-tight">编辑</span>
          <span className="text-[10px] text-gray-500 leading-tight">
            {landmark?.name.slice(0, 4) || '地点'} · {profileName}
          </span>
        </div>
      </button>

      {/* 分享按钮 */}
      <div className="relative">
        <button
          onClick={() => setShowShareOptions(!showShareOptions)}
          className="
            h-full bg-gradient-to-r from-emerald-500 to-teal-600 
            text-white hover:from-emerald-400 hover:to-teal-500
            shadow-lg shadow-emerald-500/20 border border-emerald-400/20
            transition-all duration-200
            flex items-center gap-2 py-2.5 px-3.5 rounded-xl
          "
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="hidden sm:inline text-sm font-bold">分享</span>
        </button>

        {/* 分享选项下拉菜单 */}
        {showShareOptions && landmark && (
          <ShareMenu
            landmark={landmark}
            profile={profile}
            rangeMinutes={rangeMinutes}
            poiByLayer={poiByLayer}
            trackingLocation="result_toolbar"
            direction="down"
            showCopyLink={false}
            onClose={() => setShowShareOptions(false)}
          />
        )}
      </div>
    </div>
  );
}
