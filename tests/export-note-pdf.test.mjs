// Direct PDF export: text layout (any script) and PDF assembly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { loadTs } from './helpers.mjs';

const TINY_JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAA4ACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD1qiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP//Z';
const fake = (text, size) => [...text].length * size * 0.5; // every character is half an em wide

test('page layout: headings are bigger and bold, lists get markers, long lines wrap inside the page, Hindi passes through', async () => {
  const { layoutText, BASE_SIZE } = await loadTs('src/pageLayout.ts');
  const html = '<h1>Title</h1><p>' + 'word '.repeat(60) + '</p><ul><li>one</li><li>two<ul><li>nested</li></ul></li></ul><ol><li>first</li></ol><p>नमस्ते दुनिया</p><p>line1<br>line2</p><p></p><p>end</p>';
  const { lines, height } = layoutText(html, fake);
  const h = lines.find((l) => l.text === 'Title');
  assert.ok(h.bold && h.size > BASE_SIZE * 1.9);
  const body = lines.filter((l) => l.text.startsWith('word'));
  assert.ok(body.length > 2, 'long paragraph wrapped');
  for (const l of lines) assert.ok(l.x + fake(l.text, l.size) <= 1000 + 0.01, 'no line leaves the page: ' + l.text);
  assert.ok(lines.some((l) => l.text === '•'), 'bullet marker');
  assert.ok(lines.some((l) => l.text === '1.'), 'number marker');
  const nested = lines.find((l) => l.text === 'nested');
  const one = lines.find((l) => l.text === 'one');
  assert.ok(nested.x > one.x, 'nested list is indented');
  assert.ok(lines.some((l) => l.text === 'नमस्ते दुनिया'));
  assert.ok(lines.some((l) => l.text === 'line1') && lines.some((l) => l.text === 'line2'));
  const ys = lines.map((l) => l.y);
  assert.deepEqual(ys, [...ys].sort((a, b) => a - b), 'lines go top to bottom');
  assert.ok(height > ys.at(-1));
  assert.deepEqual(layoutText('', fake).lines, []);
});

test('page layout: text without spaces is broken by characters instead of overflowing', async () => {
  const { layoutText } = await loadTs('src/pageLayout.ts');
  const { lines } = layoutText('<p>' + 'あ'.repeat(300) + '</p>', fake);
  assert.ok(lines.length > 1);
  for (const l of lines) assert.ok(l.x + fake(l.text, l.size) <= 1000.01);
  assert.equal(lines.map((l) => l.text).join(''), 'あ'.repeat(300));
});

test('direct PDF: pictures become A4 pages, in order', async () => {
  const { buildPdfFromJpegs } = await loadTs('src/pdfAssemble.ts');
  const bytes = Uint8Array.from(Buffer.from(TINY_JPEG, 'base64'));
  const out = await buildPdfFromJpegs([{ bytes, heightRatio: 1.4142 }, { bytes, heightRatio: 0.5 }], 'My note');
  assert.equal(new TextDecoder().decode(out.slice(0, 5)), '%PDF-');
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 2);
  assert.equal(doc.getTitle(), 'My note');
  const { width, height } = doc.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 0.1 && Math.abs(height - 841.89) < 0.1);
});
