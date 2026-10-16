import type {
  InterestPoint,
  IsochroneFeature,
  POIWithLayer,
  POIByLayer,
  CoverageStatus,
  CoverageOverlap,
  CuratedRegion,
  POIQueryResult,
  QueryInterestPointsOptions,
} from '../types/index.ts';
import { wgs84ToGcj02 } from './coord-transform.ts';
import {
  isPointInGeometry,
  isPointInRing,
  evaluateGeometryOverlap,
} from './geo-utils.ts';
import {
  CURATED_REGIONS,
  getAllInterestPoints,
} from '../data/interest-points.ts';
import {
  getColorForRange,
  isochroneColors,
} from '../data/isochrone-config.ts';

// 重新导出数据类型，保证现有代码直接 import { POIWithLayer, POIByLayer } from '@/lib/poi-utils' 兼容性
export type {
  POIWithLayer,
  POIByLayer,
  CoverageStatus,
  CoverageOverlap,
  CuratedRegion,
  POIQueryResult,
  QueryInterestPointsOptions,
};

/**
 * 判断点是否在多边形单环内（射线法，委托唯一几何引擎）
 */
export function isPointInPolygon(point: [number, number], polygon: number[][]): boolean {
  return isPointInRing(point, polygon).inside;
}

/**
 * 判断点是否在等时圈要素几何内（委托唯一几何引擎）
 * 坐标系契约：point 与 feature.geometry 均使用 WGS-84 坐标系
 */
export function isPointInIsochrone(point: [number, number], feature: IsochroneFeature): boolean {
  if (!feature || !feature.geometry) return false;
  return isPointInGeometry(point, feature.geometry);
}

/**
 * 圈层标准颜色映射（由 isochrone-config.ts 单一配置源动态生成，保持导出签名向后兼容）
 */
export const LAYER_COLOR_MAP: Record<number, { color: string; fillColor: string }> = Object.fromEntries(
  isochroneColors.map((c) => [c.minutes, { color: c.color, fillColor: c.fillColor }])
);

/**
 * 将 POI 匹配并按圈层分组
 * 关键规则与契约：
 * 1. 坐标统一：point.coordinates (WGS-84) 与 isochrone.geometry (WGS-84) 统一在 WGS-84 空间做几何包含计算，杜绝单侧偏移。
 * 2. 最小圈层：按 properties.value 从小到大排序圈层，每点仅归入其可达的最小分钟层。
 * 3. 几何健壮：完整支持 Polygon 孔洞排除、MultiPolygon 以及外边界闭合/孔边界排除策略。
 * 4. 去重：同一 id 的输入 POI 仅保留首个有效实体，避免重复分配。
 * 5. 显示契约：输出结果保留原始 id，position 转换为 GCJ-02 [lat, lng] 以符合 Leaflet 地图标记渲染约定。
 * 6. rating 语义：保持本地人工推荐指数（1-5），不篡改为用户评分。
 */
export function groupPOIsByLayer(
  interestPoints: InterestPoint[],
  isochrones: IsochroneFeature[],
  rangeMinutes: number[] = [15, 30, 60]
): POIByLayer[] {
  if (!interestPoints || interestPoints.length === 0 || !isochrones || isochrones.length === 0) {
    return [];
  }

  // 1. 输入数据去重与防脏数据
  const seenIds = new Set<string>();
  const uniquePoints: InterestPoint[] = [];
  for (const p of interestPoints) {
    if (p && p.id && !seenIds.has(p.id)) {
      seenIds.add(p.id);
      uniquePoints.push(p);
    }
  }

  // 2. 按时间从小到大排序等时圈（确保每点归入其最小可达圈层）
  const sortedIsochrones = [...isochrones].sort(
    (a, b) => a.properties.value - b.properties.value
  );

  // 3. 初始化圈层分组结构（直接读取 getColorForRange 单一源）
  const result: POIByLayer[] = rangeMinutes.map(minutes => {
    const config = getColorForRange(minutes);
    return {
      layerMinutes: minutes,
      color: config.color,
      fillColor: config.fillColor,
      points: [],
    };
  });

  // 4. 跟踪已分配的 POI 与全局顺序编号
  const assignedPOIs = new Set<string>();
  let globalIndex = 1;

  for (const isochrone of sortedIsochrones) {
    const minutes = Math.round(isochrone.properties.value / 60);
    const layerIndex = result.findIndex(r => r.layerMinutes === minutes);
    if (layerIndex === -1) continue;

    for (const point of uniquePoints) {
      if (assignedPOIs.has(point.id)) continue;

      // 坐标核对：point.coordinates 是 [lng, lat] (WGS-84)
      // isochrone.geometry 也是 WGS-84 坐标
      if (isPointInIsochrone(point.coordinates, isochrone)) {
        assignedPOIs.add(point.id);

        // 仅在输出结果给地图渲染时转换为 GCJ-02 [lat, lng]
        const [gcjLng, gcjLat] = wgs84ToGcj02(point.coordinates[0], point.coordinates[1]);

        result[layerIndex].points.push({
          ...point,
          layerMinutes: minutes,
          index: globalIndex++,
          position: [gcjLat, gcjLng],
        });
      }
    }
  }

  // 过滤掉未匹配到任何地点的空圈层
  return result.filter(layer => layer.points.length > 0);
}

/**
 * 结构化查询地点与评估收录覆盖状态
 * 供 #6 纯数据接口交付以及后续 #8 UI 工单消费
 */
export function queryInterestPoints(options: QueryInterestPointsOptions): POIQueryResult {
  const rangeMinutes = options.rangeMinutes || [15, 30, 60];
  const allPoints = options.allPoints || getAllInterestPoints();
  const regions = options.regions || CURATED_REGIONS;
  const isochrones = options.isochrones || [];
  const originCoordinates = options.originCoordinates || options.landmark?.coordinates || null;

  // 1. 无等时圈数据时的边界处理（如初始状态、请求失败或返回空几何）
  if (isochrones.length === 0) {
    if (originCoordinates) {
      for (const region of regions) {
        if (isPointInGeometry(originCoordinates, region.boundary)) {
          return {
            status: 'covered-empty',
            coverageOverlap: 'full',
            isPartial: false,
            poiByLayer: [],
            allPOIs: [],
            matchedRegion: region,
            disclaimer: region.disclaimer,
          };
        }
      }
    }
    return {
      status: 'uncovered',
      coverageOverlap: 'none',
      isPartial: false,
      poiByLayer: [],
      allPOIs: [],
      matchedRegion: null,
      disclaimer: '当前探索区域暂未建立精选地点库',
    };
  }

  // 2. 基于最外层/最大等时圈几何判定与各收录区域的空间覆盖关系
  const largestIsochrone = [...isochrones].sort(
    (a, b) => b.properties.value - a.properties.value
  )[0];

  let bestOverlap: CoverageOverlap = 'none';
  let bestRegion: CuratedRegion | null = null;

  for (const region of regions) {
    const overlap = evaluateGeometryOverlap(largestIsochrone.geometry, region.boundary);
    if (overlap === 'full') {
      bestOverlap = 'full';
      bestRegion = region;
      break;
    } else if (overlap === 'partial') {
      bestOverlap = 'partial';
      bestRegion = region;
    }
  }

  // 3. 执行纯几何包含匹配（按地理范围筛选候选点，不依赖起点 city 字符串）
  const poiByLayer = groupPOIsByLayer(allPoints, isochrones, rangeMinutes);
  const allPOIs = getAllPOIsWithIndex(poiByLayer);
  const hasMatches = allPOIs.length > 0;

  // 4. 严格结构化状态合成：
  //    - matched: 覆盖区内有匹配地点（若跨越边界则附带 isPartial=true）
  //    - covered-empty: 完全在覆盖区内，但当前范围无匹配地点
  //    - uncovered: 完全在覆盖区外
  //    - partial: 等时圈部分落在覆盖区内但无匹配地点
  let status: CoverageStatus;
  let isPartial = false;

  if (hasMatches) {
    status = 'matched';
    isPartial = bestOverlap === 'partial';
  } else {
    if (bestOverlap === 'full') {
      status = 'covered-empty';
      isPartial = false;
    } else if (bestOverlap === 'partial') {
      status = 'partial';
      isPartial = true;
    } else {
      status = 'uncovered';
      isPartial = false;
    }
  }

  return {
    status,
    coverageOverlap: bestOverlap,
    isPartial,
    poiByLayer,
    allPOIs,
    matchedRegion: bestRegion,
    disclaimer: bestRegion?.disclaimer || '本地维护精选收录数据',
  };
}

/**
 * 获取所有带编号的 POI（扁平化）
 */
export function getAllPOIsWithIndex(poiByLayer: POIByLayer[]): POIWithLayer[] {
  return poiByLayer.flatMap(layer => layer.points);
}

/**
 * 格式化圈层时间显示（保留向后兼容）
 */
export function formatLayerTime(minutes: number): string {
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${hours}小时内`;
  }
  return `${minutes}分钟内`;
}

/**
 * 格式化圈层互斥最小时间区间（例如 15分钟内、15–30分钟、30–60分钟）
 * 用于图例、清单分组与地图弹层，避免把圈层时间当成单点精确行程时间
 */
export function formatExclusiveTierTime(
  minutes: number,
  allRanges: number[] = [15, 30, 60]
): string {
  const sorted = [...allRanges].sort((a, b) => a - b);
  const idx = sorted.indexOf(minutes);
  if (idx <= 0) {
    if (minutes >= 60) return `${minutes / 60}小时内`;
    return `${minutes}分钟内`;
  }
  const prev = sorted[idx - 1];
  return `${prev}–${minutes}分钟`;
}

