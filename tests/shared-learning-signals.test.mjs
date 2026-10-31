import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const signals = await loadTs('src/sharedLearningSignals.ts');

function session(overrides = {}) {
  return {
    totalDuration: 600,
    watchedSeconds: 300,
    watchPercentage: 50,
    seekForwardCount: 0,
    completed: false,
    feedback: null,
    ...overrides,
  };
}

test('ignores accidental starts and invalid watch samples', () => {
  assert.equal(signals.isMeaningfulSharedLearningSample(session({ watchedSeconds: 10, watchPercentage: 2 })), false);
  assert.equal(signals.isMeaningfulSharedLearningSample(session({ totalDuration: 0 })), false);
  assert.equal(signals.isMeaningfulSharedLearningSample(session({ watchPercentage: 101 })), false);
  assert.equal(signals.isMeaningfulSharedLearningSample(session({ seekForwardCount: 1 })), false);
  assert.equal(signals.isMeaningfulSharedLearningSample(session()), true);
});

test('classifies watch outcomes into coarse buckets', () => {
  assert.equal(signals.classifySharedLearningOutcome(session({ watchPercentage: 19.9 })), 'early-drop');
  assert.equal(signals.classifySharedLearningOutcome(session({ watchPercentage: 20 })), 'partial');
  assert.equal(signals.classifySharedLearningOutcome(session({ watchPercentage: 69.9 })), 'partial');
  assert.equal(signals.classifySharedLearningOutcome(session({ watchPercentage: 70 })), 'near-complete');
  assert.equal(signals.classifySharedLearningOutcome(session({ watchPercentage: 85 })), 'near-complete');
  assert.equal(signals.classifySharedLearningOutcome(session({ watchPercentage: 30, completed: true })), 'completed');
});

test('contribution contains only a coarse outcome and optional feedback', () => {
  const sample = signals.toSharedLearningSample({
    id: 'session-secret',
    videoId: 'abcdefghijk',
    userId: 'private-user-id',
    totalDuration: 600,
    watchedSeconds: 500,
    watchPercentage: 90,
    pauseCount: 8,
    seekForwardCount: 0,
    replayCount: 2,
    completed: true,
    timeToFirstPause: 12,
    feedback: 'like',
    signal: 'like',
    sessionTimestamp: '2026-10-31T00:00:00.000Z',
  });
  assert.deepEqual(sample, { outcome: 'completed', feedback: 'like' });
  assert.deepEqual(signals.buildSharedLearningCounters('completed', 'like'), {
    sampleCount: 1,
    earlyDropCount: 0,
    partialCount: 0,
    nearCompleteCount: 0,
    completedCount: 1,
    positiveFeedbackCount: 1,
    negativeFeedbackCount: 0,
  });
});

test('invalid or tiny sessions never become shared samples', () => {
  assert.equal(signals.toSharedLearningSample({
    id: 'x', videoId: 'abcdefghijk', userId: 'guest',
    totalDuration: 600, watchedSeconds: 12, watchPercentage: 2,
    pauseCount: 0, seekForwardCount: 0, replayCount: 0,
    completed: false, timeToFirstPause: null, feedback: null,
    signal: 'dislike', sessionTimestamp: '2026-10-31T00:00:00.000Z',
  }), null);
});
