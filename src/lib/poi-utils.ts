import { InterestPoint, IsochroneFeature } from '@/types';
import { wgs84ToGcj02 } from './coord-transform';

// 判断点是否在多边形内 (射线法)
function isPointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// 判断点是否在等时圈内
function isPointInIsochrone(point: [number, number], feature: IsochroneFeature): boolean {
  const geometry = feature.geometry;
  
  if (geometry.type === 'Polygon') {
    // Polygon 的第一个环是外边界
    return isPointInPolygon(point, geometry.coordinates[0] as number[][]);
  } else if (geometry.type === 'MultiPolygon') {
    // MultiPolygon 检查每个多边形
    for (const polygon of geometry.coordinates) {
      if (isPointInPolygon(point, polygon[0] as number[][])) {
        return true;
      }
    }
  }
  
  return false;
}

// 带圈层信息的兴趣点
export interface POIWithLayer extends InterestPoint {
  layerMinutes: number; // 所属圈层（分钟）
  index: number; // 全局序号（1-based）
  position: [number, number]; // GCJ-02 坐标 [lat, lng]
}

// 按圈层分组的结果
export interface POIByLayer {
  layerMinutes: number;
  color: string;
  fillColor: string;
  points: POIWithLayer[];
}

// 将 POI 按圈层分组
export function groupPOIsByLayer(
  interestPoints: InterestPoint[],
  isochrones: IsochroneFeature[],
  rangeMinutes: number[]
): POIByLayer[] {
  // 按时间从小到大排序等时圈
  const sortedIsochrones = [...isochrones].sort(
    (a, b) => a.properties.value - b.properties.value
  );
  
  // 颜色配置
  const colorMap: Record<number, { color: string; fillColor: string }> = {
    15: { color: '#15803d', fillColor: '#86efac' },
    30: { color: '#a16207', fillColor: '#fde68a' },
    60: { color: '#dc2626', fillColor: '#fca5a5' },
  };
  
  // 初始化结果
  const result: POIByLayer[] = rangeMinutes.map(minutes => ({
    layerMinutes: minutes,
    color: colorMap[minutes]?.color || '#3b82f6',
    fillColor: colorMap[minutes]?.fillColor || '#93c5fd',
    points: [],
  }));
  
  // 用于跟踪已分配的 POI
  const assignedPOIs = new Set<string>();
  let globalIndex = 1;
  
  // 从最小圈层开始，逐层分配 POI
  sortedIsochrones.forEach((isochrone) => {
    const minutes = isochrone.properties.value / 60;
    const layerIndex = result.findIndex(r => r.layerMinutes === minutes);
    
    if (layerIndex === -1) return;
    
    interestPoints.forEach(point => {
      if (assignedPOIs.has(point.id)) return;
      
      // 转换坐标用于检测（等时圈已经是 GCJ-02）
      const [lng, lat] = wgs84ToGcj02(point.coordinates[0], point.coordinates[1]);
      
      if (isPointInIsochrone([lng, lat], isochrone)) {
        assignedPOIs.add(point.id);
        result[layerIndex].points.push({
          ...point,
          layerMinutes: minutes,
          index: globalIndex++,
          position: [lat, lng],
        });
      }
    });
  });
  
  // 过滤掉空的圈层
  return result.filter(layer => layer.points.length > 0);
}

// 获取所有带编号的 POI（扁平化）
export function getAllPOIsWithIndex(poiByLayer: POIByLayer[]): POIWithLayer[] {
  return poiByLayer.flatMap(layer => layer.points);
}

// 格式化圈层时间显示
export function formatLayerTime(minutes: number): string {
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${hours}小时内`;
  }
  return `${minutes}分钟内`;
}

