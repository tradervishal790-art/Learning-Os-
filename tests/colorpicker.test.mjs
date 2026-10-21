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

test('basic colours: 4 x 12 valid hex, custom has 24 slots', () => {
  assert.equal(c.BASIC_COLORS.length, 48);
  for (const h of c.BASIC_COLORS) assert.match(h, /^#[0-9a-f]{6}$/);
  assert.equal(c.CUSTOM_SLOTS, 24);
});

test('brightness bar: a colour at full brightness goes down to black', () => {
  const top = c.hsvToHex({ h: 60, s: 1, v: 1 });
  assert.equal(top, '#ffff00');
  assert.equal(c.hsvToHex({ h: 60, s: 1, v: 0 }), '#000000');
  assert.equal(c.hsvToHex({ h: 0, s: 0, v: 1 }), '#ffffff'); // bottom of the square = white
});
