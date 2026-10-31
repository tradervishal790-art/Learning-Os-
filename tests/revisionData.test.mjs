import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const data = await loadTs('src/revisionData.ts');
const reviews = await loadTs('src/revisionstore.ts');
const recall = await loadTs('src/revisionRecallStore.ts');
const ROADMAP_KEY = 'learning_os_generated_roadmap';

const tasks = {
  day1: 'Review day one', day3: 'Review day three', day7: 'Review day seven',
  day15: 'Review day fifteen', day30: 'Review day thirty', day60: 'Review day sixty',
  fallback: 'Review this topic',
};

function setupTopic() {
  localStorage.removeItem('learning_os_revision_reviews');
  localStorage.removeItem('learning_os_revision_review_dates');
  localStorage.removeItem('learning_os_revision_recall');
  const now = new Date();
  const started = new Date(now);
  started.setDate(started.getDate() - 10);
  localStorage.setItem(ROADMAP_KEY, JSON.stringify({
    id: 'test-roadmap',
    title: 'Test roadmap',
    description: '',
    status: 'learning',
    estimatedTime: '1 week',
    difficulty: 'Beginner',
    why: { learn: '', connect: '', system: '', risk: '' },
    children: [{
      id: 'topic-retain',
      title: 'Memory topic',
      description: '',
      status: 'learning',
      estimatedTime: '1 hour',
      difficulty: 'Beginner',
      why: { learn: '', connect: '', system: '', risk: '' },
      learningStartedAt: started.toISOString(),
      children: [],
    }],
  }));
  return now;
}

test('next checkpoint is scheduled from the actual completion date', () => {
  const now = setupTopic();
  const reviewed = new Date(now);
  reviewed.setDate(reviewed.getDate() - 2);
  reviews.markDayReviewed('topic-retain', 1, reviewed.toISOString());
  recall.saveRecallRating('topic-retain', 1, 'remembered');

  const [item] = data.getRevisionData(tasks);
  assert.equal(item.day, 3);
  assert.equal(item.status, 'due-today');
});

test('forgotten material returns sooner than the normal spaced interval', () => {
  const now = setupTopic();
  const reviewed = new Date(now);
  reviewed.setDate(reviewed.getDate() - 2);
  reviews.markDayReviewed('topic-retain', 1, reviewed.toISOString());
  recall.saveRecallRating('topic-retain', 1, 'forgot');

  const [item] = data.getRevisionData(tasks);
  assert.equal(item.day, 3);
  assert.equal(item.status, 'overdue');
  assert.equal(item.dueDate, 'Yesterday');
});
