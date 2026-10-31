import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const logic = await loadTs('src/sharedLearningPatternLogic.ts');

test('revision patterns require multiple topic recalls and bucket only coarse ratings', () => {
  assert.equal(logic.bucketRecallRatings(['remembered']), null);
  assert.equal(logic.bucketRecallRatings(['forgot', 'forgot']), 'low');
  assert.equal(logic.bucketRecallRatings(['forgot', 'partial']), 'medium');
  assert.equal(logic.bucketRecallRatings(['remembered', 'remembered']), 'high');
});

test('question accuracy patterns require at least ten scored questions', () => {
  assert.equal(logic.bucketQuestionAccuracy(4, 9), null);
  assert.equal(logic.bucketQuestionAccuracy(3, 10), 'low');
  assert.equal(logic.bucketQuestionAccuracy(6, 10), 'medium');
  assert.equal(logic.bucketQuestionAccuracy(9, 10), 'high');
  assert.equal(logic.bucketQuestionAccuracy(11, 10), null);
});

test('only approved coarse signal identifiers are accepted', () => {
  assert.equal(logic.isSharedPatternId('revision_day_7'), true);
  assert.equal(logic.isSharedPatternId('question_mcq'), true);
  assert.equal(logic.isSharedPatternId('question_subjective'), true);
  assert.equal(logic.isSharedPatternId('my_private_topic'), false);
  assert.equal(logic.isSharedPatternId('revision_day_2'), false);
});

test('aggregate payload contains only three outcome counters', () => {
  assert.deepEqual(logic.buildPatternCounters('medium'), {
    sampleCount: 1, lowCount: 0, mediumCount: 1, highCount: 0,
  });
});
