# #13 珠海数据契约接入与远端整合报告

所属总工单：[#4](https://github.com/kuhung/travel-in-hours/issues/4) | 子单：[#13](https://github.com/kuhung/travel-in-hours/issues/13)  
分支：`feat/issue-5-result-state` | 基线：`015ca87` | 远端 HEAD：`d368e14`  
改动状态：未提交（全部以工作区未暂存状态保全）  

---

## Executive View

- **状态**：P1 珠海数据契约接入、单一 Seam 集成、全局文案纠偏、远端能力整合及回归测试已完成，工单保持开启等待验收；#5–#12 变更完整保留。
- **结论**：珠海 15 处出入境服务厅与 7 处预设起点以 WGS-84 坐标接入单一数据源 `src/data/interest-points.ts`；新增 `ZHUHAI_CURATED_REGION` 声明多边形；`queryInterestPoints` 严格基于等时圈多边形筛选，杜绝粗 bbox 或城市名推断可达性；全局消除历史上海专属文案与预设城市笔误；吸收远端 Git 版本号注入与补丁；P2 方案规划待决策，未实现新采集接口。
- **关键路径**：数据保真 → 单一数据源 Seam → 空间几何筛选 → 覆盖四态评估 → POIListPanel 专题呈现 → 分享恢复验证。
- **待验证瓶颈**：15 处大厅营业时间、公交及近似路段定位未实地核验；高分屏长列表排版留待用户手动验收。
- **待决策**：P1 珠海整合属于总单 #4 交付与合并的必做前置；P2 批量 POI 扩充与反馈方案属于后续独立规划，不作为总单 #4 关单前置。待用户验收 #13 本地成果后推进 #4 收口。

---

## 1. 远端差异整合与处置表

| 远端提交 / 来源 | 远端变更内容 | 本地处置方案 (Disposition) | 状态 / 证据 |
|---|---|---|---|
| **d368e14**<br>`share-utils.ts`<br>`IsochroneMap.tsx` | 瓦片/图标 crossOrigin、`ensureRoundRect` 兼容、`canvasToBlob` 回退、`allowTaint: false`、`useCORS: true` | 本地已在 #10 统一分享架构中等价吸收并强化（离屏快照、瓦片就绪控制器、4096px 内存保护）；保持现有架构不回滚 | **已吸收保留**<br>`tests/issue-10.test.mjs` 测试 5 & 7；`tests/issue-13.test.mjs` 测试 10 |
| **112d753**<br>`landmarks.ts`<br>`interest-points.ts`<br>`IsochroneApp.tsx`<br>`POIListPanel.tsx`<br>`sitemap.ts` | 7 珠海起点、服务厅接入等时圈、撤掉独立专题页及对应 sitemap 条目、更新主站 sitemap 日期至 2026-09-26 | 7 起点全量吸收；珠海 POI 纯几何筛选；废弃粗 bbox；保持独立页撤销；sitemap 日期对齐 | **已重构集成**<br>`tests/issue-13.test.mjs` 测试 1–6、10 |
| **c1a4fcc** (祖先)<br>`zhuhai-immigration-halls.ts` | 录入 15 个珠海服务厅原始数据（地址、时间、WGS-84 坐标、公交） | 复制保全 15 条记录，稳定编号 `zh-imm-1`..`15`，注明继承来源与未核验，剔除旧 helpers | **已保全集成**<br>`tests/issue-13.test.mjs` 测试 1 |
| **c1a4fcc** (祖先)<br>`next.config.ts`<br>`VersionBadge.tsx` | Git 版本号注入、版本徽章组件 | 最小兼容合并至 `next.config.ts`；新增 `VersionBadge` 并在主应用挂载 | **已整合**<br>`tests/issue-13.test.mjs` 测试 10 |

---

## 2. 数据 Seam、几何筛选与交互适配

1. **数据 Seam 契约** (`src/data/interest-points.ts`)：
   - 15 处大厅映射为 `zhuhaiImmigrationInterestPoints`：稳定 ID `zh-imm-1`..`15`、WGS-84 原生坐标、`category: other`、无虚假 5 星评分（`rating: undefined`）。
   - 业务信息入 `description`：含地址、服务时间、公交指引与未实时核验提示，复制与卡片均可见。
   - `getAllInterestPoints` 返回 23 处（沪 8 + 珠 15）；`getInterestPointsByCity` 兼容珠海别名；保留 `getInterestPointsForLocation` 兼容。
2. **声明性覆盖多边形**：
   - 新增 `ZHUHAI_CURATED_REGION`（`113.10..113.70, 21.85..22.45`），声明为本地专题数据范围而非精确测绘边界。`CURATED_REGIONS` 扩为沪珠双区域。
3. **空间几何筛选与四态评估**：
   - 纯几何筛选：`queryInterestPoints` 基于原生 WGS-84 等时圈多边形计算，不依赖 `city` 字段或粗 bbox。渲染输出时由 `wgs84ToGcj02` 单次转为 GCJ-02。
   - 结构化四态：matched / covered-empty / uncovered / partial。预设、定位、地图选点三种起点在同坐标下输出完全一致。
4. **全局文案纠偏与 POIListPanel 特异化**：
   - `exploration-state.ts`：搜索无匹配说明从 `cities` 动态派生（8 城，更正历史北京笔误）。
   - `layout-utils.ts` / `poi-utils.ts`：更正为上海精选与珠海服务厅双区域。
   - `POIListPanel.tsx`：全为大厅时特异化为“**可达出入境服务厅**”；混合或常规文旅保留通用“**可达地点清单**”，避免统称“签注机”。

---

## 3. 验证证据与未核验边界

### 3.1 验证命令与保真复核证据
- **执行模型**：由 `antigravity/gemini-3.8-flash` 独立执行代码与数据契约整合。
- **父级逐字段深比较复核**：父级已读取实际源码及保存的测试日志（92/92 通过），并对 15 条大厅原始对象与 7 个珠海起点针对 fetched `112d753` 原记录进行了逐字段深度比较（deep comparison），确认名称、坐标、地址、营业时间、区划、公交及地标属性全部 100% 保真通过，无新增阻断。
- **自动化测试**：`npm test` 统计 **tests 92, pass 92, fail 0**（新增 `tests/issue-13.test.mjs` 10 项测试，更新历史 #6/#7/#8 断言，保留全部既有几何回归）。
- **静态类型与规范**：`npx tsc --noEmit` 0 错误；定向 `eslint` 0 错误 0 警告；`git diff --check` 0 告警。
- **说明**：上述测试属于 Node.js 离线纯函数与静态源码接线核验，未声明为真实浏览器端到端测试。

### 3.2 客观未核验边界
- **服务厅信息实地核验**：营业时间、公交线路及近似路段定位未作实时/实地勘测，已注明出行前核验。
- **声明性多边形局限**：珠海多边形仅表达维护边界，非标准行政区划测绘。
- **视觉排版**：未启动无头浏览器截图，真实高分屏排版留待用户手动验收。

---

## 4. P2 批量扩充与用户反馈待确认方案

按工单要求规划，本轮未实现新入口或数据采集：
1. **批量收录规范**：
   - 稳定 ID：`{city}-{category}-{slug/seq}`，发布后不可变；
   - 坐标契约：官方名录与合规 OSM 清洗，录入必须校验原生 WGS-84；
   - 空间去重：同城同类距离 < 50m 且名称相似度 > 80% 触发人工合并；
   - 维护成本：高价值专题优先，按确认批次更新，不无序膨胀。
2. **用户报错与线索评估**：
   - 形态：详情卡增设低权重“信息有误反馈”预设选项与简要输入；
   - **红线**：用户选点与搜索仅为需求热度信号，绝不直接当 POI；
   - 隐私边界：不采集个人身份与设备 ID，位置上报显式知情且优先粗粒度区县，不收集精确经纬度，文本去标识化。
3. **决策状态**：待用户与维护团队决策后另行立项。
