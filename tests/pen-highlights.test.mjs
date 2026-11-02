// The highlighter PEN counts for Revision ("study only my doubts") like a typed highlight does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const stroke = (id, kind, color, txt) => ({ id, kind, color, width: 20, pts: [10, 10, 0.5, 90, 10, 0.5], sim: true, sm: 0.5, ...(txt !== undefined ? { txt } : {}) });

test('snapping to words: rough sweeps mean whole words, a small overshoot into the gap does not pull in a neighbour', async () => {
  const { snapStart, snapEnd } = await loadTs('src/inkText.ts');
  const t = 'is chlorophyll and more';
  //            0123456789012345678901 2
  assert.equal(t.slice(snapStart(t, 6), snapEnd(t, 10)), 'chlorophyll'); // from inside the word to inside the word
  assert.equal(t.slice(snapStart(t, 2), snapEnd(t, 14)), 'chlorophyll'); // start on the gap before it, end on the gap after it
  assert.equal(t.slice(snapStart(t, 3), snapEnd(t, 14)), 'chlorophyll'); // exact boundaries
  assert.equal(t.slice(snapStart(t, 4), snapEnd(t, 18)), 'chlorophyll and'); // two words
});

test('only NEW highlighter strokes get their words read, once', async () => {
  const { withHighlightText } = await loadTs('src/inkText.ts');
  const calls = [];
  const read = (st) => { calls.push(st.id); return 'words of ' + st.id; };
  const before = [stroke('old', 'highlighter', '#fde047')];
  const next = [...before, stroke('new', 'highlighter', '#f9a8d4'), stroke('pen', 'ballpoint', '#000000'), stroke('done', 'highlighter', '#fde047', 'already')];
  const out = withHighlightText(next, new Set(['old']), read);
  assert.deepEqual(calls, ['new']); // not the old one, not a pen, not one that already has its words
  assert.equal(out.find((s) => s.id === 'new').txt, 'words of new');
  assert.equal(out.find((s) => s.id === 'done').txt, 'already');
  assert.equal(out.find((s) => s.id === 'pen').txt, undefined);
  assert.equal(withHighlightText(before, new Set(['old']), read), before); // nothing new: the same array back
});

test('Revision lists pen highlights next to typed ones: colour = meaning, repeats counted, across pages', async () => {
  await import('./helpers.mjs');
  const { extractHighlights } = await loadTs('src/revisionExtract.ts');
  const items = extractHighlights([
    { id: 'p1', html: '<p>Mitochondria is the <mark style="background-color:#fde047">powerhouse</mark> of the cell</p>', ink: [stroke('a', 'highlighter', '#f9a8d4', 'osmosis vs diffusion'), stroke('b', 'ballpoint', '#000000', 'ignored text')] },
    { id: 'p2', html: '<p>nothing typed here</p>', ink: [stroke('c', 'highlighter', '#f9a8d4', 'Osmosis vs  diffusion'), stroke('d', 'highlighter', '#86efac', ''), stroke('e', 'highlighter', '#93c5fd')] },
  ]);
  const byText = Object.fromEntries(items.map((i) => [i.text.toLowerCase(), i]));
  assert.equal(byText['powerhouse'].kind, 'important'); // typed highlight, as before
  const doubt = byText['osmosis vs diffusion'];
  assert.equal(doubt.kind, 'doubt'); // pink pen = doubt
  assert.equal(doubt.count, 2); // the same passage twice (different spacing / case) is one item, counted
  assert.deepEqual(doubt.pages.map((p) => p.pageNumber), [1, 2]);
  assert.equal(items.length, 2); // a pen stroke with no words, a plain pen, an empty one: nothing to study
  // notes with no ink still work
  assert.equal(extractHighlights([{ id: 'p', html: '<p>x</p>' }]).length, 0);
});

test('a backup keeps the words of a pen highlight', async () => {
  const { buildBackupJson, parseBackup } = await loadTs('src/backup.ts');
  const note = { id: 'n1', title: 'T', updatedAt: '2026-01-01T00:00:00.000Z', pages: [{ id: 'p1', text: 'x', ink: [stroke('h', 'highlighter', '#fde047', 'important words')] }] };
  const parsed = parseBackup(buildBackupJson([note]));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.notes[0].pages[0].ink[0].txt, 'important words');
});
