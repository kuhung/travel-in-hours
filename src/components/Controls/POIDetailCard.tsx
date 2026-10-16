'use client';

import { useState, useMemo, useRef, useEffect, useSyncExternalStore } from 'react';
import { track, type JourneyContext } from '@/lib/analytics';
import type { TravelProfile, POIWithLayer, CityLandmark } from '@/types';
import {
  createAmapNavUrl,
  formatPOICopyText,
  copyTextToClipboard,
  getPOICategoryLabel,
  resolveNavigationAction,
  isMobileDevice,
} from '@/lib/navigation-utils.ts';
import { formatExclusiveTierTime } from '@/lib/poi-utils.ts';

const noopSubscribe = () => () => {};

export interface POIDetailCardProps {
  poi: POIWithLayer;
  origin?: CityLandmark | null;
  profile?: TravelProfile;
  rangeMinutes?: number[];
  onClose?: () => void;
  onShare?: (poi: POIWithLayer) => void;
  isMobilePlatform?: boolean;
  variant?: 'embedded' | 'floating';
  analyticsContext?: JourneyContext;
}

export default function POIDetailCard({
  poi,
  origin,
  profile = 'driving-car',
  rangeMinutes = [15, 30, 60],
  onClose,
  onShare,
  isMobilePlatform,
  variant = 'embedded',
  analyticsContext,
}: POIDetailCardProps) {
  // 设备能力判定：解耦视口宽度，优先使用独立传入的平台参数或环境检测（useSyncExternalStore 规范保障 SSR 安全）
  const effectiveIsMobile = useSyncExternalStore(
    noopSubscribe,
    () => (typeof isMobilePlatform === 'boolean' ? isMobilePlatform : isMobileDevice()),
    () => (typeof isMobilePlatform === 'boolean' ? isMobilePlatform : false)
  );

  // POI 身份绑定与状态隔离：切换 POI 时自动复位所有反馈状态
  const [lastPoiId, setLastPoiId] = useState(poi.id);
  const [navRequested, setNavRequested] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [showManualCopy, setShowManualCopy] = useState(false);

  if (poi.id !== lastPoiId) {
    setLastPoiId(poi.id);
    setNavRequested(false);
    setCopyStatus('idle');
    setShowManualCopy(false);
  }

  const currentPoiIdRef = useRef(poi.id);

  useEffect(() => {
    currentPoiIdRef.current = poi.id;
  }, [poi.id]);

  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const categoryLabel = useMemo(() => getPOICategoryLabel(poi.category), [poi.category]);
  const exclusiveTierLabel = useMemo(
    () => formatExclusiveTierTime(poi.layerMinutes, rangeMinutes),
    [poi.layerMinutes, rangeMinutes]
  );

  // 严格使用 committed 起点与选中目的地
  const navUrl = useMemo(() => {
    if (!origin) return null;
    return createAmapNavUrl({
      origin: {
        coordinates: origin.coordinates,
        name: origin.name,
      },
      destination: {
        coordinates: poi.coordinates,
        name: poi.name,
      },
      profile,
    });
  }, [origin, poi, profile]);

  // 解析当前平台真实可执行的导航动作与限制
  const navAction = useMemo(() => {
    return resolveNavigationAction({
      profile,
      isMobilePlatform: effectiveIsMobile,
      navUrl,
    });
  }, [profile, effectiveIsMobile, navUrl]);

  const copyText = useMemo(() => {
    return formatPOICopyText({
      poi,
      origin,
      profile,
      rangeMinutes,
      navUrl,
      isMobilePlatform: effectiveIsMobile,
    });
  }, [poi, origin, profile, rangeMinutes, navUrl, effectiveIsMobile]);

  // 处理在外部地图中导航请求
  const handleNavClick = () => {
    if (!navAction.canDirectlyNavigate || !navUrl) return;
    track('navigation_requested', {
      ...analyticsContext,
      location: variant === 'floating' ? 'floating_poi_card' : 'poi_list_detail',
      poi_id: poi.id,
      poi_name: poi.name,
      travel_mode: profile,
      attempt: true,
      is_mobile: effectiveIsMobile,
    });

    setNavRequested(true);
  };

  // 处理复制地点与坐标
  const handleCopy = async () => {
    const targetPoiId = poi.id;
    const success = await copyTextToClipboard(copyText);
    if (success) track('poi_coordinates_copied', {
      ...analyticsContext,
      location: variant === 'floating' ? 'floating_poi_card' : 'poi_list_detail',
    });
    if (currentPoiIdRef.current !== targetPoiId) return;

    if (success) {
      setCopyStatus('copied');
      setShowManualCopy(false);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        if (currentPoiIdRef.current === targetPoiId) {
          setCopyStatus('idle');
        }
      }, 3000);
    } else {
      setCopyStatus('failed');
      setShowManualCopy(true);
    }
  };

  const containerClasses = variant === 'floating'
    ? 'bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-2xl p-4 shadow-xl text-xs space-y-3 max-h-[75vh] overflow-y-auto'
    : 'p-3.5 text-xs space-y-3 bg-slate-50/90 border-t border-gray-100 max-h-full overflow-y-auto';

  return (
    <div className={containerClasses} data-testid="poi-detail-card">
      {/* 头部：地点名称、类别与关闭按钮 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-bold text-gray-900 truncate" title={poi.name}>
              {poi.name}
            </h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 shrink-0">
              {categoryLabel}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 shrink-0">
              {exclusiveTierLabel} 预估可达
            </span>
          </div>

          {/* 出发起点与出行方式 */}
          {origin && (
            <p className="text-[11px] text-gray-500 mt-1 truncate">
              出发起点: <span className="text-gray-700 font-medium">{origin.name}</span>
              <span className="mx-1">·</span>
              方式: <span className="text-gray-700 font-medium">
                {profile === 'driving-car' ? '驾车' : profile === 'cycling-regular' ? '骑行' : '步行'}
              </span>
            </p>
          )}
        </div>

        {/* 关闭按钮：关闭详情以保持探索 */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
            aria-label="关闭地点详情"
            title="关闭详情"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 真实已有字段：地点简介（缺省优雅省略） */}
      {poi.description && (
        <p className="text-xs text-gray-600 leading-relaxed bg-white/70 rounded-xl p-2.5 border border-gray-100">
          {poi.description}
        </p>
      )}

      {/* 真实已有字段：推荐指数（非第三方评分，如实标注） */}
      {typeof poi.rating === 'number' && (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className="font-medium text-amber-600">
            推荐指数: {'★'.repeat(poi.rating)}{'☆'.repeat(Math.max(0, 5 - poi.rating))}
          </span>
          <span className="text-[10px] text-gray-400">（本地精选推荐）</span>
        </div>
      )}

      {/* 桌面端骑行模式限制提示（依据官方文档如实说明，不静默改驾车） */}
      {!navAction.canDirectlyNavigate && navAction.warningMessage && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 text-[11px] text-amber-800 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>骑行导航限制说明</span>
          </div>
          <p className="leading-snug">{navAction.warningMessage}</p>
          <p className="text-[10px] text-amber-700/80 leading-snug">{navAction.adviceMessage}</p>
        </div>
      )}

      {/* 行动出口按钮组 */}
      <div className="flex items-center gap-2 pt-0.5">
        {/* 主要行动出口：受限时切换为复制手机信息，非受限时提供原生 a 标签直达外部地图 */}
        {navAction.canDirectlyNavigate && navUrl ? (
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleNavClick}
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer text-center"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>{navAction.primaryButtonText}</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{copyStatus === 'copied' ? '已复制手机信息' : navAction.primaryButtonText}</span>
          </button>
        )}

        {/* 辅助行动出口：复制地点与坐标（总可用） */}
        {navAction.canDirectlyNavigate && (
          <button
            type="button"
            onClick={handleCopy}
            className="py-2 px-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 active:scale-[0.99] text-gray-700 font-medium text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0"
            title="复制地点名称与坐标"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{copyStatus === 'copied' ? '已复制' : '复制地点'}</span>
          </button>
        )}

        {/* 辅助行动出口：分享此地点明确对象卡片与链接 */}
        {onShare && (
          <button
            type="button"
            onClick={() => {
              track('share_poi_clicked', {
                location: variant === 'floating' ? 'floating_poi_card' : 'poi_list_detail',
                poi_id: poi.id,
                poi_name: poi.name,
              });
              onShare(poi);
            }}
            className="py-2 px-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 active:scale-[0.99] text-gray-700 font-medium text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0"
            title="分享此地点卡片与链接"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>分享此地</span>
          </button>
        )}
      </div>

      {/* 原生打开请求状态反馈（不假测弹窗是否拦截，仅给出如实说明与指引） */}
      {navRequested && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[11px] text-emerald-800 flex items-start justify-between gap-2">
          <span>已请求打开外部地图页面（高德开放平台）。如未正常打开，请检查浏览器弹窗设置或点击下方复制手动使用。</span>
          <button
            type="button"
            onClick={() => setNavRequested(false)}
            className="text-emerald-700 hover:text-emerald-900 underline text-[10px] shrink-0 cursor-pointer"
          >
            知道了
          </button>
        </div>
      )}

      {/* 复制成功提示 */}
      {copyStatus === 'copied' && (
        <div className="text-[11px] text-emerald-700 font-medium text-center">
          ✓ 已复制地点与坐标（含 WGS-84 / GCJ-02 与导航链接）
        </div>
      )}

      {/* 复制失败降级：手动可选中文本与复制出口 */}
      {showManualCopy && (
        <div className="space-y-1 pt-1 border-t border-gray-100">
          <p className="text-[10px] text-gray-500">无法自动写入剪贴板，请长按或Ctrl+C手动复制：</p>
          <textarea
            readOnly
            value={copyText}
            rows={2}
            className="w-full max-h-20 text-[10px] p-2 bg-gray-50 border border-gray-200 rounded-lg select-all font-mono leading-tight"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={() => setShowManualCopy(false)}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline block ml-auto cursor-pointer"
          >
            收起文本
          </button>
        </div>
      )}
    </div>
  );
}
