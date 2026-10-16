import test from 'node:test';
import assert from 'node:assert/strict';
import { focusMapOnLocation } from '../src/lib/map-viewport.ts';
import { wgs84ToGcj02 } from '../src/lib/coord-transform.ts';
import { getCoverageStatusDescription, resolvePOIListOpen } from '../src/lib/layout-utils.ts';

test('定位立即停止旧动画，转换坐标并避让侧栏；同坐标再次定位仍有效', () => {
  const calls = [];
  const map = {
    stop: () => calls.push('stop'),
    fitBounds: (bounds, options) => calls.push({ bounds, options }),
  };
  const padding = { paddingTopLeft: [344, 80], paddingBottomRight: [344, 48] };
  const coordinates = [113.5767, 22.2707];
  focusMapOnLocation(map, coordinates, padding);
  focusMapOnLocation(map, coordinates, padding);
  const [lng, lat] = wgs84ToGcj02(...coordinates);
  assert.equal(calls.length, 4);
  assert.equal(calls[0], 'stop');
  assert.deepEqual(calls[1].bounds, [[lat, lng], [lat, lng]]);
  assert.deepEqual(calls[1].options, { ...padding, maxZoom: 14, animate: true, duration: 0.6 });
  assert.deepEqual(calls[3], calls[1]);
});

test('定位支持减少动态效果并提供默认边距', () => {
  let options;
  focusMapOnLocation({ stop() {}, fitBounds: (_, value) => { options = value; } }, [0, 0], undefined, true);
  assert.equal(options.animate, false);
  assert.deepEqual(options.paddingTopLeft, [50, 50]);
  assert.deepEqual(options.paddingBottomRight, [50, 50]);
});

test('所有零匹配状态都明确可在地图查看范围，无需换起点', () => {
  for (const status of ['uncovered', 'covered-empty', 'partial']) {
    const description = getCoverageStatusDescription({ status, isPartial: status === 'partial', matchedCount: 0 });
    assert.match(description.explanation, /可达范围已显示在地图上/);
    assert.doesNotMatch(description.helpfulNote, /建议.*(更换|移至|重新)/);
    assert.equal(description.badgeVariant, 'info');
  }
});


test('零 POI 默认折叠，手动查看只作用于当前结果，错误保留恢复入口', () => {
  const params = { resultId: 1, matchedCount: 0, preference: null };
  assert.equal(resolvePOIListOpen(params), false);
  assert.equal(resolvePOIListOpen({ ...params, matchedCount: 3 }), true);
  assert.equal(resolvePOIListOpen({ ...params, dataError: '匹配失败' }), true);
  const preference = { resultId: 1, open: true };
  assert.equal(resolvePOIListOpen({ ...params, preference }), true);
  assert.equal(resolvePOIListOpen({ ...params, resultId: 2, preference }), false);
  assert.equal(resolvePOIListOpen({ ...params, matchedCount: 3, preference: { resultId: 1, open: false } }), false);
  assert.equal(resolvePOIListOpen({ ...params, resultId: 2, matchedCount: 3, preference: { resultId: 1, open: false } }), true);
});
