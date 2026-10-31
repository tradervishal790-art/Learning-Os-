import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const grading = await loadTs('src/testGrading.ts');

const mcq = {
  id: 'q1', type: 'mcq', question: 'Pick the correct answer',
  options: ['A', 'B'], correctIndex: 0, explanation: '', marks: 4, negativeMarks: 1,
};

test('MCQ scoring distinguishes correct, wrong and unanswered responses', () => {
  assert.deepEqual(grading.gradeMCQAnswer(mcq, { questionId: 'q1', type: 'mcq', selectedIndex: 0 }), {
    questionId: 'q1', isCorrect: true, marksObtained: 4,
  });
  assert.deepEqual(grading.gradeMCQAnswer(mcq, { questionId: 'q1', type: 'mcq', selectedIndex: 1 }), {
    questionId: 'q1', isCorrect: false, marksObtained: -1,
  });
  assert.deepEqual(grading.gradeMCQAnswer(mcq, undefined), {
    questionId: 'q1', isCorrect: false, marksObtained: 0,
  });
});

test('Hindi answer normalization ignores spacing and common punctuation', () => {
  assert.equal(grading.normalizeAnswer('भारत।  एक देश है!'), grading.normalizeAnswer('भारत एक देश है'));
});

test('subjective answers remain pending unless an accepted answer is supplied', () => {
  const question = { id: 's1', type: 'subjective', question: 'Define gravity', modelAnswer: 'Force of attraction', explanation: '', marks: 2 };
  const answers = [{ questionId: 's1', type: 'subjective', text: 'Gravity pulls objects together' }];
  assert.equal(grading.buildInitialResults([question], answers)[0].isCorrect, null);
  assert.equal(grading.buildInitialResults([{ ...question, acceptedAnswers: ['Gravity is attraction'] }], answers)[0].isCorrect, false);
});

test('self-grading updates only the selected subjective question', () => {
  const initial = [{ questionId: 's1', isCorrect: null, marksObtained: 0 }, { questionId: 's2', isCorrect: null, marksObtained: 0 }];
  const result = grading.selfGradeSubjective(initial, 's1', true, 2);
  assert.deepEqual(result, [
    { questionId: 's1', isCorrect: true, marksObtained: 2 },
    { questionId: 's2', isCorrect: null, marksObtained: 0 },
  ]);
});
