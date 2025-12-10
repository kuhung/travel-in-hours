'use client';

import { POIByLayer, formatLayerTime } from '@/lib/poi-utils';

interface POIListPanelProps {
  poiByLayer: POIByLayer[];
  onPOIHover?: (index: number | null) => void;
  onPOIClick?: (index: number) => void;
}

export default function POIListPanel({
  poiByLayer,
  onPOIHover,
  onPOIClick,
}: POIListPanelProps) {
  const totalPOIs = poiByLayer.reduce((sum, layer) => sum + layer.points.length, 0);

  if (totalPOIs === 0) return null;

  return (
    <div
      className="
        fixed z-20 bg-white shadow-2xl
        inset-x-0 bottom-0 rounded-t-2xl
        h-[45vh] md:h-full
        md:inset-y-0 md:left-0 md:right-auto md:bottom-auto
        md:w-80 md:rounded-none md:rounded-r-2xl
        flex flex-col
        transition-all duration-300
      "
    >
      {/* 移动端拖拽指示条 */}
      <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>

      {/* 头部 */}
      <div className="bg-white border-b border-gray-100 px-5 py-4 pt-2 md:pt-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">可达热点清单</h2>
            <p className="text-xs text-gray-500">共 {totalPOIs} 个地点按圈层分布</p>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="overflow-y-auto p-5 space-y-6 flex-1">
        {poiByLayer.map((layer) => (
          <div key={layer.layerMinutes}>
            {/* 圈层标题 */}
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: layer.fillColor, border: `2px solid ${layer.color}` }}
              />
              <span className="text-sm font-semibold" style={{ color: layer.color }}>
                {formatLayerTime(layer.layerMinutes)}可达
              </span>
              <span className="text-xs text-gray-400">({layer.points.length})</span>
            </div>

            {/* POI 列表 */}
            <div className="space-y-2 pl-5">
              {layer.points.map((poi) => (
                <div
                  key={poi.id}
                  className="
                    flex items-start gap-3 p-3 rounded-xl
                    bg-gray-50 hover:bg-gray-100 cursor-pointer
                    transition-all duration-150
                  "
                  onMouseEnter={() => onPOIHover?.(poi.index)}
                  onMouseLeave={() => onPOIHover?.(null)}
                  onClick={() => onPOIClick?.(poi.index)}
                >
                  {/* 编号 */}
                  <div
                    className="
                      w-6 h-6 rounded-full flex items-center justify-center
                      text-xs font-bold text-white shrink-0
                    "
                    style={{ backgroundColor: layer.color }}
                  >
                    {poi.index}
                  </div>
                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {poi.name}
                    </div>
                    {poi.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {poi.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}