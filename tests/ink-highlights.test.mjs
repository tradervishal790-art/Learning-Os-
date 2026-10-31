// Highlighter-PEN marks are found as regions so the Revision Sheet can show them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const hl = (id, color, pts, width = 3) => ({ id, kind: 'highlighter', color, width, sim: true, sm: 0.3, pts });
const line = (x0, x1, y) => [x0, y, 0.5, (x0 + x1) / 2, y, 0.5, x1, y, 0.5];

test('ink highlights: touching strokes of one colour form one region; colours and distant marks stay apart', async () => {
  const { inkHighlightRegions } = await loadTs('src/inkHighlights.ts');
  const pages = [
    { id: 'p1', ink: [] },
    {
      id: 'p2',
      ink: [
        hl('a', '#fde047', line(100, 400, 200)),
        hl('b', '#fde047', line(100, 380, 212)), // second pass over the same line -> same region
        hl('c', '#f9a8d4', line(100, 300, 700)), // pink = doubt, far away
        hl('d', '#fde047', line(100, 300, 900)), // yellow again but far from the first -> its own region
        { id: 'pen', kind: 'ballpoint', color: '#000000', width: 2, sim: true, sm: 0.3, pts: line(0, 900, 50) }, // a normal pen is not a highlight
      ],
    },
  ];
  const r = inkHighlightRegions(pages);
  assert.equal(r.length, 3);
  assert.deepEqual(r.map((x) => [x.pageNumber, x.kind]), [[2, 'important'], [2, 'doubt'], [2, 'important']]);
  assert.ok(r[0].box.x <= 100 && r[0].box.x + r[0].box.w >= 400, 'region covers the marked line');
  assert.ok(r[0].box.y <= 200 && r[0].box.y + r[0].box.h >= 212);
  assert.ok(r.every((x) => x.box.w > 0 && x.box.h > 0 && x.box.x >= 0 && x.box.x + x.box.w <= 1000));
  assert.deepEqual(inkHighlightRegions([{ id: 'x' }, { id: 'y', ink: [] }]), []);
});

test('ink highlights: itemsToText lists a pen mark with its page', async () => {
  const { itemsToText } = await loadTs('src/revisionExtract.ts');
  const text = itemsToText(
    [{ key: 'k', kind: 'important', color: '#fde047', text: '', ink: true, count: 1, pages: [{ pageId: 'p', pageNumber: 4 }] }],
    { kinds: { important: 'Important', understood: 'U', doubt: 'D', example: 'E', other: 'O' }, page: 'Page', ink: 'Handwritten highlight' },
  );
  assert.match(text, /- \[Handwritten highlight\] \(Page 4\)/);
});
