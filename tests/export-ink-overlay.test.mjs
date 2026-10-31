// Print / PDF export: handwriting sits OVER the typed text of its page, not as a separate picture below it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const stroke = { id: 's', kind: 'ballpoint', color: '#111111', width: 3, sim: false, sm: 0.3, pts: [100, 100, 0.5, 300, 120, 0.5, 500, 100, 0.5] };

test('export: ink of a typed page is overlaid on its text; a PDF page keeps its ink as a block', async () => {
  const { noteToHtml } = await loadTs('src/noteExport.ts');
  const typed = { id: 'p1', text: 'Newton law', html: '<p>Newton law</p>', ink: [stroke] };
  const html = noteToHtml('N', [typed], { ink: true });
  const box = /<div class="pgbox"[^>]*>(.*?)<\/div><\/div>/s.exec(html);
  assert.ok(box, 'page is one positioned box');
  assert.ok(box[1].indexOf('Newton law') < box[1].indexOf('<svg'), 'text first, ink drawn on top of it in the same box');
  assert.ok(box[0].includes('class="ink-over"'));
  assert.ok(!html.includes('<div class="ink">'), 'no separate picture below the text');
  assert.match(html, /aspect-ratio:1000\/1414/);

  const pdfPage = { id: 'p2', text: 'extracted', pdf: { fileId: 'f', pageNumber: 1, name: 'b.pdf' }, ink: [stroke] };
  const h2 = noteToHtml('N', [pdfPage], { ink: true });
  assert.ok(h2.includes('<div class="ink">') && !h2.includes('class="pgbox"'));
  assert.ok(!noteToHtml('N', [typed]).includes('<svg'), 'no handwriting unless asked');
});
