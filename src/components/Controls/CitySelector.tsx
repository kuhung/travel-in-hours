'use client';

import { useState, useMemo } from 'react';
import { track } from '@/lib/analytics';
import { CityLandmark } from '@/types';
import { cityLandmarks, landmarksByCity } from '@/data/landmarks';
import {
  getExplorationSource,
  formatSearchNoMatchMessage,
} from '@/lib/exploration-state';

interface CitySelectorProps {
  selectedLandmark: CityLandmark | null;
  onSelect: (landmark: CityLandmark | null) => void;
  onStartMapPick?: () => void;
  remainingQuota?: number;
  isExample?: boolean;
  isLocating?: boolean;
  locatingError?: string | null;
  onRequestLocation?: () => void;
  onClearLocatingError?: () => void;
}

export default function CitySelector({
  selectedLandmark,
  onSelect,
  onStartMapPick,
  remainingQuota = 5,
  isExample = false,
  isLocating = false,
  locatingError = null,
  onRequestLocation,
  onClearLocatingError,
}: CitySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  // 触发定位动作（交由统一生命周期管理）
  const handleTriggerLocation = () => {
    onRequestLocation?.();
  };

  // 过滤预设地标
  const filteredLandmarks = useMemo(() => {
    if (!searchQuery.trim()) {
      return landmarksByCity;
    }

    const query = searchQuery.trim().toLowerCase();
    const filtered = cityLandmarks.filter(
      (l) => l.name.toLowerCase().includes(query) || l.city.toLowerCase().includes(query)
    );

    return filtered.reduce((acc, landmark) => {
      if (!acc[landmark.city]) {
        acc[landmark.city] = [];
      }
      acc[landmark.city].push(landmark);
      return acc;
    }, {} as Record<string, CityLandmark[]>);
  }, [searchQuery]);

  const hasSearchResults = useMemo(() => {
    return Object.keys(filteredLandmarks).length > 0;
  }, [filteredLandmarks]);

  const handleSelect = (landmark: CityLandmark) => {
    track('landmark_selected', {
      location: 'selector',
      city: landmark.city,
      landmark_name: landmark.name,
      is_current_location: landmark.id === 'current-location',
    });

    onSelect(landmark);
    setIsOpen(false);
    setSearchQuery('');
    onClearLocatingError?.();
  };

  const handleStartMapPickClick = () => {
    setIsOpen(false);
    onClearLocatingError?.();
    onStartMapPick?.();
  };

  // 当前起点的来源标签
  const source = getExplorationSource(selectedLandmark, isExample);
  const sourceBadge = useMemo(() => {
    if (!selectedLandmark) return null;
    if (source === 'example') {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded">
          上海示例
        </span>
      );
    }
    if (source === 'current-location') {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 rounded">
          当前位置
        </span>
      );
    }
    if (source === 'custom') {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-800 rounded">
          地图选点
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-600 rounded">
        预设地标
      </span>
    );
  }, [selectedLandmark, source]);

  return (
    <div className="relative">
      {/* 当前选择展示栏 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5
                   bg-gray-50 border border-gray-200
                   rounded-xl text-gray-900 hover:bg-gray-100 hover:border-gray-300 transition-all
                   focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-left min-w-0">
            {selectedLandmark ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm truncate text-gray-900">{selectedLandmark.name}</span>
                  {sourceBadge}
                </div>
                <div className="text-[11px] text-gray-500 truncate">
                  {selectedLandmark.city}
                  {selectedLandmark.province ? `, ${selectedLandmark.province}` : ''}
                </div>
              </>
            ) : (
              <div className="text-gray-400 text-sm">点击选择出发地</div>
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

      {/* 下拉选择抽屉/面板 */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 
                        bg-white/98 backdrop-blur-xl border border-gray-200 
                        rounded-2xl shadow-2xl max-h-[70vh] overflow-hidden
                        animate-fade-in divide-y divide-gray-100">
          {/* 1. 起点动作快捷区：定位当前位置 & 地图选点 */}
          <div className="p-3 bg-gray-50/70 space-y-2">
            <div className="flex items-center gap-2">
              {/* 定位按钮 */}
              <button
                type="button"
                onClick={handleTriggerLocation}
                disabled={isLocating}
                className="flex-1 py-2 px-3 bg-white hover:bg-blue-50 active:bg-blue-100 border border-gray-200 hover:border-blue-300 rounded-xl text-left text-xs font-semibold text-gray-800 transition-colors flex items-center justify-between group disabled:opacity-75 disabled:cursor-wait"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isLocating ? (
                    <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <svg className="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                  <span className="truncate">{isLocating ? '正在定位...' : '定位当前位置'}</span>
                </div>
                <span className="text-[10px] font-normal text-blue-600 shrink-0">免配额</span>
              </button>

              {/* 地图选点 */}
              {onStartMapPick && (
                <button
                  type="button"
                  onClick={handleStartMapPickClick}
                  className="flex-1 py-2 px-3 bg-white hover:bg-orange-50 active:bg-orange-100 border border-gray-200 hover:border-orange-300 rounded-xl text-left text-xs font-semibold text-gray-800 transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-3.5 h-3.5 text-orange-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span className="truncate">在地图选点</span>
                  </div>
                  <span className="text-[10px] font-normal text-orange-600 shrink-0">余{remainingQuota}次</span>
                </button>
              )}
            </div>

            {/* 定位错误卡片与恢复出口（保留原结果，不清空） */}
            {locatingError && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 animate-fade-in">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-amber-900">定位提示</div>
                    <div className="text-[11px] text-amber-700 mt-0.5">{locatingError}</div>
                    <div className="flex items-center gap-2 mt-2 pt-1 border-t border-amber-200/60">
                      <button
                        type="button"
                        onClick={handleTriggerLocation}
                        className="px-2 py-0.5 font-semibold text-[11px] bg-amber-600 hover:bg-amber-700 text-white rounded cursor-pointer"
                      >
                        重试定位
                      </button>
                      {onStartMapPick && (
                        <button
                          type="button"
                          onClick={handleStartMapPickClick}
                          className="px-2 py-0.5 font-semibold text-[11px] bg-orange-600 hover:bg-orange-700 text-white rounded cursor-pointer"
                        >
                          在地图选点
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onClearLocatingError}
                        className="text-[11px] text-gray-500 hover:text-gray-700 ml-auto cursor-pointer"
                      >
                        忽略
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. 预设地标搜索框 */}
          <div className="p-3">
            <div className="text-[11px] font-semibold text-gray-500 mb-1.5 flex items-center justify-between">
              <span>搜索预设地标 (已收录 7 城)</span>
              <span className="text-[10px] text-gray-400 font-normal">免配额</span>
            </div>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={(e) => {
                  // IME 输入法 composing 防护，避免在拼音输入阶段误触发回车提交
                  if (e.key === 'Enter' && !isComposing && !e.nativeEvent.isComposing) {
                    const firstCity = Object.keys(filteredLandmarks)[0];
                    if (firstCity && filteredLandmarks[firstCity]?.[0]) {
                      handleSelect(filteredLandmarks[firstCity][0]);
                    }
                  }
                }}
                placeholder="搜索地标名称或城市 (如 东方明珠、广州塔...)"
                autoFocus
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200
                         rounded-xl text-gray-900 text-xs placeholder-gray-400
                         focus:outline-none focus:border-blue-500 focus:bg-white
                         transition-all"
              />
            </div>
          </div>

          {/* 3. 预设地标列表或无匹配替代出口 */}
          <div className="overflow-y-auto max-h-[45vh]">
            {hasSearchResults ? (
              Object.entries(filteredLandmarks).map(([city, landmarks]) => (
                <div key={city}>
                  <div className="sticky top-0 px-4 py-1.5 bg-gray-50/95 backdrop-blur-sm
                                text-[11px] font-semibold text-blue-700 tracking-wider border-b border-gray-100 flex items-center justify-between">
                    <span>{city}</span>
                    <span className="text-[10px] text-gray-400 font-normal">{landmarks.length} 个地标</span>
                  </div>
                  {landmarks.map((landmark) => {
                    const isSelected = selectedLandmark?.id === landmark.id;
                    return (
                      <button
                        key={landmark.id}
                        type="button"
                        onClick={() => handleSelect(landmark)}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-50
                                  transition-colors flex items-center gap-3
                                  ${isSelected ? 'bg-blue-50/70' : ''}`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 text-xs truncate">{landmark.name}</div>
                          <div className="text-[10px] text-gray-500 truncate">{landmark.description}</div>
                        </div>
                        {isSelected && (
                          <svg className="w-4 h-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              // 搜索无匹配时的解释与明确替代动作出口
              <div className="p-4 text-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-gray-800">
                  {formatSearchNoMatchMessage(searchQuery).message}
                </div>
                <p className="text-[11px] text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  {formatSearchNoMatchMessage(searchQuery).scopeExplanation}
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  {onStartMapPick && (
                    <button
                      type="button"
                      onClick={handleStartMapPickClick}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      在地图上选点
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleTriggerLocation}
                    className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors cursor-pointer"
                  >
                    定位当前位置
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
