import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dash = readFileSync(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8');
const roadmap = readFileSync(new URL('../src/Roadmap.tsx', import.meta.url), 'utf8');

test('home Watch buttons open the roadmap lecture, not the generic Videos page', () => {
  const home = dash.slice(dash.indexOf("activePage === 'dashboard' && ("), dash.indexOf("activePage === 'roadmap' && ("));
  assert.ok(!home.includes("setActivePage('videos')"), 'home must not route to the generic Videos page');
  assert.ok(dash.includes('const startNextLecture'));
  assert.ok((home.match(/startNextLecture/g) ?? []).length >= 1);
  assert.ok(/action: startNextLecture/.test(dash), 'checklist watch step uses the roadmap lecture');
});

test('roadmap auto-start resumes a saved video or builds the playlist once', () => {
  assert.ok(roadmap.includes('autoStartTopicId'));
  assert.ok(roadmap.includes('hasSavedVideoForTopic(activeGoalId ?? undefined, topic.id)'));
  assert.ok(roadmap.includes('autoStartedRef'));
  assert.ok(roadmap.includes('onClick={() => void handleWatchVideos()}'), 'click event must not be passed as a topic');
});
