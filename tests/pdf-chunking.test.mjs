import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { loadTs } from './helpers.mjs';

const { splitPdfIntoChunks } = await loadTs('src/pdfChunking.ts');
async function makePdf(pageCount) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) pdf.addPage();
  return new Uint8Array(await pdf.save());
}

test('daily extraction can split even a small PDF into one-page chunks', async () => {
  const chunks = await splitPdfIntoChunks(await makePdf(4), 10_000_000, 30, 1);
  assert.equal(chunks.length, 4);
  for (const chunk of chunks) assert.equal((await PDFDocument.load(chunk)).getPageCount(), 1);
});

test('normal imports keep a small PDF together within the normal page limit', async () => {
  const chunks = await splitPdfIntoChunks(await makePdf(4), 10_000_000, 30, 30);
  assert.equal(chunks.length, 1);
  assert.equal((await PDFDocument.load(chunks[0])).getPageCount(), 4);
});

test('page limits are enforced even when the PDF is small', async () => {
  const source = await makePdf(31);
  await assert.rejects(() => splitPdfIntoChunks(source, 10_000_000, 30, 1), /limit is 30/);
});
