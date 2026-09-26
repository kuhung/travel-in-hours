import type { NextConfig } from "next";
import { execSync } from "child_process";

// 可选：通过环境变量覆盖，便于在不同设备/局域网段开发时调整
const devAllowedOrigins =
  process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);

function resolveGitSha(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  if (fromVercel) return fromVercel;
  const fromEnv = process.env.NEXT_PUBLIC_GIT_SHA;
  if (fromEnv) return fromEnv;
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

const nextConfig: NextConfig = {
  // 允许在局域网设备访问 dev server 时加载 /_next/* 资源，避免跨域警告
  allowedDevOrigins: devAllowedOrigins ?? ['192.168.*.*'],
  // 优化图片加载
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'unpkg.com',
      },
      {
        protocol: 'https',
        hostname: '*.tile.openstreetmap.org',
      },
    ],
  },
  
  // 实验性功能
  experimental: {
    // 启用 React Compiler (如果可用)
  },
  
  // 环境变量：注入 Git 版本号，便于线上页面追踪
  env: {
    NEXT_PUBLIC_GIT_SHA: resolveGitSha(),
  },

  // 安全请求头
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ]
  },
};

export default nextConfig;
