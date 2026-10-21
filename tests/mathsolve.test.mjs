import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const m = await loadTs('src/mathSolve.ts');

test('basic sums', () => {
  assert.equal(m.evalMath('2 + 2'), 4);
  assert.equal(m.evalMath('3 x 2'), 6);
  assert.equal(m.evalMath('3 × 2 + 1'), 7);
  assert.equal(m.evalMath('2 + 3 * 4'), 14);
  assert.equal(m.evalMath('(2 + 3) * 4'), 20);
  assert.equal(m.evalMath('2^3^2'), 512);
  assert.equal(m.evalMath('50%'), 0.5);
  assert.equal(m.evalMath('sqrt(81)'), 9);
  assert.equal(m.evalMath('10 / 4'), 2.5);
  assert.equal(m.evalMath('-3 + 5'), 2);
});

test('not math -> null', () => {
  assert.equal(m.evalMath('hello'), null);
  assert.equal(m.evalMath('1 / 0'), null);
  assert.equal(m.evalMath('2 +'), null);
  assert.equal(m.evalMath('x'), null);
  assert.equal(m.evalMath('process.exit()'), null);
});

test('solve lines', () => {
  const r = m.solveMathText('2 + 2 =\nWater cycle\n3 x 2 =\n5 + 5 = 10');
  assert.equal(r.solved, 2);
  assert.equal(r.text, '2 + 2 = 4\nWater cycle\n3 x 2 = 6\n5 + 5 = 10');
});
