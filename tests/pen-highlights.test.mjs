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
