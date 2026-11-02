// Print / PDF must draw the paper (ruled, grid, …) like the editor — the text position was kept, the lines were missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { paperPrint } = await loadTs('src/pagePaperPrint.ts');
const { noteToHtml } = await loadTs('src/noteExport.ts');

test('blank paper draws nothing, ruled / grid / dotted / music / todo / isometric / notebook draw a pattern', () => {
  assert.equal(paperPrint('blank', undefined).overlay, '');
  for (const t of ['ruled', 'ruledNarrow', 'ruledWide', 'notebook', 'dotted', 'grid', 'graph', 'isometric', 'music', 'todo', 'cornell']) {
    const p = paperPrint(t, undefined);
    assert.match(p.overlay, /^<svg class="paper-extra"/, t);
    assert.match(p.overlay, /viewBox="0 0 1000 1414/, t);
    assert.ok(p.overlay.includes('<pattern'), `${t} has a pattern`);
  }
});

test('paper colour is applied, and a dark paper switches text and ink to light', () => {
  assert.equal(paperPrint('ruled', 'cream').style, 'background-color:#fbf4e3');
  assert.equal(paperPrint('ruled', 'cream').dark, false);
  const d = paperPrint('grid', 'charcoal');
  assert.equal(d.dark, true);
  assert.match(d.style, /#2b2d31/);
  assert.equal(paperPrint('ruled', undefined).style, '');
});

test('ruled spacing follows the template (40 / 28 / 56 page units)', () => {
  assert.match(paperPrint('ruled', undefined).overlay, /<pattern id="pp" width="10" height="40"/);
  assert.match(paperPrint('ruledNarrow', undefined).overlay, /height="28"/);
  assert.match(paperPrint('ruledWide', undefined).overlay, /height="56"/);
});

test('the exported page carries its paper: overlay first, colour on the page, dark class on dark paper', () => {
  const page = (template, paper) => ({ id: 'p' + template, text: 'Hello', html: '<p>Hello</p>', template, paper, ink: [] });
  const html = noteToHtml('T', [page('ruled', 'cream'), page('grid', 'charcoal'), page('blank', undefined)], { layout: 'page' });
  assert.equal((html.match(/class="paper-extra"/g) ?? []).length, 2, 'blank page has no overlay');
  assert.match(html, /background-color:#fbf4e3/);
  assert.match(html, /class="page note-gridded pdark"/);
  assert.match(html, /print-color-adjust:exact/);
  // overlay sits BEFORE the text so it can never cover it
  assert.ok(html.indexOf('class="paper-extra"') < html.indexOf('class="note-prose"'));
});
