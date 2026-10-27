import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const store = await loadTs('src/studyLogStore.ts');
const KEY = 'learning_os_study_log';

function reset() {
  localStorage.removeItem(KEY);
}

test('adds a trimmed study session and calculates honest summary totals', () => {
  reset();
  const initial = store.addStudyLogEntry({
    date: '2026-10-27',
    subject: '  Mathematics ',
    topic: ' Time and Work ',
    minutes: 35,
    recallScore: 75,
  }, { version: 1, entries: [] });
  const next = store.addStudyLogEntry({
    date: '2026-10-26',
    subject: 'English',
    topic: 'Vocabulary',
    minutes: 20,
  }, initial);

  assert.equal(next.entries.length, 2);
  assert.equal(next.entries[0].subject, 'Mathematics');
  assert.equal(next.entries[0].topic, 'Time and Work');
  assert.equal(next.entries[0].minutes, 35);
  assert.equal(next.entries[0].recallScore, 75);

  const summary = store.getStudyLogSummary(next, '2026-10-27');
  assert.deepEqual(summary, {
    totalSessions: 2,
    totalMinutes: 55,
    minutesToday: 35,
    sessionsToday: 1,
    activeDays: 2,
    averageRecall: 75,
  });
});

test('rejects empty subject/topic, invalid time, recall, and calendar dates', () => {
  const empty = { version: 1, entries: [] };
  const base = { subject: 'Math', topic: 'Fractions', minutes: 10 };
  assert.throws(() => store.addStudyLogEntry({ ...base, subject: '  ' }, empty), /subject and topic/i);
  assert.throws(() => store.addStudyLogEntry({ ...base, topic: '' }, empty), /subject and topic/i);
  assert.throws(() => store.addStudyLogEntry({ ...base, minutes: 0 }, empty), /at least one minute/i);
  assert.throws(() => store.addStudyLogEntry({ ...base, minutes: 0.4 }, empty), /at least one minute/i);
  assert.throws(() => store.addStudyLogEntry({ ...base, minutes: Number.NaN }, empty), /at least one minute/i);
  assert.throws(() => store.addStudyLogEntry({ ...base, minutes: Number.MAX_SAFE_INTEGER + 1 }, empty), /safe whole number/i);
  assert.throws(() => store.addStudyLogEntry({ ...base, recallScore: 101 }, empty), /recall score/i);
  assert.throws(() => store.addStudyLogEntry({ ...base, date: '2026-02-30' }, empty), /valid YYYY-MM-DD/i);
  assert.throws(() => store.addStudyLogEntry({ ...base, date: 'tomorrow' }, empty), /valid YYYY-MM-DD/i);
});

test('load ignores malformed entries and de-duplicates repeated IDs', () => {
  reset();
  const good = {
    id: 'one',
    date: '2026-10-27',
    subject: 'Math',
    topic: 'Fractions',
    minutes: 15,
    createdAt: '2026-10-27T08:00:00.000Z',
  };
  localStorage.setItem(KEY, JSON.stringify({
    version: 99,
    entries: [
      good,
      { ...good, subject: 'Updated Math', minutes: 25 },
      { ...good, id: 'bad-date', date: '2026-02-30' },
      { ...good, id: 'bad-minutes', minutes: 1.5 },
      { ...good, id: 'bad-recall', recallScore: 120 },
      { ...good, id: 'bad-timestamp', createdAt: 'not-a-date' },
      { ...good, id: 'blank-subject', subject: ' ' },
    ],
  }));

  const loaded = store.loadStudyLog();
  assert.equal(loaded.version, 1);
  assert.equal(loaded.entries.length, 1);
  assert.equal(loaded.entries[0].id, 'one');
  assert.equal(loaded.entries[0].subject, 'Updated Math');
  assert.equal(loaded.entries[0].minutes, 25);
});

test('save and remove persist normalized entries locally', () => {
  reset();
  const state = store.addStudyLogEntry({
    date: '2026-10-27',
    subject: 'Science',
    topic: 'Light',
    minutes: 12,
  }, { version: 1, entries: [] });
  assert.equal(store.saveStudyLog(state), true);
  assert.equal(store.loadStudyLog().entries.length, 1);

  const removed = store.removeStudyLogEntry(state.entries[0].id, store.loadStudyLog());
  assert.equal(removed.entries.length, 0);
  assert.equal(store.saveStudyLog(removed), true);
  assert.equal(store.loadStudyLog().entries.length, 0);
});

test('empty study log has zero totals and no invented recall score', () => {
  reset();
  assert.deepEqual(store.getStudyLogSummary({ version: 1, entries: [] }, '2026-10-27'), {
    totalSessions: 0,
    totalMinutes: 0,
    minutesToday: 0,
    sessionsToday: 0,
    activeDays: 0,
    averageRecall: null,
  });
});
