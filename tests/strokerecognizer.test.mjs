import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const m = await loadTs('src/strokeRecognizer.ts');

// a small "letter": 3 points, pts = [x, y, pressure, ...]
const letter = (id, x, y, h = 20, kind = 'ballpoint') => ({
  id, kind, color: 'auto', width: 2, sim: true, sm: 0.5,
  pts: [x, y, 0.5, x + 5, y + h / 2, 0.5, x + 10, y + h, 0.5],
});

test('two lines are split top to bottom, each sorted left to right', () => {
  const strokes = [
    letter('c', 120, 100), letter('a', 50, 100), letter('b', 80, 102),
    letter('f', 70, 160), letter('d', 20, 158),
  ];
  const lines = m.groupIntoLines(strokes);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0].map((s) => s.id), ['a', 'b', 'c']);
  assert.deepEqual(lines[1].map((s) => s.id), ['d', 'f']);
});

test('a descender / tall stroke does not merge the next line in', () => {
  const strokes = [letter('a', 10, 100), letter('tall', 40, 95, 40), letter('b', 10, 150), letter('c', 40, 150)];
  const lines = m.groupIntoLines(strokes);
  assert.equal(lines.length, 2);
});

test('highlighter strokes and empty input are ignored', () => {
  assert.deepEqual(m.groupIntoLines([]), []);
  assert.equal(m.groupIntoLines([letter('h', 10, 10, 20, 'highlighter')]).length, 0);
});

test('fast path returns null (so Gemini fallback runs) when the Google call fails', async () => {
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal(await m.recognizeStrokes([letter('a', 10, 10)]), null);
});

test('Google reply is parsed and lines are joined with newlines', async () => {
  let calls = 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => ['SUCCESS', [['id', [`line${++calls}`, 'alt']]]] });
  const text = await m.recognizeStrokes([letter('a', 10, 10), letter('b', 10, 80)]);
  assert.equal(text.split('\n').length, 2);
});
