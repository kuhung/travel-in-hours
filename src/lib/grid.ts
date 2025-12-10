
/**
 * 网格系统配置
 */
export const GRID_CONFIG = {
  // 网格大小（米）
  CELL_SIZE: 500,
  // 坐标精度（保留小数位）
  PRECISION: 6
};

/**
 * 将经纬度坐标对齐到指定大小的网格中心
 * @param lng 经度
 * @param lat 纬度
 * @returns [snappedLng, snappedLat] 对齐后的坐标
 */
export function snapToGrid(lng: number, lat: number): [number, number] {
  // 地球半径 (米)
  const R = 6378137;
  
  // 纬度每度的距离 (米) - 近似值
  // 1度纬度 ≈ 111111米
  const metersPerLatDeg = 111111;
  
  // 计算纬度步长 (度)
  const latStep = GRID_CONFIG.CELL_SIZE / metersPerLatDeg;
  
  // 对齐纬度
  const snappedLat = Math.round(lat / latStep) * latStep;
  
  // 经度每度的距离 (米) - 取决于纬度
  // 1度经度 ≈ 111111 * cos(lat) 米
  const metersPerLngDeg = 111111 * Math.cos(snappedLat * Math.PI / 180);
  
  // 计算经度步长 (度)
  const lngStep = GRID_CONFIG.CELL_SIZE / metersPerLngDeg;
  
  // 对齐经度
  const snappedLng = Math.round(lng / lngStep) * lngStep;
  
  return [
    Number(snappedLng.toFixed(GRID_CONFIG.PRECISION)),
    Number(snappedLat.toFixed(GRID_CONFIG.PRECISION))
  ];
}

