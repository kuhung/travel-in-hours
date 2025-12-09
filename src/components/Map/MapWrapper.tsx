'use client';

import dynamic from 'next/dynamic';
import { CityLandmark, IsochroneFeature, TravelProfile } from '@/types';

// 动态导入地图组件，完全禁用 SSR
const IsochroneMap = dynamic(
  () => import('./IsochroneMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-400 border-t-transparent"></div>
          <p className="text-emerald-400 text-lg font-medium">地图加载中...</p>
        </div>
      </div>
    ),
  }
);

interface MapWrapperProps {
  landmark: CityLandmark | null;
  isochrones: IsochroneFeature[];
  profile: TravelProfile;
  rangeMinutes: number[];
  isMinimalMap?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}

export default function MapWrapper(props: MapWrapperProps) {
  return <IsochroneMap {...props} />;
}
