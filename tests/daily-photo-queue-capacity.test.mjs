import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const queue = await loadTs('src/dailyPhotoQueue.ts');

test('photo queue reports the exact number saved and preserves the capacity limit', async () => {
  await queue.clearQueuedDailyPhotos();
  const fullBatch = Array.from({ length: 200 }, (_, i) => new File([`photo-${i}`], `photo-${i}.jpg`, { type: 'image/jpeg' }));
  const first = await queue.enqueueDailyPhotos(fullBatch);
  assert.deepEqual(first, { count: 200, added: 200, skipped: 0 });

  const overflow = await queue.enqueueDailyPhotos([new File(['extra'], 'extra.jpg', { type: 'image/jpeg' })]);
  assert.deepEqual(overflow, { count: 200, added: 0, skipped: 1 });
  assert.equal(await queue.getQueuedPhotoCount(), 200);
  await queue.clearQueuedDailyPhotos();
});

test('concurrent uploads cannot exceed the shared 200-file capacity', async () => {
  await queue.clearQueuedDailyPhotos();
  const first = Array.from({ length: 150 }, (_, i) => new File([`first-${i}`], `first-${i}.jpg`, { type: 'image/jpeg' }));
  const second = Array.from({ length: 150 }, (_, i) => new File([`second-${i}`], `second-${i}.jpg`, { type: 'image/jpeg' }));
  const results = await Promise.all([queue.enqueueDailyPhotos(first), queue.enqueueDailyPhotos(second)]);
  assert.equal(await queue.getQueuedPhotoCount(), 200);
  assert.equal(results.reduce((sum, result) => sum + result.added, 0), 200);
  assert.equal(results.reduce((sum, result) => sum + result.skipped, 0), 100);
  await queue.clearQueuedDailyPhotos();
});
