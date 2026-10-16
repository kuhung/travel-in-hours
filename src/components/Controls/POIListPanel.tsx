'use client';

import { useMemo } from 'react';
import type { JourneyContext } from '@/lib/analytics';
import { TravelProfile, CoverageStatus, CityLandmark } from '@/types';
import { POIByLayer, formatExclusiveTierTime, POIWithLayer } from '@/lib/poi-utils';
import { getCoverageStatusDescription } from '@/lib/layout-utils';
import POIDetailCard from './POIDetailCard';

interface POIListPanelProps {
  poiByLayer: POIByLayer[];
  totalPOIs?: number;
  coverageStatus?: CoverageStatus;
  isPartial?: boolean;
  disclaimer?: string;
  dataError?: string | null;
  onPOIHover?: (index: number | null) => void;
  selectedPOIId?: string | null;
  analyticsContext?: JourneyContext;
  onSelectPOI?: (poiId: string | null) => void;
  onPOIClick?: (index: number) => void;
  rangeMinutes?: number[];
  isOpen?: boolean;
  onToggleOpen?: (open: boolean) => void;
  onEdit?: () => void;
  onViewExample?: () => void;
  onRetry?: () => void;
  profile?: TravelProfile;
  landmarkName?: string;
  committedLandmark?: CityLandmark | null;
  isMobile?: boolean;
  onSharePOI?: (poi: POIWithLayer) => void;
}

export default function POIListPanel({
  poiByLayer,
  totalPOIs: propTotalPOIs,
  coverageStatus = 'matched',
  isPartial = false,
  disclaimer,
  dataError = null,
  onPOIHover,
  selectedPOIId = null,
  analyticsContext,
  onSelectPOI,
  onPOIClick,
  rangeMinutes = [15, 30, 60],
  isOpen = true,
  onToggleOpen,
  onEdit,
  onViewExample,
  onRetry,
  profile = 'driving-car',
  landmarkName,
  committedLandmark = null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isMobile = false,
  onSharePOI,
}: POIListPanelProps) {
  const totalPOIs = propTotalPOIs !== undefined
    ? propTotalPOIs
    : poiByLayer.reduce((sum, layer) => sum + layer.points.length, 0);

  // 扁平化查找当前选中的 POI 实体（为 #9 预留）
  const allPoints: POIWithLayer[] = useMemo(() => {
    return poiByLayer.flatMap(layer => layer.points);
  }, [poiByLayer]);

  const selectedPOI = useMemo(() => {
    if (!selectedPOIId) return null;
    return allPoints.find(p => p.id === selectedPOIId) || null;
  }, [allPoints, selectedPOIId]);

  // 获取覆盖状态详细描述与推荐操作
  const statusMeta = useMemo(() => {
    return getCoverageStatusDescription({
      status: coverageStatus,
      isPartial,
      matchedCount: totalPOIs,
      landmarkName,
      profile,
      dataError,
    });
  }, [coverageStatus, isPartial, totalPOIs, landmarkName, profile, dataError]);

  // 识别是否全为珠海出入境智能服务厅（专题特定展示，跨城混合仍走通用文案）
  const isAllImmigration = useMemo(() => {
    return allPoints.length > 0 && allPoints.every((p) => p.id.startsWith('zh-imm-'));
  }, [allPoints]);

  const effectiveTitle = isAllImmigration && statusMeta.title === '可达地点清单'
    ? '可达出入境服务厅'
    : statusMeta.title;

  const effectiveBadgeText = isAllImmigration && coverageStatus === 'matched'
    ? `共 ${totalPOIs} 处出入境服务厅`
    : statusMeta.badgeText;

  const handlePOIClick = (poi: POIWithLayer) => {
    // 稳定 POI ID 选择回调（为 #9 提供单一事实来源）
    onSelectPOI?.(poi.id);
    // 兼容历史基于 index 的回调
    onPOIClick?.(poi.index);
  };

  // 当清单处于折叠状态时：桌面端与移动端分别提供明确的展开入口按钮
  if (!isOpen) {
    return (
      <>
        {/* 桌面端展开按钮 */}
        <button
          type="button"
          onClick={() => onToggleOpen?.(true)}
          className="hidden md:flex fixed top-20 left-4 z-20 items-center gap-2 px-3.5 py-2.5 bg-white/95 backdrop-blur-md shadow-lg rounded-xl border border-gray-200 text-gray-700 hover:text-blue-700 hover:border-blue-300 transition-all cursor-pointer font-medium text-xs group"
          aria-label="展开地点清单"
        >
          <span className={`w-2 h-2 rounded-full ${totalPOIs > 0 ? 'bg-blue-500' : 'bg-amber-500'}`} />
          <span className="font-semibold">地点清单</span>
          <span className="text-slate-600 text-[11px]">({totalPOIs})</span>
          <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 移动端展开药丸按钮 */}
        <button
          type="button"
          onClick={() => onToggleOpen?.(true)}
          className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 bg-white/95 backdrop-blur-md shadow-xl rounded-full border border-gray-200 text-gray-800 font-semibold text-xs transition-all active:scale-95 cursor-pointer"
          aria-label="展开地点清单"
        >
          <span className={`w-2 h-2 rounded-full ${totalPOIs > 0 ? 'bg-blue-500' : 'bg-amber-500'}`} />
          <span>查看地点清单 ({totalPOIs})</span>
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </>
    );
  }

  return (
    <div
      className="
        fixed z-20 bg-white shadow-2xl
        inset-x-0 bottom-0 rounded-t-2xl
        h-[48vh] max-h-[75vh] md:h-full
        md:inset-y-0 md:left-0 md:right-auto md:bottom-auto
        md:w-80 md:rounded-none md:rounded-r-2xl
        border-t md:border-t-0 md:border-r border-gray-200/80
        flex flex-col
        transition-all duration-300
      "
      data-testid="poi-list-panel"
    >
      {/* 移动端明确的收起操作条（替换原有无行为的假拖拽指示条） */}
      <div className="md:hidden flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${totalPOIs > 0 ? 'bg-blue-500' : 'bg-amber-500'}`} />
          <span className="text-xs font-bold text-gray-800">{isAllImmigration ? `出入境服务厅 (${totalPOIs})` : `可达地点 (${totalPOIs})`}</span>
          {isPartial && (
            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
              部分跨界
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onToggleOpen?.(false)}
          className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-gray-200 cursor-pointer"
          aria-label="收起地点清单"
        >
          <span>收起清单</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* 桌面端头部 */}
      <div className="hidden md:flex bg-white border-b border-gray-100 px-4 py-3.5 items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-gray-800 truncate">{effectiveTitle}</h2>
              {isPartial && (
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded shrink-0">
                  精选收录
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 truncate">{effectiveBadgeText}</p>
          </div>
        </div>

        {/* 桌面端收起按钮 */}
        <button
          type="button"
          onClick={() => onToggleOpen?.(false)}
          className="p-1.5 rounded-lg text-slate-600 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
          title="收起清单面板"
          aria-label="收起清单面板"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* 内容区 */}
      <div className="overflow-y-auto p-4 space-y-5 flex-1 min-h-0">
        {/* 空态处理：独立区分 uncovered / covered-empty / partial / 数据错误，绝不空白暗示“没有地方” */}
        {totalPOIs === 0 ? (
          <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 text-center space-y-3 my-auto">
            <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center bg-blue-100 text-blue-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">{statusMeta.title}</h3>
              <p className="text-sm text-slate-700 mt-2 leading-relaxed text-left">
                {statusMeta.explanation}
              </p>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed text-left">
                {statusMeta.helpfulNote}
              </p>
            </div>

            {/* 明确的后续操作出口 */}
            <div className="flex flex-col gap-2 pt-2">
              {statusMeta.canViewExample && onViewExample && (
                <button
                  type="button"
                  onClick={onViewExample}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer"
                >
                  查看上海地点示例
                </button>
              )}
              {statusMeta.canEditOrigin && onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
                >
                  修改出发点或方式
                </button>
              )}
              {statusMeta.canRetry && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
                >
                  重试地点匹配
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 跨边界部分覆盖时的收录说明条 */}
            {isPartial && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 text-[11px] text-amber-800 leading-snug">
                地图已显示可达范围，清单展示其中已收录的精选地点。
              </div>
            )}

            {/* 按圈层最小互斥分组呈现地点 */}
            {poiByLayer.map((layer) => {
              const exclusiveLabel = formatExclusiveTierTime(layer.layerMinutes, rangeMinutes);
              return (
                <div key={layer.layerMinutes} className="space-y-2">
                  {/* 圈层标题：明确标注为最小互斥区间与预估性质 */}
                  <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: layer.fillColor, border: `2px solid ${layer.color}` }}
                      />
                      <span className="text-xs font-bold text-gray-800">
                        {exclusiveLabel} 预估可达
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600">
                      {layer.points.length} 处
                    </span>
                  </div>

                  {/* POI 列表卡片 */}
                  <div className="space-y-2">
                    {layer.points.map((poi) => {
                      const isSelected = selectedPOIId === poi.id;
                      return (
                        <div
                          key={poi.id}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          aria-label={`选择地点 ${poi.name}，${exclusiveLabel}预估可达`}
                          className={`
                            flex items-start gap-2.5 p-2.5 rounded-xl border
                            cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500
                            ${isSelected
                              ? 'bg-blue-50/70 border-blue-500 shadow-sm ring-1 ring-blue-500'
                              : 'bg-gray-50/70 hover:bg-gray-100 border-gray-100'
                            }
                          `}
                          onMouseEnter={() => onPOIHover?.(poi.index)}
                          onMouseLeave={() => onPOIHover?.(null)}
                          onClick={() => handlePOIClick(poi)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handlePOIClick(poi);
                            }
                          }}
                        >
                          {/* 编号标记 */}
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                            style={{ backgroundColor: layer.color }}
                          >
                            {poi.index}
                          </div>

                          {/* 信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-gray-800 truncate">
                                {poi.name}
                              </span>
                              {isSelected && (
                                <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded shrink-0">
                                  已选
                                </span>
                              )}
                            </div>
                            {poi.description && (
                              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                {poi.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* 选中地点信息栏（为 #9 目的地行动提供挂载容器） */}
      {selectedPOI && (
        <div
          id="poi-detail-container"
          data-testid="poi-detail-container"
          className="border-t border-gray-200/90 bg-slate-50/95 shrink-0 max-h-[46%] md:max-h-[50%] overflow-y-auto"
        >
          <POIDetailCard
            key={selectedPOI.id}
            analyticsContext={analyticsContext}
            poi={selectedPOI}
            origin={committedLandmark || (landmarkName ? { id: 'origin', name: landmarkName, city: '', province: '', coordinates: [0, 0] } : null)}
            profile={profile}
            rangeMinutes={rangeMinutes}
            onClose={() => onSelectPOI?.(null)}
            onShare={onSharePOI}
            variant="embedded"
          />
        </div>
      )}

      {/* 底部估算说明 */}
      <div className="px-4 py-2 border-t border-gray-100 bg-white text-[10px] text-slate-600 text-center shrink-0">
        基于路网模型实估生活圈{disclaimer ? ` · ${disclaimer}` : ''}
      </div>
    </div>
  );
}
