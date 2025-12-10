'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  GeoJSON, 
  Marker, 
  Popup, 
  ZoomControl, 
  useMap 
} from 'react-leaflet';
import L from 'leaflet';
import { CityLandmark, IsochroneFeature, TravelProfile } from '@/types';
import { getColorForRange } from '@/data/isochrone-config';
import { wgs84ToGcj02, gcj02ToWgs84 } from '@/lib/coord-transform';
import { POIWithLayer } from '@/lib/poi-utils';

// 修复 Leaflet 默认图标问题
// 注意：这个副作用只需要执行一次，但放在这里也无妨，因为它是幂等的（大部分）
// 或者我们可以放在 useEffect 中
const fixLeafletIcons = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
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
}

export default function IsochroneMap({
  landmark,
  poiWithLayers = [],
  isochrones,
  profile,
  rangeMinutes,
  onMapClick,
  highlightedPOI,
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

  // GeoJSON 样式函数
  const getStyle = useCallback((feature: GeoJSON.Feature | undefined) => {
    if (!feature?.properties) return {};
    
    const rangeValue = feature.properties.value; // 秒
    const rangeInMinutes = rangeValue / 60;
    const colorConfig = getColorForRange(rangeInMinutes);
    
    return {
      color: colorConfig.color,
      fillColor: colorConfig.fillColor,
      fillOpacity: colorConfig.opacity,
      weight: 2,
    };
  }, []);

  // 每个等时圈的弹出内容
  const onEachFeature = useCallback((feature: GeoJSON.Feature, layer: L.Layer) => {
    if (feature.properties) {
      const minutes = feature.properties.value / 60;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeStr = hours > 0 
        ? `${hours}小时${mins > 0 ? mins + '分钟' : ''}`
        : `${mins}分钟`;
      
      const profileName = profile === 'driving-car' 
        ? '驾车' 
        : profile === 'cycling-regular' 
          ? '骑行' 
          : '步行';
      
      layer.bindPopup(`
        <div class="p-2">
          <div class="font-semibold text-gray-800">${timeStr}可达范围</div>
          <div class="text-sm text-gray-600">出行方式: ${profileName}</div>
          ${feature.properties.area ? `<div class="text-sm text-gray-600">覆盖面积: ${(feature.properties.area / 1000000).toFixed(2)} km²</div>` : ''}
        </div>
      `);
    }
  }, [profile]);

  // 排序后的等时圈数据
  const sortedIsochrones = useMemo(() => {
    return [...transformedIsochrones].sort((a, b) => b.properties.value - a.properties.value);
  }, [transformedIsochrones]);

  // 地标位置 (转换为 GCJ-02)
  const markerPosition: [number, number] | null = useMemo(() => {
    if (!landmark) return null;
    const [lng, lat] = wgs84ToGcj02(landmark.coordinates[0], landmark.coordinates[1]);
    return [lat, lng];
  }, [landmark]);

  // 圈层颜色配置
  const layerColors: Record<number, { color: string; fillColor: string }> = {
    15: { color: '#15803d', fillColor: '#86efac' },
    30: { color: '#a16207', fillColor: '#fde68a' },
    60: { color: '#dc2626', fillColor: '#fca5a5' },
  };

  // 创建编号气泡图标
  const createNumberIcon = useCallback((index: number, layerMinutes: number, isHighlighted: boolean) => {
    const colors = layerColors[layerMinutes] || { color: '#3b82f6', fillColor: '#93c5fd' };
    const size = isHighlighted ? 36 : 28;
    const fontSize = isHighlighted ? 14 : 12;
    
    return L.divIcon({
      className: 'poi-number-marker',
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: white;
          border: 3px solid ${colors.color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${fontSize}px;
          font-weight: 700;
          color: ${colors.color};
          box-shadow: 0 2px 8px rgba(0,0,0,0.2)${isHighlighted ? ', 0 0 0 4px ' + colors.fillColor : ''};
          transition: all 0.2s ease;
          ${isHighlighted ? 'transform: scale(1.1);' : ''}
        ">${index}</div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }, []);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="w-full h-full"
      scrollWheelZoom={true}
      zoomControl={false}
      preferCanvas={true} // 使用 Canvas 渲染，提高截图成功率
    >
      <ZoomControl position="bottomleft" />

      <TileLayer
        attribution='&copy; <a href="https://lbs.amap.com/">高德地图</a>'
        url="https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}"
      />
      
      <MapControllerWrapper 
        center={center} 
        zoom={zoom} 
        onMapClick={onMapClick} 
        useMapHook={useMap}
        isochrones={transformedIsochrones}
        landmark={landmark}
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
      
      {/* 地标标记 */}
      {landmark && markerPosition && (
        <Marker position={markerPosition}>
          <Popup>
            <div className="p-1">
              <div className="font-bold text-lg text-gray-800">{landmark.name}</div>
              <div className="text-sm text-gray-600">{landmark.city}, {landmark.province}</div>
              {landmark.description && (
                <div className="text-xs text-gray-500 mt-1">{landmark.description}</div>
              )}
              <div className="mt-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                起点
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* 兴趣点标记 - 使用编号气泡 */}
      {poiWithLayers.map(poi => (
        <Marker
          key={poi.id}
          position={poi.position}
          icon={createNumberIcon(poi.index, poi.layerMinutes, highlightedPOI === poi.index)}
        >
          <Popup>
            <div className="p-2 min-w-[160px]">
              <div className="flex items-center gap-2 mb-2">
                <span 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: layerColors[poi.layerMinutes]?.color || '#3b82f6' }}
                >
                  {poi.index}
                </span>
                <span className="font-bold text-base text-gray-800">{poi.name}</span>
              </div>
              {poi.description && (
                <div className="text-xs text-gray-600 mb-2">{poi.description}</div>
              )}
              <div className="text-xs px-2 py-1 rounded-full inline-block"
                style={{ 
                  backgroundColor: layerColors[poi.layerMinutes]?.fillColor || '#93c5fd',
                  color: layerColors[poi.layerMinutes]?.color || '#3b82f6'
                }}
              >
                {poi.layerMinutes >= 60 ? `${poi.layerMinutes / 60}小时` : `${poi.layerMinutes}分钟`}内可达
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

// 地图控制器包装组件
function MapControllerWrapper({ 
  center, 
  zoom,
  onMapClick,
  useMapHook,
  isochrones,
  landmark
}: { 
  center: [number, number]; 
  zoom: number;
  onMapClick?: (lat: number, lng: number) => void;
  useMapHook: () => L.Map;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isochrones: any[];
  landmark: CityLandmark | null;
}) {
  const map = useMapHook();
  
  // 基础视图控制
  useEffect(() => {
    // 只有当没有等时圈数据时，才强制跟随 center/zoom
    // 如果有等时圈数据，我们将优先适配等时圈的范围
    if (isochrones.length === 0) {
      // 如果是自定义选点（ID以 'custom-' 开头），保持当前缩放级别，只移动中心
      if (landmark?.id?.startsWith('custom-')) {
        map.panTo(center, { animate: true });
      } else {
        // 预设地标或初始状态，设置中心和缩放
        map.setView(center, zoom, { animate: true });
      }
    }
  }, [center, map, zoom, isochrones.length, landmark]);

  // 自动适配等时圈范围
  useEffect(() => {
    if (isochrones.length > 0) {
      // 动态导入 L (leaflet) 因为我们在 useEffect 中
      import('leaflet').then((L) => {
        const group = L.default.geoJSON(isochrones);
        const bounds = group.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { 
            padding: [50, 50], // 增加内边距
            animate: true,
            duration: 1
          });
        }
      });
    }
  }, [isochrones, map]);
  
  useEffect(() => {
    if (!onMapClick) return;
    
    const handleClick = (e: L.LeafletMouseEvent) => {
      // 将点击的 GCJ-02 坐标转回 WGS-84
      const [lng, lat] = gcj02ToWgs84(e.latlng.lng, e.latlng.lat);
      onMapClick(lat, lng);
    };
    
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClick]);
  
  return null;
}
