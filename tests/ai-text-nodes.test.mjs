import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

test('AI text: dash lines become one bullet list, numbers an ordered list, headings and bold are kept', async () => {
  const { aiTextToNodes } = await loadTs('src/aiTextToNodes.ts');
  const n = aiTextToNodes('Intro line\n- one\n- **two** here\n\n1. first\n2) second\n# Title');
  assert.deepEqual(n.map((x) => x.type), ['paragraph', 'bulletList', 'paragraph', 'orderedList', 'heading']);
  assert.equal(n[1].content.length, 2);
  assert.deepEqual(n[1].content[1].content[0].content[0], { type: 'text', text: 'two', marks: [{ type: 'bold' }] });
  assert.equal(n[3].content.length, 2);
  assert.equal(n[4].attrs.level, 1);
});

test('AI text: plain lines and single asterisks stay literal; empty lines stay empty paragraphs', async () => {
  const { aiTextToNodes } = await loadTs('src/aiTextToNodes.ts');
  const n = aiTextToNodes('2*3*4 = 24\n\nplain');
  assert.equal(n[0].content[0].text, '2*3*4 = 24');
  assert.deepEqual(n[1], { type: 'paragraph' });
  assert.equal(n.length, 3);
});
