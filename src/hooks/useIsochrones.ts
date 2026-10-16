'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { track } from '@/lib/analytics';
import type { IsochroneFeature, TravelProfile } from '@/types';
import { getCachedIsochrones, setCachedIsochrones } from '@/lib/isochrone-cache';
import { snapToGrid } from '@/lib/grid';
import { IsochroneRequestManager, FetchIsochronesResult } from '@/lib/exploration-state';

export type { FetchIsochronesResult };

export interface UseIsochronesResult {
  isochrones: IsochroneFeature[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  fromCache: boolean;
  fetchIsochrones: (
    coordinates: [number, number],
    profile: TravelProfile,
    rangeMinutes: number[]
  ) => Promise<FetchIsochronesResult>;
  cancelRequest: () => void;
  clearIsochrones: () => void;
  clearError: () => void;
}

export function useIsochrones(): UseIsochronesResult {
  const [isochrones, setIsochrones] = useState<IsochroneFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // 单一真实请求生命周期管理器
  const managerRef = useRef<IsochroneRequestManager>(new IsochroneRequestManager());

  // 组件卸载时可靠失效请求身份并取消在途请求
  useEffect(() => {
    const manager = managerRef.current;
    return () => {
      manager.cancel();
    };
  }, []);

  const cancelRequest = useCallback(() => {
    managerRef.current.cancel();
    setLoading(false);
  }, []);

  const fetchIsochrones = useCallback(async (
    rawCoordinates: [number, number],
    profile: TravelProfile,
    rangeMinutes: number[]
  ): Promise<FetchIsochronesResult> => {
    setLoading(true);
    setError(null);
    setIsEmpty(false);
    setFromCache(false);

    const result = await managerRef.current.startRequest(
      rawCoordinates,
      profile,
      rangeMinutes,
      {
        fetchApi: fetch,
        getCached: getCachedIsochrones,
        setCached: setCachedIsochrones,
        snapCoords: snapToGrid,
        trackEvent: track,
      }
    );

    // 检查响应是否已被取消或被更新的请求取代：统一确保失效分支返回 success=false, aborted=true
    if (result.aborted || !managerRef.current.isCurrent(result.requestId)) {
      return {
        ...result,
        success: false,
        aborted: true,
      };
    }

    setLoading(false);

    if (result.success && result.features.length > 0) {
      setIsochrones(result.features);
      setFromCache(result.fromCache);
      setError(null);
      setIsEmpty(false);
    } else if (result.isEmpty) {
      setIsEmpty(true);
      setError(null); // 关键：空数据保持 error 为 null，不污染错误状态
    } else if (result.error) {
      setError(result.error);
      setIsEmpty(false);
      // 关键改动：请求失败保留已有探索结果，不调用 setIsochrones([])
    }

    return result;
  }, []);

  const clearIsochrones = useCallback(() => {
    setIsochrones([]);
    setError(null);
    setIsEmpty(false);
    setFromCache(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setIsEmpty(false);
  }, []);

  return {
    isochrones,
    loading,
    error,
    isEmpty,
    fromCache,
    fetchIsochrones,
    cancelRequest,
    clearIsochrones,
    clearError,
  };
}
