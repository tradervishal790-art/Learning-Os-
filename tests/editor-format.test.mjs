import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const ext = await loadTs('src/editorExtensions.ts');
const tpl = await loadTs('src/pageTemplates.ts');

test('size round trip: stored form <-> number, old px form still readable', () => {
  for (const n of [8, 12.5, 16, 96, 400]) assert.equal(ext.cssToSize(ext.sizeToCss(n)), n);
  assert.equal(ext.cssToSize('20px'), 20);
  assert.equal(ext.cssToSize(''), null);
  assert.equal(ext.cssToSize(undefined), null);
  assert.equal(ext.cssToSize('2em'), null);
});

test('size is zoom-proof: calc with a 1px fallback outside the editor', () => {
  assert.equal(ext.sizeToCss(24), 'calc(24 * var(--note-px, 1px))');
});

test('grow / shrink step along the ladder and stay in range', () => {
  assert.equal(ext.stepSize(16, 1), 18);
  assert.equal(ext.stepSize(16, -1), 14);
  assert.equal(ext.stepSize(15, 1), 16);
  assert.equal(ext.stepSize(15, -1), 14);
  assert.equal(ext.stepSize(96, 1), 104);
  assert.equal(ext.stepSize(8, -1), 7);
  assert.equal(ext.stepSize(1, -1), 1);
  assert.equal(ext.stepSize(400, 1), 400);
});

test('font list: unique values, every font has a generic fallback', () => {
  const values = ext.ALL_FONTS.map((f) => f.value);
  assert.equal(new Set(values).size, values.length);
  for (const f of ext.ALL_FONTS) assert.match(f.value, /(serif|sans-serif|monospace|cursive)$/);
  // values written by older versions of the toolbar must still be selectable
  for (const old of ['Georgia, serif', 'ui-monospace, monospace', "'Comic Sans MS', cursive"]) assert.ok(values.includes(old), old);
});

test('page templates: ids unique, valid, spacing set for every patterned page', () => {
  const ids = tpl.PAGE_TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(tpl.isTemplateId(id));
  assert.equal(tpl.isTemplateId('hexagon'), false);
  for (const t of tpl.PAGE_TEMPLATES) assert.equal(t.spacing > 0, t.id !== 'blank', t.id);
  for (const id of ['grid', 'graph', 'isometric', 'music', 'todo', 'notebook', 'ruledNarrow', 'ruledWide']) assert.ok(ids.includes(id), id);
});

test('text line pitch: lined / grid pages use the SAME number as their background lines; free pages use none', () => {
  for (const id of ['ruled', 'ruledNarrow', 'ruledWide', 'notebook', 'todo', 'cornell', 'grid', 'graph', 'dotted']) {
    assert.equal(tpl.textLineUnits(id), tpl.templateSpacing(id), id);
    assert.ok(tpl.textLineUnits(id) > 0, id);
  }
  for (const id of ['blank', 'isometric', 'music']) assert.equal(tpl.textLineUnits(id), 0, id);
});
