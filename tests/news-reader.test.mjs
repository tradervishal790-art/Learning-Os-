import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { safeArticleUrl } = await loadTs('src/newsReader.ts');

test('article reader accepts only absolute HTTP and HTTPS links', () => {
  assert.equal(safeArticleUrl('https://www.thehindu.com/news/article.html'), 'https://www.thehindu.com/news/article.html');
  assert.equal(safeArticleUrl('http://example.com/story'), 'http://example.com/story');
  assert.equal(safeArticleUrl('javascript:alert(1)'), null);
  assert.equal(safeArticleUrl('data:text/html,<h1>bad</h1>'), null);
  assert.equal(safeArticleUrl('//example.com/story'), null);
  assert.equal(safeArticleUrl('not a url'), null);
  assert.equal(safeArticleUrl(null), null);
});
