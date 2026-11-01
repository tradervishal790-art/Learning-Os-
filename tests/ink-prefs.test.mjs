import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { DEFAULT_PREFS, normalizeInkPrefs } = await loadTs('src/inkPrefs.ts');

test('notebook pen and highlighter defaults preserve tablet-friendly palm rejection and laser behavior', () => {
  assert.equal(DEFAULT_PREFS.palmRejection, true);
  assert.equal(DEFAULT_PREFS.fingerDraw, false);
  assert.equal(DEFAULT_PREFS.laserStyle, 'dot');
  assert.equal(DEFAULT_PREFS.laserDelay, 3);
  assert.equal(DEFAULT_PREFS.hlColor, '#fde047');
});

test('custom pen and highlighter preferences survive normalization', () => {
  const prefs = normalizeInkPrefs({ color: '#123456', hlColor: '#22cc88', width: 4.5, hlWidth: 7, laserStyle: 'ink', laserDelay: 8 });
  assert.equal(prefs.color, '#123456');
  assert.equal(prefs.hlColor, '#22cc88');
  assert.equal(prefs.width, 4.5);
  assert.equal(prefs.hlWidth, 7);
  assert.equal(prefs.laserStyle, 'ink');
  assert.equal(prefs.laserDelay, 8);
});

test('malformed saved pen settings are bounded and invalid favorites discarded', () => {
  const prefs = normalizeInkPrefs({ width: 1000, hlWidth: -3, laserDelay: 99, kind: 'unknown', favorites: [{ kind: 'unknown', color: '#fff', width: 2 }, { kind: 'ballpoint', color: '#000', width: 2 }] });
  assert.equal(prefs.width, 20);
  assert.equal(prefs.hlWidth, 0.5);
  assert.equal(prefs.laserDelay, 10);
  assert.equal(prefs.kind, 'ballpoint');
  assert.deepEqual(prefs.favorites, [{ kind: 'ballpoint', color: '#000', width: 2 }]);
});
