'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { CityLandmark, IsochroneFeature, TravelProfile } from '@/types';
import { getColorForRange } from '@/data/isochrone-config';
import { wgs84ToGcj02, gcj02ToWgs84 } from '@/lib/coord-transform';

interface IsochroneMapProps {
  landmark: CityLandmark | null;
  isochrones: IsochroneFeature[];
  profile: TravelProfile;
  rangeMinutes: number[];
  onMapClick?: (lat: number, lng: number) => void;
}

export default function IsochroneMap({
  landmark,
  isochrones,
  profile,
  rangeMinutes,
  onMapClick,
}: IsochroneMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: React.ComponentType<{ 
      center: [number, number]; 
      zoom: number; 
      className?: string;
      scrollWheelZoom?: boolean;
      zoomControl?: boolean;
      children?: React.ReactNode;
    }>;
    TileLayer: React.ComponentType<{ 
      attribution?: string; 
      url: string; 
      className?: string;
      opacity?: number;
    }>;
    GeoJSON: React.ComponentType<{ 
      key?: string;
      data: GeoJSON.Feature;
      style?: (feature: GeoJSON.Feature | undefined) => Record<string, unknown>;
      onEachFeature?: (feature: GeoJSON.Feature, layer: L.Layer) => void;
    }>;
    Marker: React.ComponentType<{ position: [number, number]; children?: React.ReactNode }>;
    Popup: React.ComponentType<{ children?: React.ReactNode }>;
    ZoomControl: React.ComponentType<{ position: 'topleft' | 'topright' | 'bottomleft' | 'bottomright' }>;
    useMap: () => L.Map;
  } | null>(null);
  
  // 确保只在客户端运行，动态加载 react-leaflet
  useEffect(() => {
    setIsClient(true);
    
    // 动态导入 react-leaflet 和 leaflet
    Promise.all([
      import('react-leaflet'),
      import('leaflet'),
    ]).then(([reactLeaflet, L]) => {
      // 修复 Leaflet 默认图标问题
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.default.Icon.Default.prototype as any)._getIconUrl;
      L.default.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      
      setMapComponents({
        MapContainer: reactLeaflet.MapContainer,
        TileLayer: reactLeaflet.TileLayer,
        GeoJSON: reactLeaflet.GeoJSON,
        Marker: reactLeaflet.Marker,
        Popup: reactLeaflet.Popup,
        ZoomControl: reactLeaflet.ZoomControl,
        useMap: reactLeaflet.useMap,
      });
    });
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

  if (!isClient || !MapComponents) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-400 border-t-transparent"></div>
          <p className="text-emerald-400 text-lg font-medium">地图加载中...</p>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, GeoJSON, Marker, Popup, ZoomControl } = MapComponents;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="w-full h-full"
      scrollWheelZoom={true}
      zoomControl={false}
    >
      <ZoomControl position="bottomright" />

      <TileLayer
        attribution='&copy; <a href="https://lbs.amap.com/">高德地图</a>'
        url="https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}"
      />
      
      <MapControllerWrapper 
        center={center} 
        zoom={zoom} 
        onMapClick={onMapClick} 
        useMapHook={MapComponents.useMap}
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
            </div>
          </Popup>
        </Marker>
      )}
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
    map.setView(center, zoom, { animate: true });
    }
  }, [center, map, zoom, isochrones.length]);

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
