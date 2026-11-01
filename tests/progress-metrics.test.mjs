import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { normalizeActiveDays, calculateCurrentStreak, summarizeEngagementTime } = await loadTs('src/progressMetrics.ts');

test('active-day normalization removes duplicates and malformed calendar dates', () => {
  assert.deepEqual(
    normalizeActiveDays(['2026-10-31', '2026-11-01', '2026-10-31', '2026-02-30', 'bad', 42, null]),
    ['2026-10-31', '2026-11-01'],
  );
});

test('streak includes yesterday when today has not yet been recorded', () => {
  const now = new Date('2026-11-01T08:00:00.000Z');
  assert.equal(calculateCurrentStreak(['2026-10-30', '2026-10-31'], now), 2);
  assert.equal(calculateCurrentStreak(['2026-10-29', '2026-10-31'], now), 1);
  assert.equal(calculateCurrentStreak([], now), 0);
});

test('time summaries ignore malformed, negative and non-finite engagement records', () => {
  const now = new Date('2026-11-01T12:00:00.000Z');
  const result = summarizeEngagementTime([
    { watchedSeconds: 120, sessionTimestamp: '2026-11-01T10:00:00.000Z' },
    { watchedSeconds: 60, sessionTimestamp: '2026-10-31T10:00:00.000Z' },
    { watchedSeconds: -50, sessionTimestamp: '2026-11-01T11:00:00.000Z' },
    { watchedSeconds: Number.NaN, sessionTimestamp: '2026-11-01T11:00:00.000Z' },
    { watchedSeconds: 10, sessionTimestamp: 'not-a-date' },
  ], now);
  assert.equal(result.sessionCount, 2);
  assert.equal(result.totalHours, 0.1);
  assert.equal(result.todayMinutes, 2);
  assert.equal(result.last7DaysMinutes, 3);
  assert.equal(result.dailyMinutes.length, 7);
});
