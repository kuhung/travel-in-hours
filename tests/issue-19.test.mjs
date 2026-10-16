import test from 'node:test';
import assert from 'node:assert/strict';
import { IsochroneRequestManager, evaluateQuotaDeduction } from '../src/lib/exploration-state.ts';
import { generateCacheKey, getCachedIsochrones, setCachedIsochrones } from '../src/lib/isochrone-cache.ts';
import { snapToGrid } from '../src/lib/grid.ts';

const coordinates = [121.5, 31.2];
const landmark = { id: 'custom-test', coordinates };
const profiles = ['driving-car', 'cycling-regular', 'foot-walking'];
const ranges = [15, 30, 60];
function featuresFor(profile) {
  const radius = { 'driving-car': 0.1, 'cycling-regular': 0.03, 'foot-walking': 0.01 }[profile];
  return ranges.map(minutes => ({
    type: 'Feature',
    properties: { value: minutes * 60 },
    geometry: { type: 'Polygon', coordinates: [[[121.5, 31.2], [121.5 + radius, 31.2], [121.5, 31.2 + radius], [121.5, 31.2]]] },
  }));
}

test('同一自定义起点三种方式首次成功各扣一次；切回任一方式读取各自几何且免扣', async t => {
  const entries = new Map();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key),
  } });
  const requestedProfiles = [];
  const manager = new IsochroneRequestManager();
  const deps = {
    getCached: getCachedIsochrones,
    setCached: setCachedIsochrones,
    snapCoords: snapToGrid,
    fetchApi: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.coordinates, snapToGrid(...coordinates));
      assert.deepEqual(body.rangeMinutes, ranges);
      requestedProfiles.push(body.profile);
      return { ok: true, json: async () => ({ features: featuresFor(body.profile) }) };
    },
  };
  let deductions = 0;
  for (const [index, profile] of [...profiles, ...profiles].entries()) {
    const result = await manager.startRequest(coordinates, profile, ranges, deps);
    assert.equal(result.success, true);
    assert.equal(result.fromCache, index >= 3);
    assert.deepEqual(result.features, featuresFor(profile));
    const deduct = evaluateQuotaDeduction({ landmark, ...result, featuresCount: result.features.length });
    assert.equal(deduct, index < 3);
    deductions += Number(deduct);
  }
  assert.deepEqual(requestedProfiles, profiles);
  assert.equal(deductions, 3);
  assert.equal(entries.size, 3);
});

test('缓存键按方式区分，时间排序不修改草稿或已提交条件', () => {
  const unsorted = Object.freeze([60, 15, 30]);
  const keys = profiles.map(profile => generateCacheKey(coordinates, profile, unsorted));
  assert.equal(new Set(keys).size, 3);
  assert.equal(keys[0], generateCacheKey(coordinates, profiles[0], ranges));
  assert.deepEqual(unsorted, [60, 15, 30]);
});

test('同点切换方式失败保留恢复空间，不扣配额；成功重试才扣一次', async () => {
  const manager = new IsochroneRequestManager();
  const failed = await manager.startRequest(coordinates, 'cycling-regular', ranges, {
    fetchApi: async () => ({ ok: false, status: 503, json: async () => ({ error: '暂不可用' }) }),
  });
  assert.equal(failed.success, false);
  assert.equal(evaluateQuotaDeduction({ landmark, ...failed, featuresCount: failed.features.length }), false);
  const retried = await manager.startRequest(coordinates, 'cycling-regular', ranges, {
    fetchApi: async () => ({ ok: true, json: async () => ({ features: featuresFor('cycling-regular') }) }),
  });
  assert.equal(evaluateQuotaDeduction({ landmark, ...retried, featuresCount: retried.features.length }), true);
  for (const id of ['current-location', 'shanghai-yishan-road']) {
    assert.equal(evaluateQuotaDeduction({ landmark: { ...landmark, id }, ...retried, featuresCount: retried.features.length }), false);
  }
});
