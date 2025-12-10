'use client';

import { useState, useCallback } from 'react';
import { track } from '@vercel/analytics';
import { IsochroneFeature, TravelProfile } from '@/types';
import { getCachedIsochrones, setCachedIsochrones } from '@/lib/isochrone-cache';
import { snapToGrid } from '@/lib/grid';

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
    rawCoordinates: [number, number],
    profile: TravelProfile,
    rangeMinutes: number[]
  ) => {
    // 对齐到网格系统
    const coordinates = snapToGrid(rawCoordinates[0], rawCoordinates[1]);

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
        const errorMessage = errorData.error || `请求失败: ${response.status}`;
        
        // 追踪 API 错误事件 - 区分不同错误类型
        const errorType = 
          response.status === 429 ? 'rate_limit' :
          response.status === 403 ? 'forbidden' :
          response.status === 401 ? 'unauthorized' :
          response.status === 500 ? 'server_error' :
          response.status === 503 ? 'service_unavailable' :
          `http_${response.status}`;
        
        track('api_error', {
          location: 'isochrones_hook',
          error_type: errorType,
          status_code: response.status,
          profile,
          error_message: errorMessage.substring(0, 100) // 限制长度
        });
        
        // 特别追踪限流事件
        if (response.status === 429) {
          track('api_rate_limit_reached', {
            location: 'isochrones_hook',
            profile,
            coordinates: `${coordinates[0].toFixed(4)},${coordinates[1].toFixed(4)}`
          });
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const features = data.features || [];
      
      setIsochrones(features);
      
      // 保存到本地缓存
      if (features.length > 0) {
        setCachedIsochrones(coordinates, profile, rangeMinutes, features);
      }
      
      // 追踪 API 调用成功
      track('api_call_success', {
        location: 'isochrones_hook',
        profile,
        range_count: rangeMinutes.length
      });
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取数据失败';
      
      // 如果是网络错误（不是 HTTP 错误），也要追踪
      if (!(err instanceof Error && err.message.includes('请求失败'))) {
        track('api_network_error', {
          location: 'isochrones_hook',
          profile,
          error_message: message.substring(0, 100)
        });
      }
      
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

