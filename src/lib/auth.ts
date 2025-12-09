/**
 * 用户认证模块 - 预留接口
 * 
 * 未来可以集成:
 * - NextAuth.js (支持多种 OAuth 提供商)
 * - Clerk (开箱即用的认证服务)
 * - Auth0
 * 
 * 商业化考虑:
 * - 免费用户: 每天 10 次等时圈查询
 * - 付费用户: 无限查询 + 自定义出发点保存
 * - 企业用户: API 访问 + 批量分析
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  plan: 'free' | 'pro' | 'enterprise';
  queryCount: number;
  maxQueries: number;
  savedLocations: SavedLocation[];
}

export interface SavedLocation {
  id: string;
  name: string;
  coordinates: [number, number];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// 预留的认证 Hook
export function useAuth(): AuthState {
  // TODO: 实现实际的认证逻辑
  return {
    user: null,
    isLoading: false,
    isAuthenticated: false,
  };
}

// 预留的登录方法
export async function signIn(provider: 'google' | 'github' | 'wechat'): Promise<void> {
  console.log(`Sign in with ${provider} - Not implemented yet`);
  // TODO: 实现登录逻辑
}

// 预留的登出方法
export async function signOut(): Promise<void> {
  console.log('Sign out - Not implemented yet');
  // TODO: 实现登出逻辑
}

// 检查用户查询配额
export function checkQueryQuota(user: User | null): boolean {
  if (!user) {
    // 未登录用户使用 localStorage 跟踪
    if (typeof window === 'undefined') return true;
    
    const today = new Date().toDateString();
    const stored = localStorage.getItem('query_count');
    const data = stored ? JSON.parse(stored) : { date: today, count: 0 };
    
    if (data.date !== today) {
      return true; // 新的一天，重置计数
    }
    
    return data.count < 10; // 免费用户每天 10 次
  }
  
  return user.queryCount < user.maxQueries;
}

// 增加查询计数
export function incrementQueryCount(user: User | null): void {
  if (!user) {
    if (typeof window === 'undefined') return;
    
    const today = new Date().toDateString();
    const stored = localStorage.getItem('query_count');
    const data = stored ? JSON.parse(stored) : { date: today, count: 0 };
    
    if (data.date !== today) {
      data.date = today;
      data.count = 0;
    }
    
    data.count++;
    localStorage.setItem('query_count', JSON.stringify(data));
  }
  // TODO: 登录用户需要在服务端更新
}

// 保存自定义位置（预留）
export async function saveLocation(
  userId: string,
  location: Omit<SavedLocation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SavedLocation> {
  console.log('Save location - Not implemented yet', { userId, location });
  // TODO: 实现保存逻辑
  throw new Error('Not implemented');
}

// 获取用户保存的位置（预留）
export async function getSavedLocations(userId: string): Promise<SavedLocation[]> {
  console.log('Get saved locations - Not implemented yet', { userId });
  // TODO: 实现获取逻辑
  return [];
}

