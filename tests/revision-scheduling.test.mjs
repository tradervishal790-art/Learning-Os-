import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const {
  getAdaptiveIntervalDays,
  calendarDaysBetween,
  getDaysOverdue,
} = await loadTs('src/revisionScheduling.ts');

test('forgotten and partially recalled topics return sooner', () => {
  assert.equal(getAdaptiveIntervalDays(8, ['forgot']), 1);
  assert.equal(getAdaptiveIntervalDays(8, ['remembered', 'partial']), 4);
  assert.equal(getAdaptiveIntervalDays(2, ['partial']), 1);
});

test('repeated strong recall earns a modest interval extension', () => {
  assert.equal(getAdaptiveIntervalDays(8, ['remembered']), 8);
  assert.equal(getAdaptiveIntervalDays(8, ['partial', 'remembered', 'remembered']), 10);
  assert.equal(getAdaptiveIntervalDays(30, ['remembered', 'remembered']), 32);
});

test('invalid interval input safely falls back to one day', () => {
  assert.equal(getAdaptiveIntervalDays(Number.NaN, []), 1);
  assert.equal(getAdaptiveIntervalDays(0, []), 1);
});

test('calendar day counting follows dates rather than elapsed 24-hour blocks', () => {
  assert.equal(calendarDaysBetween('2026-10-30T23:45:00.000Z', new Date('2026-10-31T00:15:00.000Z')), 1);
  assert.equal(calendarDaysBetween('invalid-date', new Date('2026-10-31T00:15:00.000Z')), 0);
});

test('missed-day recovery reports overdue days without creating a backlog', () => {
  assert.equal(getDaysOverdue(3), 0);
  assert.equal(getDaysOverdue(0), 0);
  assert.equal(getDaysOverdue(-1), 1);
  assert.equal(getDaysOverdue(-8), 8);
});
