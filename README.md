# 🗺️ 出行可达地图 (Travel Reach Map)

基于 OpenRouteService 实时交通数据，查看从城市地标出发指定时间内可达的区域。

![Preview](https://via.placeholder.com/800x400/0f172a/10b981?text=Travel+Reach+Map)

## ✨ 功能特点

- 🚗 **多种出行方式**: 支持驾车、骑行、步行
- ⏱️ **灵活时间范围**: 15分钟到3小时可达范围
- 🏙️ **预设城市地标**: 覆盖中国各大城市核心地标
- 📍 **自定义位置**: 点击地图任意位置设置出发点
- 🔗 **分享功能**: 一键分享到社交媒体
- 📱 **响应式设计**: 完美适配移动端和桌面端

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 配置环境变量

1. 复制环境变量模板:
```bash
cp .env.example .env.local
```

2. 在 [OpenRouteService](https://openrouteservice.org/dev/#/signup) 注册并获取 API Key

3. 编辑 `.env.local`:
```env
ORS_API_KEY=your_api_key_here
# 可选：指定应用 URL，默认自动识别
# NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 📦 部署到 Vercel

### 方式一: 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kuhung/travel-in-3hours&env=ORS_API_KEY,NEXT_PUBLIC_APP_URL)

### 方式二: 手动部署

1. Fork 本仓库
2. 在 Vercel 中导入项目
3. 配置环境变量:
   - `ORS_API_KEY`: OpenRouteService API Key
   - `NEXT_PUBLIC_APP_URL` (可选): 你的应用 URL，用于生成分享链接等

## 🏗️ 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS 4
- **地图**: React Leaflet + Leaflet
- **API**: OpenRouteService Isochrones API

## 📁 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   └── isochrones/    # 等时圈 API
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 首页
├── components/            # React 组件
│   ├── App/              # 主应用组件
│   ├── Auth/             # 认证组件（预留）
│   ├── Controls/         # 控制面板组件
│   ├── Map/              # 地图组件
│   └── UI/               # 通用 UI 组件
├── data/                  # 静态数据
│   ├── landmarks.ts      # 城市地标数据
│   └── isochrone-config.ts # 等时圈配置
├── hooks/                 # 自定义 Hooks
├── lib/                   # 工具库
│   ├── auth.ts           # 认证模块（预留）
│   └── ors-client.ts     # ORS API 客户端
└── types/                 # TypeScript 类型定义
```

## 🔮 未来规划

### v1.1 - 景点发现
- [ ] 集成高德/百度地图 POI 数据
- [ ] 显示可达范围内的徒步景点
- [ ] 景点评分和推荐

### v1.2 - 用户系统
- [ ] 用户登录 (微信/Google/GitHub)
- [ ] 保存自定义出发点
- [ ] 历史查询记录

### v1.3 - 商业化
- [ ] 会员订阅系统
- [ ] API 服务开放
- [ ] 企业批量分析

## 📊 API 限制

OpenRouteService 免费套餐限制:
- 驾车等时圈: 最多 1 小时
- 骑行等时圈: 最多 5 小时
- 步行等时圈: 最多 20 小时
- 每分钟请求数: 40 次

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License © 2025 [kuhung](https://kuhung.me/about)

## 🙏 致谢

- [OpenRouteService](https://openrouteservice.org/) - 路径规划 API
- [Leaflet](https://leafletjs.com/) - 开源地图库
- [OpenStreetMap](https://www.openstreetmap.org/) - 地图数据
