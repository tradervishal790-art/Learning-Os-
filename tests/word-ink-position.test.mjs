// Word export: handwriting and floating photos sit ON the page at their editor position (anchored to the page),
// not as one picture under the text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

// A tiny drawing surface: the export only needs "something that becomes a PNG".
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
globalThis.Path2D = class { constructor(d) { this.d = d; } };
globalThis.OffscreenCanvas = class {
  constructor(w, h) { this.width = w; this.height = h; }
  getContext() { return new Proxy({}, { get: () => () => {}, set: () => true }); }
  async convertToBlob() { return new Blob([PNG], { type: 'image/png' }); }
};
globalThis.createImageBitmap = async () => ({ width: 400, height: 300, close() {} });

const { exportDocx, wordPageLayout, pageAnchor, putImage } = await loadTs('tests/wordEntry.ts');
const JSZip = (await import('jszip')).default;
const docXml = async (blob) => (await (await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()))).file('word/document.xml').async('string'));

const stroke = (kind, y) => ({ id: 's' + kind + y, kind, color: kind === 'highlighter' ? '#fde047' : 'auto', width: 4, pts: [100, y, 0.5, 400, y + 20, 0.5, 700, y, 0.5] });
const page = (id, extra = {}) => ({ id, text: 'typed ' + id, html: `<p>typed ${id}</p>`, ...extra });

test('geometry: A4 sheet maps 1000 units to 210 mm; tall content grows the page, capped at Word\'s limit', () => {
  assert.deepEqual(wordPageLayout(0), { heightUnits: 1414, heightTwips: Math.round(1414 * 11.906), scale: 1 });
  assert.equal(wordPageLayout(2000).heightUnits, 2000);
  const huge = wordPageLayout(9000);
  assert.ok(huge.heightTwips <= 31680 && huge.scale < 1);
  const a = pageAnchor(500, 100, 200, 100);
  assert.equal(a.offsetX, 500 * 7560);
  assert.equal(a.offsetY, 100 * 7560);
  assert.equal(a.widthPx, Math.round(200 * 0.7937));
});

test('handwriting is anchored to the page (pen in front, highlighter behind), not placed inline under the text', async () => {
  const xml = await docXml(await exportDocx('Ink', [page('a', { ink: [stroke('ballpoint', 300), stroke('highlighter', 500)] })], { includeInk: true }));
  assert.equal((xml.match(/<wp:anchor /g) ?? []).length, 2, 'highlighter layer + pen layer');
  assert.ok(!xml.includes('<wp:inline'), 'no inline picture under the text');
  assert.equal((xml.match(/relativeFrom="page"/g) ?? []).length, 4, 'x and y of both pictures are page-relative');
  assert.match(xml, /behindDoc="1"/);
  assert.match(xml, /behindDoc="0"/);
  assert.match(xml, /<wp:wrapNone\/>/);
  assert.match(xml, /<w:pgSz [^>]*w:w="11906"/);
});

test('without handwriting a page stays a normal text page (no anchors, default margins)', async () => {
  const xml = await docXml(await exportDocx('Plain', [page('a'), page('b', { ink: [stroke('ballpoint', 200)] })], { includeInk: false }));
  assert.ok(!xml.includes('<wp:anchor'));
  assert.ok(!xml.includes('<wp:inline'));
  assert.ok(xml.includes('typed a') && xml.includes('typed b'));
});

test('each note page is its own Word page; only pages with pictures get the full-bleed layout and a tall page for low ink', async () => {
  const low = { id: 'low', kind: 'ballpoint', color: 'auto', width: 4, pts: [100, 1900, 0.5, 300, 1950, 0.5] };
  const xml = await docXml(await exportDocx('Two', [page('a'), page('b', { ink: [low] })], { includeInk: true }));
  const sects = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) ?? [];
  assert.equal(sects.length, 2);
  assert.ok(!/w:h="2\d{4}"/.test(sects[0]), 'first page keeps the default A4');
  assert.match(sects[1], /w:h="23\d{3}"/, 'second page is taller than A4 so the low handwriting is not cut off');
});

test('a floating photo is anchored at its x / y / width behind the text; a photo without a place stays inline', async () => {
  await putImage('fp1', new Blob(['x'], { type: 'image/png' }), 'floating.png');
  await putImage('in1', new Blob(['y'], { type: 'image/png' }), 'inline.png');
  const xml = await docXml(await exportDocx('Photos', [page('a', { attachments: [
    { id: 'fp1', kind: 'image', name: 'floating.png', x: 100, y: 200, w: 300, ar: 0.5 },
    { id: 'in1', kind: 'image', name: 'inline.png' },
  ] })], { includeInk: false }));
  assert.equal((xml.match(/<wp:anchor /g) ?? []).length, 1);
  assert.equal((xml.match(/<wp:inline/g) ?? []).length, 1);
  assert.ok(xml.includes(`<wp:posOffset>${100 * 7560}</wp:posOffset>`));
  assert.ok(xml.includes(`<wp:posOffset>${200 * 7560}</wp:posOffset>`));
  assert.ok(xml.includes(`cx="${Math.round(300 * 0.7937) * 9525}"`), 'width follows the editor width');
  assert.match(xml, /behindDoc="1"/);
});

test('a photo whose file is not on this device is still named, never dropped silently', async () => {
  const xml = await docXml(await exportDocx('Gone', [page('a', { attachments: [{ id: 'nofile', kind: 'image', name: 'lost.png', x: 10, y: 10, w: 100 }] })], { includeInk: false }));
  assert.ok(xml.includes('lost.png'));
});
