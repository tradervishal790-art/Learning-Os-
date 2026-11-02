import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { duplicatePage } = await loadTs('src/pageOps.ts');
const mk = (id, extra = {}) => ({ id, text: id, html: `<p>${id}</p>`, ink: [{ id: 's1', kind: 'ballpoint', color: 'auto', width: 2, pts: [1, 2, 0.5, 3, 4, 0.5] }], ...extra });

test('#58 duplicate: the copy is a new page after the original and does NOT inherit the bookmark star', () => {
  const pages = [mk('a', { bookmarked: true }), mk('b')];
  const r = duplicatePage(pages, 'a');
  assert.equal(r.pages.length, 3);
  assert.equal(r.pages[1].id, r.copy.id);
  assert.notEqual(r.copy.id, 'a');
  assert.equal(r.copy.bookmarked, undefined, 'copy has no bookmark');
  assert.equal(r.pages[0].bookmarked, true, 'original keeps its bookmark');
  assert.equal(r.copy.text, 'a');
  assert.notEqual(r.copy.ink[0].id, 's1', 'strokes get new ids');
  assert.equal(duplicatePage(pages, 'nope'), null);
});
