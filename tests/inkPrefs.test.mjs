import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { normalizeInkPrefs, DEFAULT_PREFS } = await loadTs('src/inkPrefs.ts');

test('normalizes invalid persisted pen settings to safe defaults', () => {
  const prefs = normalizeInkPrefs({
    kind: 'not-a-pen',
    width: Infinity,
    smoothing: 9,
    eraserMode: 'unknown',
    laserDelay: -20,
    fingerDraw: 'yes',
  });
  assert.equal(prefs.kind, DEFAULT_PREFS.kind);
  assert.equal(prefs.width, DEFAULT_PREFS.width);
  assert.equal(prefs.smoothing, 1);
  assert.equal(prefs.eraserMode, 'stroke');
  assert.equal(prefs.laserDelay, 1);
  assert.equal(prefs.fingerDraw, DEFAULT_PREFS.fingerDraw);
});

test('clamps pen dimensions and removes invalid or duplicate favourites', () => {
  const prefs = normalizeInkPrefs({
    width: 200,
    favorites: [
      { kind: 'ballpoint', color: '#123456', width: 2 },
      { kind: 'ballpoint', color: '#123456', width: 2 },
      { kind: 'fake-pen', color: '#fff', width: 2 },
      { kind: 'pencil', color: '#222', width: -10 },
    ],
  });
  assert.equal(prefs.width, 20);
  assert.deepEqual(prefs.favorites, [{ kind: 'ballpoint', color: '#123456', width: 2 }]);
});

test('recent colours are unique, bounded, and exclude automatic colour', () => {
  const prefs = normalizeInkPrefs({ recentColors: ['#111', 'auto', '#111', '', ...Array.from({ length: 30 }, (_, i) => `#${i}`)] });
  assert.equal(prefs.recentColors.length, 24);
  assert.equal(prefs.recentColors[0], '#111');
  assert.equal(new Set(prefs.recentColors).size, prefs.recentColors.length);
  assert.ok(!prefs.recentColors.includes('auto'));
});
