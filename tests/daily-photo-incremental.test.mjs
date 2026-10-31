import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const queue = await loadTs('src/dailyPhotoQueue.ts');
const DAILY_KEY = 'learning_os_daily_test';

function pageQuestion(page) {
  return {
    type: 'mcq',
    number: 1,
    question: `What is the key idea on ${page}?`,
    options: ['A', 'B'],
    answer: 'A',
    explanation: '',
    incomplete: false,
  };
}

test('Daily Test extracts only the pages needed and resumes remaining PDF pages later', async () => {
  await queue.clearQueuedDailyPhotos();
  localStorage.removeItem(DAILY_KEY);
  await queue.enqueueDailyPhotos([new File(['original-pdf'], 'chapter.pdf', { type: 'application/pdf' })]);

  const pages = ['page-1', 'page-2', 'page-3'];
  let extractionCalls = 0;
  const dependencies = {
    prepareUpload: async () => pages.map((page) => ({ mimeType: 'application/pdf', data: btoa(page) })),
    extractQuestionsFromPhoto: async (payload) => {
      extractionCalls += 1;
      const page = atob(payload.data);
      return { questions: [pageQuestion(page)], answerKey: [] };
    },
  };

  const first = await queue.processQueuedPhotosForDailyTest(1, undefined, dependencies);
  assert.equal(first.processedPages, 1);
  assert.equal(first.processedFiles, 0);
  assert.equal(first.bank.length, 1);
  assert.equal(first.remainingFiles, 1);
  assert.equal(extractionCalls, 1);

  const second = await queue.processQueuedPhotosForDailyTest(2, undefined, dependencies);
  assert.equal(second.processedPages, 1);
  assert.equal(second.bank.length, 2);
  assert.equal(second.remainingFiles, 1);
  assert.equal(extractionCalls, 2);

  const third = await queue.processQueuedPhotosForDailyTest(3, undefined, dependencies);
  assert.equal(third.processedPages, 1);
  assert.equal(third.processedFiles, 1);
  assert.equal(third.bank.length, 3);
  assert.equal(third.remainingFiles, 0);
  assert.equal(extractionCalls, 3);

  await queue.clearQueuedDailyPhotos();
  localStorage.removeItem(DAILY_KEY);
});
