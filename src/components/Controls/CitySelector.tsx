'use client';

import { useState, useMemo } from 'react';
import { CityLandmark } from '@/types';
import { cityLandmarks, landmarksByProvince } from '@/data/landmarks';

interface CitySelectorProps {
  selectedLandmark: CityLandmark | null;
  onSelect: (landmark: CityLandmark | null) => void;
}

export default function CitySelector({ selectedLandmark, onSelect }: CitySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // 过滤地标
  const filteredLandmarks = useMemo(() => {
    if (!searchQuery.trim()) {
      return landmarksByProvince;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = cityLandmarks.filter(
      l => l.name.toLowerCase().includes(query) ||
           l.city.toLowerCase().includes(query) ||
           l.province.toLowerCase().includes(query)
    );
    
    return filtered.reduce((acc, landmark) => {
      if (!acc[landmark.province]) {
        acc[landmark.province] = [];
      }
      acc[landmark.province].push(landmark);
      return acc;
    }, {} as Record<string, CityLandmark[]>);
  }, [searchQuery]);

  const handleSelect = (landmark: CityLandmark) => {
    onSelect(landmark);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      {/* 当前选择显示 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 
                   bg-white/10 backdrop-blur-sm border border-white/20 
                   rounded-xl text-white hover:bg-white/20 transition-all
                   focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📍</span>
          <div className="text-left">
            {selectedLandmark ? (
              <>
                <div className="font-semibold">{selectedLandmark.name}</div>
                <div className="text-sm text-gray-300">
                  {selectedLandmark.city}, {selectedLandmark.province}
                </div>
              </>
            ) : (
              <div className="text-gray-300">选择出发地点</div>
            )}
          </div>
        </div>
        <svg 
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 下拉选择面板 */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 
                        bg-slate-800/95 backdrop-blur-md border border-white/10 
                        rounded-xl shadow-2xl max-h-[60vh] overflow-hidden">
          {/* 搜索框 */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <svg 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索城市或地标..."
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/10 
                         rounded-lg text-white placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
          </div>

          {/* 城市列表 */}
          <div className="overflow-y-auto max-h-[calc(60vh-60px)]">
            {Object.entries(filteredLandmarks).map(([province, landmarks]) => (
              <div key={province}>
                <div className="sticky top-0 px-4 py-2 bg-slate-700/90 backdrop-blur-sm
                              text-sm font-semibold text-emerald-400">
                  {province}
                </div>
                {landmarks.map((landmark) => (
                  <button
                    key={landmark.id}
                    onClick={() => handleSelect(landmark)}
                    className={`w-full px-4 py-3 text-left hover:bg-white/10 
                              transition-colors flex items-center gap-3
                              ${selectedLandmark?.id === landmark.id ? 'bg-emerald-500/20' : ''}`}
                  >
                    <span className="text-lg">🏙️</span>
                    <div>
                      <div className="font-medium text-white">{landmark.name}</div>
                      <div className="text-sm text-gray-400">{landmark.city}</div>
                    </div>
                    {selectedLandmark?.id === landmark.id && (
                      <svg className="w-5 h-5 text-emerald-400 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ))}
            
            {Object.keys(filteredLandmarks).length === 0 && (
              <div className="px-4 py-8 text-center text-gray-400">
                没有找到匹配的城市
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

