import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShareParams, serializeShareParams, ShareVisitInitializer, resolveSharedPOI } from '../src/lib/share-params.ts';
import { createSharePayload, generateShareUrl } from '../src/lib/share-utils.ts';
import { IsochroneRequestManager, isCustomLandmark, evaluateQuotaDeduction } from '../src/lib/exploration-state.ts';
import { queryInterestPoints } from '../src/lib/poi-utils.ts';

const landmark = { id: 'preset', name: '测试地点 & 河边', city: '上海', province: '', coordinates: [121.4276, 31.1895] };
const conditions = { landmark, profile: 'cycling-regular', rangeMinutes: [15, 30, 60] };
const search = serializeShareParams(conditions, 'sh-the-bund');
const wait = () => new Promise(resolve => setTimeout(resolve, 15));

test('URL round trip uses the same committed payload for copied links and QR export', () => {
  const payload = createSharePayload({ ...conditions, isochrones: [], selectedPOIId: 'sh-the-bund' });
  const url = generateShareUrl(payload);
  const restored = parseShareParams(url.slice(url.indexOf('?')), [landmark]);
  assert.equal(restored.landmark, landmark);
  assert.equal(restored.profile, conditions.profile);
  assert.deepEqual(restored.rangeMinutes, conditions.rangeMinutes);
  assert.equal(restored.selectedPOIId, 'sh-the-bund');
  assert.equal(restored.error, null);
  assert.deepEqual(restored.warnings, []);
});

test('coordinates must be complete finite decimal numbers inside WGS-84 bounds', () => {
  for (const [key, values] of Object.entries({ lat: ['', 'NaN', 'Infinity', '91', '-91', '31junk', '0x20', '1e999'], lng: ['', '181', '-181', 'Infinity'] })) {
    for (const value of values) {
      const params = new URLSearchParams(search);
      params.set(key, value);
      const result = parseShareParams(params.toString());
      assert.ok(result.hasParams);
      assert.equal(result.landmark, null, `${key}=${value}`);
      assert.ok(result.error);
    }
  }
  assert.equal(parseShareParams('lat=0&lng=0').landmark.coordinates[0], 0);
  assert.equal(parseShareParams('lat=-90&lng=180').error, null);
  assert.ok(parseShareParams('lat=30').error);
  assert.ok(parseShareParams(`${search}&lat=32`).error);
});

test('old valid links restore, historical ranges and invalid profiles are explicitly normalized', () => {
  const result = parseShareParams('lat=31.1&lng=121.2&name=旧起点&profile=foot-walking&range=30,60');
  assert.equal(result.profile, 'foot-walking');
  assert.deepEqual(result.rangeMinutes, [15, 30, 60]);
  assert.ok(result.warnings.some(w => w.includes('历史或无效时长')));
  for (const range of ['NaN', '', '0,-1', '15,30,90', '15,30,60,60']) {
    assert.ok(parseShareParams(`lat=31&lng=121&range=${range}`).warnings.some(w => w.includes('时长')));
  }
  const fallback = parseShareParams('lat=31&lng=121&profile=teleport');
  assert.equal(fallback.profile, 'driving-car');
  assert.ok(fallback.warnings.some(w => w.includes('出行方式')));
  assert.equal(parseShareParams('').hasParams, false);
  assert.equal(parseShareParams('utm_source=friend').hasParams, false);
});

test('invalid text/POI is bounded, valid text is data, preset names cannot spoof coordinates or quota', () => {
  const params = new URLSearchParams(search);
  params.set('name', 'x'.repeat(101));
  params.set('city', '\u0000bad');
  params.set('poi', '<script>');
  const parsed = parseShareParams(params.toString());
  assert.equal(parsed.landmark.name, '分享的起点');
  assert.equal(parsed.landmark.city, '分享位置');
  assert.equal(parsed.selectedPOIId, null);
  assert.equal(parsed.warnings.length, 3);
  for (const id of ['', 'a'.repeat(129), 'has space', '../poi']) {
    params.set('poi', id);
    assert.equal(parseShareParams(params.toString()).selectedPOIId, null);
  }
  const moved = new URLSearchParams(search);
  moved.set('lat', '32');
  const custom = parseShareParams(moved.toString(), [landmark]).landmark;
  assert.deepEqual(custom.coordinates, [121.4276, 32]);
  assert.ok(isCustomLandmark(custom));
  assert.ok(evaluateQuotaDeduction({ landmark: custom, fromCache: false, success: true, featuresCount: 1, aborted: false }));
  assert.equal(evaluateQuotaDeduction({ landmark: custom, fromCache: true, success: true, featuresCount: 1, aborted: false }), false);
});

test('stable POI selects only from the newly computed list, missing/out-of-range keeps exploration', () => {
  const poi = { id: 'sh-the-bund', name: '外滩' };
  assert.equal(resolveSharedPOI(poi.id, [poi]).selected, poi);
  assert.equal(resolveSharedPOI(poi.id, [poi]).warning, null);
  assert.ok(resolveSharedPOI('removed', [poi]).warning);
  assert.equal(resolveSharedPOI('removed', [poi]).selected, null);
  assert.ok(resolveSharedPOI(poi.id, []).warning);
  assert.equal(resolveSharedPOI(null, []).warning, null);
});

test('a real curated POI survives payload → URL → current geometry query → selected detail identity', () => {
  const feature = {
    type: 'Feature', properties: { value: 3600 },
    geometry: { type: 'Polygon', coordinates: [[[121, 30.8], [122, 30.8], [122, 31.8], [121, 31.8], [121, 30.8]]] },
  };
  const original = queryInterestPoints({ isochrones: [feature], ...conditions });
  const poi = original.allPOIs.find(point => point.id === 'sh-the-bund');
  assert.ok(poi);
  const payload = createSharePayload({ ...conditions, isochrones: [feature], selectedPOIId: poi.id, selectedPOI: poi, poiByLayer: original.poiByLayer });
  const url = generateShareUrl(payload);
  const restored = parseShareParams(url.slice(url.indexOf('?')), [landmark]);
  const current = queryInterestPoints({ isochrones: [feature], landmark: restored.landmark, rangeMinutes: restored.rangeMinutes });
  assert.equal(resolveSharedPOI(restored.selectedPOIId, current.allPOIs).selected.id, poi.id);
  assert.equal(resolveSharedPOI(restored.selectedPOIId, []).selected, null);
});

test('StrictMode setup-cleanup-setup restores once, later personal edits do not replay the URL', async () => {
  const gate = new ShareVisitInitializer();
  let count = 0;
  const cleanup = gate.schedule(() => count++);
  cleanup();
  gate.schedule(() => count++);
  await wait();
  assert.equal(count, 1);
  gate.schedule(() => count++);
  await wait();
  assert.equal(count, 1);
  // Returning is a separate user action, deliberately outside the automatic gate.
  const explicitRestore = () => count++;
  explicitRestore();
  assert.equal(count, 2);
});

test('network, 429, empty features and local quota failure do not rearm automatic restoration', async () => {
  for (const failure of ['network', '429', 'empty', 'quota']) {
    const gate = new ShareVisitInitializer();
    const manager = new IsochroneRequestManager();
    let restores = 0;
    let requests = 0;
    let done;
    const completed = new Promise(resolve => { done = resolve; });
    const restore = async () => {
      restores++;
      if (failure !== 'quota') {
        await manager.startRequest([121, 31], 'driving-car', [15, 30, 60], {
          fetchApi: async () => {
            requests++;
            if (failure === 'network') throw new Error('offline');
            return new Response(JSON.stringify(failure === '429' ? { error: 'rate limited' } : { features: [] }), { status: failure === '429' ? 429 : 200 });
          },
        });
      }
      done();
    };
    gate.schedule(() => { void restore(); });
    await completed;
    gate.schedule(() => { void restore(); });
    await wait();
    assert.equal(restores, 1, failure);
    assert.equal(requests, failure === 'quota' ? 0 : 1, failure);
  }
});

