// Part 10 safety tools: sync conflicts, backup / import, Word + handwriting export.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadTs } from './helpers.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pg = (id, text, extra = {}) => ({ id, text, ...extra });
const snap = (title, pages, extra = {}) => ({ id: 'n1', title, pages, updatedAt: '2026-01-01T00:00:00.000Z', ...extra });
const stroke = (id, kind = 'ballpoint', color = 'auto') => ({ id, kind, color, width: 3, sim: true, sm: 0.5, pts: [10, 10, 0.5, 40, 30, 0.5, 80, 40, 0.5, 120, 90, 0.5] });

test('conflict: hasConflict needs BOTH sides changed since the last sync', async () => {
  const { hasConflict } = await loadTs('src/conflict.ts');
  assert.equal(hasConflict(true, '2026-02-01T00:00:00Z', '2026-01-01T00:00:00Z'), true);
  assert.equal(hasConflict(false, '2026-02-01T00:00:00Z', '2026-01-01T00:00:00Z'), false);
  assert.equal(hasConflict(true, '2025-12-01T00:00:00Z', '2026-01-01T00:00:00Z'), false);
  assert.equal(hasConflict(true, 'nonsense', '2026-01-01T00:00:00Z'), true, 'unreadable time = cannot prove it is unchanged');
});

test('conflict: mergePages three-way rules', async () => {
  const { mergePages } = await loadTs('src/conflict.ts');
  const base = snap('T', [pg('p1', 'one'), pg('p2', 'two')]);
  const onlyRemote = mergePages(snap('T', [pg('p1', 'one'), pg('p2', 'two')]), snap('T', [pg('p1', 'one'), pg('p2', 'TWO')]), base);
  assert.deepEqual(onlyRemote.conflictingPageIds, []);
  assert.equal(onlyRemote.merged[1].text, 'TWO');
  const both = mergePages(snap('T', [pg('p1', 'L'), pg('p2', 'two')]), snap('T', [pg('p1', 'R'), pg('p2', 'two')]), base);
  assert.deepEqual(both.conflictingPageIds, ['p1']);
  assert.equal(both.merged[0].text, 'L', 'the local copy stays in the merge result');
  const noBase = mergePages(snap('T', [pg('p1', 'x')]), snap('T', [pg('p1', 'y')]));
  assert.deepEqual(noBase.conflictingPageIds, ['p1']);
  const deletedHere = mergePages(snap('T', [pg('p1', 'one')]), snap('T', [pg('p1', 'one'), pg('p2', 'two')]), base);
  assert.deepEqual(deletedHere.merged.map((p) => p.id), ['p1'], 'deleted here + untouched there stays deleted');
  const editedVsDeleted = mergePages(snap('T', [pg('p1', 'one')]), snap('T', [pg('p1', 'one'), pg('p2', 'two EDITED')]), base);
  assert.deepEqual(editedVsDeleted.conflictingPageIds, ['p2'], 'edited there but deleted here is a conflict');
  assert.deepEqual(editedVsDeleted.merged.map((p) => p.id), ['p1', 'p2'], 'and nothing is lost');
  const added = mergePages(snap('T', [pg('p1', 'one'), pg('p3', 'new local')]), snap('T', [pg('p1', 'one'), pg('p4', 'new remote')]), snap('T', [pg('p1', 'one')]));
  assert.deepEqual(added.merged.map((p) => p.id).sort(), ['p1', 'p3', 'p4']);
});

test('conflict: photos, PDF links and the linked video count as changes', async () => {
  const { mergePages, mergeVideo, pagesEqual } = await loadTs('src/conflict.ts');
  const a = pg('p1', 'same', { attachments: [{ id: 'im1', kind: 'image', name: 'a.jpg' }] });
  const b = pg('p1', 'same');
  assert.equal(pagesEqual([a], [b]), false);
  assert.equal(mergePages(snap('T', [a]), snap('T', [b])).conflictingPageIds.length, 1);
  assert.equal(pagesEqual([pg('p1', 'x', { pdf: { fileId: 'f', pageNumber: 2, name: 'n.pdf' } })], [pg('p1', 'x', { pdf: { fileId: 'f', pageNumber: 3, name: 'n.pdf' } })]), false);
  const v1 = { videoId: 'abcdefghijk', moments: [] };
  const v2 = { videoId: 'abcdefghijk', moments: [{ id: 'm', seconds: 5, kind: 'revisit', note: '', createdAt: '2026-01-01T00:00:00Z' }] };
  const base = snap('T', [], { video: v1 });
  assert.deepEqual(mergeVideo(snap('T', [], { video: v1 }), snap('T', [], { video: v2 }), base), { video: v2, conflict: false });
  assert.equal(mergeVideo(snap('T', [], { video: v2 }), snap('T', [], { video: { ...v1, startAt: 9 } }), base).conflict, true);
});

test('conflict: keepBothCopy is a deep copy as a new note', async () => {
  const { keepBothCopy } = await loadTs('src/conflict.ts');
  let n = 0;
  const orig = snap('Chem', [pg('p1', 'a', { ink: [stroke('s1')] })], { video: { videoId: 'abcdefghijk', moments: [] } });
  const copy = keepBothCopy(orig, () => `id${++n}`);
  assert.equal(copy.title, 'Chem (other device)');
  assert.notEqual(copy.id, orig.id);
  assert.notEqual(copy.pages[0].id, 'p1');
  copy.pages[0].ink[0].pts[0] = 999;
  assert.equal(orig.pages[0].ink[0].pts[0], 10, 'the original is untouched');
  assert.equal(copy.video.videoId, 'abcdefghijk');
});

test('backup: parseBackup keeps video, photos, PDF links and library fields; drops junk with warnings', async () => {
  const { parseBackup, buildBackupJson } = await loadTs('src/backup.ts');
  const note = {
    id: 'n1', title: 'Bio', updatedAt: '2026-03-01T00:00:00.000Z', tags: ['exam'], pinned: true, status: 'learning', confidence: 4, examDate: '2026-05-01',
    pages: [pg('p1', 'x', { html: '<p>x</p>', ink: [stroke('s1')], attachments: [{ id: 'im1', kind: 'image', name: 'a.jpg' }] }), pg('p2', '', { pdf: { fileId: 'f1', pageNumber: 2, name: 'n.pdf' } })],
    video: { videoId: 'abcdefghijk', startAt: 12, moments: [{ id: 'm1', seconds: 30, kind: 'confusing', note: 'why', createdAt: '2026-03-01T00:00:00Z' }] },
  };
  const r = parseBackup(buildBackupJson([note]));
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.files, 2, 'one photo + one PDF page are only references');
  assert.deepEqual(r.notes[0], note);
  const bad = parseBackup(JSON.stringify({ notes: [{}, { id: 'a', pages: 'x' }, { id: 'b', title: 't', pages: [{ id: 'p', text: 1 }, { id: 'q', text: 'ok', ink: [{ id: 's', kind: 'laser', color: 'auto', width: 1, pts: [1, 2, 3] }] }] }] }));
  assert.equal(bad.ok, true);
  assert.equal(bad.notes.length, 1);
  assert.equal(bad.notes[0].pages.length, 1, 'the page with bad text is dropped');
  assert.deepEqual(bad.notes[0].pages[0].ink, [], 'the stroke with an unknown kind is dropped');
  assert.ok(bad.warnings.length >= 4);
  assert.deepEqual(parseBackup('nope'), { ok: false, error: 'not-json' });
  assert.deepEqual(parseBackup('[]'), { ok: false, error: 'wrong-format' });
  assert.deepEqual(parseBackup('{"version":99,"notes":[]}'), { ok: false, error: 'too-new' });
  assert.equal(parseBackup('{"notes":[{}]}').ok, true, 'a damaged note is a warning, never a crash');
  // junk values must not leak through
  const junk = parseBackup(JSON.stringify({ notes: [{ id: 'z', title: 't', pages: [], status: 'hacked', confidence: 99, examDate: 'soon', video: { videoId: '<script>' } }] }));
  assert.equal(junk.notes[0].status, undefined);
  assert.equal(junk.notes[0].confidence, undefined);
  assert.equal(junk.notes[0].examDate, undefined);
  assert.equal(junk.notes[0].video, undefined);
});

test('backup: the note menu\'s own single-note JSON can be imported too', async () => {
  const { parseBackup } = await loadTs('src/backup.ts');
  const { noteToBackupJson } = await loadTs('src/noteExport.ts');
  const r = parseBackup(noteToBackupJson('My note', [pg('p1', 'hello', { ink: [stroke('s1')] })], { videoId: 'abcdefghijk', moments: [] }));
  assert.equal(r.ok, true);
  assert.equal(r.notes.length, 1);
  assert.equal(r.notes[0].id, '', 'no id yet: the import gives it a fresh one');
  assert.equal(r.notes[0].title, 'My note');
  assert.equal(r.notes[0].pages[0].ink.length, 1);
});

test('backup: planImport create / replace / skip, and ids never collide', async () => {
  const { planImport } = await loadTs('src/backup.ts');
  let c = 0;
  const newId = () => `new${++c}`;
  const mk = (id, at) => ({ id, title: id, pages: [], updatedAt: at });
  const plan = planImport(
    [{ id: 'a', updatedAt: '2026-02-01T00:00:00Z' }, { id: 'b', updatedAt: '2026-02-01T00:00:00Z' }, { id: 'e', updatedAt: 'garbage' }],
    [mk('a', '2026-01-01T00:00:00Z'), mk('b', '2026-03-01T00:00:00Z'), mk('c', '2026-01-01T00:00:00Z'), mk('c', '2026-01-02T00:00:00Z'), mk('', '2026-01-01T00:00:00Z'), mk('e', '2026-09-01T00:00:00Z')],
    newId
  );
  assert.deepEqual(plan.toReplace.map((n) => n.id), ['b']);
  assert.equal(plan.skipped, 2, 'older copy and a copy whose local time is unreadable are skipped');
  assert.equal(plan.toCreate.length, 3);
  assert.equal(new Set(plan.toCreate.map((n) => n.id)).size, 3);
});

test('handwriting: highlighter is drawn first, auto colour follows the paper', async () => {
  const { inkToSvg } = await loadTs('src/inkSvg.ts');
  const svg = inkToSvg([stroke('s1', 'ballpoint', 'auto'), stroke('s2', 'highlighter', '#ffff00')], {});
  assert.ok(svg.indexOf('opacity="0.4"') > -1 && svg.indexOf('opacity="0.4"') < svg.indexOf('#111827'));
  assert.ok(inkToSvg([stroke('s1')], { dark: true }).includes('#f3f4f6'));
  assert.match(svg, /viewBox="0 0 1000 \d+"/);
});

test('export: printable page includes handwriting only when asked, and a handwriting-only page is not dropped', async () => {
  const { noteToHtml } = await loadTs('src/noteExport.ts');
  const pages = [pg('p1', 'typed text'), pg('p2', '', { ink: [stroke('s1')] })];
  const plain = noteToHtml('N', pages);
  assert.ok(!plain.includes('<svg'), 'default output is unchanged: no handwriting');
  const withInk = noteToHtml('N', pages, { ink: true });
  assert.equal((withInk.match(/<svg/g) || []).length, 1);
  assert.ok(withInk.includes('typed text'));
  assert.ok(!/<script/i.test(withInk));
});

test('export: Word file is a valid zip with headings, lists, tables, and names of photos / PDF pages', async () => {
  const { exportDocx } = await loadTs('src/noteExportWord.ts');
  const blob = await exportDocx('Doc', [
    pg('p1', 'x', { html: '<h1>Heading</h1><p><strong>b</strong> <em>i</em> <a href="https://example.com">link</a></p><ul><li>a</li></ul><ol><li>1</li></ol><ul data-type="taskList"><li data-checked="true"><p>done</p></li></ul><table><tr><th>h</th></tr><tr><td>c</td></tr></table>', attachments: [{ id: 'im1', kind: 'image', name: 'diagram.png' }] }),
    pg('p2', 'pdf text', { pdf: { fileId: 'f', pageNumber: 4, name: 'book.pdf' } }),
  ], { includeInk: false });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.ok(blob.size > 1500);
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml').async('string');
  for (const needle of ['Heading', 'diagram.png', 'book.pdf', 'done', 'link']) assert.ok(xml.includes(needle), `document.xml mentions ${needle}`);
  assert.ok(xml.includes('w:hyperlink'), 'the link is a real Word hyperlink');
});

// ---------- the store: two devices and a fake cloud ----------

async function loadStore() {
  const dir = join(process.cwd(), 'node_modules', '.cache', 'los-test');
  mkdirSync(dir, { recursive: true });
  const fake = join(dir, `fakeCloud${process.pid}.mjs`);
  writeFileSync(fake, `
    const cloud = (globalThis.__cloud ??= new Map());
    export const pullFromCloud = async (k) => (cloud.has(k) ? structuredClone(cloud.get(k)) : null);
    export const pushToCloudChecked = async (k, v) => { cloud.set(k, structuredClone(v)); return true; };
    export const deleteFromCloud = async (k) => { cloud.delete(k); };
    export const subscribeCloud = () => () => {};
  `);
  const outfile = join(dir, `store${process.pid}.mjs`);
  await build({
    entryPoints: [resolve('src/notebookStore.ts')], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent', jsx: 'automatic',
    external: ['react', 'react-dom'],
    plugins: [{ name: 'fake-cloud', setup(b) { b.onResolve({ filter: /cloudSync$/ }, () => ({ path: fake })); } }],
  });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
}

test('store: edited on both devices since the last sync -> held, nothing overwritten, resolve works', async () => {
  localStorage.clear();
  globalThis.__cloud = new Map();
  const S = await loadStore();
  const meta = await S.createNote(null, 'Photosynthesis');
  await S.saveNoteContent(meta.id, 'Photosynthesis', [pg('p1', 'one')]);
  await S.retrySync(); // first sync: the cloud now has the note and the sync mark is recorded
  assert.ok(globalThis.__cloud.has(`note_${meta.id}`));

  // the OTHER device edits the cloud copy
  await sleep(15);
  const t2 = new Date().toISOString();
  const cloudNote = globalThis.__cloud.get(`note_${meta.id}`);
  globalThis.__cloud.set(`note_${meta.id}`, { ...cloudNote, pages: [pg('p1', 'one'), pg('p2', 'remote page')], updatedAt: t2 });
  const idxCloud = globalThis.__cloud.get('notebookIndex');
  globalThis.__cloud.set('notebookIndex', { ...idxCloud, notes: idxCloud.notes.map((n) => (n.id === meta.id ? { ...n, title: 'Photosynthesis (phone)', updatedAt: t2 } : n)) });

  // THIS device edits the same note
  await sleep(15);
  await S.saveNoteContent(meta.id, 'Photosynthesis', [pg('p1', 'local edit')]);
  await S.hydrateNotebook();

  assert.deepEqual(S.getNoteConflictIds(), [meta.id], 'the note is held for the student to decide');
  const local = await S.loadNoteContent(meta.id);
  assert.equal(local.pages[0].text, 'local edit', 'this device was not overwritten');
  assert.equal(globalThis.__cloud.get(`note_${meta.id}`).pages.length, 2, 'the cloud was not overwritten either');
  await S.retrySync(); // a full push must still skip the held note
  assert.equal(globalThis.__cloud.get(`note_${meta.id}`).pages[1].text, 'remote page');
  assert.equal(globalThis.__cloud.get('notebookIndex').notes.find((n) => n.id === meta.id).title, 'Photosynthesis (phone)', 'the cloud index row is kept too');
  assert.equal(S.getIndex().notes.find((n) => n.id === meta.id).title, 'Photosynthesis', 'our own row is untouched');

  const info = await S.loadConflict(meta.id);
  assert.equal(info.local.pages[0].text, 'local edit');
  assert.equal(info.remote.pages.length, 2);
  assert.equal(info.remote.title, 'Photosynthesis (phone)');

  assert.equal(await S.resolveConflict(info, { type: 'theirs' }), true);
  assert.deepEqual(S.getNoteConflictIds(), []);
  assert.equal((await S.loadNoteContent(meta.id)).pages.length, 2);
  await S.retrySync();
  assert.equal(globalThis.__cloud.get(`note_${meta.id}`).pages.length, 2, 'the chosen version syncs again');
});

test('store: only the other device edited -> pulled as before, no hold', async () => {
  localStorage.clear();
  globalThis.__cloud = new Map();
  const S = await loadStore();
  const meta = await S.createNote(null, 'Algebra');
  await S.saveNoteContent(meta.id, 'Algebra', [pg('p1', 'one')]);
  await S.retrySync();
  await sleep(15);
  const t2 = new Date().toISOString();
  globalThis.__cloud.set(`note_${meta.id}`, { ...globalThis.__cloud.get(`note_${meta.id}`), pages: [pg('p1', 'edited on phone')], updatedAt: t2 });
  const idxCloud = globalThis.__cloud.get('notebookIndex');
  globalThis.__cloud.set('notebookIndex', { ...idxCloud, notes: idxCloud.notes.map((n) => (n.id === meta.id ? { ...n, updatedAt: t2 } : n)) });
  await S.hydrateNotebook();
  assert.deepEqual(S.getNoteConflictIds(), []);
  assert.equal((await S.loadNoteContent(meta.id)).pages[0].text, 'edited on phone');
});

test('store: a held note survives a reload (the hold is persisted)', async () => {
  localStorage.clear();
  globalThis.__cloud = new Map();
  let S = await loadStore();
  const meta = await S.createNote(null, 'Held');
  await S.saveNoteContent(meta.id, 'Held', [pg('p1', 'one')]);
  await S.retrySync();
  await sleep(15);
  const t2 = new Date().toISOString();
  globalThis.__cloud.set(`note_${meta.id}`, { ...globalThis.__cloud.get(`note_${meta.id}`), pages: [pg('p1', 'remote')], updatedAt: t2 });
  const idxCloud = globalThis.__cloud.get('notebookIndex');
  globalThis.__cloud.set('notebookIndex', { ...idxCloud, notes: idxCloud.notes.map((n) => (n.id === meta.id ? { ...n, updatedAt: t2 } : n)) });
  await sleep(15);
  await S.saveNoteContent(meta.id, 'Held', [pg('p1', 'local')]);
  await S.hydrateNotebook();
  assert.equal(S.getNoteConflictIds().length, 1);
  S = await loadStore(); // "reload": fresh module, same localStorage + IndexedDB
  assert.deepEqual(S.getNoteConflictIds(), [meta.id]);
  await S.retrySync();
  assert.equal(globalThis.__cloud.get(`note_${meta.id}`).pages[0].text, 'remote', 'still not overwritten after the reload');
});

test('store: backup -> delete -> import restores a note with video, handwriting and photo references', async () => {
  localStorage.clear();
  globalThis.__cloud = new Map();
  const S = await loadStore();
  const { buildBackupJson, parseBackup } = await loadTs('src/backup.ts');
  const meta = await S.createNote(null, 'Original');
  await S.saveNoteContent(meta.id, 'Original', [pg('p1', 'text', { attachments: [{ id: 'im-missing', kind: 'image', name: 'a.jpg' }], ink: [stroke('s1')] })], { videoId: 'abcdefghijk', moments: [] });
  const { notes } = await S.getAllSnapshots();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].video.videoId, 'abcdefghijk');
  const file = buildBackupJson(notes);
  await S.deleteNotesForever([meta.id]);
  assert.equal(S.getIndex().notes.length, 0);
  const parsed = parseBackup(file);
  const r = await S.importSnapshots(parsed.notes);
  assert.deepEqual([r.created, r.replaced, r.skipped, r.failed], [1, 0, 0, 0]);
  const back = await S.loadNoteContent(meta.id);
  assert.equal(back.pages[0].ink.length, 1);
  assert.equal(back.video.videoId, 'abcdefghijk');
  assert.equal(back.pages[0].attachments[0].id, 'im-missing', 'a photo whose file is not here keeps its reference');
  // importing the same file again changes nothing
  const again = await S.importSnapshots(parsed.notes);
  assert.deepEqual([again.created, again.replaced, again.skipped], [0, 0, 1]);
});

test('store: "keep both" keeps mine here and adds the other device\'s version as a new note', async () => {
  localStorage.clear();
  globalThis.__cloud = new Map();
  const S = await loadStore();
  const meta = await S.createNote(null, 'Optics');
  await S.saveNoteContent(meta.id, 'Optics', [pg('p1', 'one')]);
  await S.retrySync();
  await sleep(15);
  const t2 = new Date().toISOString();
  globalThis.__cloud.set(`note_${meta.id}`, { ...globalThis.__cloud.get(`note_${meta.id}`), pages: [pg('p1', 'phone version')], updatedAt: t2 });
  const idxCloud = globalThis.__cloud.get('notebookIndex');
  globalThis.__cloud.set('notebookIndex', { ...idxCloud, notes: idxCloud.notes.map((n) => (n.id === meta.id ? { ...n, title: 'Optics (phone)', updatedAt: t2 } : n)) });
  await sleep(15);
  await S.saveNoteContent(meta.id, 'Optics', [pg('p1', 'laptop version')]);
  await S.hydrateNotebook();
  const info = await S.loadConflict(meta.id);
  assert.equal(await S.resolveConflict(info, { type: 'both' }), true);
  const notes = S.getIndex().notes;
  assert.equal(notes.length, 2);
  const copy = notes.find((n) => n.id !== meta.id);
  assert.equal(copy.title, 'Optics (phone) (other device)');
  assert.equal((await S.loadNoteContent(copy.id)).pages[0].text, 'phone version');
  assert.equal((await S.loadNoteContent(meta.id)).pages[0].text, 'laptop version');
  assert.deepEqual(S.getNoteConflictIds(), []);
});

test('textDiff: word diff, big inputs never hang, page diff follows ids', async () => {
  const { diffWords, diffPages } = await loadTs('src/textDiff.ts');
  assert.deepEqual(diffWords('a b c', 'a x c').map((o) => [o.type, o.text]), [['same', 'a '], ['remove', 'b '], ['add', 'x '], ['same', 'c']]);
  assert.deepEqual(diffWords('', 'new'), [{ type: 'add', text: 'new' }]);
  const big = Array.from({ length: 6000 }, (_, i) => `w${i}`).join(' ');
  const t0 = Date.now();
  const ops = diffWords(big, big.replace('w3000', 'zzz'));
  assert.ok(Date.now() - t0 < 3000 && ops.length > 0, 'more than 5000 words falls back to a line diff');
  const changes = diffPages(
    [pg('p1', 'one'), pg('p2', 'two'), pg('p3', 'three', { ink: [stroke('s1')] })],
    [pg('p1', 'one'), pg('p3', 'three', { ink: [stroke('s1'), stroke('s2')] }), pg('p4', 'four')]
  );
  assert.deepEqual(changes.map((c) => [c.pageId, c.kind]), [['p1', 'same'], ['p2', 'removed'], ['p3', 'changed'], ['p4', 'added']]);
  assert.deepEqual([changes[2].inkBefore, changes[2].inkAfter], [1, 2]);
});
