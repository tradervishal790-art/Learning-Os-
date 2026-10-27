import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const store = await loadTs('src/revisionRecallStore.ts');
const KEY = 'learning_os_revision_recall';

function reset() {
  localStorage.removeItem(KEY);
}

test('saving a recall rating stores one valid record per topic and checkpoint', () => {
  reset();
  const first = store.saveRecallRating('react-hooks', 3, 'forgot');
  assert.equal(first.topicId, 'react-hooks');
  assert.equal(first.day, 3);
  assert.equal(first.rating, 'forgot');
  assert.ok(!Number.isNaN(Date.parse(first.recordedAt)));

  store.saveRecallRating('react-hooks', 3, 'remembered');
  store.saveRecallRating('react-hooks', 7, 'partial');
  store.saveRecallRating('javascript', 3, 'partial');

  assert.deepEqual(store.getRecallRecords('react-hooks').map(({ day, rating }) => ({ day, rating })), [
    { day: 3, rating: 'remembered' },
    { day: 7, rating: 'partial' },
  ]);
  assert.equal(store.getRecallRecords().length, 3);
});

test('invalid topic IDs, checkpoint days, and ratings are rejected', () => {
  reset();
  assert.throws(() => store.saveRecallRating('', 1, 'forgot'), /valid topic ID/i);
  assert.throws(() => store.saveRecallRating('topic', 0, 'forgot'), /valid topic ID/i);
  assert.throws(() => store.saveRecallRating('topic', 1.5, 'forgot'), /valid topic ID/i);
  assert.throws(() => store.saveRecallRating('topic', 1, 'unknown'), /invalid recall rating/i);
  assert.deepEqual(store.getRecallRecords(), []);
});

test('reads ignore malformed records and records stored under the wrong topic key', () => {
  reset();
  localStorage.setItem(KEY, JSON.stringify({
    topicA: [
      { topicId: 'topicA', day: 1, rating: 'remembered', recordedAt: '2026-10-27T00:00:00.000Z' },
      { topicId: 'topicA', day: 0, rating: 'forgot', recordedAt: '2026-10-27T00:00:00.000Z' },
      { topicId: 'topicA', day: 2, rating: 'unknown', recordedAt: '2026-10-27T00:00:00.000Z' },
      { topicId: 'otherTopic', day: 3, rating: 'partial', recordedAt: '2026-10-27T00:00:00.000Z' },
      { topicId: 'topicA', day: 4, rating: 'partial', recordedAt: 'not-a-date' },
    ],
    topicB: { not: 'an array' },
  }));

  assert.deepEqual(store.getRecallRecords('topicA').map((record) => record.day), [1]);
  assert.deepEqual(store.getRecallRecords().map((record) => record.topicId), ['topicA']);
});

test('accuracy is null without observations and averages the three recall levels', () => {
  reset();
  assert.equal(store.getRecallAccuracy(), null);
  store.saveRecallRating('a', 1, 'forgot');
  store.saveRecallRating('b', 1, 'partial');
  store.saveRecallRating('c', 1, 'remembered');
  assert.equal(store.getRecallAccuracy(), 50);
});

test('seven-day trend keeps days without recall attempts null, not zero', () => {
  reset();
  const now = new Date(2026, 9, 27, 12, 0, 0);
  const today = new Date(2026, 9, 27, 9, 0, 0).toISOString();
  const yesterday = new Date(2026, 9, 26, 9, 0, 0).toISOString();
  localStorage.setItem(KEY, JSON.stringify({
    a: [{ topicId: 'a', day: 1, rating: 'remembered', recordedAt: today }],
    b: [{ topicId: 'b', day: 1, rating: 'forgot', recordedAt: yesterday }],
  }));

  const trend = store.getRecallTrend(now);
  assert.equal(trend.length, 7);
  assert.equal(trend[5].date, '2026-10-26');
  assert.equal(trend[5].accuracy, 0);
  assert.equal(trend[5].attempts, 1);
  assert.equal(trend[6].date, '2026-10-27');
  assert.equal(trend[6].accuracy, 100);
  assert.equal(trend[6].attempts, 1);
  assert.equal(trend[0].accuracy, null);
  assert.equal(trend[0].attempts, 0);
});
