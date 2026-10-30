import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

test('Ask my notes: a long note keeps the passage that answers the question, not just the first 6000 chars', async () => {
  const { pickExcerpts, questionWords } = await loadTs('src/noteExcerpts.ts');
  const filler = Array.from({ length: 400 }, (_, i) => `Line ${i} about nothing in particular here.`).join('\n');
  const text = `Title of the note\n${filler}\nMitochondria produce ATP through oxidative phosphorylation.\n${filler}`;
  assert.ok(text.length > 6000);
  const out = pickExcerpts(text, questionWords('How do mitochondria make ATP?'), 6000);
  assert.ok(out.length <= 6000);
  assert.ok(out.includes('oxidative phosphorylation'), 'the matching passage is kept');
  assert.ok(out.startsWith('Title of the note'), 'the start of the note is kept when there is room');
});

test('Ask my notes: short notes are unchanged; no match falls back to the start', async () => {
  const { pickExcerpts } = await loadTs('src/noteExcerpts.ts');
  assert.equal(pickExcerpts('short note', ['note'], 6000), 'short note');
  const long = 'abc '.repeat(5000);
  assert.equal(pickExcerpts(long, ['zzz'], 100), long.trim().slice(0, 100));
});
