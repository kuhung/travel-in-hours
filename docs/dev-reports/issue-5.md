# Issue #5 实施报告与接口交接文档

所属总工单：[#4](https://github.com/kuhung/travel-in-hours/issues/4)
子任务工单：[#5](https://github.com/kuhung/travel-in-hours/issues/5)
分支：`feat/issue-5-result-state`
关联提交：未提交（按交付约定保留在工作区）

---

## 1. 目标与背景

在原有实现中：
1. 地图任意点击都会创建自定义起点，并由于参数监听直接清空原有等时圈结果。
2. 控制面板中只要切换出行方式或地点，旧探索结果立即消失。
3. 异步请求缺乏并发与过期保护：慢请求 A 会在快请求 B 之后覆盖结果；请求失败或返回空结果直接抹去界面已有结果。
4. 在途请求期间点击取消/恢复原条件时，在途异步响应依然会 setCommitted 并扣除配额。
5. 结果展示状态强依赖于控制面板是否折叠（`!isPanelOpen`）。

本任务作为总工单 #4 下的 P1 首项工程，建立轻量明确的状态与请求生命周期缝合点，彻底解耦编辑态草稿与展示态已提交结果。

---

## 2. 核心架构与生产调用链

### 2.1 状态数据模型 (`src/lib/exploration-state.ts`)

```typescript
export interface ExplorationConditions {
  landmark: CityLandmark | null;
  profile: TravelProfile;
  rangeMinutes: number[];
}

export interface CommittedSnapshot {
  conditions: {
    landmark: CityLandmark;
    profile: TravelProfile;
    rangeMinutes: number[];
  };
  isochrones: IsochroneFeature[];
  timestamp: number;
}

export class IsochroneRequestManager {
  // 单一真实请求管理器：管理递增 sequence requestId、AbortController 中止与身份失效
  startRequest(rawCoordinates, profile, rangeMinutes, deps): Promise<FetchIsochronesResult>;
  cancel(): void;
  isCurrent(requestId: number): boolean;
}
```

### 2.2 生产实际调用链 (Production Call Chain)

1. **请求发起与防竞态**：
   `IsochroneApp.handleGenerate()`
   → 生成本轮递增 `activeRunIdRef.current`
   → 调用 `useIsochrones.fetchIsochrones()`
   → 内部调用 `IsochroneRequestManager.startRequest()`
   → 中止旧 `AbortController` 并递增 `latestRequestId`
   → 响应返回时校验 `isCurrent(result.requestId)`
   → 若已过期/被取消直接返回统一失效对象 `{ ...result, success: false, aborted: true }`，绝不以 success=true 漏传给应用。
2. **应用级取消与晚返回失效闭环**：
   用户点击“恢复原条件” (`IsochroneApp.handleCancelChanges()`) 或组件卸载
   → `invalidateActiveRun()` (`activeRunIdRef.current++`，立即失效应用层等待微任务)
   → `cancelRequest()` → `manager.cancel()`（递增管理器序列号并 abort 信号）
   → 即使底层 fetch 已返回、缓存立即 resolve 或处于微任务执行窗口期，因 `runId !== activeRunIdRef.current || result.aborted || !result.success`，绝不调用 `setCommitted()`，绝不调用 `increment()` 扣除额度。
3. **配额扣减判定契约**：
   `IsochroneApp` 在分析成功后调用生产函数 `evaluateQuotaDeduction({ landmark, fromCache, success, featuresCount, aborted })`：
   - 严格遵循旧策略：仅当 `isCustomLandmark(landmark)`（即 `id.startsWith('custom-')`）为真、未命中缓存、返回 `features > 0` 且未被中断时扣除 1 次配额。
   - 浏览器定位（`id: 'current-location'`）不以 `custom-` 开头，保持旧策略不扣减额度。
4. **历史埋点事件口径兼容性**：
   - 严格保持原有 `location: 'isochrones_hook'`，不随意更换为 `request_manager`，保护历史分析分组。
   - 严格还原 HTTP 429 时的 `api_rate_limit_reached` 事件及其 `coordinates` 字段。
   - 严格还原 `api_error` 的 `error_type` 与 `status_code`。
5. **状态与展示快照分离**：
   - 地图、图例、POI 清单、工具栏与分享按钮一律消费 `committed` 快照。
   - `hasPendingChanges(draftConditions, committed)` 统一判定是否展示“条件已修改，待更新”。
   - `canShareCommitted(committed)` 统一判定结果存在性与分享资格（必须 `features.length > 0`）。
6. **初始化路径时序健壮性**：
   - URL 分享参数加载与首次引导演示均采用“仅在定时器真正执行时标记 handled/executed”模式，有效防止 React StrictMode 下的 setup-cleanup-setup 时序吞掉唯一调度。
   - `handleGenerate` 闭包陈旧问题通过 `handleGenerateRef` 与参数显式覆盖消除。

---

## 3. 验收项核对与证据

| 验收项目 | 状态 | 验证方式与测试证据 |
|---------|------|-------------------|
| 1. 已有结果时普通点击/拖动地图、关闭弹窗都不改起点或清结果 | 已满足 | `IsochroneMap.tsx` 仅在 `isPickingLocation === true` 时绑定 map click 事件；普通拖拽与点击不触发选点；`tests/issue-5.test.mjs` 测试 5 验证 committed 隔离。 |
| 2. 显式选点可确认/取消；取消后原结果、原起点、原方式不变 | 已满足 | 选点模式提供悬浮栏支持“确认出发点”（载入草稿）与“取消”（丢弃候选，原起点与旧 committed 结果不变）。 |
| 3. 更改方式未生成前显示待更新；取消恢复；旧结果的摘要和分享仍使用旧条件 | 已满足 | 面板显示“条件已修改，待更新”及“恢复原条件”；生产函数 `hasPendingChanges` 与 `canShareCommitted` 在 `tests/issue-5.test.mjs` 测试 5 验证通过。 |
| 4. 更新成功只展示匹配条件的新结果；失败保留旧结果并可重试 | 已满足 | 请求成功原子替换 committed 快照；请求失败保留原有 committed；`tests/issue-5.test.mjs` 测试 3 验证失败返回 error 且不扣额度。 |
| 5. 模拟 A 请求慢、B 请求快，A 最后返回不会覆盖 B；卸载/取消安全处理 | 已满足 | `IsochroneRequestManager` 实际生产类在 `tests/issue-5.test.mjs` 测试 1、测试 2、测试 8 中全路径验证并发废弃、取消失效及缓存微任务窗口阻断。 |
| 6. 空 features 不误显示为可分享的成功结果；无数据与错误有清楚状态 | 已满足 | `useIsochrones` 对 0 features 产生 `isEmpty: true, error: null`；`tests/issue-5.test.mjs` 测试 3 验证空数据不作为成功且不扣额度。 |
| 7. 缓存、每日次数耗尽、成功扣次和失败不扣次按实际规则做关键逻辑测试 | 已满足 | `evaluateQuotaDeduction` 与 `isCustomLandmark` 在 `tests/issue-5.test.mjs` 测试 4 验证全矩阵会计规则（预设、定位、自定义、缓存、失败、取消、空数据）。 |
| 8. 额度存储数值合法性与 SSR 首屏安全 | 已满足 | `useSelectionLimit` 使用 `useSyncExternalStore` 规范保障 SSR/client 首屏一致；`parseStoredCount` 在 `tests/issue-5.test.mjs` 测试 6 验证防非法数值。 |
| 9. 分析事件历史口径与 429 限流事件兼容 | 已满足 | `tests/issue-5.test.mjs` 测试 7 验证 429 触发 `api_rate_limit_reached`，且 `api_error` 维持 `location: 'isochrones_hook'`。 |

---

## 4. 测试范围与未测说明 (Test Scope & Boundaries)

### 已通过自动化测试覆盖的真实生产逻辑：
- `IsochroneRequestManager.startRequest`：慢 A 快 B 实际竞态并发中止与序列号校验。
- `IsochroneRequestManager.cancel`：在途中断与 request identity 可靠失效。
- 缓存立即 resolve 场景下 cancel 阻断提交与扣次（微任务提交窗口安全）。
- 空响应处理与失败响应处理。
- `evaluateQuotaDeduction` 全场景矩阵（预设、定位、自定义、缓存、失败、取消、空数据）。
- `isCustomLandmark` 严格边界校验（验证 `current-location` 不扣次）。
- 历史埋点事件还原校验（429 触发 `api_rate_limit_reached`，维持 `isochrones_hook` 历史分组）。
- `hasPendingChanges` 与 `canShareCommitted` 逻辑。
- `parseStoredCount` 容错解析。

### 未经自动化测试直接覆盖的部分（如实承认）：
- 真实浏览器中 Leaflet 地图底图瓦片渲染与 Canvas 截图交互（未连接外部浏览器）。
- React 真实 DOM 树渲染时的端到端视觉效果。

---

## 5. 验证命令与结果

1. **类型检查**:
   ```bash
   npx tsc --noEmit
   # 输出：0 errors，退出码 0
   ```
2. **代码风格与 Git 规范检查**:
   ```bash
   git diff --check
   # 输出：无任何空白或格式问题，退出码 0
   ```
3. **目标文件 Lint 检查**:
   ```bash
   npx eslint src/components/App/IsochroneApp.tsx src/hooks/useIsochrones.ts src/hooks/useSelectionLimit.ts src/components/Map/IsochroneMap.tsx src/components/Map/MapWrapper.tsx src/components/Controls/CitySelector.tsx src/lib/exploration-state.ts
   # 输出：0 errors, 0 warnings，退出码 0
   ```
4. **自动化单元测试（原生 Node 26 运行，零额外传递依赖）**:
   ```bash
   npm test
   # node --no-warnings --test --experimental-strip-types tests/*.test.mjs
   # 输出：
   # ✔ 1. 生产请求管理器测试：A慢B快并发竞态，过期A请求被安全废弃，不覆盖B
   # ✔ 2. 生产请求管理器测试：在途取消与请求身份可靠失效（覆盖恢复原条件/卸载场景）
   # ✔ 3. 生产请求管理器测试：空 features（0个）识别为 isEmpty，失败返回 error 并保留原有状态
   # ✔ 4. 生产配额判定与自定义地标识别契约（严格遵循旧策略：仅 startsWith custom- 扣次）
   # ✔ 5. 生产条件修改检测（hasPendingChanges）与分享资格（canShareCommitted）
   # ✔ 6. 存储计数解析函数（parseStoredCount）合法性校验与容错
   # ✔ 7. 生产埋点事件兼容性核对：429限流事件与api_error location/error_type严格还原
   # ✔ 8. 缓存立即 resolve 场景下 cancel 必须不提交/不扣次（覆盖微任务提交窗口）
   # 8 passed, 0 failed, 耗时 ~118ms
   ```

---

## 6. 遗留限制与边界说明

1. 本任务仅聚焦 #5 状态/请求生命周期缝合点；不顺手修改未覆盖数据函数（留待 #6）。
2. 未修改分享弹层内部微信截图生成与二维码绘制细节（留待 #10 与 #11）。
3. 按照权限指令，未执行 Git commit/push，未创建 PR，工作区保持纯净代码变更供原审阅者审查。
