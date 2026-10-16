import type { CityLandmark, TravelProfile } from '../types/index.ts';

const RANGES = [15, 30, 60];
const KEYS = ['lat', 'lng', 'name', 'city', 'profile', 'range', 'poi'];

export interface ParsedShareParams {
  hasParams: boolean;
  landmark: CityLandmark | null;
  profile: TravelProfile;
  rangeMinutes: number[];
  selectedPOIId: string | null;
  warnings: string[];
  error: string | null;
}

/** Read one immutable visit. Names never override the coordinates supplied by the sender. */
export function parseShareParams(search: string, landmarks: CityLandmark[] = []): ParsedShareParams {
  const params = new URLSearchParams(search);
  const result: ParsedShareParams = {
    hasParams: KEYS.some(key => params.has(key)),
    landmark: null,
    profile: 'driving-car',
    rangeMinutes: [...RANGES],
    selectedPOIId: null,
    warnings: [],
    error: null,
  };
  if (!result.hasParams) return result;
  if (KEYS.some(key => params.getAll(key).length > 1)) {
    result.error = '分享链接包含重复条件，请向发送者获取完整链接，或手动选择起点。';
    return result;
  }
  const number = (key: string, max: number) => {
    const raw = params.get(key)?.trim();
    if (!raw || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null;
    const value = Number(raw);
    return Number.isFinite(value) && Math.abs(value) <= max ? value : null;
  };
  const lat = number('lat', 90);
  const lng = number('lng', 180);
  if (lat === null || lng === null) {
    result.error = '分享链接的起点坐标无效，请向发送者获取完整链接，或手动选择起点。';
    return result;
  }
  const text = (key: string, fallback: string) => {
    const value = params.get(key)?.trim();
    if (!value || value.length > 100 || /[\u0000-\u001f\u007f]/.test(value)) {
      result.warnings.push(`已使用默认${key === 'name' ? '起点名称' : '城市名称'}。`);
      return fallback;
    }
    return value;
  };
  const name = text('name', '分享的起点');
  const city = text('city', '分享位置');
  const preset = landmarks.find(l => l.name === name && l.city === city &&
    Math.abs(l.coordinates[0] - lng) < 0.000001 && Math.abs(l.coordinates[1] - lat) < 0.000001);
  result.landmark = preset || {
    id: `custom-share-${lng}-${lat}`, name, city, province: '', coordinates: [lng, lat],
  };
  const profile = params.get('profile');
  if (profile === 'driving-car' || profile === 'cycling-regular' || profile === 'foot-walking') {
    result.profile = profile;
  } else if (profile !== null) {
    result.warnings.push('分享链接的出行方式无效，已改用驾车。');
  }
  const range = params.get('range');
  if (range !== null && range !== '15,30,60') {
    result.warnings.push('此链接的历史或无效时长已调整为 15 / 30 / 60 分钟，将按这三档重新计算。');
  }
  const poi = params.get('poi');
  if (poi !== null) {
    if (/^[a-zA-Z0-9_-]{1,128}$/.test(poi)) result.selectedPOIId = poi;
    else result.warnings.push('分享链接的地点编号无效，已保留起点与可达范围。');
  }
  return result;
}

export function serializeShareParams(conditions: {
  landmark: CityLandmark;
  profile: TravelProfile;
  rangeMinutes: readonly number[];
}, selectedPOIId?: string | null): string {
  const { landmark, profile, rangeMinutes } = conditions;
  const params = new URLSearchParams({
    lat: String(landmark.coordinates[1]), lng: String(landmark.coordinates[0]),
    name: landmark.name, city: landmark.city, profile, range: rangeMinutes.join(','),
  });
  if (selectedPOIId) params.set('poi', selectedPOIId);
  return params.toString();
}

/** Scheduling is cancellable before mount settles; failures never reset the consumed flag. */
export class ShareVisitInitializer {
  private consumed = false;
  schedule(restore: () => void): () => void {
    if (this.consumed) return () => {};
    const timer = setTimeout(() => {
      if (this.consumed) return;
      this.consumed = true;
      restore();
    }, 0);
    return () => clearTimeout(timer);
  }
}

export function resolveSharedPOI<T extends { id: string }>(id: string | null, points: T[]) {
  const selected = id ? points.find(point => point.id === id) || null : null;
  return {
    selected,
    warning: id && !selected
      ? '分享的地点当前未在可达清单中找到（可能已移除或范围已变化），已保留起点与可达范围。'
      : null,
  };
}
