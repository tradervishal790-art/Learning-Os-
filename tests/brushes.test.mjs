import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

// a recording canvas: counts what every brush draws, and lets us compare two runs
class FakePath { constructor() { this.n = 0; } moveTo() { this.n++; } lineTo() { this.n++; } quadraticCurveTo() { this.n++; } closePath() {} }
globalThis.Path2D = FakePath;
function fakeCtx(log) {
  return new Proxy({}, {
    get: (_, k) => (k === 'canvas' ? {} : (...a) => log.push(`${String(k)}(${a.map((x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : typeof x)).join(',')})`)),
    set: (_, k, v) => { log.push(`${String(k)}=${v}`); return true; },
  });
}

const { drawStroke, PEN_KINDS, KINDS } = await loadTs('src/inkEngine.ts');
const pts = [];
for (let i = 0; i < 40; i++) pts.push(100 + i * 5, 100 + Math.sin(i / 5) * 20, 0.2 + 0.6 * Math.sin((i / 39) * Math.PI));
const mk = (kind, id = 's_test1') => ({ id, kind, color: '#3b82f6', width: 3, pts: [...pts], sim: false, sm: 0.5 });

test('every pen kind in the list has a config and draws without error', () => {
  for (const k of PEN_KINDS) {
    assert.ok(KINDS[k], `${k} config`);
    const log = [];
    drawStroke(fakeCtx(log), mk(k), false);
    assert.ok(log.length > 3, `${k} drew something`);
  }
});

test('the list has Paint\'s nine brushes first, in order', () => {
  assert.deepEqual(PEN_KINDS.slice(0, 9), ['brush', 'calligraphyBrush', 'calligraphy', 'airbrush', 'oil', 'crayon', 'marker', 'natural', 'watercolor']);
});

test('textured brushes are repeatable: same stroke -> same grain; another stroke -> different grain', () => {
  for (const k of ['airbrush', 'oil', 'crayon', 'natural']) {
    const a = []; const b = []; const c = [];
    drawStroke(fakeCtx(a), mk(k), false);
    drawStroke(fakeCtx(b), mk(k), false);
    drawStroke(fakeCtx(c), mk(k, 's_other_id'), false);
    assert.deepEqual(a, b, `${k} repeats`);
    assert.notDeepEqual(a, c, `${k} differs between strokes`);
  }
});

test('a single tap draws a dot for the new brushes', () => {
  for (const k of ['calligraphyBrush', 'airbrush', 'oil', 'crayon', 'natural', 'watercolor']) {
    const log = [];
    drawStroke(fakeCtx(log), { ...mk(k), pts: [100, 100, 0.5] }, false);
    assert.ok(log.some((l) => l.startsWith('arc(')), `${k} dot`);
  }
});
