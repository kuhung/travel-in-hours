import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  
  // 环境变量
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
};

export default nextConfig;
