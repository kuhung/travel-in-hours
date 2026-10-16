# #12 旅程指标实施报告

## Executive View

- **状态**：埋点实现与离线验证完成，等待用户验收；工单保持开启。
- **结论**：统一 schema v2，明确 manual/example/shared 入口与起点来源，结果就绪在 committed 状态及地点查询确认后发送，地点选择和导航对应真实动作。
- **关键路径**：有效探索尝试 → 唯一终态 → 用户有效选择 → 外部导航点击。分享复制、生成、保存发起、接收分别统计。
- **瓶颈**：尚未部署、未核验生产入库；没有项目可用的跨事件同一用户关联证据，无法报告用户级转化。
- **下一步**：按用户指示继续 #13 珠海整合；交互与生产验证由后续验收和部署授权决定。

## P2 实施

- 新增 `src/lib/analytics.ts`，聚合属性白名单、schema_version=2 与可注入 sink 的生命周期控制。runId 只在内存防重，事件中不含身份标识。
- 分析尝试记录 started/finished。ready 需要非空 committed 范围与当前地点查询成功；empty/failed/quota/cancelled/poi_error 独立终态。新请求、取消和过期响应不能重复完成。
- 地图、清单及地点分享统一使用父组件选中状态；只有用户意图经过有效实体确认后记录 poi_selected，恢复、hover、取消选择和重复渲染不计。
- 列表内嵌与浮动详情传递 committed 来源上下文；可执行原生导航链接点击才记录 navigation_requested，受限桌面骑行复制信息不计导航。
- 分享沿用既有 share_copy_link/share_image_success，不重复增加同义事件。生成成功移至 ObjectURL 可用后；下载与打开原图记录 share_save_requested。当前没有渠道按钮，文档保留将来真实渠道点击契约，不制造虚假事件。
- 客户端原有事件统一通过属性白名单，不发送坐标、名称、地址、自由文本错误或 POI ID。Vercel beforeSend 清理自动页面 URL 的 query/hash；现有 GA 初始化同步清理页面和 referrer URL，旅程自定义事件仍仅使用 Vercel。
- 429 保留限流诊断，删除无证据的“每日配额耗尽”推定。服务端错误不再发送自由文本消息。
- 完整指标、示例、重复/缓存/重试语义及历史迁移见根目录 `ANALYTICS.md`。

## 验证与证据

- `npm test`：82 项通过，其中 #12 新增 7 项。mock 检查来源、唯一终态、缓存重试、有效选择、接收去重、隐私白名单与失败安全；源码检查补充真实 UI 接线证据。
- `npx tsc --noEmit`、定向 ESLint、`git diff --check` 通过。ESLint 对既有 layout 中原生 GA script 提示 1 项 next/script 建议，无错误；本轮未升级该加载方式。
- #5 历史 429 测试更新为“不含坐标”，保留原 location/error_type/status 断言。这是 #12 明确的隐私口径变更。
- 数据最小化采用 query-product-analytics 的“决策先行、事件与用户指标分离”原则；未查询生产数据、上传测试事件或更改管理侧配置。

## 未完成边界与消融

尚未挂载浏览器验证 React/Leaflet 真实交互、检查线上 SDK 发送及生产入库；本轮不宣称转化改善。分享中未匹配预设的坐标无法辨别发送者原取点方式，origin_source=unknown。

保留的新增结构分别承担隐私边界、唯一终态和有效选择确认，均直接对应验收。无新增分析供应商、身份追踪、渠道入口或用户级漏斗实现。既有未提交变更保留，未提交、推送、合并或部署。
