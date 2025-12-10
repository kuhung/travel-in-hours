import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY_PREFIX = 'isochrone_usage_';
const MAX_DAILY_LIMIT = 1;

export function useSelectionLimit() {
  const [count, setCount] = useState(0);
  const [remaining, setRemaining] = useState(MAX_DAILY_LIMIT);

  // 获取当天的 key
  const getTodayKey = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return `${STORAGE_KEY_PREFIX}${today}`;
  }, []);

  // 初始化加载
  useEffect(() => {
    const key = getTodayKey();
    const stored = localStorage.getItem(key);
    const currentCount = stored ? parseInt(stored, 10) : 0;
    setCount(currentCount);
    setRemaining(Math.max(0, MAX_DAILY_LIMIT - currentCount));
  }, [getTodayKey]);

  // 增加计数
  const increment = useCallback(() => {
    const key = getTodayKey();
    const currentCount = parseInt(localStorage.getItem(key) || '0', 10);
    const newCount = currentCount + 1;
    
    localStorage.setItem(key, newCount.toString());
    setCount(newCount);
    setRemaining(Math.max(0, MAX_DAILY_LIMIT - newCount));
  }, [getTodayKey]);

  // 检查是否允许
  const checkLimit = useCallback(() => {
    const key = getTodayKey();
    const currentCount = parseInt(localStorage.getItem(key) || '0', 10);
    return currentCount < MAX_DAILY_LIMIT;
  }, [getTodayKey]);

  return {
    count,
    remaining,
    increment,
    checkLimit,
    maxLimit: MAX_DAILY_LIMIT
  };
}

