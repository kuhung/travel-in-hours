# 出行可达地图 | Isochrone Travel Map

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Deploy with Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com/new/clone?repository-url=https://github.com/kuhung/travel-in-3hours&env=ORS_API_KEY,NEXT_PUBLIC_APP_URL)

**在线体验**: [keda.kuhung.me](https://keda.kuhung.me)

基于 OpenRouteService 等时圈 API，可视化从任意出发点在指定时间内可达的地理范围。支持驾车、骑行、步行三种出行方式，覆盖国内 7 座城市核心地标，帮助你快速发现"生活半径"。

> Visualize reachable areas from any starting point within a given time using the OpenRouteService Isochrones API. Supports driving, cycling, and walking across 7 major Chinese cities.

![出行可达地图预览](https://opengraph.kuhung.me/api/image?url=https://keda.kuhung.me)

---

## 功能特点

- **多种出行方式**: 驾车 / 骑行 / 步行，覆盖日常出行场景
- **灵活时间范围**: 15 分钟至 3 小时可达范围，分层可视化
- **预设城市地标**: 覆盖上海、杭州、广州、深圳、成都、绍兴、重庆 7 座城市的核心交通枢纽与地标
- **自定义选点**: 点击地图任意位置设置出发点（每日 5 次）
- **POI 发现**: 自动标注可达范围内的兴趣点（景区、交通枢纽等）
- **一键分享**: 生成带二维码的地图截图，支持微博 / Twitter / 微信分享
- **分享链接**: URL 参数还原分享状态，便于二次传播
- **响应式设计**: 移动端与桌面端自适应布局

---

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 安装

```bash
git clone https://github.com/kuhung/travel-in-3hours.git
cd travel-in-3hours
npm install
```

### 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
# 必填：在 https://openrouteservice.org/dev/#/signup 注册后获取
ORS_API_KEY=your_api_key_here

# 可选：应用访问地址，用于生成分享链接（默认自动识别）
# NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 本地开发

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看效果。

---

## 部署到 Vercel

### 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kuhung/travel-in-3hours&env=ORS_API_KEY,NEXT_PUBLIC_APP_URL)

### 手动部署

1. Fork 本仓库
2. 在 [Vercel](https://vercel.com) 中导入项目
3. 配置以下环境变量：
   - `ORS_API_KEY`: OpenRouteService API Key（必填）
   - `NEXT_PUBLIC_APP_URL`: 你的应用 URL（可选，用于生成分享链接）

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | [Next.js 16](https://nextjs.org/) (App Router) |
| 语言 | [TypeScript 5](https://www.typescriptlang.org/) |
| 样式 | [Tailwind CSS 4](https://tailwindcss.com/) |
| 地图 | [React Leaflet](https://react-leaflet.js.org/) + [Leaflet](https://leafletjs.com/) |
| 地图数据 | [OpenStreetMap](https://www.openstreetmap.org/) |
| 路径 API | [OpenRouteService Isochrones API](https://openrouteservice.org/dev/#/api-docs/v2/isochrones) |
| 截图 | [html2canvas](https://html2canvas.hertzen.com/) |
| 二维码 | [qrcode](https://github.com/soldair/node-qrcode) |
| 监控 | [Vercel Analytics](https://vercel.com/analytics) |
| 部署 | [Vercel](https://vercel.com) |

---

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/isochrones/     # 等时圈代理 API（服务端，保护 API Key）
│   ├── globals.css
│   ├── layout.tsx          # 根布局（SEO Metadata、Analytics）
│   ├── opengraph-image.tsx # 动态 OG 图片
│   └── page.tsx
├── components/
│   ├── App/                # 主应用组件（状态管理入口）
│   ├── Controls/           # 控制面板（城市选择、出行方式、分享）
│   ├── Map/                # 地图组件（等时圈渲染、POI 标注）
│   └── UI/                 # 通用 UI（错误提示、引导、微信弹窗）
├── data/
│   ├── landmarks.ts        # 城市地标数据
│   ├── interest-points.ts  # 兴趣点数据
│   └── isochrone-config.ts # 时间范围配置
├── hooks/
│   ├── useIsochrones.ts    # 等时圈数据请求 Hook
│   ├── useShareParams.ts   # URL 分享参数解析 Hook
│   └── useSelectionLimit.ts# 自定义选点次数限制 Hook
├── lib/
│   ├── ors-client.ts       # OpenRouteService API 客户端
│   ├── isochrone-cache.ts  # 客户端内存缓存
│   ├── cache-preloader.ts  # 热门地标后台预加载
│   ├── share-utils.ts      # 截图与分享工具函数
│   ├── poi-utils.ts        # POI 分层计算
│   ├── grid.ts             # 坐标网格工具
│   └── coord-transform.ts  # GCJ-02 坐标转换
└── types/index.ts          # TypeScript 类型定义
```

---

## API 限制说明

使用 OpenRouteService 免费套餐时的约束：

| 出行方式 | 最大可达时间 | 每分钟请求数 |
|----------|-------------|-------------|
| 驾车     | 1 小时      | 40 次       |
| 骑行     | 5 小时      | 40 次       |
| 步行     | 20 小时     | 40 次       |

本项目已内置客户端内存缓存和后台预加载机制，在相同参数下重复请求不消耗 API 配额。

---

## 数据监控

项目集成 Vercel Web Analytics，追踪用户行为、API 健康状态和缓存命中率。

详细文档：[ANALYTICS.md](./ANALYTICS.md)

---

## 扩展地标数据

在 `src/data/landmarks.ts` 中按以下格式添加新地标：

```typescript
{
  id: 'city-landmark-name',   // 唯一 ID，建议格式：城市-地标英文
  name: '地标名称',
  city: '城市',
  province: '省份',
  coordinates: [经度, 纬度], // WGS-84 坐标，[lng, lat]
  description: '地标描述',
}
```

在 `src/data/interest-points.ts` 中可为每座城市添加兴趣点数据，用于在等时圈内展示 POI 清单。

---

## 未来规划

**v1.1 - 景点发现**
- 集成高德 / 百度地图 POI 数据
- 可达范围内的徒步景点展示与评分

**v1.2 - 用户系统**
- 用户登录（微信 / Google / GitHub）
- 收藏自定义出发点与历史记录

**v1.3 - 商业化**
- 会员订阅
- API 服务开放

---

## 贡献

欢迎提交 Issue 和 Pull Request。请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## 致谢

- [OpenRouteService](https://openrouteservice.org/) — 路径规划与等时圈 API
- [Leaflet](https://leafletjs.com/) — 开源地图渲染库
- [OpenStreetMap](https://www.openstreetmap.org/) — 开源地图数据

---

## 许可证

[MIT License](./LICENSE) &copy; 2026 [kuhung](https://kuhung.me/about)
