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

test('#1 revision cards no longer show an invented retention number', () => {
  const src = read('Revision.tsx');
  assert.ok(!src.includes('retentionLabel'));
  assert.ok(!src.includes('item.retention'));
});

test('#2 "Forgot" keeps the checkpoint pending and snoozes it until tomorrow', () => {
  const src = read('Revision.tsx');
  assert.match(src, /rating === 'forgot'[\s\S]{0,200}snoozeCheckpointUntilTomorrow/);
  assert.match(read('revisionData.ts'), /isCheckpointSnoozed\(topic\.id, nextDay\)/);
  assert.match(read('revisionstore.ts'), /export function snoozeCheckpointUntilTomorrow/);
});

test('#3 Done opens the recall rating instead of marking the checkpoint directly', () => {
  const src = read('Revision.tsx');
  const doneBtn = src.slice(src.indexOf('aria-label={t.revision.card.doneCta}') - 120, src.indexOf('aria-label={t.revision.card.doneCta}'));
  assert.match(doneBtn, /handleReviewNow\(item\.id\)/);
  assert.ok(!src.includes('onClick={() => handleMarkDone(item)}'));
});
