import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/mentorPrefill.ts', import.meta.url), 'utf8');
const javascript = ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`;
const { saveMentorLearningContext, consumeMentorLearningContext, MENTOR_LEARNING_CONTEXT_KEY } = await import(moduleUrl);

function storage() {
  const values = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  return values;
}

test('Mentor handoff preserves topic, difficulty and source', () => {
  const values = storage();
  saveMentorLearningContext({ topicTitle: 'React Hooks', difficulty: 'Intermediate', source: 'videos' });
  const context = consumeMentorLearningContext();
  assert.deepEqual(context, { topicTitle: 'React Hooks', difficulty: 'Intermediate', source: 'videos' });
  assert.equal(values.has(MENTOR_LEARNING_CONTEXT_KEY), false);
});

test('Mentor handoff is consumed once and cannot leak into a later chat', () => {
  storage();
  saveMentorLearningContext({ topicTitle: 'Closures', source: 'roadmap' });
  assert.equal(consumeMentorLearningContext()?.topicTitle, 'Closures');
  assert.equal(consumeMentorLearningContext(), null);
});

test('empty and malformed context is ignored safely', () => {
  const values = storage();
  saveMentorLearningContext({ topicTitle: '   ' });
  assert.equal(consumeMentorLearningContext(), null);
  values.set(MENTOR_LEARNING_CONTEXT_KEY, '{broken');
  assert.equal(consumeMentorLearningContext(), null);
});

test('handoff values are bounded and unsupported sources are discarded', () => {
  const values = storage();
  saveMentorLearningContext({
    topicTitle: 'T'.repeat(500),
    goalTitle: 'G'.repeat(500),
    difficulty: 'D'.repeat(100),
    source: 'videos',
  });
  const context = consumeMentorLearningContext();
  assert.equal(context.topicTitle.length, 160);
  assert.equal(context.goalTitle.length, 120);
  assert.equal(context.difficulty.length, 40);
  assert.equal(context.source, 'videos');
  values.set(MENTOR_LEARNING_CONTEXT_KEY, JSON.stringify({ topicTitle: 'Valid', source: 'unknown' }));
  assert.deepEqual(consumeMentorLearningContext(), { topicTitle: 'Valid' });
});
