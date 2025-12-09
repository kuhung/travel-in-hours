'use client';

import { TravelProfile } from '@/types';
import { travelProfiles } from '@/data/isochrone-config';

interface TravelModeSelectorProps {
  selected: TravelProfile;
  onSelect: (profile: TravelProfile) => void;
}

// SVG 图标组件
const TravelIcons: Record<TravelProfile, React.ReactNode> = {
  'driving-car': (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4zM5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11M5 11v6h2m12-6v6h-2m-12 0h12" />
    </svg>
  ),
  'cycling-regular': (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.5 18a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm13 0a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5.5 14.5l4-7.5m0 0l2.5 4 4-4m-6.5 0h4m-2 7.5l2-3.5" />
    </svg>
  ),
  'foot-walking': (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 4a2 2 0 100 4 2 2 0 000-4zm-1 6l-2 8-2 2m4-10l2 3 3 1m-5-4v3l3 3v5" />
    </svg>
  ),
};

export default function TravelModeSelector({ selected, onSelect }: TravelModeSelectorProps) {
  return (
    <div className="flex gap-2">
      {travelProfiles.map((profile) => {
        const isSelected = selected === profile.id;
        return (
          <button
            key={profile.id}
            onClick={() => onSelect(profile.id)}
            className={`flex-1 flex flex-col items-center gap-1.5 px-3 py-3 
                       rounded-xl border-2 transition-all duration-200
                       ${isSelected
                         ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-500/10'
                         : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                       }`}
          >
            <div className={`transition-transform duration-200 ${isSelected ? 'scale-110' : ''}`}>
              {TravelIcons[profile.id]}
            </div>
            <span className="text-xs font-medium">{profile.name}</span>
          </button>
        );
      })}
    </div>
  );
}

