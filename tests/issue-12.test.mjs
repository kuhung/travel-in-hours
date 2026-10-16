import test from 'node:test';
import assert from 'node:assert/strict';
import { JourneyAnalytics, getJourneyContext, emitAnalytics, sanitizeAnalyticsProperties, sanitizeAnalyticsUrl } from '../src/lib/analytics.ts';

const landmark = { id: 'shanghai-yishan-road', name: 'private name', city: '上海', province: '', coordinates: [121, 31] };
const context = getJourneyContext(landmark, 'preset', 'driving-car');

function harness() {
  const events = [];
  return { events, analytics: new JourneyAnalytics((name, properties) => events.push({ name, properties })) };
}

test('manual, example and shared entries retain distinct origin dimensions without guessing shared geolocation', () => {
  assert.deepEqual(context, { entry_source: 'manual', origin_source: 'preset', travel_mode: 'driving-car' });
  assert.equal(getJourneyContext(landmark, 'example').entry_source, 'example');
  assert.equal(getJourneyContext(landmark, 'share').entry_source, 'shared');
  assert.equal(getJourneyContext({ ...landmark, id: 'current-location' }, 'current-location').origin_source, 'geolocation');
  assert.equal(getJourneyContext({ ...landmark, id: 'custom-123' }, 'custom').origin_source, 'map');
  assert.equal(getJourneyContext({ ...landmark, id: 'custom-share-121-31' }, 'share').origin_source, 'unknown');
});

test('one terminal outcome per attempt, cached retry counts separately, late/cancelled completions cannot create ready', () => {
  const { events, analytics } = harness();
  analytics.start(1, context, false);
  analytics.start(2, context, true);
  analytics.finish(1, 'ready');
  analytics.finish(2, 'ready', { coverage_status: 'matched', poi_count: 4 });
  analytics.finish(2, 'ready');
  assert.deepEqual(events.map(e => [e.name, e.properties.outcome]), [
    ['exploration_started', undefined], ['exploration_finished', 'cancelled'],
    ['exploration_started', undefined], ['exploration_finished', 'ready'],
  ]);
  assert.equal(events[2].properties.is_cached, true);
  assert.equal(events[3].properties.poi_count, 4);
  assert.ok(events.every(e => e.properties.schema_version === 2));
  assert.ok(events.every(e => !('id' in e.properties)));
});

test('empty, failed, quota and POI processing failure are terminal non-ready outcomes', () => {
  const { events, analytics } = harness();
  ['empty', 'failed', 'quota', 'poi_error'].forEach((outcome, i) => {
    analytics.start(i, context, false);
    analytics.finish(i, outcome);
  });
  assert.equal(events.filter(e => e.properties.outcome === 'ready').length, 0);
  assert.equal(events.filter(e => e.name === 'exploration_finished').length, 4);
});

test('selection counts a confirmed user intent once, never automatic restoration or repeated rendering', () => {
  const { events, analytics } = harness();
  analytics.confirmSelection('restored', context, 15);
  analytics.requestSelection('valid');
  analytics.confirmSelection('other', context, 15);
  assert.equal(events.length, 0);
  analytics.confirmSelection('valid', context, 30);
  analytics.confirmSelection('valid', context, 30);
  assert.equal(events.length, 1);
  analytics.requestSelection(null); // second click deselects
  analytics.confirmSelection('valid', context, 30);
  assert.equal(events.length, 1);
  analytics.requestSelection('valid'); // deliberate reselect counts
  analytics.confirmSelection('valid', context, 30);
  assert.equal(events.length, 2);
  analytics.requestSelection('late');
  analytics.cancel();
  analytics.confirmSelection('late', context, 30);
  assert.equal(events.length, 2);
});

test('share reception counts once, including malformed visits, with no linkage to sender actions', () => {
  const { events, analytics } = harness();
  analytics.openShare(false, false);
  analytics.openShare(true, true);
  assert.deepEqual(events, [{ name: 'share_received', properties: { valid: false, has_destination: false, schema_version: 2 } }]);
});

test('analytics allowlist excludes raw coordinates, free text, identifiers and URLs; errors cannot break UI', () => {
  const privateFields = { latitude: 31, longitude: 121, coordinates: '121,31', landmark: 'my address', poi_name: 'secret', error_message: 'private', poi_id: 'secret', url: '?lat=31', session_id: 'id' };
  assert.deepEqual(sanitizeAnalyticsProperties({ ...privateFields, ...context, poi_count: 2 }), { ...context, poi_count: 2 });
  const events = [];
  emitAnalytics((name, properties) => events.push({ name, properties }), 'navigation_requested', { ...privateFields, ...context, attempt: true });
  assert.deepEqual(events[0].properties, { ...context, attempt: true, schema_version: 2 });
  assert.doesNotThrow(() => emitAnalytics(() => { throw new Error('sdk unavailable'); }, 'test'));
  assert.equal(sanitizeAnalyticsUrl('https://example.com/?lat=31&name=private#anchor'), 'https://example.com/');
  assert.equal(sanitizeAnalyticsUrl('bad URL'), '/');
});

