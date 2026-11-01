import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { selectDiscoveryWords } = await loadTs('src/dictionaryDiscovery.ts');

test('word discovery is stable for the same day and varied for a new seed', () => {
  const words = ['apple', 'banana', 'Cherry', 'date', 'elderberry', 'fig', 'grape', 'honey'];
  assert.deepEqual(selectDiscoveryWords(words, '2026-11-01', 5), selectDiscoveryWords(words, '2026-11-01', 5));
  assert.notDeepEqual(selectDiscoveryWords(words, '2026-11-01', 5), selectDiscoveryWords(words, '2026-11-02', 5));
});

test('word discovery returns unique normalized headwords and respects limits', () => {
  const result = selectDiscoveryWords(['Apple', 'apple', 'banana', 'bad word', 'x'.repeat(50), 'चाँद', 'river'], 'seed', 10);
  assert.equal(new Set(result).size, result.length);
  assert.ok(result.includes('apple'));
  assert.ok(result.includes('चाँद'));
  assert.equal(result.length, 4);
});

test('empty word lists and invalid limits are safe', () => {
  assert.deepEqual(selectDiscoveryWords([], 'seed'), []);
  assert.deepEqual(selectDiscoveryWords(['one'], 'seed', 0), []);
});
