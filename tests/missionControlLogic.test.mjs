import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Keep the production decision engine as the only implementation under test.
// Transpile its standalone TypeScript module in-memory so the repository's
// existing `node --test tests/*.test.mjs` command can exercise it directly.
const source = await readFile(new URL('../src/missionControlLogic.ts', import.meta.url), 'utf8');
const javascript = ts.transpile(source, {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
});
const engineUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`;
const { getNextBestStepRecommendation, getContinueLearningTarget } = await import(engineUrl);

const base = {
  hasLearningProfile: true,
  activeGoals: 1,
  revisionDue: 0,
  revisionOverdue: 0,
  currentTopic: 'React Hooks',
  currentTopicMastery: 40,
  currentTopicHasMeasuredWeakness: false,
  currentTopicSessions: 0,
  weakTopic: null,
  weakTopicMastery: null,
  testAttempts: 0,
  roadmapTopicCount: 8,
  completedTopicCount: 2,
};

test('profile setup has priority over downstream actions', () => {
  const result = getNextBestStepRecommendation({ ...base, hasLearningProfile: false, revisionOverdue: 3 });
  assert.equal(result.action, 'profile');
  assert.equal(result.stageId, 'know');
});

test('a learner without an active goal is directed to Plan', () => {
  const result = getNextBestStepRecommendation({ ...base, activeGoals: 0 });
  assert.equal(result.action, 'goal');
  assert.equal(result.stageId, 'plan');
});

test('overdue revision takes priority over due-today revision', () => {
  const result = getNextBestStepRecommendation({ ...base, revisionDue: 2, revisionOverdue: 1 });
  assert.equal(result.action, 'revision');
  assert.match(result.title, /1 overdue topic/);
  assert.equal(result.stageId, 'retain');
});

test('due-today revision takes priority over weak-topic help', () => {
  const result = getNextBestStepRecommendation({
    ...base,
    revisionDue: 2,
    weakTopic: 'State',
    weakTopicMastery: 25,
  });
  assert.equal(result.action, 'revision');
});

test('measured low recall/test/feedback can direct the learner to Mentor', () => {
  const result = getNextBestStepRecommendation({
    ...base,
    currentTopicMastery: 35,
    currentTopicHasMeasuredWeakness: true,
  });
  assert.equal(result.action, 'mentor');
  assert.equal(result.stageId, 'learn');
});

test('the default 40-point learning baseline is not treated as measured weakness', () => {
  const result = getNextBestStepRecommendation({ ...base, currentTopicMastery: 40 });
  assert.equal(result.action, 'videos');
  assert.equal(result.stageId, 'learn');
});

test('an explicitly measured weak non-current topic can trigger Mentor support', () => {
  const result = getNextBestStepRecommendation({
    ...base,
    weakTopic: 'Closures',
    weakTopicMastery: 42,
  });
  assert.equal(result.action, 'mentor');
  assert.match(result.title, /Closures/);
});

test('completed roadmap topics lead to a test when no topic is active', () => {
  const result = getNextBestStepRecommendation({
    ...base,
    currentTopic: null,
    roadmapTopicCount: 4,
    completedTopicCount: 4,
  });
  assert.equal(result.action, 'test');
  assert.equal(result.stageId, 'prove');
});

test('an empty roadmap leads to Roadmap rather than an empty Videos page', () => {
  const result = getNextBestStepRecommendation({
    ...base,
    currentTopic: null,
    roadmapTopicCount: 0,
    completedTopicCount: 0,
  });
  assert.equal(result.action, 'roadmap');
});

test('continue-learning routing keeps its existing topic/no-topic behavior', () => {
  assert.equal(getContinueLearningTarget(true), 'videos');
  assert.equal(getContinueLearningTarget(false), 'roadmap');
});
