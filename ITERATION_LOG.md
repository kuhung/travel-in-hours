# 迭代日志 (Iteration Log)

## 迭代记录：测试集消融与公开文档/文案现代化 (Test Ablation & Copy Modernization)

- **目标**：消融脆弱冗余的静态源码匹配测试用例；依照 `public-copy` 准则排查并消除 UI、提示与对外文案中的过度防御、自陈局限与不当外露；同步项目最新真实结构与技术模型，清理 README / CONTRIBUTING / ANALYTICS 中过时矛盾的描述。
- **实施亮点**：
  1. **测试用例消融（92项 -> 73项）**：彻底剔除 15 处使用 `fs.readFileSync` 暴力正则匹配源码的脆弱断言（覆盖 issue 7~13），消融理论推演测试与跨 issue 重复断言，全部保留核心拓扑几何、请求生命周期、状态机隔离与安全序列化测试。
  2. **公开文案去防御化**：消除了“并不代表没有生活设施”、“暂未接入详细检索”、“非第三方真实评分”等负面认错免责语境；转换为正面表达“基于路网模型实估生活圈”、“本地维护精选收录数据”，移除外露底部的上游接口标识与坐标系底层命名对比。
  3. **文档体系更新与矛盾消除**：
     - `README.md`：移除已过时的微信/微博/Twitter分享渠道说明、移除 ORS 40次/分免费配额等内部成本外露、移除未实现的商业化会员订阅规划；全面对齐珠海等 8 城精选支持及最新项目结构。
     - `CONTRIBUTING.md`：补全 `npm test` 验证规范，将历史北京地标示例纠正为收录城市（如广州珠江新城、上海东方明珠等），强化数据隐私最小化规范。
     - `ANALYTICS.md`：移除静态检查说明，校准测试集验证范围。
     - `CHANGELOG.md`：记录 `[Unreleased]` 文档与测试现代化条目。
- **验证**：`npm test` 73 项纯逻辑与契约测试 100% 通过（耗时 ~650ms）；`npx tsc --noEmit` 0 错误。
- **报告归档**：详见 `public-copy-audit-report.md`。

## 迭代记录：Issue #13 珠海数据契约接入与远端整合（总工单 #4）

- **任务编号**：[#13](https://github.com/kuhung/travel-in-hours/issues/13)（Parent [#4](https://github.com/kuhung/travel-in-hours/issues/4)）
- **目标**：完成珠海出入境智能服务厅专题数据（15 处大厅与 7 处预设起点）的单一数据集 Seam 接入，建立声明性多边形边界，排查更正上海专属文案与测试断言，吸收远端版本号注入与能力修复，规划 P2 批量扩充方案。
- **实施亮点**：
  1. `src/data/zhuhai-immigration-halls.ts`：15 处出入境大厅 WGS-84 坐标、原地址、服务时间、公交指引全量保真，稳定编号 `zh-imm-1`..`15`。
  2. `src/data/interest-points.ts`：将珠海数据接入 `getAllInterestPoints`（共 23 处地点）与 `CURATED_REGIONS`（声明性覆盖多边形 `[113.10..113.70, 21.85..22.45]`，不伪称精确行政边界）；`category` 保持 `other`，无虚假 5 星推荐；`getInterestPointsByCity` 兼容珠海别名。
  3. 纯空间几何契约：`queryInterestPoints` 严格基于 WGS-84 等时圈多边形筛选候选点，不依赖起点的 `city` 字段或粗 bbox 判断可达性；地图渲染时通过 `wgs84ToGcj02` 进行单次 GCJ-02 转换。
  4. 全局文案纠偏：`exploration-state.ts` 搜索无结果说明直接从 `cities` 派生（8 城：上海、杭州、广州、深圳、成都、绍兴、重庆、珠海，消除历史北京错误）；`layout-utils.ts` 与 `poi-utils.ts` 真实表达上海与珠海覆盖；`POIListPanel` 在全为出入境大厅时特异化标题为“可达出入境服务厅”，混合与通用场景保留通用标题，避免统称“签注机”。
  5. 远端能力吸收：确认 d368e14 瓦片跨域、`ensureRoundRect` 与 `canvasToBlob` 已由 #10 等价吸收；集成 `NEXT_PUBLIC_GIT_SHA` 注入、`VersionBadge` 版本徽章展示及 `sitemap.ts` 日期更新；未恢复已被远端撤销的独立地图页面。
- **验证**：`tests/issue-13.test.mjs` 新增 10 项测试，全量 `npm test` 92 项测试全部通过；`npx tsc --noEmit` 0 错误；定向 eslint 0 错误；`git diff --check` 无空白告警。
- **未验证边界**：营业时间、公交线路及近似路段定位未作实时/实地核验；P2 批量 POI 录入与用户报错入口按方案规划记录，待用户决策，本轮未实施新采集接口。
- **详细记录**：[docs/dev-reports/issue-13.md](./docs/dev-reports/issue-13.md)。

## 迭代记录：Issue #12 旅程事件口径（总工单 #4）

- **目标**：区分主动、示例、分享访问，避免 API 成功、hover、恢复动作和保存发起被当成有效价值或用户级转化。
- **实现**：统一 schema v2 及属性白名单；纯生命周期对象防止重复终态和重复选中。ready 等待 committed 范围与地点查询确认，POI 查询失败为独立终态。地图、列表及详情接入相同上下文。
- **隐私**：不上传坐标、名称、地址、POI ID、自由文本错误或关联标识；Vercel beforeSend 与既有 GA 页面配置去除分享 query/hash。服务端 429 停止推定每日配额耗尽。
- **分享**：保留复制成功与卡片生成已有事件；新增下载/原图打开动作事件及接收去重。当前无渠道按钮，无渠道点击数据。
- **验证**：完整测试 82 项通过（#12 新增 7 项）；类型、定向 ESLint 和 diff 检查通过，layout 原生 GA script 有 1 项既有建议警告。mock 无生产上传，#5 坐标断言按新隐私契约更新。
- **边界**：未部署、未检查生产入库或浏览器运行时；事件比率不称为用户级转化。详见 ANALYTICS.md 与 docs/dev-reports/issue-12.md。

## 迭代记录：Issue #11 分享接收与地点恢复（总工单 #4）

- **目标**：消费既有分享 payload，恢复一次探索及其稳定地点 ID，支持接收者切换自己的探索和显式返回原分享。
- **契约变更**：URL 序列化收敛到 `src/lib/share-params.ts`；解析校验有限坐标、重复字段、文本、方式、固定三档范围和地点 ID。历史非三档 range 显式提示后重新计算。预设匹配增加坐标条件，避免名称覆盖发送坐标或绕过自定义配额。
- **数据消费**：恢复 POI 通过当前结果的 `queryInterestPoints` 解析；缺失或范围变化仅放弃地点选择，保留可用起点与几何结果。本轮未变更本地 POI 数据、几何包含算法或坐标转换。
- **生命周期**：一次性可取消调度适配 StrictMode；自动初始化消费后不因失败重新触发。显式重看和手动重试复用恢复路径；分享入口停用后台地标批量预加载。定位动作取消在途恢复，晚响应失效。
- **验证**：`tests/issue-11.test.mjs` 新增 9 项测试，完整测试 75 项通过；类型、定向 ESLint、diff 空白检查通过。真实收录地点完成 payload → URL → 几何查询 → 同一地点 ID 的离线测试。
- **未验证**：无浏览器/真机操作，React 与 Leaflet 的运行时视觉表现、真实定位权限、扫码及线上接口链路待用户验收。工单保持开启。
- **详细记录**：[docs/dev-reports/issue-11.md](./docs/dev-reports/issue-11.md)。后续 #12 指标归因与 #13 珠海数据整合独立推进。

## 迭代记录：Issue #6 地点数据与几何计算接口（总工单 #4）

- **任务编号**：[#6](https://github.com/kuhung/travel-in-hours/issues/6)（Parent [#4](https://github.com/kuhung/travel-in-hours/issues/4)）
- **交付目标**：交付纯数据与几何计算接口、类型定义与确定性单元测试，解耦起点 city 字符串依赖，建立声明性收录边界与局限说明，对齐 WGS-84 代码包含契约，修复几何拓扑重叠缺陷。本单不修改 UI 集成（留待 #8 消费）。
- **主要交付项**：
  1. `src/lib/geo-utils.ts`：唯一几何算法引擎（射线法、孔洞排除、MultiPolygon、真跨立相交、内部采样探测、外闭内开边界策略、几何重叠度评估）。修复了相同多边形误判 partial、孔洞未收录覆盖误判 full、MultiPolygon 后续分块漏判、以及 identical donut / identical concave（含旋转、反向）误判 none 等缺陷。
  2. `src/lib/poi-utils.ts`：唯一生产地点分组与查询入口，直接复用唯一几何引擎与数据源，彻底收敛内部重复代码，交付 `queryInterestPoints`。
  3. `src/data/interest-points.ts`：唯一收录数据源，手工粗略定义 `SHANGHAI_CURATED_REGION` 本轮声明性维护边界多边形，提供 `getAllInterestPoints`，保留 `getInterestPointsByCity` 兼容。
  4. `src/types/index.ts`：定义 `CoverageStatus`, `CoverageOverlap`, `CuratedRegion`, `POIQueryResult` 等共享类型（收敛冗余派生字段）。
  5. `tests/issue-6.test.mjs`：包含 15 项几何与业务纯函数单元测试（含针对 4 个几何缺陷及 4 种边界拓扑的高阶用例），全量跑通。
  6. `docs/dev-reports/issue-6.md`：详细实施架构、坐标契约与未核验声明、接口契约、使用示例及简化方案评估交接报告。
- **状态与后续**：#6 纯数据接口交付完成，等待父级复核与后续 #8（结果 IA 与 UI 集成）进行消费。
