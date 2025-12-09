'use client';

import { isochroneColors, defaultTimeRanges } from '@/data/isochrone-config';

interface TimeRangeSelectorProps {
  // 保持接口兼容，但不使用 interactive props
  selected?: number[];
  onSelect?: (ranges: number[]) => void;
  maxRange?: number;
}

// 时间范围标签配置
const rangeLabels: Record<number, { label: string; description: string }> = {
  15: { label: '15分钟', description: '核心圈' },
  30: { label: '30分钟', description: '生活圈' },
  60: { label: '1小时', description: '通勤圈' },
};

export default function TimeRangeSelector({ 
  selected = defaultTimeRanges,
}: TimeRangeSelectorProps) {
  // 固定显示所有默认时间段
  const displayRanges = defaultTimeRanges;

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
      {/* 静态展示，不再作为按钮 */}
      <div className="flex gap-2">
        {displayRanges.map((range) => {
          const fillColor = getColorForMinutes(range);
          const borderColor = getBorderColorForMinutes(range);
          const label = rangeLabels[range] || { label: `${range}分钟`, description: '' };
          
          return (
            <div
              key={range}
              className="flex-1 flex flex-col items-center gap-1 px-3 py-3 
                         rounded-xl border border-white/10 bg-white/5"
              style={{
                backgroundColor: `${fillColor}20`,
                borderColor: borderColor,
              }}
            >
              <span 
                className="text-lg font-bold"
                style={{ color: borderColor }}
              >
                {label.label}
              </span>
              <span className="text-xs text-gray-400">{label.description}</span>
            </div>
          );
        })}
      </div>
      
      {/* 简要说明 */}
      <div className="text-xs text-gray-500 text-center">
        显示 15分钟、30分钟、1小时 可达范围
      </div>
    </div>
  );
}
