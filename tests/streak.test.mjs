import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

// Fixed "today" = Wed 2026-10-21 (local). daysAgo(n) -> local YYYY-MM-DD.
const today = new Date(2026, 9, 21, 12, 0, 0);
const daysAgo = (n) => {
  const d = new Date(2026, 9, 21 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('streak: plain consecutive days', async () => {
  const { computeStreak } = await loadTs('src/streak.ts');
  assert.equal(computeStreak([daysAgo(0), daysAgo(1), daysAgo(2)], today), 3);
  assert.equal(computeStreak([daysAgo(0)], today), 1);
});

test('streak: one missed day is forgiven, and not counted', async () => {
  const { computeStreak } = await loadTs('src/streak.ts');
  assert.equal(computeStreak([daysAgo(0), daysAgo(2), daysAgo(3)], today), 3);
});

test('streak: two missed days in a row break it', async () => {
  const { computeStreak } = await loadTs('src/streak.ts');
  assert.equal(computeStreak([daysAgo(0), daysAgo(3), daysAgo(4)], today), 1);
});

test('streak: only one rest day per 7 days', async () => {
  const { computeStreak } = await loadTs('src/streak.ts');
  // misses at 2 and 5 (3 apart) -> second miss is not forgiven
  const days = [0, 1, 3, 4, 6, 7].map(daysAgo);
  assert.equal(computeStreak(days, today), 4);
  // misses at 2 and 9 (7 apart) -> both forgiven
  const spaced = [0, 1, 3, 4, 5, 6, 7, 8, 10].map(daysAgo);
  assert.equal(computeStreak(spaced, today), 9);
});

test('streak: a miss with nothing before it is not a rest day', async () => {
  const { computeStreak } = await loadTs('src/streak.ts');
  assert.equal(computeStreak([daysAgo(0), daysAgo(1)], today), 2);
});

test('streak: days are local calendar days, not UTC', async () => {
  const { localDayKey } = await loadTs('src/streak.ts');
  assert.equal(localDayKey(new Date(2026, 9, 21, 0, 30)), '2026-10-21'); // 00:30 local stays on the 21st
  assert.equal(localDayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});
