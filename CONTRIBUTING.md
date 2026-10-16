# 贡献指南 | Contributing Guide

感谢你对本项目的关注与支持。无论是报告缺陷、补充城市地标，还是优化算法与界面，我们都非常欢迎你的参与。

---

## 报告问题 (Issue)

提交 Issue 前请确认：

1. 已在现有 Issue 列表中搜索，避免重复提交；
2. 提供清晰的复现步骤、浏览器版本以及操作系统信息；
3. 如涉及路径计算或地图异常，请附上控制台报错信息（注意隐去个人敏感信息与私有密钥）。

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

### 开发与验证流程

```bash
# 1. 基于 main 分支创建功能分支
git checkout -b feat/your-feature-name

# 2. 本地开发与三重验证
npm run dev
npm run lint
npm test

# 3. 提交代码（遵循 Conventional Commits 规范）
git commit -m "feat: add new landmarks for Suzhou"

# 4. 推送并创建 PR
git push origin feat/your-feature-name
```

### Commit Message 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

| 类型 | 用途 |
|------|------|
| `feat` | 新增功能或数据 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `refactor` | 重构（不改变现有行为） |
| `perf` | 性能优化 |
| `test` | 补充或调整测试用例 |
| `chore` | 构建配置、依赖维护等 |

---

## 扩展城市地标数据

这是最受欢迎的轻量贡献方式。

在 `src/data/landmarks.ts` 中追加地标，格式如下：

```typescript
{
  id: 'city-landmark-name',        // 唯一 ID：城市拼音-地标英文，小写连字符
  name: '地标名称',
  city: '城市',
  province: '省份',
  coordinates: [120.585315, 31.298886],  // [经度, 纬度]，原生 WGS-84 坐标
  description: '地标简要描述',
}
```

坐标获取参考：
- [OpenStreetMap](https://www.openstreetmap.org/)：右键点击位置选择“显示地址/查询要素”，复制经纬度坐标
- [geojson.io](https://geojson.io/)：在地图上选点获取 `[lng, lat]` 坐标

---

## 代码与质量规范

- **类型安全**：TypeScript 严格模式，避免使用 `any`，核心数据结构统一维护在 `src/types/` 中；
- **测试守卫**：新增空间几何算法、URL 参数编解码或状态流转逻辑，必须包含确定性单元测试，且 `npm test` 全量通过；
- **隐私保护与埋点合规**：严格遵循 [ANALYTICS.md](./ANALYTICS.md) 的数据最小化契约，严禁向分析平台或日志打印用户原始坐标、详细地址等敏感信息，生产环境禁止遗留调试 `console.log`；
- **界面与样式**：统一采用 Tailwind CSS 4 工具类，保持组件小而专注。

---

## 联系与支持

- 作者：kuhung
- 邮箱：hi@kuhung.me
- 个人主页：[kuhung.me](https://kuhung.me/about)
