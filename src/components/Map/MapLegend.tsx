import React from 'react';
import { defaultTimeRanges, getColorForRange } from '@/data/isochrone-config';

interface MapLegendProps {
  rangeMinutes?: number[];
}

export const MapLegend: React.FC<MapLegendProps> = ({ 
  rangeMinutes = defaultTimeRanges 
}) => {
  return (
    <div className="absolute z-10 top-20 left-4 bottom-auto md:top-auto md:bottom-8 md:left-auto md:right-4 bg-white/90 backdrop-blur-md p-3 rounded-lg shadow-lg border border-white/20">
      <div className="text-xs font-semibold text-gray-500 mb-2">等时圈范围</div>
      <div className="flex flex-col gap-2">
        {rangeMinutes.map((minutes) => {
          const { color, fillColor } = getColorForRange(minutes);
          return (
            <div key={minutes} className="flex items-center gap-2">
              <span 
                className="w-4 h-4 rounded-sm border opacity-80" 
                style={{ 
                  backgroundColor: fillColor,
                  borderColor: color 
                }}
              />
              <span className="text-xs text-gray-700 font-medium">{minutes} 分钟</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

