import { IsochroneFeature, TravelProfile } from '@/types';

// 缓存键生成
export function generateCacheKey(
  coordinates: [number, number],
  profile: TravelProfile,
  rangeMinutes: number[]
): string {
  const coordKey = `${coordinates[0].toFixed(4)}_${coordinates[1].toFixed(4)}`;
  const rangeKey = rangeMinutes.sort((a, b) => a - b).join('_');
  return `isochrone_${coordKey}_${profile}_${rangeKey}`;
}

// 缓存版本，用于清除旧缓存
const CACHE_VERSION = 'v1';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7天过期

interface CacheEntry {
  version: string;
  timestamp: number;
  data: IsochroneFeature[];
}

// 从 localStorage 获取缓存
export function getCachedIsochrones(
  coordinates: [number, number],
  profile: TravelProfile,
  rangeMinutes: number[]
): IsochroneFeature[] | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const key = generateCacheKey(coordinates, profile, rangeMinutes);
    const cached = localStorage.getItem(key);
    
    if (!cached) return null;
    
    const entry: CacheEntry = JSON.parse(cached);
    
    // 检查版本和过期时间
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }
    
    if (Date.now() - entry.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(key);
      return null;
    }
    
    return entry.data;
  } catch {
    return null;
  }
}

// 保存到 localStorage 缓存
export function setCachedIsochrones(
  coordinates: [number, number],
  profile: TravelProfile,
  rangeMinutes: number[],
  data: IsochroneFeature[]
): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = generateCacheKey(coordinates, profile, rangeMinutes);
    const entry: CacheEntry = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage 可能已满，忽略错误
    console.warn('Failed to cache isochrones data');
  }
}

// 清除所有等时圈缓存
export function clearIsochroneCache(): void {
  if (typeof window === 'undefined') return;
  
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('isochrone_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}


