// #44 — a running voice recording must never vanish silently.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

test('guard: busy recorder is seen, saved or discarded on request, idle one is ignored', async () => {
  const g = await loadTs('tests/recordingGuardEntry.ts');
  assert.equal(g.isRecordingBusy(), false);
  let busy = true; let saved = 0; let discarded = 0;
  const off = g.registerRecorder({ busy: () => busy, saveAndStop: async () => { saved++; busy = false; return true; }, discard: () => { discarded++; busy = false; } });
  assert.equal(g.isRecordingBusy(), true);
  assert.equal(await g.saveBusyRecordings(), true);
  assert.equal(saved, 1);
  assert.equal(g.isRecordingBusy(), false);
  busy = true; g.discardBusyRecordings();
  assert.equal(discarded, 1);
  busy = true; saved = 0;
  g.discardBusyRecordings(); // busy again then idle: only busy ones are touched
  off();
  assert.equal(g.isRecordingBusy(), false);
});

test('guard: a failed save is reported (clip stays), so Back never loses it', async () => {
  const g = await loadTs('tests/recordingGuardEntry.ts');
  const off = g.registerRecorder({ busy: () => true, saveAndStop: async () => false, discard: () => {} });
  assert.equal(await g.saveBusyRecordings(), false);
  off();
});

test('rescue: an orphaned clip is stored and attached to the page it was recorded on', async () => {
  const g = await loadTs('tests/recordingGuardEntry.ts');
  localStorage.clear();
  const meta = await g.createNote(null, 'Rec test');
  const before = await g.loadNoteContent(meta.id);
  const pageId = before.pages[0].id;
  const ok = await g.rescueRecording(meta.id, pageId, { blob: new Blob(['voice'], { type: 'audio/webm' }), mime: 'audio/webm', durationSec: 12, bookmarks: [3] }, 'Voice note');
  assert.equal(ok, true);
  const after = await g.loadNoteContent(meta.id);
  const att = after.pages[0].attachments.find((a) => a.kind === 'audio');
  assert.ok(att, 'audio attachment present');
  assert.equal(att.name, 'Voice note');
  const clip = await g.getAudio(att.id);
  assert.equal(clip.meta.durationSec, 12);
  assert.deepEqual(clip.meta.bookmarks, [3]);
});

test('rescue: a page that no longer exists falls back to the last page instead of losing the clip', async () => {
  const g = await loadTs('tests/recordingGuardEntry.ts');
  const meta = await g.createNote(null, 'Rec test 2');
  const ok = await g.rescueRecording(meta.id, 'pg_gone', { blob: new Blob(['v']), mime: 'audio/webm', durationSec: 1, bookmarks: [] }, 'Voice note');
  assert.equal(ok, true);
  const c = await g.loadNoteContent(meta.id);
  assert.equal(c.pages[c.pages.length - 1].attachments.filter((a) => a.kind === 'audio').length, 1);
});
