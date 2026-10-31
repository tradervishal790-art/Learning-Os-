import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const drafts = await loadTs('src/testDraft.ts');
const KEY = 'learning_os_test_draft';

const paper = {
  id: 'paper-1',
  title: 'Algebra',
  topic: 'Maths',
  durationMinutes: 30,
  questions: [{
    id: 'q1', type: 'mcq', question: 'Which number is even?',
    options: ['2', '3'], correctIndex: 0, explanation: '', marks: 4, negativeMarks: 1,
  }],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

function validDraft(overrides = {}) {
  return {
    paper,
    answers: [{ questionId: 'q1', type: 'mcq', selectedIndex: 1 }],
    statusMap: { q1: 'answered' },
    step: 0,
    startedAt: Date.now(),
    ...overrides,
  };
}

test('valid in-progress test restores its answers and current question', () => {
  localStorage.setItem(KEY, JSON.stringify(validDraft()));
  const restored = drafts.loadDraft();
  assert.equal(restored?.paper.id, 'paper-1');
  assert.equal(restored?.answers[0].selectedIndex, 1);
  assert.equal(restored?.statusMap.q1, 'answered');
});

test('invalid draft with an answer for a missing question is cleared safely', () => {
  localStorage.setItem(KEY, JSON.stringify(validDraft({
    answers: [{ questionId: 'missing', type: 'mcq', selectedIndex: 0 }],
  })));
  assert.equal(drafts.loadDraft(), null);
  assert.equal(localStorage.getItem(KEY), null);
});

test('invalid selected option and non-finite start time cannot resume', () => {
  localStorage.setItem(KEY, JSON.stringify(validDraft({
    answers: [{ questionId: 'q1', type: 'mcq', selectedIndex: 9 }],
  })));
  assert.equal(drafts.loadDraft(), null);
  localStorage.setItem(KEY, JSON.stringify(validDraft({ startedAt: Infinity })));
  assert.equal(drafts.loadDraft(), null);
});

test('resume position is clamped to the available question range', () => {
  localStorage.setItem(KEY, JSON.stringify(validDraft({ step: 100 })));
  assert.equal(drafts.loadDraft()?.step, 0);
});
