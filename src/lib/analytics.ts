import { track as vercelTrack } from '@vercel/analytics';
import type { CityLandmark, TravelProfile } from '../types/index.ts';
import type { ExplorationSource } from './exploration-state.ts';

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;
export type AnalyticsSink = (name: string, properties: AnalyticsProperties) => void;
export interface JourneyContext {
  entry_source: 'manual' | 'example' | 'shared';
  origin_source: 'preset' | 'geolocation' | 'map' | 'unknown';
  travel_mode: TravelProfile;
}

const ALLOWED = new Set([
  'entry_source', 'origin_source', 'travel_mode', 'profile', 'location', 'outcome',
  'coverage_status', 'is_partial', 'poi_count', 'layer_minutes', 'is_cached',
  'remaining_quota', 'new_remaining', 'quota_used', 'is_mobile', 'attempt',
  'share_target', 'method', 'channel', 'valid', 'has_destination',
  'error_type', 'status_code', 'range_count', 'max_range', 'has_poi',
  'is_destination_share', 'mode', 'previous_mode', 'is_current_location',
]);

/** No coordinates, names, URLs, free-form errors, or visitor/attempt IDs leave this boundary. */
export function sanitizeAnalyticsProperties(input: AnalyticsProperties): AnalyticsProperties {
  return Object.fromEntries(Object.entries(input).filter(([key, value]) =>
    ALLOWED.has(key) && (value === null || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value)) ||
      (typeof value === 'string' && value.length <= 100))));
}

export function emitAnalytics(sink: AnalyticsSink, name: string, properties: AnalyticsProperties = {}) {
  try {
    sink(name, { ...sanitizeAnalyticsProperties(properties), schema_version: 2 });
  } catch {
    // Instrumentation must never interrupt exploration or external navigation.
  }
}

export function track(name: string, properties: AnalyticsProperties = {}) {
  emitAnalytics(vercelTrack, name, properties);
}

export function getJourneyContext(landmark: CityLandmark, source?: ExplorationSource, profile: TravelProfile = 'driving-car'): JourneyContext {
  return {
    entry_source: source === 'share' ? 'shared' : source === 'example' ? 'example' : 'manual',
    origin_source: landmark.id === 'current-location' ? 'geolocation'
      : landmark.id.startsWith('custom-share-') ? 'unknown'
      : landmark.id.startsWith('custom-') ? 'map' : 'preset',
    travel_mode: profile,
  };
}

/** IDs below are memory-only request guards. They are never event properties. */
export class JourneyAnalytics {
  private current: { id: number; context: JourneyContext } | null = null;
  private selection: string | null = null;
  private opened = false;
  private sink: AnalyticsSink;

  constructor(sink: AnalyticsSink) { this.sink = sink; }

  openShare(valid: boolean, hasDestination: boolean) {
    if (this.opened) return;
    this.opened = true;
    emitAnalytics(this.sink, 'share_received', { valid, has_destination: hasDestination });
  }

  start(id: number, context: JourneyContext, cached: boolean) {
    this.cancel();
    this.selection = null;
    this.current = { id, context };
    emitAnalytics(this.sink, 'exploration_started', { ...context, is_cached: cached });
  }

  finish(id: number, outcome: 'ready' | 'empty' | 'failed' | 'quota' | 'cancelled' | 'poi_error', properties: AnalyticsProperties = {}) {
    if (!this.current || this.current.id !== id) return;
    const { context } = this.current;
    this.current = null;
    emitAnalytics(this.sink, 'exploration_finished', { ...properties, ...context, outcome });
  }

  cancel() {
    if (this.current) this.finish(this.current.id, 'cancelled');
    this.selection = null;
  }

  requestSelection(id: string | null) { this.selection = id; }

  confirmSelection(id: string, context: JourneyContext, layerMinutes: number) {
    if (this.selection !== id) return;
    this.selection = null;
    emitAnalytics(this.sink, 'poi_selected', { ...context, layer_minutes: layerMinutes });
  }
}

/** Vercel automatically attaches the page URL; remove the share query before transmission. */
export function sanitizeAnalyticsUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch { return '/'; }
}
