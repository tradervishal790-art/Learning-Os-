import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('#4 Watch never dead-ends on the learning-style quiz', () => {
  assert.ok(!read('Roadmap.tsx').includes('Complete the Learning Style Quiz first.'));
  assert.ok(!read('Dashboard.tsx').includes('Complete the Learning Style Quiz first.'));
  assert.match(read('learningProfileStore.ts'), /getLearningProfileOrNeutral/);
  assert.match(read('Roadmap.tsx'), /getLearningProfileOrNeutral\(\)/);
});
