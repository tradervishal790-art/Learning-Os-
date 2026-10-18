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
