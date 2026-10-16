# Issue #10 实施报告与分享信息架构及卡片导出交付文档

所属总工单：[#4](https://github.com/kuhung/travel-in-hours/issues/4)
子任务工单：[#10](https://github.com/kuhung/travel-in-hours/issues/10)
依赖：#8（结果信息架构与布局）、#9（地点选择与外部导航）
分支：`feat/issue-5-result-state`
关联提交：未提交（按交付约定保留在工作区）

---

## 1. 目标与背景

在原有分享实现中，存在以下结构性问题：
1. **渠道、格式与动作混排**：旧版 `ShareMenu` 将保存分享图片、复制链接、微博、推特、微信并列；进入微信弹层后，内部又设置扫码分享与复制链接两套 tab，并在输入框右侧与弹层底部放置两处重复的复制按钮；
2. **写剪贴板冒充保存**：“保存分享图片”在实现上优先调用 `navigator.clipboard.write` 写入图片剪贴板，失败后才回退为文件下载；同一按钮在不同设备执行不同动作，生成成功不等于存入手机相册；
3. **父级菜单卸载导致状态丢失**：微信弹层点击保存时先强制关闭父级菜单，生成过程中缺少受控预览和原地重试承载容器；
4. **入口数据不对称**：结果工具栏分享传入了圈层地点数据，但控制面板底部的分享按钮漏传数据，导致同一结果在不同入口生成的卡片内容不一致；
5. **导出破坏用户活动地图**：旧版 `generateShareImage` 直接读取并修改全局 `window.__leaflet_map` 视角，在用户交互过程中强行平移地图且不恢复；同时直接对处于活动变化中的 DOM 执行截图，条件变更时容易混入错误结果；
6. **远端修复尚未在本地集成**：远端提交 `d368e14` 针对高德瓦片与图标跨域污染、缺少 `roundRect` 支持以及 `toBlob` 异常做了修复，但本地尚未合回，需在不引入图片剪贴板主路径的前提下吸收其健壮性能力。

本工单建立统一的分享快照 `SharePayload`，在主应用建立单一所有者弹窗 `ShareDialog`，分离链接交互与静态卡片生成流程，接通地点详情“分享此地”明确出口，并通过离屏隔离渲染避免干扰用户活动探索地图。

---

## 2. 变更前后对照 (Before & After)

| 维度 | 修改前 (Before) | 修改后 (After) |
|---|---|---|
| **第一层分享入口** | 平台（微信/微博/推特）与格式动作并列混排，用户需先选平台 | 第一层仅提供“复制交互链接”与“生成静态卡片”，不强制预选社交平台 |
| **重复菜单与状态归属** | `ResultToolbar` 与 `ShareButton` 各自维护局部下拉菜单，微信弹层内又有两套复制按钮；父组件折叠导致弹层关闭 | 由 `IsochroneApp` 统一持有单一所有者 `ShareDialog`，编辑面板展开折叠不丢失分享预览；清理废弃微信 tab 与重复菜单组件 |
| **地点详情分享出口** | 地点详情卡片无分享出口，用户无法将特定目的地发起分享 | `POIDetailCard` 接入“分享此地”按钮，支持明确以“从起点到所选目的地”为对象发起分享 |
| **分享对象区分** | 无法表达具体目的地，卡片与链接一律混为整张地图 | 支持“所选地点卡”与“整次探索卡”明确对象区分；所选地点卡突出目的地与起点关系、出行方式及互斥圈层时间预估；支持在弹窗内切换 |
| **图片保存行为** | 优先调用 `navigator.clipboard.write` 尝试写入图片剪贴板，失败后才回退为文件下载 | 生成仅产出 Blob 与预览，保存为明确的静态文件下载；文案说明“已发起下载”，移动端提示长按预览图片回退存储，不写入图片剪贴板 |
| **重复保存开销** | 每次点击保存均重新跑完整截屏与拼图流程 | 生成成功后保留当前产物 Blob，用户多次点击“保存图片”直接复用现有 Blob 发起下载，无重复计算开销 |
| **活动地图视角稳定性** | 直接调用 `window.__leaflet_map.setView` 重设用户活动地图中心，打断探索视野 | 采用离屏独立 Leaflet 容器与独立快照渲染，不访问 `window.__leaflet_map`，成功、失败或取消均保持活动地图视角与选择不变 |
| **活动 DOM 干扰防护** | 直接截取当前活动 DOM `#app-map-container`，用户手势与浮层易污染卡片 | 离屏容器在独立的坐标与尺寸空间内完成矢量和瓦片绘制，隔绝活动界面的拖拽与动画干扰 |
| **离屏瓦片加载状态控制** | 依赖截取当前活动 DOM，无独立离屏渲染与瓦片就绪控制器 | 引入生产控制器 `initTileLoadTracker`，严格要求完整就绪且无瓦片错误，零瓦片或残缺超时明确报错拒绝，禁止缺块冒充完整 |
| **异步生命周期防挂死** | 缺少超时取消与请求身份校验，慢请求晚返回易造成旧图覆盖新状态 | 引入内部与外部级联 `AbortController` 与 `withTimeout` 保护，QR 解码限制 5 秒，`canvasToBlob` 限制 4 秒有界回退，整体导出限制 25 秒超时，迟到任务不发假成功不创无主 URL |
| **画布兼容与内存保护** | 旧版依赖原生 `ctx.roundRect`；高倍屏无限缩放存在手机内存崩溃风险 | 吸收 `ensureRoundRect` 兼容圆角绘制；吸收 `canvasToBlob` 在异常时回退 `toDataURL`；限制画布单边最大 4096px 防内存溢出 |
| **弹窗身份与焦点管理** | 无请求身份守卫，切换对象或重开可导致旧 URL 串台；无焦点循环管理 | 建立 `copyRunIdRef` 与 `imageRunIdRef` 守卫，切换/关闭时废弃在途回调并清理定时器；支持 Escape 关闭、Tab 焦点圈守卫与关闭还焦点 |

---

## 3. 架构设计与接口契约

### 3.1 数据流架构

```
               +------------------------------------------------+
               |              CommittedSnapshot                 |
               | (landmark, profile, rangeMinutes, isochrones)  |
               +------------------------------------------------+
                                       |
                                       v
                    +--------------------------------------+
                    |      createSharePayload (纯函数)      |
                    | (深度克隆 + Object.freeze 深度冻结隔离) |
                    +--------------------------------------+
                                       |
                                       v
               +------------------------------------------------+
               |             Readonly<SharePayload>             |
               | - conditions (起点、方式、15/30/60m、示例标识)     |
               | - isochrones (等时圈多边形特征要素)               |
               | - selectedPOIId (可选稳定目的地 ID)              |
               | - selectedPOI (可选目的地实体)                   |
               | - poiInfo (圈层分组、匹配数、覆盖状态)             |
               | - createdAt (绑定 committed.timestamp)         |
               +------------------------------------------------+
                        /              |              \
                       /               |               \
                      v                v                v
            [generateShareUrl] [generateShareTitle] [exportShareImage]
                    |                  |                |
                    |                  |                +--> [renderIsolatedMapSnapshot]
                    |                  |                |    (离屏独立 Leaflet 容器)
                    |                  |                |    (initTileLoadTracker 控制器)
                    v                  v                v
              交互链接(?poi=)       卡片分享文案        生成 Blob 与预览 URL
                                                        |
                                                        v
                                                 [downloadBlob]
                                               (显式发起下载，可重复保存)
```

### 3.2 SharePayload 规范与下游子单消费契约

本单定义的 `SharePayload` 类型规范作为总工单 #4 的核心中枢，供 #11（链接恢复）与 #12（旅程指标）消费：

```typescript
export interface SharePayloadConditions {
  landmark: CityLandmark;
  profile: TravelProfile;
  rangeMinutes: number[];
  isExample?: boolean;
}

export interface SharePayloadPOIInfo {
  totalPOIs: number;
  poiByLayer: POIByLayer[];
  coverageStatus: CoverageStatus;
  isPartial?: boolean;
}

export interface SharePayload {
  version: 1;
  conditions: SharePayloadConditions;
  isochrones: IsochroneFeature[];
  selectedPOIId: string | null;
  selectedPOI?: POIWithLayer | null;
  poiInfo: SharePayloadPOIInfo;
  createdAt: number;
}
```

- **生成时间稳定性**：`createSharePayload` 显式消费 `committed.timestamp` 作为快照时间戳，避免用户在所选地点与整张地图切换时频繁刷新时间；
- **提供给 #11（链接恢复）的接口**：
  - `generateShareUrl(payload: SharePayload): string`：当 `payload.selectedPOIId` 存在时，URL 查询参数自动追加 `poi=${selectedPOIId}`，与已有 `lat`、`lng`、`name`、`city`、`profile`、`range` 形成对称参数集，为 #11 的接收端反序列化提供参数契约；
- **提供给 #12（旅程指标）的接口**：
  - `conditions.isExample` 明确标识是否属于示例探索；
  - `selectedPOI` 明确区分是整次探索分享还是单地点行动分享；
  - 埋点口径区分 `share_copy_link`（复制交互链接）、`share_image_started`（发起生成）、`share_image_success(method=blob_generated)`（完成卡片绘制）与 `share_poi_clicked`（从详情发起分享）。注意 `share_image_success` 仅代表图片本地绘制完成，不代表对方已收到或已存入相册。

---

## 4. 离屏渲染模板与健壮性保障

### 4.1 统一 960x600 离屏模板的收敛理由

历史代码曾根据当前浏览器屏幕宽高比尝试区分横屏和竖屏，直接对活动 DOM 执行裁切。但在实际运行中，移动端窗口高度受到软键盘、底部地址栏和面板折叠状态影响，直接裁切会导致边缘圈层多边形和关键标记被静默剪掉。

本单将离屏地图快照收敛为统一的 960x600 独立矢量渲染尺寸（加上头部与底部总高度约为 730–850px）：
1. 离屏容器具有确定、固定的几何像素大小，不受用户当前浏览器窗口宽度或手势影响；
2. 视角计算使用 `bounds.extend` 对起点坐标、所有等时圈几何以及所选目的地（或全部热点）进行并集包络（Union Bounds），配合 `[36, 36]` 安全 padding，避免边缘地标被裁掉；
3. 输出产物比例均衡，无论用户在桌面还是移动端发起，均能生成一致的分享卡片。

### 4.2 瓦片就绪控制器与严格就绪策略 (initTileLoadTracker)

提取独立的瓦片追踪控制器，解决旧版无条件 resolve 导致的灰底空白或残缺卡片冒充成功问题：
1. **监听先于请求**：在 Leaflet 地图执行 `fitBounds` 或 `setView` 之前挂载 `tileloadstart`、`tileload`、`tileerror` 与 `load` 监听；
2. **严格就绪策略**：对于导出的静态分享卡片，必须确保地图完整性。若发生任一瓦片错误（`failed > 0`）、零请求零加载、或超时且加载数小于请求数（`loaded < requested`），控制器明确拒绝并报错，不以部分瓦片或空白地图冒充成功；错误或超时后用户可在弹窗内就地重试或使用交互链接；
3. **缓存就绪识别**：若瓦片已在浏览器缓存中完成加载（`allLoadedFired` 或 `!tileLayer.isLoading()`）且 `failed === 0`，控制器快速识别并结算为 `cached`；
4. **清理安全性**：在超时、完成或收到 `AbortSignal` 时，控制器清理全部定时器并解绑全部事件监听，杜绝内存与回调泄漏。

### 4.3 整体导出超时与迟到任务防泄漏机制

1. **内部 AbortController 级联联动**：
   - `exportShareImage` 内部建立受控 `internalController`，将外部传入的 `options.signal` 与 25 秒整体超时统一连接到内部 signal；
   - 外部调用者中止或 25 秒超时到达时，内部立即触发 abort，促使 `renderIsolatedMapSnapshot` 的 `finally` 块立刻执行 `map.remove()` 与离屏容器 DOM 移除；
2. **迟到结果防泄漏阻断**：
   - 在生成 Blob 后、调用 `URL.createObjectURL` 与上报 `share_image_success` 前，增加终态有效性检查；若任务已超时或被中止，阻断 ObjectURL 创建与成功事件上报，防止产生无人释放的内存泄漏；
   - 具名清理包装器中的 `signal.removeEventListener('abort', onAbort)` 监听，避免监听器残留。

### 4.4 远端 commit `d368e14` 吸收与无用旧代码清理

1. **已吸收能力说明**：
   - 远端提交 `d368e14` 专门针对图片跨域与导出兼容进行修复（其祖先提交 `112d753` 包含的珠海数据并不在本提交的 patch 中）；
   - 本地在保留当前工作区基线的前提下对 `d368e14` 的图片修复实现了代码级等价吸收（非 Git 合并）；
   - 高德瓦片与 Leaflet 默认图标均配置 `crossOrigin: "anonymous"`；
   - html2canvas 设置 `useCORS: true`、`allowTaint: false` 与 15000ms 超时；
   - Canvas 2D `ensureRoundRect` 兼容函数；
   - `canvasToBlob` 增加有界超时与 `toDataURL` 降级回退；
   - 限制最终 Canvas 单边不超过 4096px；
2. **清理无消费者旧代码**：
   - 移除 `src/components/Controls/ShareMenu.tsx` 与 `src/components/UI/WeChatShareModal.tsx`；
   - 从 `src/lib/share-utils.ts` 中彻底删除未被任何生产和测试使用的 `openSocialShare`、`generateShareImage` 和 `ShareImageOptions`，消除冗余旁路。

---

## 5. 验证结果与自动化测试证据

全量用例采用 Node.js 现代测试运行器执行，61 项测试全部通过。

```
✔ 1. SharePayload 契约与深度冻结不可变性验证 (Immutability & Seam Contract) (1.274709ms)
✔ 2. 分享链接参数对称性与 #11 往返契约验证 (URL Symmetry & Round-Trip) (0.366541ms)
✔ 3. 分享对象明确性与文案承诺验证 (Explicit Destination vs Exploration Title) (0.375417ms)
✔ 4. 生产瓦片等待控制器就绪契约 (initTileLoadTracker & waitForTiles Strict Readiness) (105.683291ms)
✔ 5. 吸收远端修复健壮性核验 (Absorbed d368e14 Fallbacks) (51.734625ms)
✔ 6. 静态源码核对：离屏隔离渲染与无修改活动地图 (Active Map Invariance) (0.627792ms)
✔ 7. 静态源码核对：Leaflet 图标与瓦片 crossOrigin 保护 (IsochroneMap Compliance) (0.241417ms)
✔ 8. 静态源码核对：废弃微信 Tab、重复菜单与死代码彻底清理 (Dead Code Cleanup) (2.09ms)
✔ 9. copyShareLink 与 downloadBlob 执行及回退逻辑验证 (1.31025ms)
✔ 10. 真实生产导出控制器超时、中止与迟到任务防泄漏验证 (exportShareImage Lifecycle & Late Task Guard) (245.091833ms)
...
ℹ tests 61
ℹ suites 0
ℹ pass 61
ℹ fail 0
```

代码规范检查：
- `npx tsc --noEmit`：0 错误；
- `npx eslint` 定向校验：0 错误，0 警告；
- `git diff --check`：0 空白与换行告警。

---

## 6. 客观未验证范围与用户验收项 (Pending User Review)

依工作区权限规范，本轮未启动外部浏览器。以下项客观声明为未在当前工单验证，留待用户在真实设备中手动核验：

1. **真实浏览器中生成的 PNG 图片视觉排版**：
   - 离屏 Canvas 在不同真实屏幕 PPI 下渲染的字体对齐、图例边角高光与卡片阴影质感；
2. **二维码在线扫描与跨平台还原**：
   - 手机微信或相机直接扫描生成卡片右下角二维码，进入交互网页的真实还原体验；
3. **移动端浏览器长按保存**：
   - 在 iOS Safari、微信内置浏览器或 Android Chrome 中长按预览卡片触发系统“存储图像”的系统级表现；
---

## 7. 用户 Review 后的收尾修正（已确认配色与大圈覆盖根因修复）

在用户完成对里程碑 2 的首次 Review 审阅后，反馈并确认了最后的配色收尾与根因修复方案（本单已按用户授权由父级在 GitHub 上正式关闭 CLOSED）：
1. **导出图大圈覆盖内圈的根因与修复**：
   - **根因查明**：活动地图组件 `IsochroneMap.tsx` 内部对等时圈按 `properties.value` 从大到小降序绘制，因此 60 分钟大圈在底层，15 分钟小圈在顶层；但离屏快照导出函数 `renderIsolatedMapSnapshot`（`src/lib/share-utils.ts`）直接按 API 原始 payload 顺序遍历绘制。当 payload 为 15m、30m、60m 升序时，60 分钟大圈最后绘制在顶层，加之旧版 60 分钟采用红色填充且透明度较高（0.35–0.4），导致外圈红雾覆盖了内圈颜色；
   - **生产排序控制器**：在 `src/data/isochrone-config.ts` 中提取纯函数 `sortIsochronesForRender`，输入任意乱序或正序，均确定性输出 60m -> 30m -> 15m（降序），且不修改输入数组。活动地图与导出离屏快照统一调用此控制器，有效防止大圈覆盖内圈；
2. **三档配色与层级体系（Refactoring UI 体系，复用 emerald 品牌）**：
   - 彻底摒弃红/黄/绿“红绿灯/危险警告”色彩暗示，转向从青绿到冷蓝的平滑感知渐变；
   - **15分钟（青绿 / Teal）**：边框与标记背景 `#0f766e`（Teal-700），面填充 `#2dd4bf`（Teal-400），填充透明度 `0.32`。作为核心圈，层级最高、清晰度最强；
   - **30分钟（蓝 / Blue）**：边框与标记背景 `#1d4ed8`（Blue-700），面填充 `#60a5fa`（Blue-400），填充透明度 `0.23`。作为生活圈，中距离层次分明；
   - **60分钟（靛蓝 / Indigo）**：边框与标记背景 `#4338ca`（Indigo-700），面填充 `#818cf8`（Indigo-400），填充透明度 `0.16`。作为通勤圈，极淡浓度大圈，清晰保留底图路网；
3. **目的地标记与错误态解耦**：
   - 废除原导出目的地标记中误用的 `#dc2626`（危险错误红）；
   - 统一建立 `DESTINATION_STYLE`：底色使用深青色 `#0f766e`，搭配加粗白色描边（3px）与 1.15 倍放大展示；
   - 页面中真正的错误态（如地点匹配异常重试按钮、定位失败提示）继续保留红色，不做全局替换；
4. **单一事实来源收敛**：
   - 全站颜色与样式配置统一由 `src/data/isochrone-config.ts` 提供；
   - 清理 `IsochroneMap.tsx`、`share-utils.ts`（两处）与 `poi-utils.ts` 中的硬编码 `LAYER_COLORS`；
   - `poi-utils.ts` 的 `LAYER_COLOR_MAP` 动态由 `isochroneColors` 生成，保持 Node ESM `../data/isochrone-config.ts` 导入兼容；
   - 统一地图 GeoJSON、Canvas 导出图例、页面图例 `MapLegend`、地点清单 `POIListPanel` 及标记 Marker 的颜色引用；
5. **Alpha 合成数值证明与对比度自动化核验**：
   - **Alpha 合成数学证明**：在标准 Porter-Duff source-over 合成下，先画 60m 再画 15m，15m 顶层色彩信号完整保留 32% 贡献率，呈现清晰青绿色（Green: 198 > Red: 147）；若后画 60m，15m 色彩信号被压制衰减至 20.7%，且外圈色彩涂抹在顶层造成严重色混；
   - **WCAG 2.1 对比度**：15m (5.47:1)、30m (6.70:1)、60m (7.90:1)、目的地标记 (5.47:1) 白字与深底对比度均显著高于 WCAG AA 标准 4.5:1；
   - **全量测试通过**：测试用例扩展至 66 项，`tsc` 0 错误，定向 `eslint` 0 警告，`git diff --check` 0 告警；
6. **客观未核验边界与用户确认边界**：
   - 用户确认的是方案原则、色值方向与授权关单，并非已在浏览器中目视验收新配色实图；
   - 依权限规范未启动无头或外部浏览器，未暗中截图；离屏 Canvas 最终合成图像的像素排版与高分屏视觉效果留待用户在真实浏览器与设备中核验。

