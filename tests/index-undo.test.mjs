// Undo in the notes library reverts only what one action changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const note = (id, extra = {}) => ({ id, title: id, folderId: null, updatedAt: '2026-01-01T00:00:00.000Z', ...extra });
const folder = (id, extra = {}) => ({ id, name: id, parentId: null, updatedAt: '2026-01-01T00:00:00.000Z', ...extra });
const NOW = '2026-02-02T00:00:00.000Z';

test('undo of trash brings back only the trashed note, not later edits to other notes', async () => {
  const { captureUndo, applyUndo } = await loadTs('src/indexUndo.ts');
  const before = { notes: [note('a'), note('b')], folders: [], deleted: {} };
  const after = { notes: [note('a', { trashedAt: 'x' }), note('b')], folders: [], deleted: {} };
  const u = captureUndo(before, after);
  assert.deepEqual(Object.keys(u.notes), ['a']);
  // meanwhile the student renamed b and created c
  const current = { notes: [note('a', { trashedAt: 'x' }), note('b', { title: 'renamed' }), note('c')], folders: [], deleted: {} };
  const out = applyUndo(current, u, NOW);
  const a = out.notes.find((n) => n.id === 'a');
  assert.equal(a.trashedAt, undefined, 'a is back');
  assert.equal(a.updatedAt, NOW, 'stamped so the undo wins the cloud merge');
  assert.equal(out.notes.find((n) => n.id === 'b').title, 'renamed', 'later edit to b is kept');
  assert.ok(out.notes.some((n) => n.id === 'c'), 'later new note c is kept');
});

test('undo of a folder delete restores the folder, its notes and the deleted marker', async () => {
  const { captureUndo, applyUndo } = await loadTs('src/indexUndo.ts');
  const before = { notes: [note('a', { folderId: 'f' })], folders: [folder('f')], deleted: {} };
  const after = { notes: [note('a', { folderId: null })], folders: [], deleted: { f: 't' } };
  const u = captureUndo(before, after);
  const out = applyUndo(after, u, NOW);
  assert.equal(out.folders.length, 1);
  assert.equal(out.notes[0].folderId, 'f');
  assert.deepEqual(out.deleted, {});
});

test('rows created by the action are removed again; untouched action = empty undo', async () => {
  const { captureUndo, applyUndo, isEmptyUndo } = await loadTs('src/indexUndo.ts');
  const before = { notes: [note('a')], folders: [], deleted: {} };
  const after = { notes: [note('a'), note('dup')], folders: [], deleted: {} };
  const u = captureUndo(before, after);
  assert.deepEqual(applyUndo(after, u, NOW).notes.map((n) => n.id), ['a']);
  assert.equal(isEmptyUndo(captureUndo(before, before)), true);
});
