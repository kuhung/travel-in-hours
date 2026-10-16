/**
 * 几何计算与空间关系基础工具库
 *
 * 坐标系约定：
 * - 纯几何与点包含关系（Point-in-Polygon, PIP）均在原始 WGS-84 坐标系下进行计算（单位：度，[lng, lat]）。
 * - 边界策略明确：
 *   - 外边界（exterior ring）：闭区间包含（inclusive，点在边上视为在多边形内）。
 *   - 孔边界（interior ring / holes）：开区间排除（exclusive，点在孔洞边上视为在孔洞内，即排除在多边形外）。
 */

export type Point = [number, number]; // [lng, lat]

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface GeometryLike {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

export type SupportedGeometry = GeometryLike;

export type OverlapResult = 'full' | 'partial' | 'none';

const EPSILON = 1e-9;

/**
 * 计算单个环的最小外包矩形 (Bounding Box)
 */
export function computeRingBoundingBox(ring: number[][]): BoundingBox {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const pt of ring) {
    const lng = pt[0];
    const lat = pt[1];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return { minLng, minLat, maxLng, maxLat };
}

/**
 * 计算单个多边形 (含外边界及孔) 的最小外包矩形
 */
export function computePolygonBoundingBox(polygonCoordinates: number[][][]): BoundingBox {
  if (!polygonCoordinates || polygonCoordinates.length === 0 || !polygonCoordinates[0]) {
    return { minLng: 0, minLat: 0, maxLng: 0, maxLat: 0 };
  }
  return computeRingBoundingBox(polygonCoordinates[0]);
}

/**
 * 计算 MultiPolygon 的全局最小外包矩形
 */
export function computeMultiPolygonBoundingBox(multiPolygonCoordinates: number[][][][]): BoundingBox {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const poly of multiPolygonCoordinates) {
    if (!poly || poly.length === 0 || !poly[0]) continue;
    const bbox = computeRingBoundingBox(poly[0]);
    if (bbox.minLng < minLng) minLng = bbox.minLng;
    if (bbox.maxLng > maxLng) maxLng = bbox.maxLng;
    if (bbox.minLat < minLat) minLat = bbox.minLat;
    if (bbox.maxLat > maxLat) maxLat = bbox.maxLat;
  }

  if (minLng === Infinity) {
    return { minLng: 0, minLat: 0, maxLng: 0, maxLat: 0 };
  }

  return { minLng, minLat, maxLng, maxLat };
}

/**
 * 计算 GeoJSON 几何的最小外包矩形
 */
export function computeGeometryBoundingBox(geometry: GeometryLike): BoundingBox {
  if (geometry.type === 'Polygon') {
    return computePolygonBoundingBox(geometry.coordinates as number[][][]);
  }
  return computeMultiPolygonBoundingBox(geometry.coordinates as number[][][][]);
}

/**
 * 判定两外包矩形是否相交
 */
export function doBoundingBoxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.maxLng < b.minLng ||
    a.minLng > b.maxLng ||
    a.maxLat < b.minLat ||
    a.minLat > b.maxLat
  );
}

/**
 * 判定点是否位于外包矩形内（支持容差）
 */
export function isPointInBoundingBox(point: Point, bbox: BoundingBox, epsilon = EPSILON): boolean {
  const [lng, lat] = point;
  return (
    lng >= bbox.minLng - epsilon &&
    lng <= bbox.maxLng + epsilon &&
    lat >= bbox.minLat - epsilon &&
    lat <= bbox.maxLat + epsilon
  );
}

/**
 * 判定点是否位于线段上（含端点）
 */
export function isPointOnSegment(point: Point, segStart: Point, segEnd: Point, epsilon = EPSILON): boolean {
  const [px, py] = point;
  const [x1, y1] = segStart;
  const [x2, y2] = segEnd;

  const minX = Math.min(x1, x2) - epsilon;
  const maxX = Math.max(x1, x2) + epsilon;
  const minY = Math.min(y1, y2) - epsilon;
  const maxY = Math.max(y1, y2) + epsilon;

  if (px < minX || px > maxX || py < minY || py > maxY) {
    return false;
  }

  const cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < epsilon) {
    return Math.hypot(px - x1, py - y1) <= epsilon;
  }

  return Math.abs(cross) / len <= epsilon;
}

/**
 * 二维向量方向 (Orientations)
 * 0: 共线, 1: 顺时针, 2: 逆时针
 */
function getOrientation(p: Point, q: Point, r: Point): number {
  const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (Math.abs(val) < 1e-11) return 0;
  return val > 0 ? 1 : 2;
}

/**
 * 判定两线段是否在几何内部真跨立穿越（Proper Crossing）
 * 排除端点重合或共线重叠等纯边界接触
 */
export function doSegmentsProperlyCross(p1: Point, q1: Point, p2: Point, q2: Point): boolean {
  const minX1 = Math.min(p1[0], q1[0]);
  const maxX1 = Math.max(p1[0], q1[0]);
  const minY1 = Math.min(p1[1], q1[1]);
  const maxY1 = Math.max(p1[1], q1[1]);

  const minX2 = Math.min(p2[0], q2[0]);
  const maxX2 = Math.max(p2[0], q2[0]);
  const minY2 = Math.min(p2[1], q2[1]);
  const maxY2 = Math.max(p2[1], q2[1]);

  if (maxX1 < minX2 || minX1 > maxX2 || maxY1 < minY2 || minY1 > maxY2) {
    return false;
  }

  const o1 = getOrientation(p1, q1, p2);
  const o2 = getOrientation(p1, q1, q2);
  const o3 = getOrientation(p2, q2, p1);
  const o4 = getOrientation(p2, q2, q1);

  // 严格异侧（非 0），即真跨立穿越
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}

/**
 * 判定两线段是否相交（支持端点接触与共线重叠）
 */
export function doSegmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point): boolean {
  const minX1 = Math.min(p1[0], q1[0]);
  const maxX1 = Math.max(p1[0], q1[0]);
  const minY1 = Math.min(p1[1], q1[1]);
  const maxY1 = Math.max(p1[1], q1[1]);

  const minX2 = Math.min(p2[0], q2[0]);
  const maxX2 = Math.max(p2[0], q2[0]);
  const minY2 = Math.min(p2[1], q2[1]);
  const maxY2 = Math.max(p2[1], q2[1]);

  if (maxX1 < minX2 || minX1 > maxX2 || maxY1 < minY2 || minY1 > maxY2) {
    return false;
  }

  const o1 = getOrientation(p1, q1, p2);
  const o2 = getOrientation(p1, q1, q2);
  const o3 = getOrientation(p2, q2, p1);
  const o4 = getOrientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  if (o1 === 0 && isPointOnSegment(p2, p1, q1)) return true;
  if (o2 === 0 && isPointOnSegment(q2, p1, q1)) return true;
  if (o3 === 0 && isPointOnSegment(p1, p2, q2)) return true;
  if (o4 === 0 && isPointOnSegment(q1, p2, q2)) return true;

  return false;
}

/**
 * 射线法判定点是否在单个线性环内，同时明确返回是否位于边界上
 */
export function isPointInRing(point: Point, ring: number[][]): { inside: boolean; onBoundary: boolean } {
  if (!ring || ring.length < 3) {
    return { inside: false, onBoundary: false };
  }

  const [x, y] = point;
  const n = ring.length;

  for (let i = 0; i < n; i++) {
    const nextIdx = (i + 1) % n;
    const p1: Point = [ring[i][0], ring[i][1]];
    const p2: Point = [ring[nextIdx][0], ring[nextIdx][1]];

    if (isPointOnSegment(point, p1, p2)) {
      return { inside: true, onBoundary: true };
    }
  }

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    if ((yi > y) !== (yj > y)) {
      const intersectX = ((yj - y) * xi + (y - yi) * xj) / (yj - yi);
      if (x < intersectX) {
        inside = !inside;
      }
    }
  }

  return { inside, onBoundary: false };
}

/**
 * 判定点是否位于单个 Polygon（含外边界及孔洞）内
 * 边界策略：
 * - 点在外边界上：属于外边界，视为在多边形内 (inclusive)。
 * - 点在孔洞边界上：属于孔洞区域，排除在多边形外 (exclusive)。
 */
export function isPointInPolygonRings(point: Point, rings: number[][][]): boolean {
  if (!rings || rings.length === 0 || !rings[0] || rings[0].length < 3) {
    return false;
  }

  const exteriorResult = isPointInRing(point, rings[0]);
  if (!exteriorResult.inside) {
    return false;
  }

  for (let h = 1; h < rings.length; h++) {
    const holeRing = rings[h];
    if (!holeRing || holeRing.length < 3) continue;

    const holeResult = isPointInRing(point, holeRing);
    if (holeResult.inside) {
      return false;
    }
  }

  return true;
}

/**
 * 判定点是否严格位于单个 Polygon 内部（不含外边界与孔边界）
 */
export function isPointStrictlyInsidePolygonRings(point: Point, rings: number[][][]): boolean {
  if (!rings || rings.length === 0 || !rings[0] || rings[0].length < 3) {
    return false;
  }

  const exteriorResult = isPointInRing(point, rings[0]);
  if (!exteriorResult.inside || exteriorResult.onBoundary) {
    return false;
  }

  for (let h = 1; h < rings.length; h++) {
    const holeRing = rings[h];
    if (!holeRing || holeRing.length < 3) continue;

    const holeResult = isPointInRing(point, holeRing);
    if (holeResult.inside) {
      return false;
    }
  }

  return true;
}

/**
 * 判定点是否位于 MultiPolygon 内
 */
export function isPointInMultiPolygonRings(point: Point, multiRings: number[][][][]): boolean {
  if (!multiRings || multiRings.length === 0) {
    return false;
  }

  for (const polygonRings of multiRings) {
    if (isPointInPolygonRings(point, polygonRings)) {
      return true;
    }
  }

  return false;
}

/**
 * 判定点是否在 GeoJSON Geometry (Polygon 或 MultiPolygon) 内
 */
export function isPointInGeometry(point: Point, geometry: GeometryLike): boolean {
  if (geometry.type === 'Polygon') {
    return isPointInPolygonRings(point, geometry.coordinates as number[][][]);
  } else if (geometry.type === 'MultiPolygon') {
    return isPointInMultiPolygonRings(point, geometry.coordinates as number[][][][]);
  }
  return false;
}

/**
 * 提取几何中所有的连续线段 (Segments)
 */
function extractSegmentsFromRings(rings: number[][][]): [Point, Point][] {
  const segments: [Point, Point][] = [];
  for (const ring of rings) {
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const nextIdx = (i + 1) % n;
      if (i === n - 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1]) {
        continue;
      }
      segments.push([[ring[i][0], ring[i][1]], [ring[nextIdx][0], ring[nextIdx][1]]]);
    }
  }
  return segments;
}

/**
 * 稳健提取多边形的有效内部采样点
 * 沿每条边中点的法线向两侧微步探测，确保独立于顶点首点旋转、环方向或凹形/空洞几何，
 * 绝不依赖不保证在内部的顶点算术平均值
 */
export function findInteriorSamples(rings: number[][][]): Point[] {
  const samples: Point[] = [];
  const ring = rings[0];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const nextIdx = (i + 1) % n;
    if (i === n - 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1]) continue;
    const p1 = ring[i];
    const p2 = ring[nextIdx];
    const mx = (p1[0] + p2[0]) / 2;
    const my = (p1[1] + p2[1]) / 2;
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const nx = -dy / len;
    const ny = dx / len;
    const delta = Math.min(1e-4, len * 0.01);
    for (const factor of [1, -1]) {
      const pt: Point = [mx + factor * delta * nx, my + factor * delta * ny];
      if (isPointStrictlyInsidePolygonRings(pt, rings)) {
        samples.push(pt);
      }
    }
  }
  return samples;
}

/**
 * 评估单个源多边形 (ringsS) 相对于单个目标多边形 (ringsT) 的重叠关系
 * - 'full': S 完全处于 T 内部（S ⊆ T，且 S 未覆盖 T 的任何孔洞，且 S 的外边界未越界）
 * - 'partial': S 与 T 存在公共面积，但 S 并不完全包含在 T 内（或 S 覆盖了 T 的孔洞，或跨界）
 * - 'none': S 与 T 完全不相交（含纯外部边缘相接无 2D 面积重叠场景）
 */
function evaluateSinglePolygonPair(
  ringsS: number[][][],
  ringsT: number[][][]
): OverlapResult {
  const bboxS = computePolygonBoundingBox(ringsS);
  const bboxT = computePolygonBoundingBox(ringsT);

  // 1. 外包盒快速排斥
  if (!doBoundingBoxesIntersect(bboxS, bboxT)) {
    return 'none';
  }

  const segmentsS = extractSegmentsFromRings(ringsS);
  const segmentsT = extractSegmentsFromRings(ringsT);

  // 2. 真跨立相交检测（Proper Crossing）：若 S 的边界真穿过 T 的外边界或孔边界，必为 partial
  for (const segS of segmentsS) {
    for (const segT of segmentsT) {
      if (doSegmentsProperlyCross(segS[0], segS[1], segT[0], segT[1])) {
        return 'partial';
      }
    }
  }

  // 3. 稳健检测两多边形是否存在真正的 2D 内部面积重叠（排除纯外部边缘接触）
  let has2DOverlap = false;
  const samplesS = findInteriorSamples(ringsS);
  for (const pt of samplesS) {
    if (isPointStrictlyInsidePolygonRings(pt, ringsT)) {
      has2DOverlap = true;
      break;
    }
  }
  if (!has2DOverlap) {
    const samplesT = findInteriorSamples(ringsT);
    for (const pt of samplesT) {
      if (isPointStrictlyInsidePolygonRings(pt, ringsS)) {
        has2DOverlap = true;
        break;
      }
    }
  }

  // 若无任何 2D 内部面积重叠（纯外部边缘相接或完全不相交） -> none
  if (!has2DOverlap) {
    return 'none';
  }

  // 4. 已有 2D 面积重叠，判定 S 是否完全落入 T 内部 (full) 还是超出 T (partial)
  // (a) 检查 S 外环的顶点是否落在 T 外部（闭区间，在外边界线上视为在内）
  for (const pt of ringsS[0]) {
    const p: Point = [pt[0], pt[1]];
    if (!isPointInPolygonRings(p, ringsT)) {
      return 'partial';
    }
  }

  // (b) 检查 S 外环边缘中点（防外环凹形穿越，如两顶点在边上但中线跨出多边形）
  const extSegmentsS = extractSegmentsFromRings([ringsS[0]]);
  for (const seg of extSegmentsS) {
    const mid: Point = [(seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2];
    if (!isPointInPolygonRings(mid, ringsT)) {
      return 'partial';
    }
  }

  // (c) 检查 T 的未收录孔洞是否被 S 覆盖
  //     若 T 存在孔洞，且孔洞内部被 S 覆盖（即孔洞内部点落入了 S 有效区域），说明 S 侵入了未收录的空洞区域，S 必为 partial；
  //     若 S 本身也排除了同样的孔洞（即孔洞内部点同样不属于 S），则不视作越界
  if (ringsT.length > 1) {
    for (let h = 1; h < ringsT.length; h++) {
      const holeRing = ringsT[h];
      const holeSamples = findInteriorSamples([holeRing]);
      for (const hPt of holeSamples) {
        if (isPointInPolygonRings(hPt, ringsS)) {
          return 'partial';
        }
      }
    }
  }

  return 'full';
}

/**
 * 评估源几何 (等时圈 subjectGeom) 相对于目标几何 (收录区域 targetGeom) 的覆盖关系
 * 支持 Polygon / MultiPolygon 全组合、孔洞排除、跨界、内外边界明确策略
 * 返回：
 * - 'full': 源几何完全处于目标区域内（所有块均 full）
 * - 'partial': 源几何与目标区域有交集，但未达到完全覆盖
 * - 'none': 源几何与目标区域完全无交集
 */
export function evaluateGeometryOverlap(
  subjectGeom: GeometryLike,
  targetGeom: GeometryLike
): OverlapResult {
  const subjectPolygons: number[][][][] =
    subjectGeom.type === 'Polygon'
      ? [subjectGeom.coordinates as number[][][]]
      : (subjectGeom.coordinates as number[][][][]);

  const targetPolygons: number[][][][] =
    targetGeom.type === 'Polygon'
      ? [targetGeom.coordinates as number[][][]]
      : (targetGeom.coordinates as number[][][][]);

  if (!subjectPolygons.length || !targetPolygons.length) {
    return 'none';
  }

  let allSubjectsFull = true;
  let anySubjectHasOverlap = false;

  for (const sPoly of subjectPolygons) {
    let sOverlapWithTarget: OverlapResult = 'none';

    for (const tPoly of targetPolygons) {
      const res = evaluateSinglePolygonPair(sPoly, tPoly);
      if (res === 'full') {
        sOverlapWithTarget = 'full';
        break; // 只要被某一个目标块完全包含，该源块即为 full
      } else if (res === 'partial') {
        sOverlapWithTarget = 'partial';
      }
    }

    if (sOverlapWithTarget === 'full') {
      anySubjectHasOverlap = true;
    } else if (sOverlapWithTarget === 'partial') {
      anySubjectHasOverlap = true;
      allSubjectsFull = false;
    } else {
      allSubjectsFull = false;
    }
  }

  if (allSubjectsFull && anySubjectHasOverlap) {
    return 'full';
  }
  if (anySubjectHasOverlap) {
    return 'partial';
  }
  return 'none';
}
