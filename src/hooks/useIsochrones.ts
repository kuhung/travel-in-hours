'use client';

import { useState, useCallback } from 'react';
import { IsochroneFeature, TravelProfile } from '@/types';
import { getCachedIsochrones, setCachedIsochrones } from '@/lib/isochrone-cache';

interface UseIsochronesResult {
  isochrones: IsochroneFeature[];
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  fetchIsochrones: (
    coordinates: [number, number],
    profile: TravelProfile,
    rangeMinutes: number[]
  ) => Promise<boolean>;
  clearIsochrones: () => void;
  clearError: () => void;
}

export function useIsochrones(): UseIsochronesResult {
  const [isochrones, setIsochrones] = useState<IsochroneFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const fetchIsochrones = useCallback(async (
    coordinates: [number, number],
    profile: TravelProfile,
    rangeMinutes: number[]
  ) => {
    setLoading(true);
    setError(null);
    setFromCache(false);

    // 首先检查本地缓存
    const cached = getCachedIsochrones(coordinates, profile, rangeMinutes);
    if (cached && cached.length > 0) {
      setIsochrones(cached);
      setFromCache(true);
      setLoading(false);
      return true;
    }

    try {
      const response = await fetch('/api/isochrones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates,
          profile,
          rangeMinutes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `请求失败: ${response.status}`);
      }

      const data = await response.json();
      const features = data.features || [];
      
      setIsochrones(features);
      
      // 保存到本地缓存
      if (features.length > 0) {
        setCachedIsochrones(coordinates, profile, rangeMinutes, features);
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取数据失败';
      setError(message);
      setIsochrones([]);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearIsochrones = useCallback(() => {
    setIsochrones([]);
    setError(null);
    setFromCache(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isochrones,
    loading,
    error,
    fromCache,
    fetchIsochrones,
    clearIsochrones,
    clearError,
  };
}

