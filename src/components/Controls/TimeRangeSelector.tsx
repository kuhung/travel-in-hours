'use client';

import { isochroneColors, defaultTimeRanges } from '@/data/isochrone-config';

interface TimeRangeSelectorProps {
  selected: number[];
  onSelect: (ranges: number[]) => void;
  maxRange: number;
}

// 固定3档时间：1小时、2小时、3小时
const availableRanges = defaultTimeRanges;

// 时间范围标签配置
const rangeLabels: Record<number, { label: string; description: string }> = {
  60: { label: '1小时', description: '短途' },
  120: { label: '2小时', description: '中途' },
  180: { label: '3小时', description: '远途' },
};

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

  const getColorForMinutes = (minutes: number) => {
    const config = isochroneColors.find(c => c.minutes === minutes);
    return config?.fillColor || '#86efac';
  };

  const getBorderColorForMinutes = (minutes: number) => {
    const config = isochroneColors.find(c => c.minutes === minutes);
    return config?.color || '#15803d';
  };

  return (
    <div className="space-y-4">
      {/* 时间选择器 */}
      <div className="flex gap-2">
        {filteredRanges.map((range) => {
          const isSelected = selected.includes(range);
          const fillColor = getColorForMinutes(range);
          const borderColor = getBorderColorForMinutes(range);
          const label = rangeLabels[range] || { label: `${range}分钟`, description: '' };
          
          return (
            <button
              key={range}
              onClick={() => toggleRange(range)}
              className={`flex-1 flex flex-col items-center gap-1 px-3 py-3 
                         rounded-xl transition-all duration-200
                         ${isSelected 
                           ? 'ring-2 ring-offset-2 ring-offset-slate-900 shadow-lg' 
                           : 'opacity-60 hover:opacity-100 border border-white/10'
                         }`}
              style={{
                backgroundColor: isSelected ? `${fillColor}40` : 'transparent',
                borderColor: isSelected ? borderColor : undefined,
                ringColor: isSelected ? borderColor : undefined,
              }}
            >
              <span 
                className="text-lg font-bold"
                style={{ color: isSelected ? borderColor : '#9ca3af' }}
              >
                {label.label}
              </span>
              <span className="text-xs text-gray-400">{label.description}</span>
            </button>
          );
        })}
      </div>
      
      {/* 颜色图例 - 紧凑横向展示 */}
      <div className="flex items-center justify-center gap-6 py-3 px-4 bg-white/5 rounded-xl">
        {availableRanges.map((range) => {
          const fillColor = getColorForMinutes(range);
          const isSelected = selected.includes(range);
          const label = rangeLabels[range] || { label: `${range}分钟`, description: '' };
          
          return (
            <div 
              key={range} 
              className={`flex items-center gap-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-40'}`}
            >
              <div 
                className="w-4 h-4 rounded-sm border"
                style={{ 
                  backgroundColor: fillColor,
                  borderColor: getBorderColorForMinutes(range),
                }}
              />
              <span className="text-xs text-gray-300 font-medium">{label.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

