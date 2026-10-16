'use client';

import dynamic from 'next/dynamic';
import { CityLandmark, IsochroneFeature, TravelProfile } from '@/types';
import { POIWithLayer } from '@/lib/poi-utils';
import type { MapPaddingResult } from '@/lib/layout-utils';

// 动态导入地图组件，完全禁用 SSR
const IsochroneMap = dynamic(
  () => import('./IsochroneMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-blue-700 text-lg font-medium">地图加载中...</p>
        </div>
      </div>
    ),
  }
);

interface MapWrapperProps {
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
  candidateCoordinates?: [number, number] | null;
  mapPadding?: MapPaddingResult;
  committedTimestamp?: number;
  locationFocus?: CityLandmark | null;
}

export default function MapWrapper(props: MapWrapperProps) {
  return <IsochroneMap {...props} />;
}
