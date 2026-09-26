'use client';

import { useEffect, useMemo, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { ImmigrationHall } from '@/data/zhuhai-immigration-halls';
import { wgs84ToGcj02 } from '@/lib/coord-transform';

const fixLeafletIcons = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};

interface ImmigrationHallsMapProps {
  halls: ImmigrationHall[];
  selectedId: string | null;
  onSelect: (hall: ImmigrationHall) => void;
}

function createHallIcon(index: number, isSelected: boolean) {
  const size = isSelected ? 40 : 32;
  const color = isSelected ? '#059669' : '#0f766e';
  const pinPath =
    'M16 0C7.163 0 0 7.163 0 16c0 8.837 16 32 16 32s16-23.163 16-32C32 7.163 24.837 0 16 0z';

  return L.divIcon({
    className: 'immigration-hall-marker',
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size * 1.5}px;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.28));
        transition: transform 0.2s ease;
        ${isSelected ? 'transform: scale(1.08) translateY(-2px); z-index: 1000;' : ''}
      ">
        <svg viewBox="0 0 32 48" width="100%" height="100%" style="overflow: visible;">
          <path d="${pinPath}" fill="${color}" stroke="white" stroke-width="2" />
          <circle cx="16" cy="16" r="10" fill="rgba(255,255,255,0.18)" />
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
          font-size: ${isSelected ? 14 : 12}px;
          font-weight: 700;
          color: white;
          font-family: ui-sans-serif, system-ui, sans-serif;
        ">${index}</div>
      </div>
    `,
    iconSize: [size, size * 1.5],
    iconAnchor: [size / 2, size * 1.5],
    popupAnchor: [0, -size * 1.5],
  });
}

function FitBounds({
  positions,
  selectedPosition,
}: {
  positions: [number, number][];
  selectedPosition: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12, animate: true });
  }, [map, positions]);

  useEffect(() => {
    if (!selectedPosition) return;
    map.flyTo(selectedPosition, Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [map, selectedPosition]);

  return null;
}

export default function ImmigrationHallsMap({
  halls,
  selectedId,
  onSelect,
}: ImmigrationHallsMapProps) {
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  const markers = useMemo(() => {
    return halls.map((hall) => {
      const [lng, lat] = wgs84ToGcj02(hall.coordinates[0], hall.coordinates[1]);
      return {
        hall,
        position: [lat, lng] as [number, number],
      };
    });
  }, [halls]);

  const positions = useMemo(() => markers.map((m) => m.position), [markers]);

  const selectedPosition = useMemo(() => {
    const found = markers.find((m) => m.hall.id === selectedId);
    return found ? found.position : null;
  }, [markers, selectedId]);

  const center: [number, number] = positions[0] || [22.27, 113.55];

  const handleMarkerClick = useCallback(
    (hall: ImmigrationHall) => {
      onSelect(hall);
    },
    [onSelect]
  );

  return (
    <MapContainer
      center={center}
      zoom={11}
      className="w-full h-full"
      scrollWheelZoom={true}
      zoomControl={false}
      preferCanvas={true}
    >
      <ZoomControl position="bottomleft" />
      <TileLayer
        attribution='&copy; <a href="https://lbs.amap.com/">高德地图</a>'
        url="https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}"
      />
      <FitBounds positions={positions} selectedPosition={selectedPosition} />

      {markers.map(({ hall, position }) => {
        const isSelected = hall.id === selectedId;
        return (
          <Marker
            key={hall.id}
            position={position}
            icon={createHallIcon(hall.index, isSelected)}
            eventHandlers={{
              click: () => handleMarkerClick(hall),
            }}
          >
            <Popup>
              <div className="p-1 min-w-[200px]">
                <div className="font-bold text-base text-gray-800 mb-1">
                  {hall.index}. {hall.name}
                </div>
                <div className="text-sm text-gray-600 mb-1">{hall.address}</div>
                <div className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-block mb-1">
                  {hall.hours}
                </div>
                {hall.busGuide && (
                  <div className="text-xs text-gray-500 mt-1">公交：{hall.busGuide}</div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
