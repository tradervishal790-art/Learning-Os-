import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { getTopicTestEvidence, combineTopicMasteryScore } = await loadTs('src/topicMastery.ts');
function attempt(topic, outcomes) {
  return { topic, results: outcomes.map((isCorrect, index) => ({ questionId: `q${index}`, isCorrect, marksObtained: isCorrect ? 1 : 0 })) };
}

test('topic evidence matches exact normalized topic names and ignores pending subjective answers', () => {
  const evidence = getTopicTestEvidence('Algebra', [
    attempt('ALGEBRA!', [true, false, null]),
    attempt('Advanced Algebra', [true, true, true]),
    attempt(' algebra ', [true]),
  ]);
  assert.deepEqual(evidence, { accuracy: 67, attempts: 2, gradedQuestions: 3 });
  const hindi = getTopicTestEvidence('प्रकाश संश्लेषण', [attempt('प्रकाश-संश्लेषण', [true, false])]);
  assert.deepEqual(hindi, { accuracy: 50, attempts: 1, gradedQuestions: 2 });
});

test('only the five most recent matching tests contribute to mastery evidence', () => {
  const evidence = getTopicTestEvidence('Physics', Array.from({ length: 6 }, (_, i) => attempt('Physics', [i !== 0])));
  assert.deepEqual(evidence, { accuracy: 80, attempts: 5, gradedQuestions: 5 });
});

test('mastery uses recall as primary evidence and gradually trusts test scores', () => {
  assert.equal(combineTopicMasteryScore(75, 80, 40, 2), 66);
  assert.equal(combineTopicMasteryScore(75, null, 25, 1), 65);
  assert.equal(combineTopicMasteryScore(75, null, 25, 5), 45);
  assert.equal(combineTopicMasteryScore(75, null, null, 0), 75);
});
