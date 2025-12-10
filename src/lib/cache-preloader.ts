'use client';

import { cityLandmarks } from '@/data/landmarks';
import { TravelProfile } from '@/types';
import { getCachedIsochrones, setCachedIsochrones } from './isochrone-cache';
import { snapToGrid } from './grid';

// 预加载配置
const PRELOAD_PROFILES: TravelProfile[] = ['driving-car', 'cycling-regular', 'foot-walking'];
// 保持与默认显示时间一致 [15, 30, 60] 以确保命中缓存
const PRELOAD_RANGES: Record<TravelProfile, number[]> = {
  'driving-car': [15, 30, 60], 
  'cycling-regular': [15, 30, 60],
  'foot-walking': [15, 30, 60],
};

interface PreloadTask {
  landmarkId: string;
  landmarkName: string;
  coordinates: [number, number];
  profile: TravelProfile;
  rangeMinutes: number[];
}

// 生成所有需要预加载的任务
function getPreloadTasks(): PreloadTask[] {
  const tasks: PreloadTask[] = [];
  
  for (const landmark of cityLandmarks) {
    for (const profile of PRELOAD_PROFILES) {
      const ranges = PRELOAD_RANGES[profile];
      // 对齐到网格
      const snappedCoordinates = snapToGrid(landmark.coordinates[0], landmark.coordinates[1]);
      
      tasks.push({
        landmarkId: landmark.id,
        landmarkName: landmark.name,
        coordinates: snappedCoordinates,
        profile,
        rangeMinutes: ranges,
      });
    }
  }
  
  return tasks;
}

// 检查是否已缓存
function isTaskCached(task: PreloadTask): boolean {
  const cached = getCachedIsochrones(task.coordinates, task.profile, task.rangeMinutes);
  return cached !== null && cached.length > 0;
}

// 预加载单个任务
async function preloadTask(task: PreloadTask): Promise<boolean> {
  try {
    const response = await fetch('/api/isochrones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: task.coordinates,
        profile: task.profile,
        rangeMinutes: task.rangeMinutes,
      }),
    });

    if (!response.ok) {
      console.warn(`预加载失败: ${task.landmarkName} - ${task.profile}`);
      return false;
    }

    const data = await response.json();
    const features = data.features || [];
    
    if (features.length > 0) {
      setCachedIsochrones(task.coordinates, task.profile, task.rangeMinutes, features);
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn(`预加载错误: ${task.landmarkName} - ${task.profile}`, error);
    return false;
  }
}

// 预加载所有缓存（带延迟，避免触发 API 限流）
export async function preloadAllCaches(
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<{ success: number; failed: number; skipped: number }> {
  const tasks = getPreloadTasks();
  const result = { success: 0, failed: 0, skipped: 0 };
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    
    // 检查是否已缓存
    if (isTaskCached(task)) {
      result.skipped++;
      onProgress?.(i + 1, tasks.length, `${task.landmarkName} (已缓存)`);
      continue;
    }
    
    onProgress?.(i + 1, tasks.length, `${task.landmarkName} - ${task.profile}`);
    
    const success = await preloadTask(task);
    if (success) {
      result.success++;
    } else {
      result.failed++;
    }
    
    // 延迟 1.5 秒，避免 API 限流
    if (i < tasks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  return result;
}

// 获取缓存统计信息
export function getCacheStats(): { total: number; cached: number; missing: number } {
  const tasks = getPreloadTasks();
  let cached = 0;
  
  for (const task of tasks) {
    if (isTaskCached(task)) {
      cached++;
    }
  }
  
  return {
    total: tasks.length,
    cached,
    missing: tasks.length - cached,
  };
}

// 静默后台预加载（不阻塞UI）
export function startBackgroundPreload(): void {
  // 延迟 3 秒后开始，让页面先完成渲染
  setTimeout(async () => {
    const stats = getCacheStats();
    
    // 如果缓存已满，不需要预加载
    if (stats.missing === 0) {
      console.log('✅ 等时圈缓存已完整');
      return;
    }
    
    console.log(`🔄 开始后台预加载等时圈数据 (${stats.missing}/${stats.total} 待缓存)`);
    
    const result = await preloadAllCaches((completed, total, current) => {
      if (completed % 5 === 0) { // 每5个任务输出一次日志
        console.log(`预加载进度: ${completed}/${total} - ${current}`);
      }
    });
    
    console.log(`✅ 预加载完成: 成功 ${result.success}, 失败 ${result.failed}, 跳过 ${result.skipped}`);
  }, 3000);
}


