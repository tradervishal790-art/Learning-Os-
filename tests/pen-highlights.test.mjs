// #53 — highlighter-pen marks reach the Revision Sheet (as pictures of the marked spot, by colour meaning).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { extractPenHighlights } = await loadTs('src/penHighlights.ts');
const line = (id, kind, color, y, x0 = 100, x1 = 500, w = 12) => ({ id, kind, color, width: w, pts: [x0, y, 0.5, (x0 + x1) / 2, y + 2, 0.5, x1, y, 0.5] });

test('marks of one colour close together are one card; far apart or another colour are separate; reading order', () => {
  const pages = [
    { id: 'p1', ink: [] },
    {
      id: 'p2',
      ink: [
        line('h1', 'highlighter', '#fde047', 300),
        line('h2', 'highlighter', '#fde047', 322), // right under h1 -> same mark
        line('h3', 'highlighter', '#fde047', 900), // far away -> its own card
        line('h4', 'highlighter', '#f9a8d4', 100), // pink = doubt
        line('pen', 'ballpoint', 'auto', 305, 150, 450, 3), // handwriting under the yellow mark
        line('far', 'ballpoint', 'auto', 1300, 150, 450, 3),
      ],
    },
  ];
  const r = extractPenHighlights(pages);
  assert.deepEqual(r.map((c) => [c.pageNumber, c.kind]), [[2, 'doubt'], [2, 'important'], [2, 'important']]);
  assert.ok(r[0].box.y0 < r[1].box.y0 && r[1].box.y0 < r[2].box.y0, 'top to bottom');
  assert.equal(new Set(r.map((c) => c.key)).size, 3);
  // the yellow card shows the handwriting under it; the far-away pen stroke is not in any card
  const yellowTop = r[1].svg;
  assert.equal((yellowTop.match(/<path/g) ?? []).length, 3, 'two marks + the pen stroke under them');
  assert.ok(!r[2].svg.includes('M') || (r[2].svg.match(/<path/g) ?? []).length === 1);
  assert.equal(r[1].under, 1);
  assert.match(yellowTop, /^<svg [^>]*viewBox="\d+ \d+ \d+ \d+"/);
});

test('no highlighter strokes -> nothing; non-official colours are "other"; bad strokes are ignored', () => {
  assert.deepEqual(extractPenHighlights([{ id: 'a', ink: [line('p', 'ballpoint', 'auto', 10)] }]), []);
  assert.deepEqual(extractPenHighlights([{ id: 'a' }]), []);
  const r = extractPenHighlights([{ id: 'a', ink: [line('h', 'highlighter', '#222222', 10), { id: 'dot', kind: 'highlighter', color: '#fde047', width: 5, pts: [1, 1] }] }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, 'other');
});

test('a page full of marks is capped so the sheet stays light', () => {
  const ink = Array.from({ length: 200 }, (_, i) => line('h' + i, 'highlighter', '#86efac', 20 + i * 200));
  assert.equal(extractPenHighlights([{ id: 'x', ink }]).length, 80);
});

// ---- the words under a mark ----
const { coveredText } = await loadTs('src/penHighlightText.ts');
const word = (text, x0, y0, block = 0, w = 60, h = 20) => ({ text, x0, y0, x1: x0 + w, y1: y0 + h, block });

test('words under a mark are found (most of the word covered), others are not; blocks stay separate', () => {
  const words = [
    word('Typed', 10, 20), word('line', 80, 20), word('one', 150, 20), word('important', 220, 20, 0, 90),
    word('Second', 10, 80, 1), word('line', 80, 80, 1),
  ];
  // a yellow mark along the first line from x=70 to x=330 (thickness 3*6 = 18 around y=30)
  const mark = { id: 'm', kind: 'highlighter', color: '#fde047', width: 3, pts: [70, 30, 0.5, 200, 30, 0.5, 330, 30, 0.5] };
  assert.equal(coveredText(words, [mark]), 'line one important');
  // two marks over two paragraphs -> two lines
  const mark2 = { id: 'm2', kind: 'highlighter', color: '#fde047', width: 3, pts: [5, 90, 0.5, 150, 90, 0.5] };
  assert.equal(coveredText(words, [mark, mark2]), 'line one important\nSecond line');
  // a mark between the lines covers nothing
  const miss = { id: 'x', kind: 'highlighter', color: '#fde047', width: 1, pts: [0, 55, 0.5, 400, 55, 0.5] };
  assert.equal(coveredText(words, [miss]), '');
});

test('a mark that only grazes a word does not take it', () => {
  const words = [word('edge', 100, 20, 0, 60, 20)];
  const graze = { id: 'g', kind: 'highlighter', color: '#fde047', width: 1, pts: [90, 36, 0.5, 170, 36, 0.5] }; // 6 thick, only the bottom ~15% of the word
  assert.equal(coveredText(words, [graze]), '');
});
