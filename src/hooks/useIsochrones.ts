'use client';

import { useState, useCallback } from 'react';
import { IsochroneFeature, TravelProfile } from '@/types';

interface UseIsochronesResult {
  isochrones: IsochroneFeature[];
  loading: boolean;
  error: string | null;
  fetchIsochrones: (
    coordinates: [number, number],
    profile: TravelProfile,
    rangeMinutes: number[]
  ) => Promise<void>;
  clearIsochrones: () => void;
  clearError: () => void;
}

export function useIsochrones(): UseIsochronesResult {
  const [isochrones, setIsochrones] = useState<IsochroneFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIsochrones = useCallback(async (
    coordinates: [number, number],
    profile: TravelProfile,
    rangeMinutes: number[]
  ) => {
    setLoading(true);
    setError(null);

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
      setIsochrones(data.features || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取数据失败';
      setError(message);
      setIsochrones([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearIsochrones = useCallback(() => {
    setIsochrones([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isochrones,
    loading,
    error,
    fetchIsochrones,
    clearIsochrones,
    clearError,
  };
}

