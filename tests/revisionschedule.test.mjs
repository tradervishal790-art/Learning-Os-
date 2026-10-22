// Revision checkpoints (Day 1/3/7/15/30/60) are counted from the real class day and never pile up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

// Local-time dates so the calendar-day maths is the same on any machine.
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const iso = (y, m, d, h = 12) => at(y, m, d, h).toISOString();

test('day 1 is TOMORROW (calendar days), not 24 hours later', async () => {
  const { nextCheckpoint } = await loadTs('src/revisionSchedule.ts');
  const startedAt = iso(2026, 10, 20, 23); // class finished at 11 pm
  assert.deepEqual(nextCheckpoint({ startedAt, reviewedDays: [], now: at(2026, 10, 20, 23) }), { day: 1, daysUntilDue: 1 });
  assert.deepEqual(nextCheckpoint({ startedAt, reviewedDays: [], now: at(2026, 10, 21, 7) }), { day: 1, daysUntilDue: 0 }, 'due first thing next morning');
});

test('on-time learner: day 1, then day 3, then day 7 on the right dates', async () => {
  const { nextCheckpoint } = await loadTs('src/revisionSchedule.ts');
  const startedAt = iso(2026, 10, 1);
  const r1 = nextCheckpoint({ startedAt, reviewedDays: [1], lastReviewedAt: iso(2026, 10, 2), now: at(2026, 10, 2) });
  assert.deepEqual(r1, { day: 3, daysUntilDue: 2 }, 'day 3 is two days after day 1');
  const r2 = nextCheckpoint({ startedAt, reviewedDays: [1, 3], lastReviewedAt: iso(2026, 10, 4), now: at(2026, 10, 4) });
  assert.deepEqual(r2, { day: 7, daysUntilDue: 4 });
});

test('a late learner does NOT get the next checkpoints one after another on the same day', async () => {
  const { nextCheckpoint } = await loadTs('src/revisionSchedule.ts');
  const startedAt = iso(2026, 10, 1);
  // Day 1 was due on Oct 2, but the learner only reviews it on Oct 10.
  const afterLate = nextCheckpoint({ startedAt, reviewedDays: [1], lastReviewedAt: iso(2026, 10, 10), now: at(2026, 10, 10) });
  assert.deepEqual(afterLate, { day: 3, daysUntilDue: 2 }, 'day 3 comes two days after the late review, not today');
  // Without the review date (old data) the plain schedule applies.
  const legacy = nextCheckpoint({ startedAt, reviewedDays: [1], now: at(2026, 10, 10) });
  assert.equal(legacy.daysUntilDue, 3 - 9);
});

test('never earlier than the plain schedule', async () => {
  const { nextCheckpoint } = await loadTs('src/revisionSchedule.ts');
  // Reviewed day 1 very early (same day as the class): day 3 still waits until day 3.
  const out = nextCheckpoint({ startedAt: iso(2026, 10, 1), reviewedDays: [1], lastReviewedAt: iso(2026, 10, 1), now: at(2026, 10, 1) });
  assert.deepEqual(out, { day: 3, daysUntilDue: 3 });
});

test('all checkpoints done or a bad date: nothing to schedule', async () => {
  const { nextCheckpoint } = await loadTs('src/revisionSchedule.ts');
  assert.equal(nextCheckpoint({ startedAt: iso(2026, 10, 1), reviewedDays: [1, 3, 7, 15, 30, 60], now: at(2026, 12, 1) }), null);
  assert.equal(nextCheckpoint({ startedAt: 'not a date', reviewedDays: [], now: at(2026, 12, 1) }), null);
});

test('month and year boundaries count calendar days correctly', async () => {
  const { localDayNumber } = await loadTs('src/revisionSchedule.ts');
  assert.equal(localDayNumber(at(2027, 1, 1)) - localDayNumber(at(2026, 12, 31)), 1);
  assert.equal(localDayNumber(at(2026, 3, 1)) - localDayNumber(at(2026, 2, 28)), 1);
  assert.equal(localDayNumber(at(2026, 10, 25, 23)) - localDayNumber(at(2026, 10, 25, 0)), 0, 'same day, different hours');
});
