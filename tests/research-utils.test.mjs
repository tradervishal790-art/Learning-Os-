import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { normalizeResearchResponse, isSafeExternalUrl, displayResearchUrl } = await loadTs('src/researchUtils.ts');

test('normalizes valid research results and drops malformed rows', () => {
  assert.deepEqual(normalizeResearchResponse({
    grounded: true,
    results: [
      { title: '  Source  ', url: 'https://example.com/a', snippet: '  Useful detail  ' },
      { title: '', url: 'javascript:alert(1)', snippet: '' },
      null,
      { title: 'Only a title', url: 42, snippet: null },
    ],
  }, 'learning'), {
    query: 'learning',
    grounded: true,
    results: [
      { title: 'Source', url: 'https://example.com/a', snippet: 'Useful detail' },
      { title: 'Only a title', url: '', snippet: '' },
    ],
  });
});

test('rejects malformed response containers so corrupted cache can be recovered', () => {
  assert.equal(normalizeResearchResponse(null, 'q'), null);
  assert.equal(normalizeResearchResponse({ results: 'not-an-array' }, 'q'), null);
  assert.deepEqual(normalizeResearchResponse({ results: [], grounded: false }, 'q'), {
    query: 'q', results: [], grounded: false,
  });
});

test('only credential-free HTTP(S) URLs are safe to open', () => {
  assert.equal(isSafeExternalUrl('https://example.com/path'), true);
  assert.equal(isSafeExternalUrl('http://example.com'), true);
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
  assert.equal(isSafeExternalUrl('data:text/html,hello'), false);
  assert.equal(isSafeExternalUrl('https://user:pass@example.com'), false);
  assert.equal(isSafeExternalUrl('/relative/path'), false);
});

test('formats result URLs without exposing query strings or fragments', () => {
  assert.equal(displayResearchUrl('https://www.example.com/path/?token=secret#part'), 'example.com/path');
});
