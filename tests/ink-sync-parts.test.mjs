// A page with very heavy handwriting syncs (split over several cloud documents) instead of staying "not synced".
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const heavyInk = (strokes, points) =>
  Array.from({ length: strokes }, (_, i) => ({
    id: `s${i}`, kind: 'fountain', color: '#112233', width: 3, sim: false, sm: 0.3,
    pts: Array.from({ length: points * 3 }, (_, j) => Math.round(((i * 7 + j * 13) % 9000)) / 10),
  }));

test('ink sync: splitStrokes keeps order and size limits', async () => {
  const { splitStrokes } = await loadTs('src/inkParts.ts');
  const strokes = heavyInk(40, 100);
  const parts = splitStrokes(strokes, 20_000);
  assert.ok(parts.length > 1);
  assert.deepEqual(parts.flat().map((s) => s.id), strokes.map((s) => s.id));
  for (const p of parts) assert.ok(JSON.stringify(p).length <= 20_000);
  assert.deepEqual(splitStrokes([], 100), []);
});

test('ink sync: a >1 MiB page is pushed in parts, pulled back identical, and shrinks cleanly', async () => {
  const { pushContent, pullContent, store, LIMIT } = await loadTs('tests/inkSyncEntry.ts', { alias: { './cloudSync': 'tests/fakeCloud.ts' } });
  const ink = heavyInk(260, 400); // well over 1 MiB of JSON
  assert.ok(JSON.stringify(ink).length > LIMIT, 'test page really is too big for one document');
  const note = (strokes) => ({ id: 'n1', schemaVersion: 1, updatedAt: '2026-10-30T00:00:00.000Z', pages: [{ id: 'p1', text: 'hello', ink: strokes }, { id: 'p2', text: 'plain' }] });

  assert.equal(await pushContent(note(ink)), true, 'the heavy page now syncs');
  const first = store.get('ink_n1_p1');
  assert.ok(first.parts >= 2, 'first document declares its parts');
  assert.ok(store.has('ink_n1_p1_p1'), 'extra part stored');
  for (const [k, v] of store) assert.ok(JSON.stringify(v).length <= LIMIT, `${k} fits in a document`);

  const back = await pullContent('n1');
  assert.ok(back, 'pulls completely');
  assert.deepEqual(back.pages[0].ink, ink, 'handwriting comes back identical and in order');
  assert.equal(back.pages[1].ink, undefined);

  // the page gets lighter: it is a single document again and the old extra parts are removed
  const light = ink.slice(0, 20);
  assert.equal(await pushContent({ ...note(light), updatedAt: '2026-10-30T00:01:00.000Z' }), true);
  assert.equal(store.get('ink_n1_p1').parts, undefined);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.has('ink_n1_p1_p1'), false, 'old parts deleted');
  assert.deepEqual((await pullContent('n1')).pages[0].ink, light);

  // a missing part means "incomplete": never hand back half a page
  await pushContent({ ...note(ink), updatedAt: '2026-10-30T00:02:00.000Z' });
  store.delete('ink_n1_p1_p1');
  assert.equal(await pullContent('n1'), null);
});
