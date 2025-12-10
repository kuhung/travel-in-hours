'use client';

import { useState, useMemo } from 'react';
import { track } from '@vercel/analytics';
import { CityLandmark } from '@/types';
import { cityLandmarks, landmarksByCity } from '@/data/landmarks';

interface CitySelectorProps {
  selectedLandmark: CityLandmark | null;
  onSelect: (landmark: CityLandmark | null) => void;
}

export default function CitySelector({ selectedLandmark, onSelect }: CitySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // 获取当前位置
  const handleGetCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      track('geolocation_unsupported', {
        location: 'city_selector'
      });
      alert('您的浏览器不支持地理定位');
      return;
    }

    track('geolocation_requested', {
      location: 'city_selector'
    });
    
    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        track('geolocation_success', {
          location: 'city_selector',
          latitude: latitude.toFixed(4),
          longitude: longitude.toFixed(4)
        });
        
        const currentLocation: CityLandmark = {
          id: 'current-location',
          name: '当前位置',
          city: '我的位置',
          province: '',
          coordinates: [longitude, latitude],
          description: '基于浏览器定位'
        };
        
        onSelect(currentLocation);
        setIsOpen(false);
        setIsLocating(false);
        setSearchQuery('');
      },
      (error) => {
        console.error('Geolocation error:', error);
        let msg = '无法获取位置';
        let errorType = 'unknown';
        
        switch(error.code) {
           case error.PERMISSION_DENIED: 
             errorType = 'permission_denied';
             msg = window.isSecureContext 
               ? '请允许浏览器访问位置信息' 
               : '定位功能仅支持 HTTPS 或 localhost 访问';
             break;
           case error.POSITION_UNAVAILABLE: 
             errorType = 'position_unavailable';
             msg = '位置信息不可用'; 
             break;
           case error.TIMEOUT: 
             errorType = 'timeout';
             msg = '获取位置超时'; 
             break;
        }
        
        track('geolocation_error', {
          location: 'city_selector',
          error_type: errorType
        });
        
        alert(msg);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // 过滤地标
  const filteredLandmarks = useMemo(() => {
    if (!searchQuery.trim()) {
      return landmarksByCity;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = cityLandmarks.filter(
      l => l.name.toLowerCase().includes(query) ||
           l.city.toLowerCase().includes(query)
    );
    
    return filtered.reduce((acc, landmark) => {
      if (!acc[landmark.city]) {
        acc[landmark.city] = [];
      }
      acc[landmark.city].push(landmark);
      return acc;
    }, {} as Record<string, CityLandmark[]>);
  }, [searchQuery]);

  const handleSelect = (landmark: CityLandmark) => {
    // 追踪地标选择事件
    track('landmark_selected', {
      location: 'selector',
      city: landmark.city,
      landmark_name: landmark.name,
      is_current_location: landmark.id === 'current-location'
    });
    
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
                   bg-gray-50 border border-gray-200 
                   rounded-xl text-gray-900 hover:bg-gray-100 hover:border-gray-300 transition-all
                   focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-left min-w-0">
            {selectedLandmark ? (
              <>
                <div className="font-medium truncate text-gray-900">{selectedLandmark.name}</div>
                <div className="text-xs text-gray-500 truncate">
                  {selectedLandmark.city}{selectedLandmark.province ? `, ${selectedLandmark.province}` : ''}
                </div>
              </>
            ) : (
              <div className="text-gray-400">点击选择出发地</div>
            )}
          </div>
        </div>
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
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
                        bg-white/98 backdrop-blur-xl border border-gray-200 
                        rounded-xl shadow-2xl max-h-[60vh] overflow-hidden
                        animate-fade-in">
          {/* 搜索框 */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <svg 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
                placeholder="搜索地标 / 点击右侧定位"
                autoFocus
                className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 
                         rounded-lg text-gray-900 text-sm placeholder-gray-400
                         focus:outline-none focus:border-emerald-500 focus:bg-white
                         transition-all"
              />
              
              <button
                onClick={handleGetCurrentLocation}
                disabled={isLocating}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 
                         text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 
                         rounded-md transition-all disabled:opacity-50"
                title="定位当前位置"
              >
                {isLocating ? (
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* 城市列表 */}
          <div className="overflow-y-auto max-h-[calc(60vh-60px)]">
            {Object.entries(filteredLandmarks).map(([city, landmarks]) => (
              <div key={city}>
                <div className="sticky top-0 px-4 py-2 bg-gray-50/95 backdrop-blur-sm
                              text-xs font-semibold text-emerald-600 uppercase tracking-wider border-b border-gray-100">
                  {city}
                </div>
                {landmarks.map((landmark) => (
                  <button
                    key={landmark.id}
                    onClick={() => handleSelect(landmark)}
                    className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 
                              transition-colors flex items-center gap-3
                              ${selectedLandmark?.id === landmark.id ? 'bg-emerald-50' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 text-sm truncate">{landmark.name}</div>
                      <div className="text-xs text-gray-500 truncate">{landmark.description}</div>
                    </div>
                    {selectedLandmark?.id === landmark.id && (
                      <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ))}
            
            {Object.keys(filteredLandmarks).length === 0 && (
              <div className="px-4 py-8 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-400 text-sm">没有找到匹配的城市</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

