// Finishing a class completes that topic and opens the next one — revision never gates it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const topic = (id, status, extra = {}) => ({ id, title: id, status, difficulty: 'Beginner', ...extra });
const road = (...children) => ({ id: 'root', title: 'Goal', status: 'learning', difficulty: 'Beginner', children });
const NOW = new Date('2026-10-23T10:00:00.000Z');

test('finishing the class completes THAT topic, opens the next one, and starts its revision clock', async () => {
  const { applyWatchToTopic } = await loadTs('src/roadmapWatch.ts');
  const r = road(topic('t1', 'learning'), topic('t2', 'locked'), topic('t3', 'locked'));
  const out = applyWatchToTopic(r, 't1', 90, NOW);
  assert.equal(out.found, true);
  const [a, b, c] = out.roadmap.children;
  assert.equal(a.status, 'completed');
  assert.equal(a.learningStartedAt, NOW.toISOString(), 'revision schedule starts now');
  assert.equal(b.status, 'learning', 'next class is open');
  assert.equal(b.learningStartedAt, undefined, 'the next class has no revision clock until it is finished');
  assert.equal(c.status, 'locked', 'only the next one opens');
});

test('the revision clock starts the day the class is finished, even if the topic unlocked days earlier', async () => {
  const { applyWatchToTopic } = await loadTs('src/roadmapWatch.ts');
  const r = road(topic('t1', 'learning', { learningStartedAt: '2026-10-01T00:00:00.000Z' }), topic('t2', 'locked'));
  const out = applyWatchToTopic(r, 't1', 100, NOW);
  assert.equal(out.roadmap.children[0].learningStartedAt, NOW.toISOString());
});

test('between 70% and 85%: starts a locked topic, otherwise changes nothing', async () => {
  const { applyWatchToTopic } = await loadTs('src/roadmapWatch.ts');
  let out = applyWatchToTopic(road(topic('t1', 'locked')), 't1', 75, NOW);
  assert.equal(out.roadmap.children[0].status, 'learning');
  assert.equal(out.roadmap.children[0].learningStartedAt, undefined, 'started, not finished: no revision clock yet');
  out = applyWatchToTopic(road(topic('t1', 'learning'), topic('t2', 'locked')), 't1', 75, NOW);
  assert.equal(out.roadmap, null);
});

test('under 70% nothing changes', async () => {
  const { applyWatchToTopic } = await loadTs('src/roadmapWatch.ts');
  const out = applyWatchToTopic(road(topic('t1', 'learning'), topic('t2', 'locked')), 't1', 50, NOW);
  assert.deepEqual([out.found, out.roadmap], [true, null]);
});

test('a completed or mastered topic is never moved backwards', async () => {
  const { applyWatchToTopic } = await loadTs('src/roadmapWatch.ts');
  for (const status of ['completed', 'mastered']) {
    const out = applyWatchToTopic(road(topic('t1', status), topic('t2', 'locked')), 't1', 95, NOW);
    assert.deepEqual([out.found, out.roadmap], [true, null], status);
  }
});

test('unknown topic id: not found (caller falls back to title matching); last topic has no next to open', async () => {
  const { applyWatchToTopic } = await loadTs('src/roadmapWatch.ts');
  assert.deepEqual(applyWatchToTopic(road(topic('t1', 'learning')), 'zzz', 95, NOW), { found: false, roadmap: null });
  const out = applyWatchToTopic(road(topic('t1', 'locked'), topic('t2', 'learning')), 't2', 95, NOW);
  assert.equal(out.roadmap.children[1].status, 'completed');
  assert.equal(out.roadmap.children[0].status, 'locked', 'earlier topics are untouched');
});
