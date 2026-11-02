// #12 — the fading-ink laser has its own colour / thickness; choosing them no longer changes the pen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { normalizeInkPrefs, DEFAULT_PREFS } = await loadTs('src/inkPrefs.ts');

test('new settings start from defaults', () => {
  const p = normalizeInkPrefs({});
  assert.equal(p.laserInkColor, DEFAULT_PREFS.laserInkColor);
  assert.equal(p.laserInkWidth, DEFAULT_PREFS.laserInkWidth);
});

test('settings saved before this change keep looking the same: the laser starts from the pen the student already used', () => {
  const p = normalizeInkPrefs({ color: '#dc2626', width: 5, laserStyle: 'ink' });
  assert.equal(p.laserInkColor, '#dc2626');
  assert.equal(p.laserInkWidth, 5);
  assert.equal(p.color, '#dc2626');
});

test('once set, laser ink and pen are independent and survive a round trip', () => {
  const p = normalizeInkPrefs(normalizeInkPrefs({ color: '#2563eb', width: 3, laserInkColor: '#16a34a', laserInkWidth: 6 }));
  assert.equal(p.color, '#2563eb');
  assert.equal(p.width, 3);
  assert.equal(p.laserInkColor, '#16a34a');
  assert.equal(p.laserInkWidth, 6);
});

test('bad values fall back instead of breaking the laser', () => {
  const p = normalizeInkPrefs({ laserInkColor: 42, laserInkWidth: 'wide', color: 'auto' });
  assert.equal(p.laserInkColor, 'auto');
  assert.equal(p.laserInkWidth, DEFAULT_PREFS.laserInkWidth);
  assert.equal(normalizeInkPrefs({ laserInkWidth: 999 }).laserInkWidth, 20);
});
