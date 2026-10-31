import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const zip = await loadTs('src/zipStore.ts');
const sweep = await loadTs('src/fileSweep.ts');
const bf = await loadTs('src/backupFiles.ts');

const bytes = (s) => new TextEncoder().encode(s);

test('a zip we write can be read back, byte for byte', () => {
  const files = [
    { name: 'notes.json', data: bytes('{"a":1}') },
    { name: 'files/images/img_1', data: new Uint8Array([0, 255, 1, 2, 3, 254]) },
    { name: 'files/pdfs/pdf_1', data: new Uint8Array(0) },
  ];
  const back = zip.readZip(zip.buildZip(files));
  assert.equal(back.length, 3);
  for (let i = 0; i < files.length; i++) {
    assert.equal(back[i].name, files[i].name);
    assert.deepEqual([...back[i].data], [...files[i].data]);
  }
});

test('a damaged or foreign zip is refused, never half-read', () => {
  const good = zip.buildZip([{ name: 'notes.json', data: bytes('hello world') }]);
  const bad = good.slice();
  bad[40] ^= 0xff; // flip a byte inside the stored file: the checksum no longer matches
  assert.equal(zip.readZip(bad), null);
  assert.equal(zip.readZip(bytes('this is not a zip file at all, just text')), null);
  assert.equal(zip.readZip(new Uint8Array(0)), null);
});

test('backup zip: notes.json + files are found, anything else is not a backup', () => {
  const z = zip.buildZip([
    { name: 'notes.json', data: bytes('{"notes":[]}') },
    { name: 'files/manifest.json', data: bytes('[]') },
  ]);
  assert.equal(bf.looksLikeZip(z), true);
  assert.equal(bf.looksLikeZip(bytes('{"notes":[]}')), false);
  const open = bf.openBackupZip(z);
  assert.equal(open.notesJson, '{"notes":[]}');
  assert.equal(open.files.length, 1);
  assert.equal(bf.openBackupZip(zip.buildZip([{ name: 'other.txt', data: bytes('x') }])), null);
});

test('clean-up: only unused files older than 7 days are picked', () => {
  const now = Date.parse('2026-10-30T00:00:00Z');
  const day = 24 * 3600 * 1000;
  const iso = (daysAgo) => new Date(now - daysAgo * day).toISOString();
  const files = [
    { id: 'used-old', createdAt: iso(100) },
    { id: 'unused-old', createdAt: iso(30) },
    { id: 'unused-new', createdAt: iso(2) },
    { id: 'unused-bad-date', createdAt: 'not a date' },
  ];
  assert.deepEqual(sweep.pickOrphans(files, new Set(['used-old']), now), ['unused-old']);
});

test('clean-up: photos, recordings and PDFs of every page are counted as used', () => {
  const refs = sweep.emptyRefs();
  sweep.collectRefs(
    [
      { id: 'p1', text: '', attachments: [{ id: 'img_1', kind: 'image', name: 'a' }, { id: 'aud_1', kind: 'audio', name: 'b' }] },
      { id: 'p2', text: '', pdf: { fileId: 'pdf_1', pageNumber: 3, name: 'c.pdf' } },
      { id: 'p3', text: '' },
    ],
    refs
  );
  assert.deepEqual([...refs.images], ['img_1']);
  assert.deepEqual([...refs.audio], ['aud_1']);
  assert.deepEqual([...refs.pdfs], ['pdf_1']);
});

// ---------- very heavy handwriting pages sync in several cloud documents ----------
const store = await loadTs('src/notebookStore.ts');

test('a heavy page of handwriting is split into parts that each fit, in order, nothing lost', () => {
  const stroke = (i) => ({ id: `s${i}`, kind: 'ballpoint', color: '#000000', width: 2, pts: Array.from({ length: 300 }, (_, k) => (k * 7 + i) % 1000), sim: false, sm: 0.5 });
  const strokes = Array.from({ length: 60 }, (_, i) => stroke(i));
  const parts = store.splitStrokes(strokes, 20_000);
  assert.ok(parts.length > 1);
  for (const part of parts) assert.ok(JSON.stringify(part).length <= 20_000);
  assert.deepEqual(parts.flat().map((s) => s.id), strokes.map((s) => s.id));
  assert.equal(store.splitStrokes(strokes.slice(0, 2)).length, 1); // a light page stays ONE plain document
  assert.deepEqual(store.splitStrokes([]), [[]]);
});

// ---------- print / HTML export carries photos ----------
test('HTML export puts a page\'s photos in, but only real image data (never an injected tag or script URL)', async () => {
  const { setupDom } = await import('./helpers.mjs').catch(() => ({}));
  void setupDom;
  const exp = await loadTs('src/noteExport.ts');
  const good = 'data:image/png;base64,iVBORw0KGgo=';
  const page = { id: 'p1', text: 'hi', html: '<p>hi</p>', attachments: [
    { id: 'a', kind: 'image', name: 'good one' },
    { id: 'b', kind: 'image', name: 'evil' },
    { id: 'c', kind: 'audio', name: 'voice' },
  ] };
  const html = exp.noteToHtml('T', [page], { images: { a: good, b: 'javascript:alert(1)', c: good } });
  assert.ok(html.includes(`src="${good}"`));
  assert.ok(!html.includes('javascript:'));
  assert.equal((html.match(/<figure class="photo">/g) ?? []).length, 1);
  // a page with ONLY a photo is no longer skipped
  const only = exp.noteToHtml('T', [{ id: 'p2', text: '', html: '<p></p>', attachments: [{ id: 'a', kind: 'image', name: 'x' }] }], { images: { a: good } });
  assert.ok(only.includes('class="photo"'));
});

test('AI text replacing styled words keeps their font; its own bold stays', async () => {
  const { withBaseMarks } = await loadTs('src/aiTextToNodes.ts');
  const base = [{ type: 'textStyle', attrs: { fontFamily: 'Georgia' } }];
  const out = withBaseMarks([{ type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b', marks: [{ type: 'bold' }] }] }], base);
  assert.deepEqual(out[0].content[0].marks, base);
  assert.deepEqual(out[0].content[1].marks.map((m) => m.type), ['textStyle', 'bold']);
  assert.deepEqual(withBaseMarks([{ type: 'text', text: 'x' }], []), [{ type: 'text', text: 'x' }]);
});
