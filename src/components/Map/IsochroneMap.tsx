'use client';

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  GeoJSON, 
  Marker,
  CircleMarker,
  Popup, 
  ZoomControl, 
  useMap 
} from 'react-leaflet';
import L from 'leaflet';
import { CityLandmark, IsochroneFeature, TravelProfile } from '@/types';
import {
  getColorForRange,
  getIsochroneStyle,
  sortIsochronesForRender,
  DESTINATION_STYLE,
  VISUAL_THEME,
  TIER_BADGE_CONFIG,
  MINIMAL_ORIGIN_PIN_SVG,
} from '@/data/isochrone-config';
import { wgs84ToGcj02, gcj02ToWgs84 } from '@/lib/coord-transform';
import { POIWithLayer, formatExclusiveTierTime } from '@/lib/poi-utils';
import { getPOICategoryLabel, createAmapNavUrl, resolveNavigationAction, isMobileDevice } from '@/lib/navigation-utils.ts';
import type { MapPaddingResult } from '@/lib/layout-utils';
import { focusMapOnLocation } from '@/lib/map-viewport';

// 修复 Leaflet 默认图标问题
const fixLeafletIcons = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    // 允许 html2canvas 跨域读取图标，避免截图 canvas 被污染（吸收自远端 d368e14）
    crossOrigin: 'anonymous',
  });
};

interface IsochroneMapProps {
  landmark: CityLandmark | null;
  poiWithLayers?: POIWithLayer[];
  isochrones: IsochroneFeature[];
  profile: TravelProfile;
  rangeMinutes: number[];
  onMapClick?: (lat: number, lng: number) => void;
  highlightedPOI?: number | null;
  selectedPOIId?: string | null;
  onSelectPOI?: (poiId: string | null) => void;
  isPickingLocation?: boolean;
  candidateCoordinates?: [number, number] | null; // [lng, lat] (WGS-84)
  mapPadding?: MapPaddingResult;
  committedTimestamp?: number;
  locationFocus?: CityLandmark | null;
}

export default function IsochroneMap({
  landmark,
  poiWithLayers = [],
  isochrones,
  profile,
  rangeMinutes,
  onMapClick,
  highlightedPOI,
  selectedPOIId = null,
  onSelectPOI,
  isPickingLocation = false,
  candidateCoordinates = null,
  mapPadding,
  committedTimestamp,
  locationFocus = null,
}: IsochroneMapProps) {
  useEffect(() => {
    fixLeafletIcons();
  }, []);
  
  // 计算地图中心和缩放级别 (转换为 GCJ-02)
  const center: [number, number] = useMemo(() => {
    if (!landmark) return [39.909187, 116.397451]; // 默认北京天安门 (GCJ-02)
    const [lng, lat] = wgs84ToGcj02(landmark.coordinates[0], landmark.coordinates[1]);
    return [lat, lng];
  }, [landmark]);
  
  const zoom = landmark ? 11 : 5;

  // 转换等时圈数据为 GCJ-02
  const transformedIsochrones = useMemo(() => {
    return isochrones.map(feature => {
      const newFeature = JSON.parse(JSON.stringify(feature));
      const geometry = newFeature.geometry;
      
      const transformPoint = (coord: number[]) => {
        return wgs84ToGcj02(coord[0], coord[1]);
      };

      if (geometry.type === 'Polygon') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        geometry.coordinates = geometry.coordinates.map((ring: any) => 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ring.map((coord: any) => transformPoint(coord))
        );
      } else if (geometry.type === 'MultiPolygon') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        geometry.coordinates = geometry.coordinates.map((polygon: any) => 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          polygon.map((ring: any) => 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ring.map((coord: any) => transformPoint(coord))
          )
        );
      }
      return newFeature;
    });
  }, [isochrones]);

  // GeoJSON 样式函数（单一样式契约）
  const getStyle = useCallback((feature: GeoJSON.Feature | undefined) => {
    if (!feature?.properties) return {};
    
    const rangeValue = feature.properties.value; // 秒
    const rangeInMinutes = Math.round(rangeValue / 60);
    const style = getIsochroneStyle(rangeInMinutes);
    
    return {
      color: style.color,
      fillColor: style.fillColor,
      fillOpacity: style.opacity,
      weight: style.weight,
      opacity: style.strokeOpacity,
      dashArray: style.dashArray,
    };
  }, []);

  // 每个等时圈的弹出内容（采用最小互斥圈层表达与估算披露）
  const onEachFeature = useCallback((feature: GeoJSON.Feature, layer: L.Layer) => {
    if (feature.properties) {
      const minutes = Math.round(feature.properties.value / 60);
      const tierLabel = formatExclusiveTierTime(minutes, rangeMinutes);
      
      const profileName = profile === 'driving-car' 
        ? '驾车' 
        : profile === 'cycling-regular' 
          ? '骑行' 
          : '步行';
      
      layer.bindPopup(`
        <div class="p-2">
          <div class="font-semibold text-gray-800">${tierLabel} 预估可达圈</div>
          <div class="text-sm text-gray-600">出行方式: ${profileName}</div>
          ${feature.properties.area ? `<div class="text-sm text-gray-600">覆盖面积: ${(feature.properties.area / 1000000).toFixed(2)} km²</div>` : ''}
          <div class="text-[11px] text-gray-400 mt-1.5 pt-1 border-t border-gray-100">
            500m网格对齐与折扣实估，非实时路况承诺
          </div>
        </div>
      `);
    }
  }, [profile, rangeMinutes]);

  // 排序后的等时圈数据（大圈先绘制底图，小圈后绘制上层）
  const sortedIsochrones = useMemo(() => {
    return sortIsochronesForRender(transformedIsochrones);
  }, [transformedIsochrones]);

  // 地标位置 (转换为 GCJ-02)
  const markerPosition: [number, number] | null = useMemo(() => {
    if (!landmark) return null;
    const [lng, lat] = wgs84ToGcj02(landmark.coordinates[0], landmark.coordinates[1]);
    return [lat, lng];
  }, [landmark]);

  // 选点模式下的候选位置 (转换为 GCJ-02)
  const candidatePosition: [number, number] | null = useMemo(() => {
    if (!candidateCoordinates) return null;
    const [lng, lat] = wgs84ToGcj02(candidateCoordinates[0], candidateCoordinates[1]);
    return [lat, lng];
  }, [candidateCoordinates]);

  const locationPosition = useMemo((): [number, number] | null => {
    if (!locationFocus) return null;
    const [lng, lat] = wgs84ToGcj02(...locationFocus.coordinates);
    return [lat, lng];
  }, [locationFocus]);

  // 选中的 POI 坐标（GCJ-02，供可用视口 panInside 避让定位）
  const selectedPOIPosition = useMemo(() => {
    if (!selectedPOIId) return null;
    const found = poiWithLayers.find(p => p.id === selectedPOIId);
    return found ? found.position : null;
  }, [poiWithLayers, selectedPOIId]);

  // 创建编号气泡图标（支持高亮与选中态，深色选中标识）
  const createNumberIcon = useCallback((index: number, layerMinutes: number, isHighlighted: boolean) => {
    const colors = getColorForRange(layerMinutes);
    const size = isHighlighted ? 42 : 32;
    const fontSize = isHighlighted ? 14 : 12;
    const pinPath = "M16 0C7.163 0 0 7.163 0 16c0 8.837 16 32 16 32s16-23.163 16-32C32 7.163 24.837 0 16 0z";
    
    return L.divIcon({
      className: 'poi-number-marker',
      html: `
        <div style="
          position: relative;
          width: ${size}px;
          height: ${size * 1.5}px;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          ${isHighlighted ? 'transform: scale(1.15) translateY(-4px); z-index: 1000;' : 'transform: translateY(0);'}
        ">
          <svg viewBox="0 0 32 48" width="100%" height="100%" style="overflow: visible;">
            <path d="${pinPath}" fill="${isHighlighted ? DESTINATION_STYLE.ink : colors.color}" stroke="${isHighlighted ? '#ffffff' : 'white'}" stroke-width="${isHighlighted ? '3.5' : '2'}" />
            <circle cx="16" cy="16" r="10" fill="rgba(255,255,255,0.15)" />
          </svg>
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: ${size}px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${fontSize}px;
            font-weight: 700;
            color: white;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            text-shadow: 0 1px 2px rgba(0,0,0,0.1);
          ">${index}</div>
        </div>
      `,
      iconSize: [size, size * 1.5],
      iconAnchor: [size / 2, size * 1.5],
      popupAnchor: [0, -size * 1.5],
    });
  }, []);

  // 计算等时圈胶囊标签最佳锚点（位于多边形东北侧外沿，契合图2视觉导向）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getIsochroneBadgePosition = useCallback((geometry: any): [number, number] | null => {
    if (!geometry) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rings: any[] = [];
    if (geometry.type === 'Polygon') {
      rings = geometry.coordinates;
    } else if (geometry.type === 'MultiPolygon') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rings = geometry.coordinates.map((poly: any) => poly[0]);
    }
    if (!rings || rings.length === 0) return null;

    let bestPoint: [number, number] | null = null;
    let maxScore = -Infinity;

    for (const ring of rings) {
      if (!Array.isArray(ring)) continue;
      for (const pt of ring) {
        if (Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
          const lng = pt[0];
          const lat = pt[1];
          // 寻找右上角外沿点：东北偏上方向得分
          const score = lat * 1.35 + lng;
          if (score > maxScore) {
            maxScore = score;
            bestPoint = [lat, lng];
          }
        }
      }
    }

    return bestPoint;
  }, []);

  // 创建等时圈胶囊标签图标（图2同款）
  const createBadgeIcon = useCallback((minutes: number) => {
    const cfg = TIER_BADGE_CONFIG[minutes] || {
      text: `${minutes} 分钟`,
      bg: VISUAL_THEME.primary,
      color: '#ffffff',
      border: 'rgba(255,255,255,0.85)',
    };

    return L.divIcon({
      className: 'isochrone-tier-pill',
      html: `
        <div style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 3px 8px;
          background-color: ${cfg.bg};
          color: ${cfg.color};
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0.02em;
          border-radius: 6px;
          border: 1.5px solid ${cfg.border};
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.25);
          pointer-events: none;
          white-space: nowrap;
          user-select: none;
          transform: translate(-50%, -50%);
        ">
          ${cfg.text}
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }, []);

  // 创建极简黑色图钉（图2同款 Origin Pin）
  const createOriginIcon = useCallback(() => {
    return L.divIcon({
      className: 'origin-minimal-marker',
      html: `
        <div style="
          width: 28px;
          height: 38px;
          filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.35));
          cursor: pointer;
        ">
          ${MINIMAL_ORIGIN_PIN_SVG}
        </div>
      `,
      iconSize: [28, 38],
      iconAnchor: [14, 38],
      popupAnchor: [0, -38],
    });
  }, []);

  // 创建选点候选标记图标
  const createCandidateIcon = useCallback(() => {
    const size = 38;
    const pinPath = "M16 0C7.163 0 0 7.163 0 16c0 8.837 16 32 16 32s16-23.163 16-32C32 7.163 24.837 0 16 0z";
    return L.divIcon({
      className: 'candidate-pin-marker',
      html: `
        <div style="
          position: relative;
          width: ${size}px;
          height: ${size * 1.5}px;
          filter: drop-shadow(0 4px 8px rgba(255, 75, 35, 0.3));
          animation: bounce 0.6s infinite alternate;
        ">
          <svg viewBox="0 0 32 48" width="100%" height="100%" style="overflow: visible;">
            <path d="${pinPath}" fill="${VISUAL_THEME.accent}" stroke="white" stroke-width="2.5" />
            <circle cx="16" cy="16" r="9" fill="white" />
          </svg>
          <div style="
            position: absolute;
            top: 4px;
            left: 0;
            width: 100%;
            text-align: center;
            font-size: 11px;
            font-weight: 800;
            color: ${VISUAL_THEME.accentInk};
          ">选</div>
        </div>
      `,
      iconSize: [size, size * 1.5],
      iconAnchor: [size / 2, size * 1.5],
      popupAnchor: [0, -size * 1.5],
    });
  }, []);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={`w-full h-full ${isPickingLocation ? 'cursor-crosshair' : ''}`}
      scrollWheelZoom={true}
      zoomControl={false}
      preferCanvas={true}
    >
      <ZoomControl position="bottomleft" />

      {/* 高德地图淡雅简约底图 (style=8)：干净灰白配色，消除粗暴黄橙公路牌与杂乱标注 */}
      <TileLayer
        attribution='&copy; <a href="https://lbs.amap.com/">高德地图</a>'
        url="https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
        crossOrigin="anonymous"
      />
      
      <MapControllerWrapper 
        center={center} 
        zoom={zoom} 
        onMapClick={onMapClick} 
        isPickingLocation={isPickingLocation}
        useMapHook={useMap}
        isochrones={transformedIsochrones}
        landmark={landmark}
        mapPadding={mapPadding}
        committedTimestamp={committedTimestamp}
        selectedPOIPosition={selectedPOIPosition}
        locationFocus={locationFocus}
      />
      
      {/* 渲染等时圈 - 从大到小渲染以确保小的在上面 */}
      {sortedIsochrones.map((feature, index) => (
        <GeoJSON
          key={`isochrone-${feature.properties.value}-${index}-${landmark?.id || 'default'}`}
          data={feature}
          style={getStyle}
          onEachFeature={onEachFeature}
        />
      ))}

      {/* 渲染等时圈胶囊微型徽章 (图2同款，清晰指示 15/30/60 分钟范围) */}
      {sortedIsochrones.map((feature, index) => {
        const minutes = Math.round(feature.properties.value / 60);
        const badgePos = getIsochroneBadgePosition(feature.geometry);
        if (!badgePos) return null;
        return (
          <Marker
            key={`isochrone-badge-${minutes}-${index}`}
            position={badgePos}
            icon={createBadgeIcon(minutes)}
            interactive={false}
          />
        );
      })}
      
      {locationPosition && (
        <CircleMarker center={locationPosition} radius={10} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#1d4ed8', fillOpacity: 1 }}>
          <Popup>当前位置 · 待生成可达范围</Popup>
        </CircleMarker>
      )}

      {/* 地标标记（已提交或当前选中的起点）- 采用图2极简黑色图钉 */}
      {landmark && markerPosition && (
        <Marker position={markerPosition} icon={createOriginIcon()}>
          <Popup>
            <div className="p-1">
              <div className="font-bold text-lg text-gray-800">{landmark.name}</div>
              <div className="text-sm text-gray-600">{landmark.city}, {landmark.province}</div>
              {landmark.description && (
                <div className="text-xs text-gray-500 mt-1">{landmark.description}</div>
              )}
              <div className="mt-2 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                起点
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* 选点模式下的候选临时标记 */}
      {isPickingLocation && candidatePosition && (
        <Marker position={candidatePosition} icon={createCandidateIcon()}>
          <Popup>
            <div className="p-1">
              <div className="font-bold text-amber-600">候选出发点</div>
              <div className="text-xs text-gray-500 mt-1">请在上方确认栏点击“确认出发点”</div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* 兴趣点标记 - 使用编号气泡，支持点击选中与稳定 ID 回调 */}
      {poiWithLayers.map(poi => {
        const isHighlighted = highlightedPOI === poi.index || selectedPOIId === poi.id;
        const exclusiveTier = formatExclusiveTierTime(poi.layerMinutes, rangeMinutes);

        return (
          <Marker
            key={poi.id}
            position={poi.position}
            icon={createNumberIcon(poi.index, poi.layerMinutes, isHighlighted)}
            eventHandlers={{
              click: () => {
                onSelectPOI?.(poi.id);
              },
            }}
          >
            <Popup>
              <div className="p-2 min-w-[160px]">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: getColorForRange(poi.layerMinutes).color }}
                  >
                    {poi.index}
                  </span>
                  <span className="font-bold text-base text-gray-800 truncate">{poi.name}</span>
                </div>
                {poi.description && (
                  <div className="text-xs text-gray-600 mb-2">{poi.description}</div>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                    {getPOICategoryLabel(poi.category)}
                  </span>
                  <div
                    className="text-[10px] px-1.5 py-0.5 rounded-full inline-block font-medium"
                    style={{
                      backgroundColor: `${getColorForRange(poi.layerMinutes).fillColor}30`,
                      color: getColorForRange(poi.layerMinutes).color,
                      border: `1px solid ${getColorForRange(poi.layerMinutes).color}40`,
                    }}
                  >
                    {exclusiveTier} 预估可达
                  </div>
                </div>
                {landmark && (() => {
                  const navUrl = createAmapNavUrl({
                    origin: { coordinates: landmark.coordinates, name: landmark.name },
                    destination: { coordinates: poi.coordinates, name: poi.name },
                    profile,
                  });
                  const action = resolveNavigationAction({
                    profile,
                    isMobilePlatform: isMobileDevice(),
                    navUrl,
                  });

                  if (action.canDirectlyNavigate && navUrl) {
                    return (
                      <a
                        href={navUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2.5 w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 shadow-sm cursor-pointer transition-colors text-center"
                      >
                        <span>在外部地图中导航</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    );
                  }

                  return (
                    <div className="mt-2 p-1.5 bg-amber-50 rounded border border-amber-200 text-[10px] text-amber-800 leading-tight">
                      骑行导航仅限手机端高德APP支持，请在清单中查看或复制地点信息
                    </div>
                  );
                })()}
                <div className="text-[10px] text-gray-400 mt-1.5 pt-1 border-t border-gray-100">
                  预估圈层 · 非单点精确时间
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

// 地图控制器包装组件
function MapControllerWrapper({ 
  center, 
  zoom,
  onMapClick,
  isPickingLocation = false,
  useMapHook,
  isochrones,
  landmark,
  mapPadding,
  committedTimestamp,
  selectedPOIPosition,
  locationFocus,
}: { 
  center: [number, number]; 
  zoom: number;
  onMapClick?: (lat: number, lng: number) => void;
  isPickingLocation?: boolean;
  useMapHook: () => L.Map;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isochrones: any[];
  landmark: CityLandmark | null;
  mapPadding?: MapPaddingResult;
  committedTimestamp?: number;
  locationFocus?: CityLandmark | null;
  selectedPOIPosition?: [number, number] | null;
}) {
  const map = useMapHook();
  const lastFittedTimestampRef = useRef<number | null>(null);
  const fitRunIdRef = useRef<number>(0);

  // 暴露 map 实例给 window 对象，以便在截图时控制
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__leaflet_map = map;
    }
  }, [map]);

  // 容器尺寸监听：仅更新 Leaflet 视口内部尺寸，杜绝反复 fitBounds 重置用户缩放拖动
  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => {
      map.invalidateSize({ debounceMoveend: true });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);

  // 视口安全移动：当选中地点变更时，调用 panInside 确保标记在可用视口内可见，绝不调用 fitBounds 重置缩放
  useEffect(() => {
    if (!selectedPOIPosition) return;
    const padding = mapPadding || {
      paddingTopLeft: [50, 50],
      paddingBottomRight: [50, 50],
    };

    try {
      map.panInside(selectedPOIPosition, {
        paddingTopLeft: padding.paddingTopLeft,
        paddingBottomRight: padding.paddingBottomRight,
        animate: true,
      });
    } catch {
      map.panTo(selectedPOIPosition, { animate: true });
    }
  }, [selectedPOIPosition, map, mapPadding]);

  // 定位是独立的视口意图：即使保留旧结果，也立即展示新位置。
  const lastLocationFocusRef = useRef<CityLandmark | null>(null);
  useEffect(() => {
    if (!locationFocus || lastLocationFocusRef.current === locationFocus) return;
    lastLocationFocusRef.current = locationFocus;
    focusMapOnLocation(map, locationFocus.coordinates, mapPadding,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [locationFocus, map, mapPadding]);

  // 基础视图控制（仅在无等时圈时依地标定位）
  useEffect(() => {
    if (locationFocus) return;
    if (isochrones.length === 0) {
      if (landmark?.id?.startsWith('custom-')) {
        map.panTo(center, { animate: true });
      } else {
        map.setView(center, zoom, { animate: true });
      }
    }
  }, [center, map, zoom, isochrones.length, landmark, locationFocus]);

  // 自动适配等时圈范围：
  // 1. 仅在 committedTimestamp 产生新快照时触发一次 fitBounds，严格保留用户手动拖拽与缩放；
  // 2. 动态 import 增加取消守卫与递增版本守卫，确保最新快照胜出并清理在途异步回调。
  useEffect(() => {
    if (isochrones.length === 0 || locationFocus) return;

    // 若已经为当前 committed 快照适配过范围，则不再因其他状态变更反复自动 fit
    if (committedTimestamp && committedTimestamp === lastFittedTimestampRef.current) {
      return;
    }

    const currentRunId = ++fitRunIdRef.current;
    let cancelled = false;
    const currentSnapshotTimestamp = committedTimestamp ?? Date.now();

    import('leaflet').then((L) => {
      if (cancelled || currentRunId !== fitRunIdRef.current) return;
      if (committedTimestamp && committedTimestamp === lastFittedTimestampRef.current) {
        return;
      }

      const group = L.default.geoJSON(isochrones);
      const bounds = group.getBounds();
      if (bounds.isValid() && !cancelled && currentRunId === fitRunIdRef.current) {
        lastFittedTimestampRef.current = currentSnapshotTimestamp;
        const padding = mapPadding || {
          paddingTopLeft: [50, 50],
          paddingBottomRight: [50, 50],
        };

        map.fitBounds(bounds, {
          paddingTopLeft: padding.paddingTopLeft,
          paddingBottomRight: padding.paddingBottomRight,
          animate: true,
          duration: 0.8,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isochrones, map, committedTimestamp, mapPadding, locationFocus]);

  // 选点模式光标样式更新
  useEffect(() => {
    const container = map.getContainer();
    if (isPickingLocation) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
  }, [map, isPickingLocation]);
  
  // 仅在显式地图选点模式下响应地图点击
  // 普通浏览、拖动、放大缩小点击均不触发选点，防止误触清空结果
  useEffect(() => {
    if (!isPickingLocation || !onMapClick) return;
    
    const handleClick = (e: L.LeafletMouseEvent) => {
      const [lng, lat] = gcj02ToWgs84(e.latlng.lng, e.latlng.lat);
      onMapClick(lat, lng);
    };
    
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClick, isPickingLocation]);
  
  return null;
}
