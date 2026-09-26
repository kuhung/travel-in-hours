'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  zhuhaiImmigrationHalls,
  hallsByDistrict,
  ImmigrationHall,
} from '@/data/zhuhai-immigration-halls';
import ImmigrationHallsMapWrapper from '@/components/Map/ImmigrationHallsMapWrapper';
import VersionBadge from '@/components/UI/VersionBadge';

export default function ImmigrationHallsApp() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [query, setQuery] = useState('');

  const selectedHall = useMemo(
    () => zhuhaiImmigrationHalls.find((h) => h.id === selectedId) || null,
    [selectedId]
  );

  const filteredByDistrict = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hallsByDistrict;

    const filtered = zhuhaiImmigrationHalls.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.address.toLowerCase().includes(q) ||
        h.district.toLowerCase().includes(q)
    );

    return filtered.reduce(
      (acc, hall) => {
        if (!acc[hall.district]) acc[hall.district] = [];
        acc[hall.district].push(hall);
        return acc;
      },
      {} as Record<string, ImmigrationHall[]>
    );
  }, [query]);

  const handleSelect = (hall: ImmigrationHall) => {
    setSelectedId(hall.id);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsPanelOpen(false);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="absolute inset-0 z-0">
        <ImmigrationHallsMapWrapper
          halls={zhuhaiImmigrationHalls}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      {/* 顶部标题 */}
      <div className="absolute top-4 left-4 right-4 z-20 pointer-events-none">
        <div className="pointer-events-auto inline-flex flex-col gap-2 max-w-xl">
          <div className="bg-white/95 backdrop-blur-md border border-white/40 rounded-2xl shadow-xl px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 font-bold">
                珠
              </div>
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-tight">
                  珠海市出入境智能服务厅地图
                </h1>
                <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                  共 {zhuhaiImmigrationHalls.length} 个办证服务点，点击标记或右侧列表查看详情
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/"
            className="pointer-events-auto self-start text-xs text-white/90 bg-slate-900/70 hover:bg-slate-900 px-3 py-1.5 rounded-full backdrop-blur transition-colors"
          >
            返回出行可达地图
          </Link>
        </div>
      </div>

      {/* 移动端面板开关 */}
      <button
        type="button"
        onClick={() => setIsPanelOpen((v) => !v)}
        className="md:hidden absolute top-4 right-4 z-30 p-2.5 rounded-xl bg-white/95 backdrop-blur shadow-lg text-gray-700"
        aria-label={isPanelOpen ? '收起列表' : '打开列表'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isPanelOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* 侧边列表 */}
      <aside
        className={`absolute z-20 top-28 md:top-4 bottom-16 md:bottom-4 right-4 w-[min(100%-2rem,360px)]
          bg-white/95 backdrop-blur-md border border-white/40 rounded-2xl shadow-2xl overflow-hidden
          transition-all duration-300
          ${isPanelOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none md:opacity-100 md:translate-x-0 md:pointer-events-auto'}
        `}
      >
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索服务厅 / 地址 / 区域"
              className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900
                         placeholder-gray-400 focus:outline-none focus:border-teal-500 focus:bg-white"
            />
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(100%-64px)]">
          {Object.entries(filteredByDistrict).map(([district, halls]) => (
            <div key={district}>
              <div className="sticky top-0 px-4 py-2 bg-gray-50/95 backdrop-blur text-xs font-semibold text-teal-700 tracking-wide border-b border-gray-100">
                {district}
              </div>
              {halls.map((hall) => {
                const active = hall.id === selectedId;
                return (
                  <button
                    key={hall.id}
                    type="button"
                    onClick={() => handleSelect(hall)}
                    className={`w-full px-4 py-3 text-left border-b border-gray-50 transition-colors
                      ${active ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                          ${active ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {hall.index}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-gray-900 truncate">{hall.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{hall.address}</div>
                        <div className="text-xs text-teal-700 mt-1">{hall.hours}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}

          {Object.keys(filteredByDistrict).length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-gray-400">没有匹配的服务厅</div>
          )}
        </div>
      </aside>

      {/* 选中详情条（移动端底部） */}
      {selectedHall && (
        <div className="md:hidden absolute bottom-14 left-4 right-4 z-20 bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-white/40 p-3">
          <div className="font-semibold text-gray-900 text-sm">
            {selectedHall.index}. {selectedHall.name}
          </div>
          <div className="text-xs text-gray-500 mt-1">{selectedHall.address}</div>
          <div className="text-xs text-teal-700 mt-1">{selectedHall.hours}</div>
        </div>
      )}

      <VersionBadge />
    </div>
  );
}
