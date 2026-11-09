import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const r = await loadTs('src/resumeStore.ts');
const vid = { kind: 'video', goalId: 'g', topicId: 't1', videoId: 'v1', seconds: 754, title: 'Nouns', at: 1 };
const rev = { kind: 'revision', itemId: 'rev-1', title: 'Articles', at: 2 };

test('left in revision: continue reopens that revision card', () => {
  const x = r.pickContinueTarget({ resume: rev, hasTestDraft: false, currentTopicId: 't1', openRevisionIds: ['rev-1'] });
  assert.equal(x.type, 'revision');
  assert.equal(x.point.itemId, 'rev-1');
});

test('revision already done: falls back, does not reopen a finished card', () => {
  const x = r.pickContinueTarget({ resume: rev, hasTestDraft: false, currentTopicId: 't1', openRevisionIds: [] });
  assert.equal(x.type, 'topic');
});

test('left mid-video on the current topic: resume that video', () => {
  const x = r.pickContinueTarget({ resume: vid, hasTestDraft: false, currentTopicId: 't1', openRevisionIds: [] });
  assert.equal(x.type, 'video');
  assert.equal(x.point.seconds, 754);
});

test('video of an old topic is ignored; unfinished test comes next', () => {
  assert.equal(r.pickContinueTarget({ resume: vid, hasTestDraft: true, currentTopicId: 't2', openRevisionIds: [] }).type, 'test');
  assert.equal(r.pickContinueTarget({ resume: null, hasTestDraft: false, currentTopicId: null, openRevisionIds: [] }).type, 'roadmap');
});

test('clock format', () => {
  assert.equal(r.formatClock(754), '12:34');
  assert.equal(r.formatClock(3725), '1:02:05');
});
