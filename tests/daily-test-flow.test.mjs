import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const store = await loadTs('src/dailyTestStore.ts');
const KEY = 'learning_os_daily_test';

function question(id) {
  return {
    id, type: 'mcq', question: `Which statement best explains the unique learning concept ${id} for this chapter?`,
    options: ['True', 'False'], correctIndex: 0, explanation: '', marks: 1, negativeMarks: 0,
  };
}

test('daily tests keep a waiting paper stable and consume the remaining round before repeating', () => {
  localStorage.removeItem(KEY);
  store.setPerDay(3);
  assert.equal(store.saveBank(['alpha', 'bravo', 'charlie', 'delta', 'echo'].map(question)), true);

  const first = store.getOrCreateTodayTest();
  assert.equal(first.questions.length, 3);
  assert.equal(store.getOrCreateTodayTest().id, first.id);

  store.completeDailyTest(first.id, first.questions.map((q) => ({ questionId: q.id, isCorrect: true, marksObtained: 1 })));
  const saved = JSON.parse(localStorage.getItem(KEY));
  const firstIds = new Set(first.questions.map((q) => q.id));
  assert.equal(saved.queue.length, 2);

  // Move the completion date well into the past to model the next test day.
  assert.equal(saved.pending, null);
  saved.lastCompletedDate = '2000-01-01';
  assert.equal(saved.bank.length, 5);
  assert.equal(store.importDailyBackup(JSON.stringify(saved)), true, JSON.stringify(saved));
  assert.equal(store.getReadyDailyQuestionCount(), 5);
  assert.equal(store.getDailyStatus(), 'ready');

  const second = store.getOrCreateTodayTest();
  assert.equal(second.questions.length, 3);
  const secondIds = second.questions.map((q) => q.id);
  assert.equal(new Set(secondIds).size, 3);
  assert.equal(secondIds.filter((id) => !firstIds.has(id)).length, 2);
});

test('failed or duplicate completion cannot clear a different pending paper', () => {
  localStorage.removeItem(KEY);
  store.setPerDay(1);
  store.saveBank([question('only')]);
  const pending = store.getOrCreateTodayTest();
  store.completeDailyTest('not-the-pending-paper', []);
  assert.equal(store.getOrCreateTodayTest().id, pending.id);
});
