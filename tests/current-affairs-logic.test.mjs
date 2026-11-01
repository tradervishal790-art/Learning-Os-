import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { isCurrentAffairsCacheEntry } = await loadTs('src/currentAffairsLogic.ts');

const day = {
  date: '2026-10-31',
  locale: 'en',
  points: [{ category: 'national', text: 'A', source: 'Source' }],
  quiz: [],
};

test('accepts a cached Current Affairs day only for its exact date and locale', () => {
  assert.equal(isCurrentAffairsCacheEntry(day, '2026-10-31', 'en'), true);
  assert.equal(isCurrentAffairsCacheEntry(day, '2026-10-30', 'en'), false);
  assert.equal(isCurrentAffairsCacheEntry(day, '2026-10-31', 'hi'), false);
});

test('rejects incomplete or malformed cached day records for recovery', () => {
  assert.equal(isCurrentAffairsCacheEntry(null, '2026-10-31', 'en'), false);
  assert.equal(isCurrentAffairsCacheEntry({ ...day, points: [] }, '2026-10-31', 'en'), false);
  assert.equal(isCurrentAffairsCacheEntry({ ...day, points: 'bad' }, '2026-10-31', 'en'), false);
  assert.equal(isCurrentAffairsCacheEntry({ ...day, quiz: 'bad' }, '2026-10-31', 'en'), false);
});
