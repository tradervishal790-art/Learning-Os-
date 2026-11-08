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
