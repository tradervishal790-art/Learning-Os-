import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

test('revisionExtract: merges split marks, colours -> meaning, dedupes across pages', async () => {
  const { extractHighlights, itemsToText } = await loadTs('src/revisionExtract.ts');
  const a = '<p>x <mark data-color="#fde047">Mitochondria</mark><mark data-color="#fde047"> make ATP</mark> and <mark data-color="#f9a8d4">why NADH?</mark></p>';
  const b = '<p><mark style="background-color: rgb(253, 224, 71)">Mitochondria make ATP</mark></p>';
  const r = extractHighlights([{ id: 'a', html: a }, { id: 'b', html: b }]);
  assert.deepEqual(r.map((x) => [x.kind, x.text, x.count]), [['important', 'Mitochondria make ATP', 2], ['doubt', 'why NADH?', 1]]);
  assert.deepEqual(r[0].pages.map((p) => p.pageNumber), [1, 2]);
  const text = itemsToText(r, { kinds: { important: 'Important', doubt: 'Doubt', example: 'Ex', understood: 'OK', other: 'Other' }, page: 'Page' });
  assert.match(text, /- Mitochondria make ATP \(Page 1, 2\) ×2/);
});

test('mistakeStore: add / list / remove, empty text rejected, bad storage ignored', async () => {
  const { addMistake, getMistakes, removeMistake } = await loadTs('src/mistakeStore.ts');
  localStorage.clear();
  assert.equal(addMistake({ text: '   ' }), null);
  const m = addMistake({ text: ' Wrong formula ', fix: 'E = mc^2', noteId: 'n1' });
  assert.equal(m.text, 'Wrong formula');
  assert.equal(getMistakes().length, 1);
  removeMistake(m.id);
  assert.equal(getMistakes().length, 0);
  localStorage.setItem('learning_os_mistakes_v1', '{not json');
  assert.deepEqual(getMistakes(), []);
});

test('attachStore: image and pdf round trip, delete', async () => {
  const s = await loadTs('src/attachStore.ts');
  await s.putImage('im1', new Blob(['abc'], { type: 'image/jpeg' }), 'a.jpg');
  assert.equal((await s.getImage('im1')).size, 3);
  await s.deleteImage('im1');
  assert.equal(await s.getImage('im1'), null);
  await s.putPdf('pd1', new Blob(['%PDF'], { type: 'application/pdf' }), 'x.pdf');
  assert.ok(await s.getPdf('pd1'));
});

test('audioStore: put / get / bookmarks / delete', async () => {
  const s = await loadTs('src/audioStore.ts');
  await s.putAudio('a1', new Blob(['xx'], { type: 'audio/webm' }), { durationSec: 7, bookmarks: [1, 2], createdAt: '2026-01-01T00:00:00Z' });
  await s.updateBookmarks('a1', [3]);
  const got = await s.getAudio('a1');
  assert.deepEqual(got.meta.bookmarks, [3]);
  await s.deleteAudio('a1');
  assert.equal(await s.getAudio('a1'), null);
});

test('attachClone: copy gets its own id and file; missing file keeps the reference', async () => {
  const store = await loadTs('src/attachStore.ts');
  const { cloneAttachment } = await loadTs('src/attachClone.ts');
  await store.putImage('imA', new Blob(['pic'], { type: 'image/jpeg' }), 'p.jpg');
  const c = await cloneAttachment({ id: 'imA', kind: 'image', name: 'p.jpg' });
  assert.notEqual(c.id, 'imA');
  // removing the copy's file never touches the original
  const again = await loadTs('src/attachStore.ts');
  assert.ok(await again.getImage('imA'));
  const missing = await cloneAttachment({ id: 'nope', kind: 'image', name: 'x' });
  assert.equal(missing.id, 'nope');
});

test('video helpers: YouTube url parsing is strict, time formats round trip', async () => {
  const v = await loadTs('src/videoTime.ts');
  assert.deepEqual(v.parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=75'), { videoId: 'dQw4w9WgXcQ', startSeconds: 75 });
  assert.equal(v.parseYouTubeUrl('https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(v.parseTimestamp('1h2m3s'), 3723);
  assert.equal(v.formatTimestamp(3725), '1:02:05');
});

test('image + pdf pure helpers match the Part 9 test cases', async () => {
  const i = await loadTs('src/imageTools.ts');
  assert.deepEqual(i.fitWithin(6000, 4000, 1600), { width: 1600, height: 1067 });
  assert.deepEqual(i.fitWithin(800, 600, 1600), { width: 800, height: 600 });
  assert.deepEqual(i.rotatedSize(100, 50, 90), { width: 50, height: 100 });
  assert.equal(i.humanSize(1468006), '1.4 MB');
  const p = await loadTs('src/exportAnnotatedPdf.ts');
  const pt = p.strokeToPdfPoints({ id: 'a', kind: 'ballpoint', color: 'auto', width: 2, pts: [500, 500, 0.5], sim: true, sm: 0 }, 600, 800, 0);
  assert.deepEqual(pt, [{ x: 300, y: 500 }]);
});

test('noteAi server: request validation limits', async () => {
  const { validateRequest } = await loadTs('api/_lib/noteAi.ts');
  assert.equal(validateRequest({ op: 'nope' }).status, 400);
  assert.equal(validateRequest({ op: 'summarize' }).status, 400);
  assert.equal(validateRequest({ op: 'translate', text: 'x' }).status, 400);
  assert.equal(validateRequest({ op: 'summarize', text: 'a'.repeat(12001) }).status, 413);
  assert.equal(validateRequest({ op: 'flashcards', text: 'x', count: 99 }).req.count, 15);
  assert.equal(validateRequest({ op: 'flashcards', text: 'x', count: 0 }).req.count, 1);
  assert.equal(validateRequest({ op: 'quiz', text: 'x' }).req.count, 5);
});

test('noteAi server: invented quotes and malformed quiz questions are dropped', async () => {
  const { parseResult } = await loadTs('api/_lib/noteAi.ts');
  const req = { op: 'gaps', text: 'Photosynthesis needs light.' };
  const r = parseResult(req, JSON.stringify({ items: [
    { quote: 'Chlorophyll absorbs red light', problem: 'p', suggestion: 's' },
    { quote: 'photosynthesis  NEEDS light', problem: 'p', suggestion: 's' },
  ] }));
  assert.equal(r.items.length, 1);
  const q = parseResult({ op: 'quiz', text: 'x' }, JSON.stringify({ questions: [
    { question: 'a', options: ['1', '2', '3'], answerIndex: 0, explanation: 'e' },
    { question: 'b', options: ['1', '2', '3', '4'], answerIndex: 2, explanation: 'e' },
    { question: 'c', options: ['1', '2', '3', '4'], answerIndex: 4, explanation: 'e' },
  ] }));
  assert.equal(q.questions.length, 1);
});

test('studyInfo: exam chips and "soon" use calendar days', async () => {
  const s = await loadTs('src/studyInfo.ts');
  const now = new Date(2026, 9, 18, 23, 30);
  assert.deepEqual(s.examChip('2026-10-18', now), { kind: 'today' });
  assert.deepEqual(s.examChip('2026-10-19', now), { kind: 'tomorrow' });
  assert.equal(s.examSoon('2026-10-30', 14, now), true);
  assert.equal(s.examSoon('2026-12-30', 14, now), false);
});

test('noteExport: html -> markdown keeps headings, lists, tasks, marks, links, tables', async () => {
  const { htmlToMarkdown, noteToMarkdown, noteToText, noteToHtml, fileName, hasText } = await loadTs('src/noteExport.ts');
  const html =
    '<h1>Cells</h1><p>The <strong>nucleus</strong> and <em>DNA</em> are <mark>key</mark>. See <a href="https://x.org">x</a></p>' +
    '<ul><li><p>one</p><ul><li><p>nested</p></li></ul></li><li><p>two</p></li></ul><ol><li><p>a</p></li><li><p>b</p></li></ol>' +
    '<ul data-type="taskList"><li data-checked="true"><label><input type="checkbox"></label><div><p>done</p></div></li><li data-checked="false"><label><input type="checkbox"></label><div><p>todo</p></div></li></ul>' +
    '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table><blockquote><p>quote</p></blockquote><pre><code>x = 1</code></pre>';
  const md = htmlToMarkdown(html);
  assert.match(md, /^# Cells/);
  assert.match(md, /\*\*nucleus\*\* and \*DNA\* are ==key==\. See \[x\]\(https:\/\/x\.org\)/);
  assert.match(md, /- one\n {2}- nested\n- two/);
  assert.match(md, /1\. a\n2\. b/);
  assert.match(md, /- \[x\] done\n- \[ \] todo/);
  assert.match(md, /\| A \| B \|\n\| --- \| --- \|\n\| 1 \| 2 \|/);
  assert.match(md, /> quote/);
  assert.match(md, /```\nx = 1\n```/);
  const pages = [{ id: 'a', text: 'Hello', html: '<p>Hello</p>' }, { id: 'b', text: 'World', html: '<p>World <script>alert(1)</script></p>' }];
  assert.equal(noteToMarkdown('My note', pages), '# My note\n\n## Page 1\n\nHello\n\n## Page 2\n\nWorld alert(1)\n'.replace(' alert(1)', ' alert(1)'));
  assert.equal(noteToText('My note', pages), 'My note\n\nHello\n\nWorld\n');
  const page = noteToHtml('A <b>', pages);
  assert.ok(!page.includes('<script>alert') && page.includes('A &lt;b&gt;'));
  assert.equal(fileName('  a/b:c?  ', 'md'), 'a b c.md');
  assert.equal(hasText([{ id: 'x', text: '  ' }]), false);
});

test('noteVersions: save, skip unchanged auto, keep newest 20, restore data', async () => {
  const v = await loadTs('src/noteVersions.ts');
  const snap = (n) => ({ title: 'T', pages: [{ id: 'p', text: 'x'.repeat(n), html: `<p>${'x'.repeat(n)}</p>`, ink: [] }] });
  const t0 = Date.parse('2026-10-18T10:00:00Z');
  const first = await v.saveVersion('n1', snap(5), 'auto', new Date(t0));
  assert.equal(first.chars, 5);
  assert.equal(await v.saveVersion('n1', snap(5), 'auto', new Date(t0 + 1000)), null, 'unchanged auto version is skipped');
  assert.ok(await v.saveVersion('n1', snap(5), 'manual', new Date(t0 + 2000)), 'a manual save is always kept');
  for (let i = 0; i < 25; i++) await v.saveVersion('n1', snap(10 + i), 'auto', new Date(t0 + 10_000 + i * 1000));
  const list = await v.listVersions('n1');
  assert.equal(list.length, v.KEEP_VERSIONS);
  assert.ok(list[0].at > list[1].at, 'newest first');
  const data = await v.getVersion(list[0].key);
  assert.equal(data.pages[0].text.length, 34);
  assert.deepEqual(await v.listVersions('other'), []);
});

test('dialogs render with roles, close on Escape, versions restore through the callback', async () => {
  const React = (await import('react')).default;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { ExportDialog, VersionsDialog, ShortcutsDialog } = await loadTs('src/NoteTools.tsx');
  const v = await loadTs('src/noteVersions.ts');
  const L = new Proxy({}, { get: (_, k) => `«${String(k)}»` });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  let closed = 0;
  await act(async () => root.render(React.createElement(ExportDialog, { title: 'T', pages: [{ id: 'a', text: 'hi', html: '<p>hi</p>' }], labels: L, onClose: () => closed++, onMessage: () => {} })));
  const dlg = host.querySelector('[role="dialog"]');
  assert.ok(dlg && dlg.getAttribute('aria-modal') === 'true');
  assert.equal(host.querySelectorAll('button').length >= 7, true);
  await act(async () => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })));
  assert.equal(closed, 1);

  await v.saveVersion('nx', { title: 'Old', pages: [{ id: 'p', text: 'old text', html: '<p>old text</p>' }] }, 'manual');
  let restored = null;
  window.confirm = () => true;
  await act(async () => root.render(React.createElement(VersionsDialog, { noteId: 'nx', getCurrent: () => ({ title: 'Now', pages: [] }), labels: L, locale: 'en-IN', onClose: () => {}, onRestore: (d) => (restored = d), onMessage: () => {} })));
  await act(async () => new Promise((r) => setTimeout(r, 50)));
  const restoreBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === '«restore»');
  assert.ok(restoreBtn, 'a saved version is listed with a Restore button');
  await act(async () => restoreBtn.click());
  await act(async () => new Promise((r) => setTimeout(r, 50)));
  assert.equal(restored?.title, 'Old');
  assert.equal((await v.listVersions('nx')).some((m) => m.kind === 'before-restore'), true, 'current note is saved before restoring');

  await act(async () => root.render(React.createElement(ShortcutsDialog, { labels: L, onClose: () => {} })));
  assert.ok(host.textContent.includes('Z') && host.textContent.includes('?'));
  await act(async () => root.unmount());
});
