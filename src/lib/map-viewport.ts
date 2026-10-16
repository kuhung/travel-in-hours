import { wgs84ToGcj02 } from './coord-transform.ts';
import type { MapPaddingResult } from './layout-utils.ts';

type Position = [number, number];
interface FocusableMap {
  stop(): unknown;
  fitBounds(bounds: [Position, Position], options: MapPaddingResult & {
    maxZoom: number;
    animate: boolean;
    duration: number;
  }): unknown;
}

/** 定位成功立即聚焦；独立于已提交范围，并避让当前侧栏。 */
export function focusMapOnLocation(
  map: FocusableMap,
  coordinates: [number, number],
  padding?: MapPaddingResult,
  reduceMotion = false,
): void {
  const [lng, lat] = wgs84ToGcj02(...coordinates);
  const position: Position = [lat, lng];
  map.stop();
  map.fitBounds([position, position], {
    ...(padding ?? { paddingTopLeft: [50, 50], paddingBottomRight: [50, 50] }),
    maxZoom: 14,
    animate: !reduceMotion,
    duration: 0.6,
  });
}
