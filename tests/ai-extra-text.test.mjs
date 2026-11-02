// #37 — the AI tools can use handwriting and scanned PDF pages once they are read to text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { inkSignature, pendingReads, pageAiText, needsScan } = await loadTs('src/aiExtraText.ts');
const st = (id, n = 3) => ({ id, kind: 'ballpoint', color: 'auto', width: 4, pts: Array.from({ length: n * 3 }, (_, i) => i) });
const page = (id, text = '', extra = {}) => ({ id, text, html: `<p>${text}</p>`, ...extra });

test('signature changes when ink is added or extended, and is empty for no ink', () => {
  assert.equal(inkSignature([]), '');
  assert.equal(inkSignature(undefined), '');
  const a = inkSignature([st('s1')]);
  assert.notEqual(a, inkSignature([st('s1'), st('s2')]));
  assert.notEqual(a, inkSignature([st('s1', 5)]));
  assert.equal(a, inkSignature([st('s1')]));
});

test('pending: ink not read yet, ink edited after reading, scanned PDF page; text PDFs and typed pages need nothing', () => {
  const pages = [
    page('typed', 'hello'),
    page('hw', ''),
    page('textpdf', 'pdf words', { pdf: { fileId: 'f', pageNumber: 1, name: 'a.pdf' } }),
    page('scan', '', { pdf: { fileId: 'f', pageNumber: 2, name: 'a.pdf' } }),
    page('read', ''),
  ];
  const ink = { hw: [st('a')], read: [st('b')] };
  const extras = { read: { hw: { sig: inkSignature(ink.read), text: 'done' } } };
  assert.deepEqual(pendingReads(pages, ink, extras), [
    { pageId: 'hw', hw: true, scan: false },
    { pageId: 'scan', hw: false, scan: true },
  ]);
  // the student writes more on an already-read page -> it is pending again
  ink.read = [st('b'), st('c')];
  assert.ok(pendingReads(pages, ink, extras).some((p) => p.pageId === 'read'));
  assert.equal(needsScan(pages[3]), true);
  assert.equal(needsScan(pages[2]), false);
});

test('page text for the AI = typed + scanned + CURRENT handwriting; stale handwriting text is left out', () => {
  const ink = [st('a')];
  const p = page('p', 'typed');
  const fresh = { hw: { sig: inkSignature(ink), text: 'handwritten line' }, scan: 'scanned words' };
  assert.equal(pageAiText(p, ink, fresh), 'typed\nscanned words\nhandwritten line');
  assert.equal(pageAiText(p, [st('a'), st('z')], fresh), 'typed\nscanned words', 'ink changed since it was read');
  assert.equal(pageAiText(p, undefined, undefined), 'typed');
  assert.equal(pageAiText(page('e', ''), [], { hw: { sig: 'x', text: 'ghost' } }), '');
});
