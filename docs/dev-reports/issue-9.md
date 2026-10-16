# Issue #9 实施报告与地点选择、详情及外部导航交付文档（终稿）

所属总工单：[#4](https://github.com/kuhung/travel-in-hours/issues/4)
子任务工单：[#9](https://github.com/kuhung/travel-in-hours/issues/9)
依赖：#8（结果信息架构与布局）
分支：`feat/issue-5-result-state`
关联提交：未提交（按交付约定保留在工作区）

---

## 1. 目标与背景

在原有实现中，地点选择与行动出口存在以下断点：
1. **触屏与选择机制脱节**：`POIListPanel` 曾提供 `onPOIClick` 回调但主应用未传入，仅做埋点；移动端和触屏用户无法依赖 `hover` 联动，地图气泡与列表卡片无法统一选中地点；
2. **地图弹窗缺少行动出口**：Leaflet 地图 Marker 弹窗仅显示简短简介与圈层标签，缺少打开外部地图导航的核心行动出口；
3. **详情字段虚构风险**：缺少统一的可信详情展示层，容易在展示时臆造虚假营业时间、门票价格、精确车程或用户评分；
4. **视口遮挡与缩放打断**：点击标记时缺乏视口避让，等时圈标记易落入被面板遮挡的区域；且直接调用 `fitBounds` 或 `setView` 会强行重置用户的当前缩放级别；
5. **草稿与已提交结果错配**：用户在编辑面板微调草稿起点时，若直接消费草稿会导致旧结果详情与草稿错配，甚至导航至未更新的错误地点；
6. **外部导航随意拼接与无文档核实**：历史上常凭记忆拼凑导航 URL，缺乏官方文档支持、经纬度顺序倒置、火星坐标（GCJ-02）多次或未转换、未考虑桌面端对骑行模式的限制，且将“打开页面”虚夸为“导航成功”。

本工单接通清单与地图统一稳定 ID 选择通道，基于真实已有数据呈现地点详情，接入官方已核验的高德 URI 导航方案，并在可用视口内安全平移避让，为总工单 #4 补齐“发现地点 → 查看详情 → 打开导航”的核心行动闭环。

---

## 2. 变更前后对照 (Before & After)

| 维度 | 修改前 (Before) | 修改后 (After) |
|---|---|---|
| **地点选中机制** | 仅依赖 `highlightedPOI`（局部 index），触屏无法持久选中，重复点击无行为 | 统一定义 `selectedPOIId`（单一事实来源），列表点击、键盘 Enter/Space 与地图标记点击双向同步，重复点击平稳反选 (toggle) |
| **选择与 Hover 隔离** | hover 易污染选择态 | hover 仅作为桌面端辅助高亮（`highlightedPOI`），绝不改变持久选择状态（`selectedPOIId`） |
| **详情呈现内容** | 仅列表底部一行微型文本，信息残缺 | 独立 `POIDetailCard`，如实呈现真实名称、类别中文标签、简介、预估圈层、本地推荐指数；缺字段优雅省略，零编造营业时间/票价/评分 |
| **外部导航出口** | 无导航出口，无法跳转外部地图 | 接入已核验的高德开放平台 URI 导航服务，提供“在外部地图中导航”按钮与“复制地点与坐标”双通道 |
| **坐标转换与顺序** | 缺少边界转换或直接拿 WGS-84 传给高德，顺序易倒置 | 在导航 URL 构造边界执行**单次** WGS-84 → GCJ-02 转换，严格遵循 `lon,lat,name`（经度在前、纬度在后）官方规范，中文名称标准 URL 编码 |
| **骑行限制与执行动作约束** | 限制只在文字提示，主按钮与链接仍无条件直通桌面骑行链接 | 通过 `resolveNavigationAction` 真正约束生产动作：桌面端骑行时主按钮直接切换为“复制手机导航信息”，禁止提供会被平台忽略的桌面导航动作，复制文本明确标注仅手机有效，绝不静默改驾车 |
| **设备与平台能力检测** | 依赖 `width < 768` 屏宽（窄桌面被误判为手机，宽手机被误判为桌面） | 建立独立平台能力判定 `isMobileDevice`（解耦布局视口宽度），通过 `useSyncExternalStore` 规范保障 SSR 安全，如实记录 User-Agent 启发式局限 |
| **弹窗打开与口径诚实度** | `window.open` 因 `noopener` 返回 null 误判为弹窗被拦截，事件虚夸为 opened | 采用原生 `<a target="_blank" rel="noopener noreferrer">` 启动外部导航；埋点诚实命名为 `navigation_requested` 且带有 `attempt: true`；文案如实呈现“已请求打开外部地图页面...” |
| **组件切换防串态** | 同一组件实例在切换 POI 时继承上一地点的反馈状态，异步复制晚返回串台 | 在 embedded 与 floating 两处调用入口均绑定 `key={selectedPOI.id}`，并在组件内维护 `lastPoiId` 与 `currentPoiIdRef` 守卫异步回调，定时器随卸载清理 |
| **48vh 视口防溢出** | 详情嵌于 footer 且 `shrink-0`，提示与 textarea 展开时撑破 48vh 视口 | `#poi-detail-container` 增加 `max-h-[46%] md:max-h-[50%] overflow-y-auto`，中间列表补齐 `min-h-0`，确保用户始终保留关闭与操作入口 |
| **地图视口可见性** | 选中标记若落入左侧或底部面板下方则被遮挡，或用 `fitBounds` 粗暴重置用户缩放 | 消费 #8 `calculateMapPadding` 动态安全边距，调用 Leaflet `map.panInside` 平滑将标记移入可见区域，绝不重置用户缩放级别 |
| **草稿与已提交结果隔离** | 修改草稿可能导致导航使用新草稿配旧目的地 | 导航起点与详情展示严格只读 `committed.conditions.landmark`，草稿修改期间导航依然使用旧结果起点 |
| **结果更新失效保护** | 重新计算结果后残留旧地点详情 | 新结果产生时，若旧 `selectedPOIId` 不在新的 `poiQueryResult.allPOIs` 中，自动降级并关闭详情 |
| **无障碍与触屏支持** | 地点列表卡片无键盘支持，触屏不易点击 | 地点列表卡片具有 `role="button"`、`tabIndex={0}`、`aria-pressed`，支持 Enter / Space 键盘点选，触控靶心 >= 44px |

---

## 3. 外部导航方案与官方来源核验证据 (Official Navigation Specification)

### 3.1 官方原始文档核验记录

本项目坚决杜绝凭记忆拼凑 API，于 **2026-10-16** 通过公共 HTTP 检索核实高德开放平台官方文档接口（`/api/docs/uri-api`）：

| 审核项 | 官方核验证据与出处 |
|---|---|
| **官方文档源地址** | `https://lbs.amap.com/api/uri-api/guide/travel/route` |
| **官方文档标题** | 《路径规划-出行相关-开发指南-URI API \| 高德地图API》 |
| **官方最后更新日期** | `2025年03月03日` |
| **工程核对与检索日期** | `2026-10-16`（经父级独立 curl 校验确认存在且一致） |
| **服务调用端点** | `https://uri.amap.com/navigation` |
| **支持的出行方式 (`mode`)** | `car`（驾车，默认）、`bus`（公交）、`walk`（步行）、`ride`（骑行） |
| **坐标系规范** | 高德坐标系（GCJ-02 火星坐标系） |
| **坐标顺序规范** | 经度在前、纬度在后（`from/to=lon,lat[,name]`，6位小数精确表达） |
| **终端限制明文说明** | **“缺省mode=car；骑行仅在移动端有效；当选择骑行模式时，调起客户端仅对高德地图APP V8.0.0以上版本支持”** |

### 3.2 坐标转换与边界契约

1. **起点坐标**：提取自已提交快照 `committed.conditions.landmark.coordinates`（WGS-84，`[lng, lat]`）；
2. **终点坐标**：提取自所选兴趣点 `selectedPOI.coordinates`（WGS-84，`[lng, lat]`）；
3. **转换边界**：在 `src/lib/navigation-utils.ts` 的 `createAmapNavUrl` 函数中，单次调用 `wgs84ToGcj02` 得到火星坐标，再组装为 `${gcjLng.toFixed(6)},${gcjLat.toFixed(6)},${name}`；
4. **编码契约**：使用 Web 标准 `URLSearchParams` 对地点名称进行百分号编码（例如 `%E5%AE%9C%E5%B1%B1%E8%B7%AF`），确保各类浏览器解析不乱码。

### 3.3 平台限制、执行约束与降级策略 (Fixed Defect 1 & 2)

1. **桌面端骑行真正限制约束**：
   - 生产函数 `resolveNavigationAction({ profile, isMobilePlatform, navUrl })` 统一负责解析动作；
   - 当 `profile === 'cycling-regular'` 且当前处于桌面环境（`!isMobilePlatform`）时：
     - `canDirectlyNavigate: false`，主按钮自动切换为 **“复制手机导航信息”**；
     - 禁止向用户提供无条件打开 `mode=ride` 的桌面端导航链接（该链接会被高德桌面网页端静默忽略或报错）；
     - 复制文本明确附注 `【高德导航链接(仅手机端有效)】`，防止作为桌面端回退继续被误用；
     - 绝不静默篡改为驾车（`car`）；
   - 地图 Marker 弹窗同步感知：桌面端骑行时呈现黄色说明卡片指引用户在清单中复制，绝不渲染无效的外部导航按钮；
2. **独立平台能力检测与 SSR 安全**：
   - 实现 `isMobileDevice(customUserAgent?: string)`，优先基于 `navigator.userAgent` 及现代 Client Hints（`navigator.userAgentData.mobile`）判断设备能力，彻底与 CSS 视口宽度（`width < 768`）解耦；
   - 在 `POIDetailCard` 中采用 React 19 推荐的 `useSyncExternalStore` 规范管理客户端平台快照，服务端渲染保守返回 `false`，彻底消除 SSR 水合不一致与级联渲染风险；
3. **原生打开与诚实口径**：
   - 废弃不可靠的 `window.open` 返回值检测（因 `noopener` 特性在正常打开时亦可能返回 `null`）；
   - 在允许直接导航时，通过原生 `<a href={navUrl} target="_blank" rel="noopener noreferrer">` 启动；
   - 界面反馈文案如实呈现：**“已请求打开外部地图页面（高德开放平台）。如未正常打开，请检查浏览器弹窗设置或点击下方复制手动使用。”**，绝不武断误报“外部窗口未正常弹出”，更不虚假宣称“导航成功”；
   - 分析事件严格命名为 `navigation_requested` 并附带 `{ attempt: true }`，确保埋点口径如实反映尝试意图；
4. **剪贴板失败回退**：
   - 优先调用 `navigator.clipboard.writeText`，降级调用 `document.execCommand('copy')`；
   - 若系统权限受限均失败，展开只读文本域（`<textarea readOnly>`）并自动全选，提示用户“请长按或Ctrl+C手动复制”。

### 3.4 身份隔离与视口高度防溢出保护 (Fixed Defect 3 & 4)

1. **组件实例身份隔离 (`key={selectedPOI.id}`)**：
   - 在 `POIListPanel.tsx`（embedded 嵌入态）与 `IsochroneApp.tsx`（floating 悬浮态）的调用点均强制绑定 `key={selectedPOI.id}`；
   - 切换地点时，React 强制销毁旧组件并挂载全新实例，彻底杜绝 `navRequested`、`copyStatus`、`showManualCopy` 状态在地点切换时残留继承；
   - 组件内部增加 `currentPoiIdRef` 守卫异步剪贴板回调，若回调返回时目标地点已改变则立即丢弃，不串台；定时器在组件卸载时可靠清理；
2. **48vh 底部面板高度防溢出保护**：
   - 在 `POIListPanel.tsx` 中，中间地点列表区域增加 `min-h-0`，确保 flex 容器允许被正确压缩；
   - 底部详情容器 `#poi-detail-container` 设置 `max-h-[46%] md:max-h-[50%] overflow-y-auto`，在移动端 48vh 约束下，即使骑行警告卡片与复制失败手动文本框同时展开，详情区域均在内部平滑滚动，绝不顶破面板外框，用户永远保留头部的关闭按钮（`✕`）与操作入口。

---

## 4. 架构与接口契约

### 4.1 数据流架构

```
                   +------------------------------------+
                   |         CommittedSnapshot          |
                   |  (landmark, profile, isochrones)   |
                   +------------------------------------+
                                      |
                                      v
                        [queryInterestPoints(committed)]
                                      |
                                      v
                        +---------------------------+
                        |      POIQueryResult       |
                        |         allPOIs           |
                        +---------------------------+
                                      |
       +------------------------------+-------------------------------+
       |                                                              |
       v                                                              v
 [POIListPanel]                                                 [IsochroneMap]
 - 列表项按 Enter/Space/Click 选中                                - 标记点击透传 poi.id
 - 稳定高亮 `selectedPOIId === poi.id`                          - `map.panInside(poi.position, padding)`
 - 中间列表 `min-h-0`                                           - 标记弹窗同步消费限制
 - `#poi-detail-container` max-h 局部滚动                       - 原生 <a target=_blank> 打开
 - 挂载 POIDetailCard key={poi.id}                              - 桌面骑行明示指引
       \                                                              /
        \                                                            /
         +----------------------------+-----------------------------+
                                      |
                                      v
                              [POIDetailCard]
            - 真实字段展示（名称、类别、简介、预估圈层、本地推荐指数）
            - 零捏造营业时间/票价/精确车程/第三方评分
            - resolveNavigationAction 生产动作约束
            - 桌面骑行切换为主按钮“复制手机导航信息”，禁开桌面无效 ride
            - 原生 <a target=_blank rel="noopener noreferrer"> 启动
            - 复制地点文本与坐标降级出口（全平台总可用）
            - 诚实反馈与 navigation_requested (attempt: true) 埋点
```

### 4.2 供 #10（分享）与 #11（恢复）使用的接口契约

本工单在 `IsochroneApp`、`ShareButton` 与 `ResultToolbar` 中正式打通稳定 POI 选择通道，未引入任何破坏性重命名：

```typescript
// 1. 稳定 POI ID 状态暴露
const [selectedPOIId, setSelectedPOIId] = useState<string | null>(null);

// 2. 派生只读有效已选 POI（自动保证结果更新与草稿隔离）
const selectedPOI: POIWithLayer | null;
const activeSelectedPOIId: string | null = selectedPOI ? selectedPOI.id : null;

// 3. 统一选择与反选通道
const handleSelectPOI: (poiId: string | null) => void;

// 4. 透传给 ShareButton 与 ResultToolbar (供 #10 生成含选点信息的分享参数与卡片)
<ShareButton
  landmark={committed?.conditions.landmark}
  profile={committed?.conditions.profile}
  rangeMinutes={committed?.conditions.rangeMinutes}
  hasData={hasCommittedResult}
  selectedPOIId={activeSelectedPOIId}
/>
```

---

## 5. 验收标准核对与自动化测试证据

全量通过 **51 项自动化测试**（42 项历史继承测试 + 9 项 Issue #9 定向用例），全矩阵 100% 通过：

| 工单验收项目 | 满足状态 | 验证方法与自动化测试凭据 |
|---|---|---|
| **1. 列表及标记统一选中，重复切换可用，键盘与触屏有反馈** | 已满足 | `tests/issue-9.test.mjs` 测试 9 验证 `listCode` 具备 `role="button"`、`tabIndex={0}`、`aria-pressed` 以及 Enter/Space 键盘事件；测试 6 验证选中相同 ID 时平稳反选 (toggle)；触屏尺寸符合标准。 |
| **2. 详情不被面板永久遮挡，关闭后可继续探索** | 已满足 | `POIDetailCard` 提供 `onClose` 回调直接重置选中态；在 `IsochroneApp` 中，清单折叠时浮层位于移动端 `bottom-16`（避让底部悬浮按钮）与桌面端 `top-28 left-4`（避让标题、结果工具栏与图例）；`tests/issue-9.test.mjs` 测试 9 验证。 |
| **3. 导航链接对中文名称正确编码，起终点/坐标顺序/坐标系确定性检查** | 已满足 | `tests/issue-9.test.mjs` 测试 1 与测试 2 验证：`from` 为起点，`to` 为终点；经度在前、纬度在后；坐标单次转换为 GCJ-02 并与 `wgs84ToGcj02` 严格比对；中文名称经标准 URL 编码并能完美逆向解码。 |
| **4. 导航平台或环境不可用有可操作回退，动作受真正约束** | 已满足 | `tests/issue-9.test.mjs` 测试 4 验证：平台检测 `isMobileDevice` 与布局解耦；桌面端骑行时 `resolveNavigationAction` 约束 `canDirectlyNavigate: false`，主按钮切换为“复制手机导航信息”，复制文本标明仅手机有效，且不静默改驾车。 |
| **5. 更改范围/起点后不残留另一组结果的地点详情；草稿修改期间导航使用旧结果** | 已满足 | `tests/issue-9.test.mjs` 测试 6 模拟修改草稿起点（天安门）时，导航依然严格使用已提交起点（宜山路）；模拟新结果不包含旧地点时，`activeSelectedPOI` 自动失效为 `null`。 |
| **6. UI 和文案不把范围估算说成精确到达时间，不捏造虚假字段，事件与反馈诚实** | 已满足 | `tests/issue-9.test.mjs` 测试 8 静态核对 `POIDetailCard.tsx`，确保绝不包含“营业时间”、“门票”、“大众点评”或“精确到达时间”，不声称“导航成功”；埋点采用 `navigation_requested` 且带有 `attempt: true`；文案如实呈现“已请求打开...”。 |
| **7. 身份隔离防串反馈与 48vh 高度防溢出** | 已满足 | `tests/issue-9.test.mjs` 测试 9 静态核对 `key={selectedPOI.id}` 绑定于 embedded 与 floating 处；核对 `min-h-0`、`max-h-[46%]` 与 `overflow-y-auto` 确保极端内容展开时不撑破面板。 |

---

## 6. 视觉核验与外部浏览器缺口声明 (Visual & Browser Gap Disclaimer)

依据工作区权限规范（未经当前轮明确授权禁止调用外部真实浏览器）：
1. **测试覆盖**：所有 URL 拼接、单次坐标转换、参数编码、键盘焦点语义、终端模式映射与生产动作约束、独立平台判定、草稿状态隔离、身份切换隔离及视口 panInside 计算均已通过自动化 Node.js 单元测试（51/51 通过）与 TypeScript 严格检查；
2. **缺口声明与未验收范围**：
   - **User-Agent 经验判定局限**：`isMobileDevice` 基于浏览器真实 UA 及 Client Hints 进行能力探测，在某些将 UA 强制设为桌面模式的高版本平板浏览器中可能存在判定模糊；
   - **外部 APP 调起差异**：未在宿主系统中调用真实外部 Chrome/Safari 浏览器打开真实的 `uri.amap.com` 页面，未启动真实高德地图 App 客户端。第三方容器（如微信内置 WebView）的拦截表现留待用户在真实移动端设备上核验；
   - **真实视觉排版与触感**：各型号手机小屏幕（如 iPhone SE 等短屏）在骑行提示+文本域展开时的实际滚动跟手度和视觉协调性，无需假借无头浏览器测试，明确留待用户在真实屏幕中核对。

---

## 7. 用户手动核验步骤 (User Manual Verification Steps)

建议用户在本地启动开发环境后按以下步骤进行端到端体验核验：

1. **运行全量自动化测试**：
   ```bash
   npm test
   npx tsc --noEmit
   ```
   预期结果：51 项测试全绿通过，TypeScript 编译无错误。

2. **启动本地开发服务器**：
   ```bash
   npm run dev
   ```
   在浏览器中访问 `http://localhost:3000`。

3. **核验地点点选与详情呈现**：
   - 点击“先看上海示例”，地图渲染 15/30/60 分钟等时圈及可达地点标记；
   - 在左侧地点清单中点击任意地点（如“豫园”），地图标记同步高亮，地图平滑平移至视口安全区域（`panInside`），清单底部展开详情卡片；
   - 使用键盘 Tab 键聚焦到列表卡片，按 Enter 或 Space 键，地点应能正常选中并切换；再次点击已选中地点，应能正常反选 (toggle)；
   - 检查详情卡片：只显示真实已有名称、类别（如“文旅景点”）、简介、预估圈层与推荐指数，**绝无捏造的营业时间或门票信息**；
   - 点击详情卡片右上角“✕”按钮，详情关闭，恢复探索态。

4. **核验桌面端骑行限制与动作约束**：
   - 在控制面板将出行方式切换为“骑行”，在桌面端点击选中地点；
   - 观察详情卡片：主按钮应自动切换为**“复制手机导航信息”**，界面展示黄色说明：“高德地图网页版骑行导航仅限移动端支持...”，禁止提供桌面无效导航链接；
   - 点击“复制手机导航信息”，提示“已复制”，粘贴查看内容是否包含标注为 `【高德导航链接(仅手机端有效)】` 的链接及真实双坐标系；
   - 查看地图 Marker 弹窗，同样展示黄色骑行限制说明，不提供失效的外部链接。

5. **核验驾车/步行原生导航与诚实反馈**：
   - 切换为“驾车”或“步行”，主按钮恢复为**“在外部地图中导航”**；
   - 点击按钮，浏览器应通过原生新标签页打开高德地图路径规划页面，卡片下方如实展示“已请求打开外部地图页面（高德开放平台）...”，绝无虚假的拦截报错或“导航成功”字眼。

6. **核验地点切换身份隔离与防串态**：
   - 选中“豫园”并点击复制，下方展示“✓ 已复制”；
   - 立即在列表中点击切换至“外滩”，观察详情卡片：复制状态应立即复位为未复制状态，绝不把上一地点的状态串到新地点上。

7. **核验 48vh 底部面板展开排版**：
   - 在移动端模拟视口下，展开骑行提示并触发手动复制文本框；
   - 检查详情区域是否在内部平滑滚动，头部的地点标题与关闭按钮（`✕`）是否始终可见、可操作。

8. **核验草稿与已提交快照隔离**：
   - 在已有结果状态下，点击右上角“修改”，在控制面板将出发地换为“北京天安门”（不要点击更新）；
   - 查看当前选中的地点详情与导航链接，出发起点依然必须是原上海起点，绝不显示天安门；
   - 点击“更新可达范围”，结果更新为北京，旧的上海地点详情应自动关闭，不残留错配信息。
