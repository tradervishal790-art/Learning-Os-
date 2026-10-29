import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const store = await loadTs('src/dailyTestStore.ts');
const validQuestion = {
  id: 'q1',
  type: 'mcq',
  question: 'Which is correct?',
  options: ['A', 'B', 'C', 'D'],
  correctIndex: 0,
  explanation: '',
  marks: 1,
  negativeMarks: 0,
};
const base = {
  version: 1,
  bank: [],
  perDay: 35,
  minutesPerQuestion: 1,
  queue: [],
  round: 1,
  wrongIds: [],
  pending: null,
  lastCompletedDate: null,
  daysCompleted: 0,
};

test('daily-test backup rejects malformed question objects instead of crashing later', () => {
  assert.equal(store.importDailyBackup(JSON.stringify({ ...base, bank: [null] })), false);
  assert.equal(store.getReadyDailyQuestionCount(), 0);
  assert.equal(store.importDailyBackup(JSON.stringify({ ...base, bank: [{ ...validQuestion, options: [null, 3] }] })), false);
});

test('daily-test backup still accepts valid questions and preserves incomplete-answer state', () => {
  assert.equal(store.importDailyBackup(JSON.stringify({ ...base, bank: [validQuestion], queue: ['q1'] })), true);
  assert.equal(store.getReadyDailyQuestionCount(), 1);
  assert.equal(store.getDailySummary().total, 1);
});
