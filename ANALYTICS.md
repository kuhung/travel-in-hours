# 旅程指标与数据监控

## 当前结论与决策

沿用 Vercel Web Analytics。本地已实现并用 mock 验证 schema v2 事件，尚未部署或验证生产入库，不据此宣称线上转化改善。

观察目标：主动探索能否得到可解释结果，并主动选择地点、发起外部导航。主要价值信号为 **manual 来源的有效地点选中次数**，与主动结果就绪量同时查看。它是事件次数，不能解释为独立用户数量。

- **继续观察**：可解释结果和有效选择持续出现，失败及配额阻止没有明显上升。
- **排查**：完成率下降或失败上升时，先按起点来源、方式与结果覆盖状态定位原因。
- **回滚判据**：经可复现验证，新增埋点干扰探索、导航或泄漏位置数据时，停止发送并修复。
- **停止推断**：未入库、样本不足、版本混杂或缺少同一用户关联时，不报告用户级漏斗、留存和因果改善。

## 范围与隐私

- 入口 SDK：既有 `@vercel/analytics`，无新增供应商、用户标识、会话 ID 或跨事件关联 ID。
- `src/lib/analytics.ts` 统一属性白名单与 `schema_version: 2`。不发送原始坐标、起点/地点名称、地址、URL、自由文本错误、POI ID；仅保留固定维度、布尔值和聚合数量。
- Vercel 的 `beforeSend` 清除自动附带页面 URL 中的 query/hash，避免分享链接的坐标及名称随 URL 发送。现有 GA 初始化同样使用去 query/hash 的 page_location 与 page_referrer；自定义旅程事件未转发到 GA。
- SDK 自动收集的访问统计遵循供应商原有机制。此处未核验生产 SDK 请求或供应商侧去重规则，不新增身份识别。
- 本轮无生产查询、测试数据上传或管理侧配置变更。

## 来源维度

| 字段 | 值 | 含义 |
|---|---|---|
| `entry_source` | `manual` | 用户主动生成，含用户点击定位后自动生成 |
| | `example` | 用户选择上海示例 |
| | `shared` | 分享 URL 初次恢复或用户显式重新加载原分享 |
| `origin_source` | `preset` | 当前条件匹配本地预设起点 |
| | `geolocation` | 当前会话由用户触发定位取得起点 |
| | `map` | 当前会话地图确认的自定义起点 |
| | `unknown` | 分享坐标未匹配预设，URL 没有原始取点方式证据 |
| `travel_mode` | `driving-car` / `cycling-regular` / `foot-walking` | 已提交条件的出行方式 |

示例和分享不进入主动探索分母。分享历史链接无法区分发送者原先使用定位还是地图选点，保留 unknown，不据名称猜测。

## 核心事件契约

| 事件 | 触发时点 | 字段及边界 |
|---|---|---|
| `exploration_started` | 存在起点、发起一次分析意图，配额检查前 | 来源维度、`is_cached`（启动时缓存检查）。一次手动重试/重新生成/显式重看均是新尝试 |
| `exploration_finished` | 一次尝试的唯一终态 | 来源维度、`outcome`。ready 时补 `coverage_status`、`is_partial`、`poi_count` |
| `poi_selected` | 用户选择后，React 状态中的有效 POI 已解析，能显示详情 | 来源维度、`layer_minutes`。地图、列表和地点分享入口统一进入父组件确认 |
| `navigation_requested` | 可用原生导航链接被点击 | 来源维度、`is_mobile`、`attempt: true`、固定 `location`。只代表导航出口点击 |
| `share_copy_link` | clipboard 或 execCommand 返回复制成功 | `travel_mode`、`share_target`、固定 `location`。手动选择文本不推定复制成功 |
| `share_image_success` | Blob 与可预览 ObjectURL 已生成 | `travel_mode`、`method: blob_generated`、`is_destination_share`。只代表卡片产物生成 |
| `share_save_requested` | 下载动作已发起，或点击原图新标签预览 | `method: download/open_preview`、`share_target`。下载触发返回 false 时不发成功启动事件 |
| `share_received` | 本次分享接收页面 mount | `valid`、`has_destination`。包含非法链接，StrictMode 重跑和显式重看不重复发送 |

### 结果终态与重复规则

`outcome` 为 `ready / empty / failed / quota / cancelled / poi_error`。

- `ready` 在 committed 非空等时圈提交后，当前 POI 查询成功、覆盖状态可解释时发送。已收录为空、未收录、部分覆盖均可为可解释结果；HTTP 成功及空 features 单独不能构成 ready。
- `poi_error` 表示范围已返回，但地点查询处理失败；本地地点重试不创建新分析尝试，也不把该尝试重新记为 ready。
- `cancelled` 表示用户取消、卸载或新请求取代旧尝试。内存 runId 只用于防重复、过期响应隔离，绝不上传。
- 每个尝试至多一次 finished，StrictMode effect 或重渲染不会重复。卸载时发送和网络传输均可能丢失，无法保证 started 与 finished 完全配平。
- 缓存命中仍为一次独立尝试；自定义配额消耗由独立 `custom_quota_used` 记录，不能用 started 的 is_cached=false 代替扣次事实。
- 同一选中项再点一次会取消选择，不记 poi_selected。取消后主动重选会再记一次。hover、自动分享地点恢复、详情/面板切换均不记有效选择。
- 重复点击导航或重复下载均是新的动作次数；不宣称为新用户、新目的地或成功到达。

### 渠道语义

当前统一分享弹窗仅有链接复制、图片生成和保存入口，没有微信/微博/X 渠道跳转按钮。因此当前不发送 `share_channel_clicked`，历史 social_share/toolbar_social 事件不继续作为当前界面证据。

以后若增加真实渠道入口，需使用 `share_channel_clicked` 加固定 `channel` 枚举，在点击渠道链接时发送。无接口证据时，不能报告消息送达、相册保存、分享完成或导航到达。接收打开量不能反推每一次复制/下载都成功发送给朋友。

## 指标分子分母

| 指标 | 分子 / 分母 | 解释限制 |
|---|---|---|
| 终态可解释率（尝试级） | manual 的 finished(outcome=ready) / manual 的全部 finished | 包含 quota/cancelled 等终态；需同时列出各终态数量。分子分母来自同一事件族，仍受丢报影响 |
| 观测完成比 | manual 的 finished / manual 的 started | 只用于观测缺失或跨窗口尾部；跨事件未逐次关联，不是严格尝试级配对完成率 |
| 地点选择事件比 | manual 的 poi_selected / manual 的 finished(outcome=ready) | 可超过 100%，同一结果能选择多处；不能叫用户转化率 |
| 导航动作事件比 | manual 的 navigation_requested / manual 的 poi_selected | 允许重复导航，分享自动恢复地点也可直接导航；只说明事件频次关系 |
| 缓存启动占比 | started(is_cached=true) / 全部 started | 启动时本地缓存检查，不代表所有请求的服务器缓存命中率 |
| 分享接收有效比 | share_received(valid=true) / 全部 share_received | valid 表示参数解析可恢复，不代表后续 API 或地点恢复成功 |
| 保存动作量 | share_save_requested 按 method 分组 | 仅发起下载或打开预览，无已保存证据 |

所有查询固定同一日期窗口、时区、schema_version=2 和来源过滤。未上线前仅提供定义，不填线上数值。Vercel 不提供本项目可用的同一人跨事件序列证据时，不计算用户级转化、分享发送→接收配对率或留存。不可相加不同分组的独立访客数。

## 示例载荷

```json
{
  "event": "exploration_finished",
  "schema_version": 2,
  "entry_source": "manual",
  "origin_source": "geolocation",
  "travel_mode": "foot-walking",
  "outcome": "ready",
  "coverage_status": "matched",
  "is_partial": false,
  "poi_count": 3
}
```

```json
{
  "event": "share_save_requested",
  "schema_version": 2,
  "method": "download",
  "share_target": "poi"
}
```

## 诊断与历史迁移

- 保留固定维度的 `api_error`、`api_rate_limit_reached`、`api_network_error`、`api_call_success`、`ors_api_success`、`ors_rate_limit` 等诊断事件；客户端 429 保留 location/error_type/status，移除坐标及自由文本错误。
- 服务端 429 只能证明限流，停止额外发送缺乏上游证据的 `ors_daily_quota_exceeded`。不再将同一次 429 的两个诊断事件相加当作两次失败。
- `custom_quota_used`、`analysis_limit_reached`、定位请求/成功/失败、`share_image_started` 和编辑等保留为诊断，经过客户端同一属性白名单。
- 原 `custom/current_location/example/preset_analysis_started/completed` 由统一 exploration 事件替换；原 `poi_clicked` 停用，改为有效状态确认后的 `poi_selected`。
- `navigation_requested` 保留名称，v2 增加来源维度并移除地点名字/ID；`poi_coordinates_copied` 改为复制 API 确认成功后触发。
- `share_copy_link`、`share_image_success` 保留已有名称；仅凭历史事件名不能假定同一字段/语义。新旧 schema 不拼接成同一漏斗。

## 验证与后续操作

`tests/issue-12.test.mjs` 用 mock sink 检查来源、单次终态、缓存/重试、有效选中、接收去重、属性最小化与 URL 清理。没有将测试事件上传到生产。

下一步由用户验收交互；获部署授权后，再限定本项目及日期窗口验证事件真实入库。当前交付仅声明埋点实现和离线验证。
