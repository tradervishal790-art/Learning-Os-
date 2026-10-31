// Handwriting that was read once is remembered, so Ask my notes can use it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }; };
const st = (id, n = 4) => ({ id, kind: 'ballpoint', color: '#000', width: 3, sim: true, sm: 0.3, pts: Array(n * 3).fill(1) });

test('ink text: remembered per page, ignored once the ink changes, listed in page order', async () => {
  const { setInkText, getInkText, pagesToRead, handwritingOf } = await loadTs('src/inkText.ts');
  const store = mem();
  const p1 = { id: 'p1', ink: [st('a')] };
  const p2 = { id: 'p2', ink: [st('b')] };
  const typed = { id: 'p3' };
  assert.deepEqual(pagesToRead('n', [p1, p2, typed], store).map((p) => p.id), ['p1', 'p2'], 'typed pages need no reading');
  setInkText('n', p1, 'Force equals mass times acceleration', store);
  setInkText('n', p2, 'Newton third law', store);
  assert.equal(getInkText('n', p1, store), 'Force equals mass times acceleration');
  assert.equal(handwritingOf('n', [p1, p2, typed], store), 'Force equals mass times acceleration\nNewton third law');
  assert.deepEqual(pagesToRead('n', [p1, p2], store), []);
  const edited = { id: 'p1', ink: [st('a'), st('c')] }; // the student wrote more
  assert.equal(getInkText('n', edited, store), '');
  assert.deepEqual(pagesToRead('n', [edited, p2], store).map((p) => p.id), ['p1']);
  assert.equal(handwritingOf('n', [edited, p2], store), 'Newton third law', 'stale text is not used');
  assert.equal(getInkText('other-note', p1, store), '');
});

test('ink text: reading goes page by page, skips failures, remembers empty pages, respects the limit', async () => {
  const { readHandwriting, handwritingOf, pagesToRead } = await loadTs('src/inkText.ts');
  const store = mem();
  const pages = [1, 2, 3, 4].map((n) => ({ id: `p${n}`, ink: [st(`s${n}`)] }));
  const calls = [];
  const deps = {
    render: (strokes) => (strokes[0].id === 's3' ? null : `png-${strokes[0].id}`),
    recognize: async (png) => { calls.push(png); if (png === 'png-s2') throw new Error('offline'); return { text: `text of ${png}` }; },
  };
  const r = await readHandwriting('n', pages, deps, { store, max: 3 });
  assert.deepEqual(r, { read: 1, failed: 1 }, 'p1 read, p2 failed, p3 had nothing to read');
  assert.deepEqual(calls, ['png-s1', 'png-s2']);
  assert.equal(handwritingOf('n', pages, store), 'text of png-s1');
  assert.deepEqual(pagesToRead('n', pages, store).map((p) => p.id), ['p2', 'p4'], 'failed + beyond-the-limit pages are tried next time');
});
