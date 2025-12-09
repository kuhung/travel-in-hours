'use client';

import { TravelProfile } from '@/types';
import { travelProfiles } from '@/data/isochrone-config';

interface TravelModeSelectorProps {
  selected: TravelProfile;
  onSelect: (profile: TravelProfile) => void;
}

export default function TravelModeSelector({ selected, onSelect }: TravelModeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        出行方式
      </label>
      <div className="flex gap-2">
        {travelProfiles.map((profile) => (
          <button
            key={profile.id}
            onClick={() => onSelect(profile.id)}
            className={`flex-1 flex flex-col items-center gap-1 px-3 py-3 
                       rounded-xl border transition-all
                       ${selected === profile.id
                         ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400'
                         : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                       }`}
          >
            <span className="text-2xl">{profile.icon}</span>
            <span className="text-sm font-medium">{profile.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

