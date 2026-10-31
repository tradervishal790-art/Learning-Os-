import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const dedup = await loadTs('src/questionDedup.ts');

test('questions that differ by an algebra variable are not treated as duplicates', () => {
  const base = {
    type: 'mcq',
    options: ['1', '2'],
    correctIndex: 0,
    explanation: '',
    marks: 1,
    negativeMarks: 0,
  };
  const questions = [
    { ...base, id: 'x', question: 'Find x in the equation and explain your reasoning step by step.' },
    { ...base, id: 'y', question: 'Find y in the equation and explain your reasoning step by step.' },
  ];
  const result = dedup.dedupeQuestions(questions);
  assert.equal(result.questions.length, 2);
  assert.equal(result.duplicates, 0);
});

test('repeated question stems with numbering and punctuation are still deduplicated', () => {
  const questions = [
    { id: 'one', type: 'subjective', question: 'Q1. Explain photosynthesis in green plants.' },
    { id: 'two', type: 'subjective', question: 'Question 2: Explain photosynthesis in green plants!' },
  ];
  const result = dedup.dedupeQuestions(questions);
  assert.equal(result.questions.length, 1);
  assert.equal(result.duplicates, 1);
});
