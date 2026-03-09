# 贡献指南 | Contributing Guide

感谢你对本项目的关注。以下是参与贡献的基本规范。

---

## 报告问题 (Issue)

提交 Issue 前请确认：

1. 已在现有 Issue 列表中搜索，避免重复
2. 提供复现步骤、浏览器版本、操作系统信息
3. 如涉及 API 错误，请附上浏览器控制台截图（注意隐去 API Key）

---

## 提交代码 (Pull Request)

### 环境准备

```bash
git clone https://github.com/kuhung/travel-in-3hours.git
cd travel-in-3hours
npm install
cp .env.example .env.local
# 编辑 .env.local，填入有效的 ORS_API_KEY
npm run dev
```

### 开发流程

```bash
# 1. 基于 main 分支创建功能分支
git checkout -b feat/your-feature-name

# 2. 开发并本地验证
npm run dev
npm run lint

# 3. 提交（遵循 Conventional Commits 规范）
git commit -m "feat: add new city landmarks for Beijing"

# 4. 推送并创建 PR
git push origin feat/your-feature-name
```

### Commit Message 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

| 类型 | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `refactor` | 重构（不影响功能） |
| `perf` | 性能优化 |
| `chore` | 构建配置、依赖升级等 |

---

## 扩展城市地标数据

这是最欢迎的贡献类型，门槛低，效果直接。

在 `src/data/landmarks.ts` 末尾追加地标，格式如下：

```typescript
{
  id: 'beijing-tiananmen',        // 唯一 ID：城市拼音-地标英文，小写连字符
  name: '天安门广场',
  city: '北京',
  province: '北京市',
  coordinates: [116.397128, 39.916527],  // [经度, 纬度]，WGS-84
  description: '北京市中心标志性广场',
}
```

坐标获取方式：
- [OpenStreetMap](https://www.openstreetmap.org/) 右键点击 → "查询要素"，复制经纬度
- [geojson.io](https://geojson.io/) 点击地图获取坐标

---

## 代码规范

- TypeScript 严格模式，不允许 `any`（必要时请加注释说明原因）
- 组件遵循单职责原则，状态提升到 `IsochroneApp`
- 新增核心逻辑必须包含关键路径日志（`console.log` 或 `track()`）
- 样式使用 Tailwind CSS 工具类，避免内联 style（OG 图片除外）

---

## 联系

- 作者：kuhung
- 邮箱：hi@kuhung.me
- 主页：[kuhung.me](https://kuhung.me/about)
