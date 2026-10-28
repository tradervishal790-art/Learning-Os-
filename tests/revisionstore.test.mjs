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
