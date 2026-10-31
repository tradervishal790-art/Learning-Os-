// Annotated PDF keeps pen pressure and pen style (it used to draw every pen as one constant-width line).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { inflateSync } from 'node:zlib';
import { loadTs } from './helpers.mjs';

async function blankPdf() {
  const d = await PDFDocument.create();
  d.addPage([600, 800]);
  return (await d.save()).buffer.slice(0);
}
async function contentOf(bytes) {
  const d = await PDFDocument.load(bytes);
  const page = d.getPages()[0];
  const parts = [];
  const contents = page.node.Contents();
  const arr = contents.asArray ? contents.asArray() : [contents];
  for (const ref of arr) {
    const stream = d.context.lookup(ref);
    const raw = stream.getContents();
    let text;
    try { text = inflateSync(raw).toString('latin1'); } catch { text = Buffer.from(raw).toString('latin1'); }
    parts.push(text);
  }
  return { text: parts.join('\n'), page, d };
}
const stroke = (over) => ({ id: 'a', kind: 'fountain', color: '#112233', width: 4, sim: false, sm: 0.3, pts: [], ...over });
const line = (pressure) => { const pts = []; for (let i = 0; i < 30; i++) pts.push(100 + i * 10, 200 + Math.sin(i / 3) * 20, pressure(i)); return pts; };

test('annotated PDF: pressure changes the drawn shape; pen kinds get their own size and opacity', async () => {
  const { exportAnnotatedPdf } = await loadTs('src/exportAnnotatedPdf.ts');
  const src = await blankPdf();
  const run = async (strokes) => contentOf(await exportAnnotatedPdf(src, [{ pageNumber: 1, strokes }]));

  const light = await run([stroke({ pts: line(() => 0.2) })]);
  const varied = await run([stroke({ pts: line((i) => (i < 15 ? 0.2 : 1)) })]);
  assert.match(varied.text, /\bf\b/, 'pens are drawn as filled outlines');
  assert.notEqual(light.text, varied.text, 'pressure changes the drawing');

  const thin = await run([stroke({ kind: 'ballpoint', sim: true, pts: line(() => 0.5) })]);
  const marker = await run([stroke({ kind: 'marker', sim: true, pts: line(() => 0.5) })]);
  assert.notEqual(thin.text, marker.text, 'a marker is not drawn like a ballpoint');

  const hl = await run([stroke({ kind: 'highlighter', color: '#fde047', sim: true, pts: line(() => 0.5) })]);
  assert.match(hl.text, /\/GS\S* gs/);
});

test('annotated PDF: unchanged without strokes; dotted and calligraphy pens do not break', async () => {
  const { exportAnnotatedPdf } = await loadTs('src/exportAnnotatedPdf.ts');
  const src = await blankPdf();
  const same = await exportAnnotatedPdf(src, [{ pageNumber: 1, strokes: [] }]);
  assert.equal(same.length, src.byteLength);
  const out = await exportAnnotatedPdf(src, [{ pageNumber: 1, strokes: [stroke({ kind: 'dotted', pts: line(() => 0.5) }), stroke({ kind: 'calligraphy', pts: line(() => 0.5) }), stroke({ kind: 'oil', sim: true, pts: [300, 300, 0.5] })] }]);
  assert.ok(out.length > src.byteLength);
  await PDFDocument.load(out); // still a valid PDF
});
