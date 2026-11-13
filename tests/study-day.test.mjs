import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { markStudyDay, readStudyDays, readStudyStreak, STUDY_DAY_EVENT, ACTIVE_DAYS_STORAGE_KEY } = await loadTs('src/studyDay.ts');
const { upsertEngagementSession } = await loadTs('src/engagementStore.ts');

const reset = () => localStorage.clear();
const session = (watchedSeconds) => ({ id: `s${watchedSeconds}`, videoId: 'v1', userId: 'guest', totalDuration: 600, watchedSeconds, watchPercentage: 10, pauseCount: 0, seekForwardCount: 0, replayCount: 0, completed: false, timeToFirstPause: null, feedback: null, signal: 'neutral', sessionTimestamp: new Date().toISOString() });

test('marking a study day is idempotent and announces only a new day', () => {
  reset();
  let events = 0;
  const on = () => { events += 1; };
  window.addEventListener(STUDY_DAY_EVENT, on);
  const now = new Date('2026-11-06T09:00:00.000Z');
  markStudyDay(now);
  markStudyDay(now);
  window.removeEventListener(STUDY_DAY_EVENT, on);
  assert.deepEqual(readStudyDays(), ['2026-11-06']);
  assert.equal(events, 1);
});

test('streak stays alive through yesterday and resets after a missed day', () => {
  reset();
  localStorage.setItem(ACTIVE_DAYS_STORAGE_KEY, JSON.stringify(['2026-11-04', '2026-11-05']));
  assert.equal(readStudyStreak(new Date('2026-11-06T08:00:00.000Z')), 2);
  assert.equal(readStudyStreak(new Date('2026-11-07T08:00:00.000Z')), 0);
});

test('a short video glance does not count, a real watch session does', () => {
  reset();
  upsertEngagementSession(session(20));
  assert.deepEqual(readStudyDays(), []);
  upsertEngagementSession(session(90));
  assert.equal(readStudyDays().length, 1);
});

const { hasWrittenContent } = await loadTs('src/studyDay.ts');
const { addRevisionSeconds, readRevisionSecondsByDay } = await loadTs('src/revisionTimeStore.ts');
const { summarizeEngagementTime } = await loadTs('src/progressMetrics.ts');

test('an empty note is not study, a written or drawn one is', () => {
  assert.equal(hasWrittenContent([{ text: '   ' }, { text: '' }]), false);
  assert.equal(hasWrittenContent([{ text: 'Nouns: number and kind' }]), true);
  assert.equal(hasWrittenContent([{ text: '', ink: [{}] }]), true);
});

test('revision time adds up per day and marks the day only after a minute', () => {
  reset();
  const now = new Date('2026-11-06T10:00:00.000Z');
  assert.equal(addRevisionSeconds(30, now), 30);
  assert.deepEqual(readStudyDays(), []);
  assert.equal(addRevisionSeconds(40, now), 70);
  assert.deepEqual(readStudyDays(), ['2026-11-06']);
  assert.deepEqual(readRevisionSecondsByDay(), { '2026-11-06': 70 });
  assert.equal(addRevisionSeconds(-5, now), 0);
});

test('study time totals include revision seconds, video sessions stay counted', () => {
  const now = new Date('2026-11-06T12:00:00.000Z');
  const result = summarizeEngagementTime(
    [{ watchedSeconds: 1800, sessionTimestamp: '2026-11-06T08:00:00.000Z' }],
    now,
    { '2026-11-06': 1800, 'bad-key': 999 },
  );
  assert.equal(result.totalHours, 1);
  assert.equal(result.todayMinutes, 60);
  assert.equal(result.sessionCount, 1);
});

test('a study day follows the learner\'s local calendar day, not UTC', () => {
  reset();
  // 23:30 local on 6 Nov: in UTC+5:30 this is still 6 Nov locally but 18:00 UTC;
  // built from local parts so the assertion holds in any time zone.
  const lateEvening = new Date(2026, 10, 6, 23, 30);
  markStudyDay(lateEvening);
  assert.deepEqual(readStudyDays(), ['2026-11-06']);
  // 00:30 local the next day is a NEW day, even if UTC has not rolled over yet.
  const justAfterMidnight = new Date(2026, 10, 7, 0, 30);
  markStudyDay(justAfterMidnight);
  assert.deepEqual(readStudyDays(), ['2026-11-06', '2026-11-07']);
  assert.equal(readStudyStreak(justAfterMidnight), 2);
});
