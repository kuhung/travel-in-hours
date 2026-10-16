# Issue #7 实施报告与起点入口及能力承诺交接文档（修订版）

所属总工单：[#4](https://github.com/kuhung/travel-in-hours/issues/4)
子任务工单：[#7](https://github.com/kuhung/travel-in-hours/issues/7)
依赖：#5（状态分离与请求生命周期）
分支：`feat/issue-5-result-state`
关联提交：未提交（按交付约定保留在工作区）

---

## 1. 目标与背景

在原有实现中存在以下入口断点与承诺脱节问题：
1. **时间能力与对外承诺脱节**：页面 metadata、OG/分享文案、JSON-LD 以及 README 中曾宣传“1–3 小时”，但底层系统配置与 OpenRouteService 驾车接口实际固定为 15、30、60 分钟（即 1 小时内）。
2. **首次访问定时器竞争**：`WelcomeGuide` 弹层与首次访问自动演示均硬编码约 1500ms 延迟，导致用户未操作时后台自动发起未标记的查询，并与弹层抢夺焦点与网络。
3. **定位生命周期分散与取消不全**：定位逻辑曾分散在 App 与 CitySelector 两套独立实例中。当引导弹层触发定位等待时，用户改选示例、在地图选点、关闭弹层或恢复原条件，旧定位未被统一取消，晚返回会覆盖新状态并发起未请求的查询；CitySelector 内部取消时未重置 loading 导致按钮永久卡在“定位中”。
4. **埋点来源错误归因**：分析事件分发曾简单以 `isCustom` 二分，导致 `current-location` 浏览器定位与示例体验均错误触发 `preset_analysis_*` 预设分析事件。
5. **小屏结果模式丢失示例身份**：结果工具栏的示例标签曾置于 `hidden sm:flex` 容器内，移动端视口下无示例标识。
6. **搜索与错误体验缺失**：搜索未说明 7 城数据收录范围，无匹配仅为空白列表；定位失败弹出阻塞式 `alert()`。

本工单彻底重整起点入口与首次引导，建立统一的定位生命周期架构与来源契约，对齐一小时产品承诺，并为后续 #8（结果 IA）与 #11（分享恢复）提供可消费的接口。

---

## 2. 事实依据与生产规则

依据源代码核对的事实基准如下：

| 功能 / 规则 | 源代码出处 | 生产事实与约束 |
|-----------|-----------|--------------|
| 固定可达档位 | `src/data/isochrone-config.ts` | 严格固定为 `[15, 30, 60]` 分钟（即 1 小时以内），不具备 2 小时或 3 小时等时圈计算能力。 |
| 坐标网格对齐 | `src/lib/grid.ts` | 采用 500 米网格（`CELL_SIZE = 500`），将坐标对齐至网格中心以提高缓存复用率。 |
| 出行方式折扣 | `src/lib/ors-client.ts` | 实际请求秒数应用经验折扣：驾车 0.8、骑行 0.7、步行 0.6，并在结果返回时还原显示秒数。 |
| 每日配额扣减 | `src/lib/exploration-state.ts` | 仅当 `isCustomLandmark(landmark)`（即 `id.startsWith('custom-')`）为真、未命中缓存、请求成功且有效 features > 0 时扣除 1 次配额；浏览器定位（`id: 'current-location'`）与预设地标不扣除配额；缓存与失败不扣除配额。 |
| 预设城市地标 | `src/data/landmarks.ts` | 本地收录 7 座城市（上海、北京、广州、深圳、杭州、成都、重庆）核心交通枢纽与地标，非全国任意地址 POI 检索。 |

---

## 3. 前后行为变化与关键修复

### 3.1 统一定位生命周期架构（收敛单 Owner）
- **修复前**：App 与 CitySelector 各自维护局部 tracker。App 的 `handleStartPicking`、`handleViewExample`、`handleDismissWelcome`、`handleCancelChanges` 以及 `CitySelector.onSelect` 均不取消定位。用户在引导层点击定位后改点上海示例，晚返回定位会覆盖示例并强行重新查询；CitySelector 内部取消未置位 `isLocating(false)`，按钮卡在定位中。
- **修复后**：
  - 生产代码在 `src/lib/exploration-state.ts` 建立 `GeolocationLifecycleManager`，收敛为 App 单一 owner；
  - `CitySelector` 彻底移除私有 tracker 与私有 loading 状态，通过 props 透传 `isLocating`、`locatingError` 与 `onRequestLocation`；
  - **全入口覆盖取消**：
    1. 切换/选择预设地标（`handleSelectLandmark`）立即 `cancelGeolocation()`；
    2. 进入地图选点模式（`handleStartPicking`，无论是面板内部还是外部入口）立即 `cancelGeolocation()`；
    3. 取消选点或确认选点（`handleCancelPicking` / `handleConfirmCandidate`）立即 `cancelGeolocation()`；
    4. 点击“先看上海示例”（`handleViewExample`）立即 `cancelGeolocation()`；
    5. 关闭/跳过首次引导（`handleDismissWelcome`）立即 `cancelGeolocation()`；
    6. 恢复原条件（`handleCancelChanges`）立即 `cancelGeolocation()`；
    7. 组件卸载立即 `cancelGeolocation()`。
  - **交互意图区分**：
    - 引导入口“从我的位置探索”标记 `autoGenerate: true`，成功后设置草稿并直接生成可达范围；
    - 编辑面板入口“定位当前位置”标记 `autoGenerate: false`，成功后仅更新草稿起点为当前位置，绝不自动提交生成，保留用户后续调整出行方式或时间的自由。

### 3.2 来源分类与分析事件归因纠正
- **修复前**：`handleGenerate` 仅靠 `isCustom` 进行二分，导致定位（`current-location`）与示例（`example`）均触发 `preset_analysis_started` 和 `preset_analysis_completed`。
- **修复后**：
  - 统一通过 `getExplorationSource(currentLandmark, isExample)` 计算来源（`custom` | `current-location` | `example` | `preset`）；
  - 定位探索触发 `current_location_analysis_started` 与 `current_location_analysis_completed`；
  - 示例探索触发 `example_analysis_started` 与 `example_analysis_completed`；
  - 传统预设地标严格维持历史 `preset_analysis_*` 事件，自定义选点严格维持 `custom_analysis_*` 事件；定位与示例绝不再污染预设指标。

### 3.3 小屏结果模式示例身份真实可见
- **修复前**：`ResultToolbar` 中的示例标签位于 `hidden sm:flex` 区域，移动端宽度（<640px）下完全隐藏。
- **修复后**：在 `ResultToolbar` 移动端视图中增加直接可见的示例标签（`sm:hidden px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded`），在手机屏幕结果模式下清晰可见；当用户在控制面板修改草稿起点但未重新生成前，已提交快照保持不变，移动端与桌面端均维持示例标签显示。

### 3.4 首次访问无自动查询与分享访问时序保护
- 删除 1500ms 演示定时器。清空本地存储后页面仅显示引导，未操作绝不发起静默网络请求或自动申请定位；
- 提供 `isShareVisitUrl()` 同步 URL 参数判定函数，配合 `useShareParams` 时序，分享访问在首次挂载时直接跳过通用引导，避免弹层闪现与定位抢跑。

### 3.5 预设地标搜索无匹配与定位异常恢复
- 搜索无匹配时输出诚实说明（“未在已收录的 7 座城市预设地标中找到...”），并提供“在地图上选点”与“定位当前位置”快捷替代操作；
- 搜索输入框集成 IME 拼音输入法回车防误触（`isComposing`）；
- 定位拒绝、超时、位置不可用或浏览器不支持时，以内联卡片提供解释与恢复出口（重试定位、在地图选点），不调用阻塞式 `alert()`，保留原有探索结果。

### 3.6 全局对外承诺与估算透明化
- 全局收敛 Metadata、OG 图片、分享文案、README 中的宣传口径至固定 15 / 30 / 60 分钟（1小时内）；
- 操作按钮文案调整为动宾短语“查看可达范围”与“更新可达范围”；
- 在生成按钮上方明确卡片展示固定三档，如实披露 500 米网格对齐与驾车 80%、骑行 70%、步行 60% 折扣计算估算模型。

---

## 4. 与 #5 接口的衔接

本工单基于 #5 确立的状态与请求管理契约进行扩展，未破坏原有任何接口：
1. **快照扩展**：在 `CommittedSnapshot.conditions` 中增加可选的 `isExample?: boolean` 与 `source?: ExplorationSource` 字段，向后完全兼容；
2. **草稿隔离**：保持 `hasPendingChanges` 契约不变，草稿变更（`draftLandmark` 改变）即刻产生 pending 状态，不改变 committed 快照中的 `isExample` 与 `source` 描述；
3. **配额核算**：继续使用 `evaluateQuotaDeduction`，严格确保 `current-location` 来源不扣除配额，仅 `custom-*` 扣除；
4. **请求失效**：继续连通 `IsochroneRequestManager.cancel()` 与应用级 `activeRunIdRef`，当重置或切换时取消在途等时圈计算。

---

## 5. 验收项与测试证据

全量通过 33 项自动化单元测试（23 项历史继承 + 10 项新增定向测试），全矩阵无失败：

| 工单验收项目 | 满足状态 | 验证方法与自动化测试凭据 |
|------------|---------|------------------------|
| 1. 清空本地记录后未操作不自动定位或自动开始默认查询 | 已满足 | 删除了 1500ms 演示定时器；`tests/issue-7.test.mjs` 测试 1 验证首访判定仅触发引导状态，无静默请求。 |
| 2. 查看示例后有示例标记，切换起点未更新旧标签仍描述旧结果 | 已满足 | `tests/issue-7.test.mjs` 测试 2 验证 committed 快照绑定 `isExample: true`，在草稿变化但未重新生成期间快照与示例标签保持不变。 |
| 3. 小屏手机结果模式真实展示示例身份 | 已满足 | `ResultToolbar.tsx` 在小屏下提供直接渲染的示例标识；测试 2 验证草稿修改不丢失旧结果示例身份。 |
| 4. 统一定位生命周期，全入口覆盖取消，不卡 loading | 已满足 | `tests/issue-7.test.mjs` 测试 5 全路径验证生产控制器：示例、选点、预设切换、恢复原条件、关闭引导、组件卸载均可靠废弃晚返回定位，结束 loading。 |
| 5. 定位与示例不误算为预设来源，事件口径独立归因 | 已满足 | `tests/issue-7.test.mjs` 测试 3 验证 `current-location` 来源为 `'current-location'`；测试 8 验证定位发 `current_location_analysis_*`，示例发 `example_analysis_*`，绝不发 `preset_analysis_*`。 |
| 6. 定位成功/拒绝/超时有明确后续操作，不清空原结果 | 已满足 | `tests/issue-7.test.mjs` 测试 6 验证各种定位错误码返回正确解释与替代出口，保留已有 committed 结果。 |
| 7. 地标搜索无匹配显示诚实解释与替代操作 | 已满足 | `tests/issue-7.test.mjs` 测试 7 验证无匹配输入输出 7 城收录范围解释与选点/定位替代出口。 |
| 8. 固定三档在生成前即可理解，按钮描述用户动作 | 已满足 | 控制面板生成按钮前展示固定 15/30/60 分钟卡片及 500m 网格与折扣估算说明，按钮文案为“查看可达范围”/“更新可达范围”。 |
| 9. 各入口不再承诺未提供的 3 小时能力 | 已满足 | `tests/issue-7.test.mjs` 测试 9 与测试 10 静态检索 `layout.tsx`、`opengraph-image.tsx`、`share-utils.ts`、`README.md`，确认 3 小时夸大承诺已彻底清理。 |
| 10. 原配额策略严格保持 | 已满足 | `tests/issue-7.test.mjs` 测试 4 验证仅 `custom-*` 扣次，`current-location` 与 `preset` 绝不扣次。 |

---

## 6. 用户后续检查步骤

在具备 Node 环境的工作区中，可执行以下命令独立核对：

1. **运行全量自动化测试**（验证 33 项用例通过）：
   ```bash
   npm test
   ```
2. **运行 TypeScript 严格类型检查**（验证 0 错误）：
   ```bash
   npx tsc --noEmit
   ```
3. **运行修改文件的代码风格检查**：
   ```bash
   npx eslint src/components/App/IsochroneApp.tsx src/components/Controls/CitySelector.tsx src/components/Controls/ResultToolbar.tsx src/components/UI/WelcomeGuide.tsx src/lib/exploration-state.ts src/lib/share-utils.ts src/app/layout.tsx src/app/opengraph-image.tsx src/data/isochrone-config.ts src/data/landmarks.ts
   ```
4. **运行 Git 格式与空白检查**：
   ```bash
   git diff --check
   ```
5. **静态检索 3 小时宣传文案残留**：
   ```bash
   grep -rnE "1[-–至]3\s*小时|3\s*小时" src/app/layout.tsx src/app/opengraph-image.tsx src/lib/share-utils.ts README.md
   ```
   应无匹配（仅 ORS 说明表格中的上游限制提及 1/5/20 小时）。

---

## 7. 限制与边界说明

1. **未接入任意地址地理编码**：预设地标搜索范围限定在本地声明的 7 座城市核心地标，未接入高德/百度等第三方地址检索接口。超出 7 城的地址需引导用户通过“在地图上选点”或“定位当前位置”进行探索。
2. **等时圈为路网工程估算**：等时圈基于 OpenRouteService 路由模型，并叠加了 500 米网格对齐与经验折扣（驾车 80%、骑行 70%、步行 60%），不代表实时交通路况。
3. **分享恢复与完整指标**：本单预留了同步判定分享链接并跳过通用引导的接口，完整的 URL 参数双向往返由后续 #11（分享恢复）统一交付；完整的分析事件指标体系与数据漏斗口径由后续 #12 统一完善。
4. **POI 筛选未接入 App**：#6 交付的 `queryInterestPoints` 纯数据函数维持隔离状态，未在本单接入主视图，该集成属于后续 #8（结果 IA）。
