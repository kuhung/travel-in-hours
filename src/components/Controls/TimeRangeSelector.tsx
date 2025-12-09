'use client';

import { isochroneColors } from '@/data/isochrone-config';

interface TimeRangeSelectorProps {
  selected: number[];
  onSelect: (ranges: number[]) => void;
  maxRange: number;
}

const availableRanges = [15, 30, 45, 60, 90, 120, 150, 180];

export default function TimeRangeSelector({ 
  selected, 
  onSelect, 
  maxRange 
}: TimeRangeSelectorProps) {
  const filteredRanges = availableRanges.filter(r => r <= maxRange);

  const toggleRange = (range: number) => {
    if (selected.includes(range)) {
      if (selected.length > 1) {
        onSelect(selected.filter(r => r !== range).sort((a, b) => a - b));
      }
    } else {
      onSelect([...selected, range].sort((a, b) => a - b));
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const getColorForMinutes = (minutes: number) => {
    const config = isochroneColors.find(c => c.minutes === minutes);
    return config?.fillColor || '#4ade80';
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        可达时间范围
      </label>
      <div className="flex flex-wrap gap-2">
        {filteredRanges.map((range) => {
          const isSelected = selected.includes(range);
          const color = getColorForMinutes(range);
          
          return (
            <button
              key={range}
              onClick={() => toggleRange(range)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all
                         border ${isSelected 
                           ? 'border-emerald-400 text-white' 
                           : 'border-white/10 text-gray-400 hover:border-white/30'
                         }`}
              style={{
                backgroundColor: isSelected ? `${color}33` : 'transparent',
              }}
            >
              {formatTime(range)}
            </button>
          );
        })}
      </div>
      
      {/* 图例 */}
      <div className="mt-4 pt-3 border-t border-white/10">
        <div className="text-xs text-gray-400 mb-2">颜色图例</div>
        <div className="flex flex-wrap gap-3">
          {selected.map((range) => (
            <div key={range} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: getColorForMinutes(range) }}
              />
              <span className="text-xs text-gray-300">{formatTime(range)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

