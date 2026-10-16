# Issue #6 实施报告与地点几何计算接口交接文档（终稿）

所属总工单：[#4](https://github.com/kuhung/travel-in-hours/issues/4)
子任务工单：[#6](https://github.com/kuhung/travel-in-hours/issues/6)
分支：`feat/issue-5-result-state`
关联提交：未提交（按交付约定保留在工作区）

---

## 1. 目标与背景

在原有实现中存在两个核心断点：
1. **起点 `city` 字符串耦合导致地点丢失**：`IsochroneApp` 仅通过 `getInterestPointsByCity(landmark.city)` 筛选候选地点。当用户在地图上选点时，`landmark.city = '自定义位置'`；当用户通过浏览器定位时，`landmark.city = '我的位置'`。因此，即使起点实际位于上海市中心，也会因 `city !== '上海'` 返回空地点数组。
2. **包含判断中的坐标系与几何缺陷**：
   - 代码采用的坐标契约与 ORS 原始等时圈几何均为 WGS-84（`[lng, lat]`）。原 `groupPOIsByLayer` 在点包含判定前，错误地把 POI 单侧转换为火星坐标系（GCJ-02），并直接与 WGS-84 等时圈多边形进行射线法判断，在代码逻辑层面产生了约 450 米的空间偏移。
   - 原实现仅检查了多边形的外边界 `coordinates[0]`，完全忽略了 GeoJSON 多边形内环孔洞（interior rings / holes）和 MultiPolygon 多块陆地结构。
3. **收录状态混淆与无法向用户诚实交代**：原系统无法区分“在已收录区域内但当前时间/出行方式不可达（`covered-empty`）”与“超出本地维护范围的未收录城市（`uncovered`）”或“跨边界部分覆盖（`partial`）”。

本工单作为 Issue #4 下的 P1 核心纯数据/几何接口，严格限定交付纯函数、空间几何引擎、声明性收录边界与类型契约，不侵入修改 UI 组件，为后续 Issue #8（结果 IA 与 UI 集成）提供坚实完备的数据基石。

---

## 2. 核心架构与接口规范

### 2.1 坐标系契约与未核验声明 (Coordinate Contract & Disclaimers)

对全链路数据流转各节点实查核对结论如下：

| 数据节点 | 实际使用坐标系 | 数据格式与顺序 | 校验凭据与代码位置 |
|---------|-------------|--------------|-------------------|
| 1. 源 POI 数据 (`src/data/interest-points.ts`) | **WGS-84 契约** | `[lng, lat]` | 历史仓库代码中未标注 POI 来源出处；`CONTRIBUTING.md` 明确了地标（landmarks）输入遵循 WGS-84 契约。代码逻辑统一按 WGS-84 经纬度处理。 |
| 2. ORS 等时圈几何 (`/api/isochrones`) | **WGS-84** | GeoJSON `[lng, lat]` | ORS 官方 RFC 7946 标准输出规范；服务端 `fetchIsochrones` 直接透传 GeoJSON 原始多边形。 |
| 3. 地图底图瓦片 (`IsochroneMap.tsx`) | **GCJ-02** | 高德瓦片图层 | 使用高德瓦片 `https://wprd01.is.autonavi.com/...`，底层为火星坐标系。 |
| 4. 几何包含计算（PIP） | **WGS-84** | `[lng, lat]` | **逻辑纠正**：POI 点与等时圈几何均在 WGS-84 空间完成比较，消除代码内部单侧 GCJ-02 转换造成的算法偏移。 |
| 5. 地图标记渲染位置 (`POIWithLayer.position`) | **GCJ-02** | `[lat, lng]` | Leaflet `Marker` 消费格式。在几何计算完成后，仅在输出层对命中点单次调用 `wgs84ToGcj02` 生成 `[lat, lng]`，符合现有渲染契约。 |

> **关键证据与局限声明**：
> 1. **未独立验证外部精度**：仓库现存的 8 个历史 POI（如外滩 `[121.4905, 31.2323]`）在代码中未注明采集来源，本项目**未进行实地测绘核对或地图卫星实测核验**，不能证明或宣称其真实地理精度已校准至现实设施。
> 2. **代码契约对齐 ≠ 真实地点校准**：本次修改仅修复了前端与计算链路中“单侧转 GCJ-02 再与 WGS-84 比较”的代码逻辑错误，消除了代码内部约 450 米的算法偏移，并不等于对真实地点物理位置进行了校准。

---

### 2.2 本轮声明性收录边界的选择依据与局限

根据规范，收录范围是**本轮为明确数据维护范围而手工划定的一组粗略声明性边界**，绝不能伪称“官方行政区划精确测绘边界”或“全境完整收录”：
- **选择依据**：本轮在 `src/data/interest-points.ts` 中划定了一个包络上海主要市区及周边地标的 12 点粗略闭合多边形（`SHANGHAI_CURATED_REGION`），用于在单元测试和接口层提供确定的空间判定范围。
- **局限与说明**：
  1. 该多边形为人为选择的粗略包络线，**绝非官方行政边界**；
  2. 即使物理上位于上海市域范围，若落在此粗略多边形外部，系统仍将判定为 `uncovered`；
  3. 元数据包含显式免责说明：
  ```typescript
  export const SHANGHAI_CURATED_REGION: CuratedRegion = {
    id: 'shanghai',
    name: '上海',
    province: '上海市',
    description: '上海市及周边已收录热门地标与文旅场所',
    disclaimer: '本地维护精选收录数据，非全国/全量 POI 检索，非行政区划精确边界',
    source: 'travel-in-3hours 本地维护整理 (WGS-84)',
    bounds: { minLng: 120.85, minLat: 30.68, maxLng: 122.00, maxLat: 31.85 },
    boundary: { type: 'Polygon', coordinates: [...] }
  };
  ```

---

### 2.3 单一算法与数据源架构 (Single Source of Truth)

为了消除代码冗余与维护分裂，彻底收敛架构：
1. **唯一坐标转换模块** (`src/lib/coord-transform.ts`)：唯一提供 `wgs84ToGcj02` 与 `gcj02ToWgs84`。
2. **唯一几何计算模块** (`src/lib/geo-utils.ts`)：唯一实现点在环内判定、内外边界策略、孔洞排除、MultiPolygon、真跨立相交（`doSegmentsProperlyCross`）、有效内部采样（`findInteriorSamples`）与重叠度评估（`evaluateGeometryOverlap`）。
3. **唯一收录数据源** (`src/data/interest-points.ts`)：唯一存放 `shanghaiInterestPoints`、`getAllInterestPoints` 与 `CURATED_REGIONS`。
4. **纯粹的业务应用层** (`src/lib/poi-utils.ts`)：直接从上述唯一模块 import 生产依赖，**彻底删除了之前复制的任何坐标算法、几何算法或默认 POI 副本**。

---

### 2.4 几何引擎与缺陷修复证据

在 `evaluateGeometryOverlap` 算法中，解决了以下关键拓扑与边界问题：
1. **相同多边形、首点旋转及环反向判定**：
   - 原算法依赖顶点算术平均值（重心），在凹形多边形（凹口处）或带孔多边形（孔洞处）重心恰好位于外部或孔内，导致自相交误判为 `none`。
   - 现采用 **沿边界各边中点法线向两侧微步探测的有效内部采样算法（`findInteriorSamples`）**。作为一种基于固定步长探测的数值近似，摆脱了对凹形或带孔多边形易落入外部的算术均值（重心）的依赖；在已通过的 23 项真实用例中稳定工作。需说明的是，该微步采样为工程数值近似，不能宣称“100% 稳健”或保证能覆盖任意极窄狭缝与极小/退化几何，极值与退化多边形情况在理论上未穷尽。
   - 对 `identical donut` 与 `identical concave`，无论首点如何旋转（以不同顶点起笔）或环方向反转（顺时针/逆时针），均稳定判定为 **`full`**。
2. **目标孔洞覆盖问题**：
   - 检验目标多边形的内环孔洞（interior rings / holes）。若源几何覆盖了目标的未收录孔洞区域（孔洞内部采样点落入源有效区域），则意味着源侵入了未收录的空洞区域，判定为 **`partial`**。
   - 若源本身也排除了相同的孔洞（即源也未收录该孔洞），则不视作越界，正确判定为 **`full`**。
   - 若源完全位于孔洞内部（有效收录区完全无重叠），正确判定为 **`none`**。
3. **MultiPolygon 多块判定问题**：
   - 遍历目标 MultiPolygon 的所有子多边形，绝不仅检查第一块的首顶点。源覆盖任意子多边形均能被正确识别。
4. **凹形多边形越界检测**：
   - 不仅检测顶点，还采样各边中点，确保凹形“桥接凹槽越界”被正确识别为 **`partial`**。
5. **纯外部边界接触**：
   - 两多边形仅外部边缘接触（相切但无内部 2D 面积重叠），正确判定为 **`none`**。

---

### 2.5 核心数据契约（收敛冗余字段）

#### 类型定义 (`src/types/index.ts`)

```typescript
// 四态收录状态（供 #8 IA 使用）
export type CoverageStatus =
  | 'matched'         // 覆盖区内有匹配地点
  | 'covered-empty'   // 覆盖区内但当前可达范围无匹配地点
  | 'uncovered'       // 未收录区域（超出本地维护范围）
  | 'partial';        // 部分覆盖（等时圈跨越收录边界且未匹配）

export type CoverageOverlap = 'full' | 'partial' | 'none';

// 结构化地点检索与覆盖评估结果
export interface POIQueryResult {
  status: CoverageStatus;
  coverageOverlap: CoverageOverlap;
  isPartial: boolean;          // 当 coverageOverlap === 'partial' 时为 true
  poiByLayer: POIByLayer[];    // 按圈层分组的地点
  allPOIs: POIWithLayer[];     // 扁平化的地点列表（总数与匹配性由 allPOIs.length 直接派生）
  matchedRegion: CuratedRegion | null;
  disclaimer: string;          // 对应收录区域说明文案
}
```

> **字段收敛说明**：删去了可直接通过 `allPOIs.length` 派生的 `hasMatches` 与 `totalCount` 冗余字段，保留对 UI 有真实用途的最小必要契约。

---

## 3. 最小调用示例 (供 Issue #8 集成)

在后续 Issue #8 中，在 `IsochroneApp.tsx` 或组件中消费 `queryInterestPoints`：

```typescript
import { queryInterestPoints } from '@/lib/poi-utils';

const queryResult = useMemo(() => {
  return queryInterestPoints({
    isochrones: displayIsochrones,
    rangeMinutes: displayRangeMinutes,
    landmark: displayLandmark, // 仅用于 coordinates 兜底，不读取 city 文本
  });
}, [displayIsochrones, displayRangeMinutes, displayLandmark]);

// 1. 结构化覆盖状态消费：
if (queryResult.status === 'uncovered') {
  // 展示未收录提示：当前区域暂未收录地点（目前仅收录上海精选地点）
} else if (queryResult.status === 'covered-empty') {
  // 展示收录内无匹配：当前探索范围内暂无收录地点，可尝试扩大时间或更换出行方式
} else if (queryResult.status === 'partial') {
  // 展示部分覆盖提示：当前探索范围部分超出已收录区域
} else if (queryResult.status === 'matched') {
  // 展示地点清单：queryResult.poiByLayer 或 queryResult.allPOIs
  // 若 queryResult.isPartial 为 true，可展示“部分探索区域超出收录范围”标签
}

// 2. 地图标记渲染：直接使用 queryResult.allPOIs（保持 poi.position: [lat, lng] GCJ-02 契约）
```

---

## 4. 验收项核对与证据 (Acceptance Verification)

| 验收项目 | 状态 | 验证方法与测试证据 |
|---------|------|-------------------|
| 1. 相同坐标通过预设、定位、custom 输入时，候选点与圈层结果一致，不受 city 文案影响 | **已满足** | `tests/issue-6.test.mjs` 测试 1 构造预设（上海）、定位（我的位置）、选点（自定义位置）、任意文案 4 种输入，产出完全一致的 `matched` 状态与 POI 序列。 |
| 2. 覆盖内无匹配与未覆盖可独立构造并得到不同状态 | **已满足** | `tests/issue-6.test.mjs` 测试 2 构造崇明岛郊野无 POI 等时圈返回 `covered-empty`，构造杭州等时圈返回 `uncovered`。 |
| 3. 部分覆盖与跨边界情况明确 | **已满足** | `tests/issue-6.test.mjs` 测试 3 构造昆山/上海跨界等时圈，验证无点返回 `partial`，有点返回 `matched + isPartial`。 |
| 4. 确定性几何用例验证最小圈层、MultiPolygon、孔洞、边界策略和去重 | **已满足** | `tests/issue-6.test.mjs` 测试 4-7 分别验证 15/30/60 最小圈层归属、孔洞外闭内开排除、MultiPolygon、输入去重。 |
| 5. 坐标契约核对与输出 | **已满足** | `tests/issue-6.test.mjs` 测试 8 验证 WGS-84 包含与 GCJ-02 输出。承认数据来源于代码既有契约，未进行物理实测校准。 |
| 6. 复现几何缺陷专门回归（含相同多边形、孔洞、MultiPolygon、凹形、反向环等） | **已满足** | `tests/issue-6.test.mjs` 测试 11 与测试 12 涵盖 10 个拓扑场景（`target==target` 得 `full`、覆盖孔洞得 `partial`、MultiPolygon 第二块得 `partial`、纯外接得 `none`、避开孔洞得 `full`、孔内无重叠得 `none`、凹形穿越得 `partial`、identical donut 得 `full`、首点旋转得 `full`、环反向得 `full`、identical concave 得 `full` 等）。 |
| 7. 向后兼容现有 API | **已满足** | `tests/issue-6.test.mjs` 测试 9 验证现有方法平稳兼容。 |

---

## 5. 验证命令执行记录

```bash
# 1. 运行所有纯函数单元测试（包含 #5 的 8 项回归测试与 #6 的 15 项新增测试，共 23 项）
npm test
# 结果：23 passed, 0 failed, duration: ~128ms

# 2. TypeScript 严格类型检查
./node_modules/.bin/tsc --noEmit
# 结果：0 errors

# 3. 定向 ESLint 校验
npx eslint src/lib/geo-utils.ts src/lib/poi-utils.ts src/data/interest-points.ts src/types/index.ts tests/issue-6.test.mjs
# 结果：0 errors, 0 warnings

# 4. Git diff 格式与空白校验
git diff --check
# 结果：clean (0 warnings)
```

---

## 6. 附：关于受约束简化覆盖方案的评估建议

父级提出“若你判断通用覆盖算法不值得继续投入，请给受约束简化方案与影响让父级核定”。在此提供评估意见与简化方案供核定：

- **现状评估**：当前 `geo-utils.ts` 已修复了包括 identical donut、identical concave、首点旋转、环反转、孔洞侵入、MultiPolygon 在内的全部确定性几何缺陷，核心代码仅约 260 行纯 TypeScript，零外部依赖，测试用例已全数通过。
- **替代方案（受约束简化方案）**：
  - 若未来不希望维护任意多边形覆盖判断，可将 `CuratedRegion` 约束为**纯经纬度矩形包围盒**（`BoundingBox: { minLng, minLat, maxLng, maxLat }`）。
  - **简化接口**：等时圈与矩形盒的覆盖判断退化为：
    1. 判断等时圈外包矩形是否完全位于 `CuratedRegion` 外包盒内（`full`）；
    2. 判断等时圈是否与 `CuratedRegion` 外包盒相交（`partial`）；
    3. 完全不相交（`none`）。
  - **业务影响**：
    - 优点：算法极其简单（仅需比较 min/max 浮点数，约 15 行代码）。
    - 局限：矩形盒无法精细刻画边界（如昆山与青浦交界处呈斜向走势，矩形盒会将昆山部分区域误框入或将金山部分区域漏掉）；但在当前仅声明粗略维护范围的定位下，矩形盒方案完全可用。
- **实施者建议**：当前实现的几何算法已完全收敛并通过 23 项严谨单元测试，建议直接采用现有实现；若后续工单希望彻底抹平几何维护成本，可由父级核定切换为矩形盒简化方案。

---

## 7. 遗留限制与未验证项声明 (诚实记录)

1. **未核验外部 POI 来源与物理精度**：本任务仅保障软件代码内坐标系契约一致（WGS-84），未对历史 8 个 POI 真实经纬度与现场出入口进行实地打点或卫星图测绘核对。
2. **声明性边界为人工粗略定义**：上海收录边界为本轮划定的人工粗略多边形，非行政边界，且目前仅内置上海一地，其他城市如实返回 `uncovered`。
3. **测试为纯函数单元测试**：当前 23 项测试均为 Node 环境下的算法单元测试，非端到端用户界面测试。
4. **主界面尚未集成**：遵循工单交付边界，未修改 `IsochroneApp.tsx`，保持纯数据与几何计算契约，留待 Issue #8 集成。
