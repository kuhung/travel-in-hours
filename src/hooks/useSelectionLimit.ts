import { useSyncExternalStore, useCallback } from 'react';

const STORAGE_KEY_PREFIX = 'isochrone_usage_';
export const MAX_DAILY_LIMIT = 5;

export function getTodayKey(): string {
  const today = new Date().toISOString().split('T')[0];
  return `${STORAGE_KEY_PREFIX}${today}`;
}

export function parseStoredCount(raw: string | null): number {
  if (!raw) return 0;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

const listeners = new Set<() => void>();
function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

function getSnapshot(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return parseStoredCount(localStorage.getItem(getTodayKey()));
  } catch {
    return 0;
  }
}

function getServerSnapshot(): number {
  return 0;
}

export function useSelectionLimit() {
  // useSyncExternalStore 规范：SSR 与客户端 Hydration 首屏均消费 getServerSnapshot (0)，
  // 水合后平滑同步客户端存储值，彻底杜绝 hydration mismatch 与 setState-in-effect 级联渲染
  const count = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const remaining = Math.max(0, MAX_DAILY_LIMIT - count);

  // 增加计数（仅在自定义选点成功且未命中缓存时扣除）
  const increment = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = getTodayKey();
      const currentCount = parseStoredCount(localStorage.getItem(key));
      const newCount = currentCount + 1;

      localStorage.setItem(key, newCount.toString());
      emitChange();
    } catch {
      // ignore storage errors
    }
  }, []);

  // 检查是否允许自定义选点
  const checkLimit = useCallback(() => {
    if (typeof window === 'undefined') return true;
    try {
      const key = getTodayKey();
      const currentCount = parseStoredCount(localStorage.getItem(key));
      return currentCount < MAX_DAILY_LIMIT;
    } catch {
      return true;
    }
  }, []);

  return {
    count,
    remaining,
    increment,
    checkLimit,
    maxLimit: MAX_DAILY_LIMIT,
  };
}
