import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('#4 Watch never dead-ends on the learning-style quiz', () => {
  assert.ok(!read('Roadmap.tsx').includes('Complete the Learning Style Quiz first.'));
  assert.ok(!read('Dashboard.tsx').includes('Complete the Learning Style Quiz first.'));
  assert.match(read('learningProfileStore.ts'), /getLearningProfileOrNeutral/);
  assert.match(read('lectureBuilder.ts'), /getLearningProfileOrNeutral\(\)/);
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

test('#9 student-facing moments and playlist errors come from translations, not hardcoded English', () => {
  const welcome = read('WelcomeBack.tsx');
  assert.ok(!welcome.includes('>Welcome back<'));
  assert.match(welcome, /moments\.welcomeBack/);
  assert.match(read('DailyHabit.tsx'), /moments\.dailyHabit/);
  assert.match(read('RecallCheck.tsx'), /moments\.recallCheck/);
  for (const f of ['Dashboard.tsx', 'Roadmap.tsx']) {
    const src = read(f);
    assert.ok(!src.includes("'Playlist could not be built, please try again.'"), f);
    assert.ok(!src.includes("'Something went wrong.'"), f);
  }
  assert.ok(!read('Dashboard.tsx').includes("'Review what you learned'"));
});

test('#10 "Clear my profile" is no longer next to the home buttons; Settings asks to confirm', () => {
  const dash = read('Dashboard.tsx');
  assert.ok(!dash.includes('>\n                    Clear my profile'));
  assert.match(dash, /setConfirmClearProfile\(true\)/);
  assert.match(dash, /<ConfirmDialog[\s\S]{0,200}learningProfileSection\.clearConfirm/);
});

test('#8 finishing a checkpoint shows a small win message', () => {
  assert.match(read('Revision.tsx'), /setNotice\(t\.revision\.recall\.doneNote\)/);
});

test('#5 next lecture is prefetched once, only for signed-in returning learners, and Watch uses it', () => {
  const dash = read('Dashboard.tsx');
  assert.match(dash, /isReturning && !isGuest && currentTopic && \(\s*<LecturePrefetch/);
  assert.match(read('LecturePrefetch.tsx'), /import\('\.\/lectureBuilder'\)/);
  const lb = read('lectureBuilder.ts');
  for (const guard of ['navigator.onLine === false', 'saveData', 'failedRecently()', 'hasSavedVideoForTopic', 'inFlight.has', 'forceRefresh: false']) {
    assert.ok(lb.includes(guard), guard);
  }
  assert.match(read('Roadmap.tsx'), /takePrefetchedLecture\(topic\.id, lectureSignature\(lectureInput\)\)/);
});
