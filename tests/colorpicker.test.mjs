import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const c = await loadTs('src/ColorPicker.tsx');

test('hex <-> hsv round trip', () => {
  for (const hex of ['#000000', '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#fde047', '#7c3aed', '#123456']) {
    assert.equal(c.hsvToHex(c.hexToHsv(hex)), hex);
  }
});

test('pure colours', () => {
  assert.equal(c.hsvToHex({ h: 0, s: 1, v: 1 }), '#ff0000');
  assert.equal(c.hsvToHex({ h: 120, s: 1, v: 1 }), '#00ff00');
  assert.equal(c.hsvToHex({ h: 240, s: 1, v: 1 }), '#0000ff');
  assert.equal(c.hsvToHex({ h: 200, s: 0, v: 0 }), '#000000');
});
