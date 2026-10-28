import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

test('backup import preserves all current pen types and clamps malformed imported values', async () => {
  const { parseBackup } = await loadTs('src/backup.ts');
  const kinds = ['ballpoint', 'fountain', 'felt', 'pencil', 'brush', 'calligraphy', 'fineliner', 'marker', 'dotted', 'highlighter', 'calligraphyBrush', 'airbrush', 'oil', 'crayon', 'natural', 'watercolor'];
  const payload = {
    app: 'learning-os-note', version: 1, title: 'Test',
    pages: [{
      id: 'p1', text: '', ink: kinds.map((kind, i) => ({ id: 's' + i, kind, color: 'auto', width: 2, pts: [1, 2, 0.5], sm: 5 })),
      attachments: [{ id: 'im1', kind: 'image', name: 'x.png', x: -50, y: 9000, w: 9000, ar: 99 }],
      pdf: { fileId: 'pdf1', pageNumber: 1, name: 'x.pdf' }
    }],
    video: { videoId: 'dQw4w9WgXcQ', moments: [
      { id: 'ok', seconds: 20, kind: 'important' },
      { id: 'bad', seconds: 1000001, kind: 'important' }
    ]},
    examDate: '2026-02-31'
  };
  const parsed = parseBackup(JSON.stringify(payload));
  assert.equal(parsed.ok, true);
  const note = parsed.notes[0];
  assert.deepEqual(note.pages[0].ink.map(s => s.kind), kinds);
  assert.ok(note.pages[0].ink.every(s => s.sm === 1));
  assert.deepEqual(
    [note.pages[0].attachments[0].x, note.pages[0].attachments[0].y, note.pages[0].attachments[0].w, note.pages[0].attachments[0].ar],
    [0, 1414, 1000, 10]
  );
  assert.deepEqual(note.video.moments.map(m => m.id), ['ok']);
  assert.equal(note.examDate, undefined);
});

test('backup import generates a unique ID even when the ID generator repeats', async () => {
  const { planImport } = await loadTs('src/backup.ts');
  const incoming = [
    { id: 'existing', title: 'A', pages: [], updatedAt: '2026-01-01T00:00:00Z' },
    { id: 'existing', title: 'B', pages: [], updatedAt: '2026-01-02T00:00:00Z' }
  ];
  const plan = planImport([{ id: 'existing', updatedAt: '2026-01-01T00:00:00Z' }], incoming, () => 'existing');
  assert.equal(plan.toCreate.length, 1);
  assert.notEqual(plan.toCreate[0].id, 'existing');
});

test('Markdown export uses safe fences around code containing triple backticks', async () => {
  const { htmlToMarkdown } = await loadTs('src/noteExport.ts');
  const ticks = String.fromCharCode(96);
  const md = htmlToMarkdown('<pre><code>const fence = ' + ticks.repeat(3) + ';</code></pre>');
  assert.ok(md.startsWith(ticks.repeat(4) + String.fromCharCode(10)));
  assert.ok(md.endsWith(String.fromCharCode(10) + ticks.repeat(4)));
});

test('manual versions saved in the same millisecond do not overwrite one another', async () => {
  const v = await loadTs('src/noteVersions.ts');
  const at = new Date('2026-10-28T00:00:00.000Z');
  await v.saveVersion('same-ms-hardening', { title: 'A', pages: [{ id: 'p', text: 'A' }] }, 'manual', at);
  await v.saveVersion('same-ms-hardening', { title: 'B', pages: [{ id: 'p', text: 'B' }] }, 'manual', at);
  const versions = await v.listVersions('same-ms-hardening');
  assert.equal(versions.length, 2);
  const saved = await Promise.all(versions.map(x => v.getVersion(x.key)));
  assert.deepEqual(new Set(saved.map(x => x.title)), new Set(['A', 'B']));
});
