# 更新日志 (Changelog)

本项目遵循简明更新日志记录规范。

## [Unreleased] - Issue #19

### Fixed
- 同一起点切换出行方式并更新结果时，按成功快照编号重建 GeoJSON 圈层及弹窗，避免复用旧几何。
- 缓存键排序不再修改传入的时间条件；补充真实缓存与三种方式独立扣次的行为测试。

核查与验证记录见 `docs/travel-in-hours-facts-2026-10-16.md`。配额规则和界面文案保持原样。

## [Unreleased] - Quality & Copy Modernization

### Removed
- **测试消融（Ablation）**：彻底移除 15 项依赖 `fs.readFileSync` 扫描源码的脆弱静态审查测试，消融 4 项脱离业务的纯理论公式推演与重复用例，测试集精炼收敛至 73 项高质量行为级确定性测试，全量平稳通过。
- **过度防御与不当外露清理**：依据 `public-copy` 规则重构 `README.md`，删除上游免费配额限制表、微观网格参数、内部敏捷工单 Review 外链及未实现的商业化规划；消除“不捏造虚假评分”、“非实时路况承诺”等防御性否定句式。

### Changed
- **引导与交互文案优化**：全面更新 `layout-utils.ts`、`exploration-state.ts`、`navigation-utils.ts` 与 `WelcomeGuide.tsx`，将“认错道歉式自陈局限”转变为正面清晰的操作指引，复制文本移除专业坐标系内部名称对比，提升最终用户体验。
- **项目文档对齐**：更新 `README.md` 与 `CONTRIBUTING.md` 目录树与技术选型，消除“微博/Twitter/微信分享”等历史已废弃组件与渠道的过时矛盾描述，将 `npm test` 纳入正式贡献验证流程。

## [Unreleased] - Issue #13

### Added
- 珠海出入境智能服务厅专题数据接入（`zhuhaiImmigrationHalls` 15 处记录保真，WGS-84 原生坐标，稳定编号 `zh-imm-1`..`15`）。
- 单一数据集 Seam（`src/data/interest-points.ts`）：新增 `zhuhaiImmigrationInterestPoints`、`ZHUHAI_CURATED_REGION` 本地声明范围多边形，`CURATED_REGIONS` 扩充为上海与珠海双区域声明；`getAllInterestPoints` 收敛为 23 处地点。
- `VersionBadge` 组件与 `next.config.ts` 的 `NEXT_PUBLIC_GIT_SHA` 注入，`sitemap.ts` 日期对齐远端。
- `tests/issue-13.test.mjs`：10 项确定性单元测试，覆盖 15 记录与 7 起点保真、最小圈层归属、四态覆盖、三种起点一致性、纯空间几何筛选、WGS-84/GCJ-02 单次渲染转换、珠海分享往返恢复及远端能力核对。

### Changed
- 全局排查并更正上海专属文案：`exploration-state.ts` 预设城市提示改由 `cities` 派生（8 城市，纠正历史北京笔误并纳入绍兴与珠海）；`layout-utils.ts` 与 `poi-utils.ts` 收录状态解释真实表达上海与珠海覆盖。
- `POIListPanel` 专题标题特异化：全为出入境大厅结果时呈现“可达出入境服务厅”专题标题与数量，跨城混合及常规文旅保留通用热点清单标题，避免泛化为签注机。
- 历史测试契约更新：#6 地点总量（23）、#7 预设城市（8 城）、#8 收录文案断言平稳升级，保留既有空间几何回归。

### Changed
- 使用 schema v2 聚合事件区分主动、示例及分享探索；在有效状态确认后记录结果、地点选择和导航出口点击。
- 分享复制、卡片生成、保存发起与接收打开分别计数；更新 ANALYTICS.md 的尝试级与事件比率定义。
- 客户端埋点改用属性白名单，页面 URL 清理分享参数；429 仅保留可证实的限流诊断。

## [Unreleased] - Issue #11

### Added
- 分享接收端恢复起点、方式、固定三档范围及有效地点，提供显式重看、定位探索与手动选点入口。
- URL 参数边界、历史范围说明、地点失效回退及一次性初始化测试。

### Fixed
- 分享参数不再仅按地标名称匹配预设坐标；自定义分享继续遵守原配额规则。
- 分享失败不自动重试，接收端跳过批量后台预加载；错误及空数据重试保留原分享地点。

## [Unreleased] - Issue #6

### Added
- **空间几何检索接口**：新增 `queryInterestPoints` 生产纯函数，完全基于结果地理多边形筛选候选地点，不再依赖起点的 `city` 显示字符串。
- **结构化收录覆盖评估**：提供 `matched`（覆盖内有匹配）、`covered-empty`（覆盖内无匹配）、`uncovered`（未收录区域）、`partial`（部分覆盖/跨越边界）四态结构化状态及收录说明。
- **声明性收录范围**：明确定义本地数据维护覆盖区域 `SHANGHAI_CURATED_REGION` 及人工粗略声明多边形，如实声明为本地维护数据，不伪称全国检索或精确行政测绘边界。
- **稳健几何计算能力**：支持 GeoJSON Polygon 孔洞（内环）排除、MultiPolygon 跨陆块归属、外边界闭区间包含与孔边界开区间排除策略，修复重合边界误判与孔洞未收录覆盖检测。

### Fixed
- **几何重叠拓扑缺陷修复**：重构 `evaluateGeometryOverlap`，引入沿边中点法向微步探测内部采样算法（`findInteriorSamples`），消除对顶点算术均值（重心）的脆弱依赖，彻底修复 `identical donut` 与 `identical concave`（含首点旋转、环方向反转）误判为 `none` 的缺陷；支持源与目标共享孔洞时正确判定为 `full`。
- **代码坐标系契约对齐**：修正历史实现中将 WGS-84 POI 点单侧转换为 GCJ-02 再与 WGS-84 等时圈比较的代码逻辑错误，消除代码内部约 450 米的算法偏移（不代表真实地点测绘校准）；仅在输出给地图渲染层（`position`）时转换为 GCJ-02 `[lat, lng]`。

### Changed
- **单一代算法与数据源收敛**：删除多余重复代码，收敛 `geo-utils.ts` 与 `coord-transform.ts` 为唯一算法来源，`interest-points.ts` 为唯一数据来源。
- **契约精简与地点去重**：精简 `POIQueryResult` 冗余派生字段；输入 POI 自动按稳定 `id` 去重，每点严格按时间升序归入其最小可达圈层。`rating` 字段维持本地人工推荐指数语义。
