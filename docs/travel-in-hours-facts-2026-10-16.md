# 同点出行方式切换与配额核查（Issue #19）

- 工单：https://github.com/kuhung/travel-in-hours/issues/19
- 状态：本地修复及自动化验证完成，用户已授权发布；部署结果记录在工单中。未进行浏览器视觉验收。

## 根因与修复

`src/components/Map/IsochroneMap.tsx` 的 GeoJSON key 原先仅包含圈层时长、索引和起点 ID。同一起点切换方式后这些值不变。已安装的 `react-leaflet/lib/GeoJSON.js` 更新函数只处理 style，不替换 data 或重新执行 onEachFeature，因此新结果可能仍展示旧几何和旧弹窗。

应用现在将成功提交快照的 analysisRunId 传给地图，并纳入 GeoJSON key；方式也纳入 key，timestamp 作为未提供结果编号时的兼容回退。每个新成功快照重建全部圈层及弹窗，MapContainer 保持挂载。草稿调整不提交结果，依然需要点击更新。

## 配额事实台账

- `src/lib/exploration-state.ts` 的 evaluateQuotaDeduction：仅自定义选点、未命中客户端缓存、成功返回非空 features、未取消时扣一次。
- `src/components/App/IsochroneApp.tsx`：通过请求编号排除过期响应，提交结果后调用 increment；预设与当前位置免费。
- `src/lib/isochrone-cache.ts`：缓存键包含网格坐标、出行方式和时间档位；三种方式独立缓存。排序改为复制数组，避免修改草稿或已提交的时间条件。
- 驾车、骑行、步行分别计算和缓存。未改变配额政策；按用户要求撤回额外界面说明及配额文案调整。

## 验证

- `npm test`：80/80 通过。新增三项行为测试覆盖真实客户端缓存、同点三种方式请求参数和几何独立、首次成功各扣一次、缓存重访免扣、失败与成功重试、预设和定位免扣、时间条件不可变性。既有测试覆盖取消和过期响应免扣。
- `npx tsc --noEmit`：通过。
- 修改文件的 ESLint 及 `git diff --check`：通过。
- 未连接用户浏览器，未请求真实 ORS 服务，未验证线上扣点或浏览器绘制效果。
