import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const {
  isSafeResearchUrl,
  normalizeResearchResponse,
  normalizeResearchHistory,
  readResearchCache,
  writeResearchCache,
  RESEARCH_CACHE_LIMIT,
  RESEARCH_CACHE_TTL_MS,
} = await loadTs('src/researchCache.ts');

test('research results retain only safe links and bounded text fields', () => {
  const result = normalizeResearchResponse({
    grounded: true,
    results: [
      { title: 'Valid', url: 'https://example.com/story', snippet: 'A useful source' },
      { title: 'Unsafe', url: 'javascript:alert(1)', snippet: 'Do not link this' },
      { title: 'Credentials', url: 'https://user:pass@example.com', snippet: 'No credentials' },
      { title: '', url: '', snippet: '' },
    ],
  }, ' test query ');
  assert.equal(result.query, 'test query');
  assert.equal(result.grounded, true);
  assert.equal(result.results.length, 3);
  assert.equal(result.results[0].url, 'https://example.com/story');
  assert.equal(result.results[1].url, '');
  assert.equal(isSafeResearchUrl('data:text/html,hi'), false);
  assert.equal(isSafeResearchUrl('https://example.com'), true);
});

test('research history is trimmed, deduplicated and bounded', () => {
  assert.deepEqual(normalizeResearchHistory(['  AI   learning ', 'ai learning', '', 4, 'Second']), ['AI learning', 'Second']);
});

test('research cache expires entries and keeps only the newest bounded set', () => {
  localStorage.clear();
  const start = 1_800_000_000_000;
  const response = { query: 'topic', grounded: true, results: [{ title: 'Source', url: 'https://example.com', snippet: 'Brief' }] };
  writeResearchCache(localStorage, 'topic', 'en', response, start);
  assert.equal(readResearchCache(localStorage, 'topic', 'en', start + 100)?.results.length, 1);
  assert.equal(readResearchCache(localStorage, 'topic', 'hi', start + 100), null);
  assert.equal(readResearchCache(localStorage, 'topic', 'en', start + RESEARCH_CACHE_TTL_MS + 1), null);

  for (let i = 0; i < RESEARCH_CACHE_LIMIT + 4; i += 1) {
    writeResearchCache(localStorage, 'topic-' + i, 'en', { ...response, query: 'topic-' + i }, start + i + 200);
  }
  const record = JSON.parse(localStorage.getItem('learning_os_research_cache_v2'));
  assert.equal(Object.keys(record).length, RESEARCH_CACHE_LIMIT);
  assert.equal(readResearchCache(localStorage, 'topic-0', 'en', start + 1000), null);
  assert.ok(readResearchCache(localStorage, 'topic-15', 'en', start + 1000));
});
