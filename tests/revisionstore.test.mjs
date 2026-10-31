import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const store = await loadTs('src/revisionstore.ts');

test('revision cloud merge keeps unique checkpoints from both devices', () => {
  const merged = store.mergeReviewMaps(
    { react: [1, 7], localOnly: [3] },
    { react: [1, 3], cloudOnly: [1] },
  );
  assert.deepEqual(merged, {
    cloudOnly: [1],
    react: [1, 3, 7],
    localOnly: [3],
  });
});

test('revision cloud merge ignores malformed topics and checkpoint days', () => {
  const merged = store.mergeReviewMaps(
    { react: [1, 0, -2, 2.5, '3'] },
    { ' ': [1], maths: 'bad' },
  );
  assert.deepEqual(merged, { react: [1] });
});


test('review completion timestamps are saved and removed with their checkpoint', () => {
  localStorage.removeItem('learning_os_revision_reviews');
  localStorage.removeItem('learning_os_revision_review_dates');
  store.markDayReviewed('react', 1, '2026-10-01T10:00:00.000Z');
  assert.deepEqual(store.getReviewedDays('react'), [1]);
  assert.equal(store.getReviewDate('react', 1), '2026-10-01T10:00:00.000Z');

  store.unmarkDayReviewed('react', 1);
  assert.deepEqual(store.getReviewedDays('react'), []);
  assert.equal(store.getReviewDate('react', 1), null);
});

test('review timestamp merge keeps the newest valid date from either device', () => {
  const merged = store.mergeReviewDateMaps(
    { react: { 1: '2026-10-01T10:00:00.000Z', 3: 'bad' } },
    { react: { 1: '2026-10-02T10:00:00.000Z', 7: '2026-10-03T10:00:00.000Z' }, ' ': { 1: '2026-10-01T00:00:00.000Z' } },
  );
  assert.deepEqual(merged, {
    react: {
      1: '2026-10-02T10:00:00.000Z',
      7: '2026-10-03T10:00:00.000Z',
    },
  });
});


test('hydration merge preserves a checkpoint recorded locally while cloud data was loading', () => {
  const latestLocal = { react: [1, 7], localOnly: [3] };
  const cloudSnapshot = { react: [1, 3], cloudOnly: [1] };
  assert.deepEqual(store.mergeReviewMaps(latestLocal, cloudSnapshot), {
    cloudOnly: [1],
    react: [1, 3, 7],
    localOnly: [3],
  });
});
