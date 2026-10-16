'use client';

import { track } from '@/lib/analytics';
import type { CityLandmark, TravelProfile, CoverageStatus } from '@/types';
import type { POIByLayer } from '@/lib/poi-utils';

export interface ResultToolbarProps {
  landmark: CityLandmark | null;
  profile: TravelProfile;
  rangeMinutes: number[];
  poiByLayer?: POIByLayer[];
  totalPOIs?: number;
  coverageStatus?: CoverageStatus;
  isPartial?: boolean;
  onEdit: () => void;
  isExample?: boolean;
  isShared?: boolean;
  onExploreMyLocation?: () => void;
  selectedPOIId?: string | null;
  onOpenShare?: () => void;
}

/**
 * 结果工具栏组件
 * 用于结果浏览模式，稳定展示 committed 起点全名、出行方式、三档范围、示例标记、匹配数与修改入口
 * 点击分享按钮时直接唤起全局统一的 ShareDialog
 */
export default function ResultToolbar({
  landmark,
  profile,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rangeMinutes,
  poiByLayer = [],
  totalPOIs: propTotalPOIs,
  coverageStatus = 'matched',
  isPartial = false,
  onEdit,
  isExample = false,
  isShared = false,
  onExploreMyLocation,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  selectedPOIId = null,
  onOpenShare,
}: ResultToolbarProps) {
  const totalPOIs = propTotalPOIs !== undefined
    ? propTotalPOIs
    : poiByLayer.reduce((sum, layer) => sum + layer.points.length, 0);

  const handleEdit = () => {
    track('edit_button_clicked', {
      location: 'result_toolbar',
      landmark: landmark?.name || '',
      city: landmark?.city || '',
      travel_mode: profile,
    });

    onEdit();
  };

  const handleShareClick = () => {
    track('share_button_clicked', {
      location: 'result_toolbar',
      landmark: landmark?.name || '',
      city: landmark?.city || '',
      travel_mode: profile,
    });

    onOpenShare?.();
  };

  const profileName = profile === 'driving-car' 
    ? '驾车' 
    : profile === 'cycling-regular' 
      ? '骑行' 
      : '步行';

  let statusText = `${totalPOIs} 处已收录`;
  if (coverageStatus === 'uncovered') {
    statusText = '未收录区域';
  } else if (coverageStatus === 'covered-empty') {
    statusText = '0 处收录';
  } else if (coverageStatus === 'partial' && totalPOIs === 0) {
    statusText = '跨边界未匹配';
  } else if (isPartial) {
    statusText = `${totalPOIs} 处(部分跨界)`;
  }

  return (
    <div className="absolute top-4 right-4 z-30 flex items-stretch gap-2 max-w-[calc(100vw-5.5rem)]">
      {/* 修改条件卡片 / 按钮 */}
      <button
        type="button"
        onClick={handleEdit}
        className="
          bg-white/95 backdrop-blur-md shadow-lg border border-white/40
          text-gray-700 hover:bg-white hover:text-blue-700 hover:border-blue-200
          transition-all duration-200
          flex items-center gap-2.5 py-2 px-3 sm:px-3.5 rounded-xl
          cursor-pointer group text-left max-w-full
        "
        aria-label="查看与修改当前探索条件"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>

        {/* 稳定展示 committed 起点全名、方式、固定档位、示例标记与匹配数（全屏及触屏均完整可查） */}
        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <span
              className="text-xs sm:text-sm font-bold text-gray-800 truncate max-w-[110px] xs:max-w-[140px] sm:max-w-[180px] md:max-w-[220px]"
              title={landmark?.name || '未知出发点'}
            >
              {landmark?.name || '未知出发点'}
            </span>
            {isExample && (
              <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-amber-100 text-amber-800 rounded shrink-0">
                示例
              </span>
            )}
            <span className="text-[11px] text-blue-600 font-semibold group-hover:underline shrink-0 ml-1">
              {isShared ? '分享的探索' : '修改'}
            </span>
          </div>

          <div className="text-[10px] text-gray-500 leading-tight mt-0.5 flex items-center gap-1 truncate">
            <span>{profileName}</span>
            <span>·</span>
            <span>15/30/60m</span>
            <span>·</span>
            <span className={totalPOIs > 0 ? "text-blue-700 font-medium" : "text-amber-700 font-medium"}>
              {statusText}
            </span>
          </div>
        </div>
      </button>

      {isShared && onExploreMyLocation && (
        <button type="button" onClick={onExploreMyLocation} className="rounded-xl bg-white/95 border border-slate-200 px-2 text-xs font-semibold text-blue-700 max-w-20 shrink-0">
          探索我的附近
        </button>
      )}

      {/* 分享按钮：直接唤起统一 ShareDialog */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={handleShareClick}
          className="
            h-full bg-blue-600
            text-white hover:bg-blue-700
            shadow-lg shadow-blue-500/20 border border-blue-400/20
            transition-all duration-200
            flex items-center gap-2 py-2 px-3 sm:px-3.5 rounded-xl cursor-pointer
          "
          aria-label="分享当前探索结果"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="hidden sm:inline text-xs sm:text-sm font-bold">分享</span>
        </button>
      </div>
    </div>
  );
}
