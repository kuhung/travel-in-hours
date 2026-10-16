# 出行可达地图 | Isochrone Travel Map

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Deploy with Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com/new/clone?repository-url=https://github.com/kuhung/travel-in-3hours&env=ORS_API_KEY,NEXT_PUBLIC_APP_URL)

**在线体验**: [keda.kuhung.me](https://keda.kuhung.me)

基于等时圈路网计算引擎，可视化从任意出发点在指定时间内可达的地理范围。支持驾车、骑行、步行三种出行方式，覆盖国内 8 座核心城市及精选地标，帮助你快速发现自己的“生活半径”。

> Visualize reachable areas from any starting point within a given time using isochrone routing. Supports driving, cycling, and walking across major Chinese cities.

![出行可达地图预览](https://opengraph.kuhung.me/api/image?url=https://keda.kuhung.me)

---

## 功能特点

- **多种出行方式**: 驾车 / 骑行 / 步行，全场景覆盖日常出行需求
- **阶梯时间范围**: 固定 15、30、60 分钟（1 小时内）分层等时圈，清晰呈现不同时长的生活圈边界
- **预设城市地标**: 覆盖上海、杭州、广州、深圳、成都、绍兴、重庆、珠海 8 座城市的核心交通枢纽与特色地标
- **自由选点探索**: 支持浏览器快速定位，或在地图上任意点击直接设定出发点
- **精选地点与详情**: 列表与地图标记双向联动点选，展示地点名称、类别、简介与预估圈层，收录上海热门文旅地标与珠海市 15 处出入境智能服务厅专题数据
- **外部地图导航**: 接入高德开放平台路径规划服务，提供真实起终点直达导航，桌面端智能提供导航参数与坐标复制
- **探索卡片导出**: 生成带二维码的高清等时圈分享卡片，支持长图下载、高清预览与链接复制
- **URL 状态还原**: 探索条件（起点、方式、时长与选中的地点）自动编码至 URL，便于直接传播与无损恢复
- **自适应设计**: 深度适配移动端与桌面端屏幕交互

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

### 本地开发与测试

```bash
# 启动本地开发服务器
npm run dev

# 运行自动化测试套件
npm test
```

打开 [http://localhost:3000](http://localhost:3000) 即可查看效果。

---

## 部署到 Vercel

### 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kuhung/travel-in-3hours&env=ORS_API_KEY,NEXT_PUBLIC_APP_URL)

### 手动部署

1. Fork 本仓库
2. 在 [Vercel](https://vercel.com) 中导入项目
3. 配置环境变量：
   - `ORS_API_KEY`: OpenRouteService API Key（必填）
   - `NEXT_PUBLIC_APP_URL`: 你的应用 URL（可选，用于生成分享链接）

---

## 技术栈

| 层级 | 技术选型 |
|------|------|
| 框架 | [Next.js 16](https://nextjs.org/) (App Router) + [React 19](https://react.dev/) |
| 语言 | [TypeScript 5](https://www.typescriptlang.org/) |
| 样式 | [Tailwind CSS 4](https://tailwindcss.com/) |
| 地图渲染 | [React Leaflet](https://react-leaflet.js.org/) + [Leaflet](https://leafletjs.com/) |
| 底图数据 | [OpenStreetMap](https://www.openstreetmap.org/) + 高德地图瓦片 |
| 路径计算 | [OpenRouteService Isochrones API](https://openrouteservice.org/dev/#/api-docs/v2/isochrones) |
| 外部导航 | [高德开放平台 URI API](https://lbs.amap.com/api/uri-api/guide/travel/route) |
| 导出分享 | [html2canvas](https://html2canvas.hertzen.com/) + [qrcode](https://github.com/soldair/node-qrcode) |
| 指标分析 | [Vercel Web Analytics](https://vercel.com/analytics)（数据最小化与隐私合规） |
| 自动化测试 | Node.js 原生 Test Runner（`node:test` + `node:assert`） |

---

## 项目结构

```
src/
├── app/                        # Next.js App Router
│   ├── api/isochrones/         # 等时圈代理 API（服务端保护 API Key）
│   ├── globals.css             # 全局样式
│   ├── layout.tsx              # 根布局（SEO Metadata、Analytics）
│   ├── opengraph-image.tsx     # 动态 OG 图片生成
│   ├── robots.ts / sitemap.ts  # 搜索引擎抓取配置
│   └── page.tsx                # 主页面入口
├── components/
│   ├── App/                    # 主应用状态（IsochroneApp、PrivacyAnalytics）
│   ├── Controls/               # 控制面板（城市选择、出行方式、地点清单、ShareDialog、POIDetailCard）
│   ├── Map/                    # 地图组件（IsochroneMap、MapLegend、MapWrapper）
│   └── UI/                     # 通用 UI（WelcomeGuide、VersionBadge）
├── data/
│   ├── landmarks.ts            # 8 城预设交通枢纽与地标
│   ├── interest-points.ts      # 精选兴趣点与收录区域声明
│   ├── zhuhai-immigration-halls.ts # 珠海出入境智能服务厅专题数据
│   └── isochrone-config.ts     # 时间圈层配色与样式配置
├── hooks/
│   ├── useIsochrones.ts        # 等时圈数据生命周期管理
│   ├── useShareParams.ts       # URL 分享状态解析 Hook
│   └── useSelectionLimit.ts    # 选点限制管理 Hook
├── lib/
│   ├── geo-utils.ts            # 空间几何计算引擎（点在多边形、孔洞排除、MultiPolygon、重叠评估）
│   ├── poi-utils.ts            # POI 圈层归属与状态检索
│   ├── share-params.ts         # 分享参数严格序列化与反序列化
│   ├── share-utils.ts          # 离屏渲染与分享卡片导出
│   ├── navigation-utils.ts     # 外部地图导航构建与平台适配
│   ├── exploration-state.ts    # 探索状态机与请求生命周期管理器
│   ├── layout-utils.ts         # 视口避让与展示状态解析
│   ├── coord-transform.ts      # WGS-84 / GCJ-02 坐标转换
│   └── analytics.ts            # 旅程分析事件分发（属性白名单与隐私保护）
└── types/index.ts              # 核心 TypeScript 类型定义
```

---

## 核心设计与计算模型

1. **路网模型与阶梯圈层**：基于道路拓扑网络模型实估 15、30、60 分钟三档可达半径，消除直线欧氏距离的失真。
2. **多级性能保障**：系统内置内存缓存层与热门地标后台预加载机制，有效降低外部接口延迟，保证高频交互秒级响应。
3. **稳健空间拓扑**：采用纯数学射线法、GeoJSON Polygon 内环孔洞排除与 MultiPolygon 分块检测，确保地点圈层归属与覆盖状态判断精确可靠。
4. **统一坐标契约**：空间几何计算严格在原生 WGS-84 坐标系下完成；在渲染展示与外部导航跳转时，统一在边界单次转换为 GCJ-02 坐标。

---

## 扩展数据

### 添加预设起点

在 `src/data/landmarks.ts` 中按以下结构添加新地标：

```typescript
{
  id: 'city-landmark-name',   // 唯一 ID，格式建议：城市拼音-地标英文
  name: '地标名称',
  city: '城市',
  province: '省份',
  coordinates: [经度, 纬度], // WGS-84 坐标，[lng, lat]
  description: '地标描述',
}
```

### 添加精选地点 (POI)

在 `src/data/interest-points.ts` 中可为城市添加候选地点数据，系统将自动根据用户生成的等时圈几何进行动态圈层归属与清单展示。

---

## 核心技术文档

- 数据监控与指标口径规范：[ANALYTICS.md](./ANALYTICS.md)
- 贡献指引与代码规范：[CONTRIBUTING.md](./CONTRIBUTING.md)
- 历史版本迭代记录：[CHANGELOG.md](./CHANGELOG.md)

---

## 贡献

欢迎提交 Issue 和 Pull Request，共同完善城市地标与出行功能。请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## 致谢

- [OpenRouteService](https://openrouteservice.org/) — 路径规划与等时圈计算引擎
- [Leaflet](https://leafletjs.com/) — 轻量开源地图渲染库
- [OpenStreetMap](https://www.openstreetmap.org/) — 开源开放地理数据

---

## 许可证

[MIT License](./LICENSE) &copy; 2026 [kuhung](https://kuhung.me/about)
