// Mentor visual cards (OpenUI): server-side program check, generated prompt in sync, render smoke test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const GOOD = `root = Stack([intro, kp, q, deck, steps, chart])
intro = TextBlock("Quick revision of **photosynthesis**.")
kp = KeyPoints("Key points", ["Happens in leaves.", "Makes glucose and oxygen."])
q = Quiz("Which gas do plants absorb?", ["Oxygen", "Carbon dioxide"], 1, "Plants take in CO2.")
deck = FlashcardDeck([{front: "Chlorophyll", back: "Green pigment that captures light"}, {front: "Stomata", back: "Tiny pores for gas exchange"}])
steps = StepList("How it works", ["Light is absorbed.", "Water is split.", "Sugar is made."])
chart = BarChart("Marks", ["Test 1", "Test 2", "Test 3"], [40, 55, 72], "%")`;

test('check: a valid program passes', async () => {
  const { validateProgram, looksLikeProgram } = await loadTs('api/_lib/mentorUiCheck.ts');
  assert.equal(looksLikeProgram(GOOD), true);
  assert.deepEqual(validateProgram(GOOD), { ok: true });
});

test('check: fences and chatter before root are stripped', async () => {
  const { extractProgram, validateProgram } = await loadTs('api/_lib/mentorUiCheck.ts');
  const p = extractProgram('Sure! Here you go:\n```openui\n' + GOOD + '\n```');
  assert.ok(p.startsWith('root ='));
  assert.ok(!p.includes('```'));
  assert.equal(validateProgram(p).ok, true);
});

test('check: broken programs are rejected, plain text is not a program', async () => {
  const { validateProgram, looksLikeProgram } = await loadTs('api/_lib/mentorUiCheck.ts');
  assert.equal(validateProgram('root = Stack([x])\nx = Banana("hi")').ok, false, 'unknown component');
  assert.equal(validateProgram('root = Stack([x])\nx = Quiz("q", ["a", "b"], 1)').ok, false, 'missing field');
  assert.equal(validateProgram('root = Stack([x, y])\nx = TextBlock("hi")').ok, false, 'unresolved reference');
  assert.equal(validateProgram('root = TextBlock("hi")').ok, false, 'root must be Stack');
  assert.equal(looksLikeProgram('Photosynthesis is how plants make food. The root = of it all is light.'), false);
});

test('prompt file is in sync with the library (run npm run gen:mentor-ui if this fails)', async () => {
  const { mentorLibrary } = await loadTs('src/mentorUi/library.tsx');
  const gen = await loadTs('api/_lib/mentorUiPrompt.ts');
  assert.equal(JSON.stringify(gen.MENTOR_UI_SCHEMA), JSON.stringify(mentorLibrary.toJSONSchema()));
  assert.equal(gen.MENTOR_UI_ROOT, mentorLibrary.root);
  for (const name of ['Stack', 'TextBlock', 'KeyPoints', 'StepList', 'Quiz', 'FlashcardDeck', 'BarChart']) {
    assert.ok(gen.MENTOR_UI_PROMPT.includes(name + '('), name);
  }
});

test('render: every card type shows its content', async () => {
  const { renderCards } = await loadTs('tests/fixtures/mentorCardsHarness.tsx');
  const html = renderCards(GOOD);
  for (const s of ['photosynthesis', 'Which gas do plants absorb?', 'Carbon dioxide', 'Chlorophyll', 'Key points', 'Makes glucose and oxygen.', 'How it works', 'Light is absorbed.', 'Marks', 'Test 2']) {
    assert.ok(html.includes(s), `missing: ${s}`);
  }
  assert.ok(!html.includes('Plants take in CO2'), 'quiz explanation stays hidden until an answer is picked');
});

test('render: a bad quiz index and a malformed chart do not crash', async () => {
  const { renderCards } = await loadTs('tests/fixtures/mentorCardsHarness.tsx');
  const prog = `root = Stack([q, c])
q = Quiz("Q?", ["a", "b"], 9, "because")
c = BarChart("T", ["a", "b", "c"], [1, 2], "")`;
  assert.doesNotThrow(() => renderCards(prog));
});

// ---- handler: card reply, broken card reply (one plain-text retry), plain reply, kill switch ----
async function loadHandler(replies) {
  const { build } = await import('esbuild');
  const { join, resolve } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const stubs = {
    'auth.js': `export async function requireUser() { return 'uid1'; }`,
    'aiFallback.js': `export async function generateAIText(p) { globalThis.__calls.push(p.systemInstruction); const r = globalThis.__replies.shift(); return { text: r.text, finishReason: r.finishReason ?? 'STOP' }; }`,
  };
  const stubPlugin = {
    name: 'stubs',
    setup(b) {
      b.onResolve({ filter: /_lib\/(auth|aiFallback)\.js$/ }, (a) => ({ path: a.path.split('/').pop(), namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js' }));
    },
  };
  const outfile = join(process.cwd(), 'node_modules', '.cache', 'los-test', `handler${process.pid}_${Math.random().toString(36).slice(2)}.mjs`);
  await build({ entryPoints: [resolve('api/mentor-chat.ts')], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent', plugins: [stubPlugin], external: ['@vercel/node'] });
  globalThis.__calls = [];
  globalThis.__replies = replies.slice();
  return (await import(pathToFileURL(outfile).href)).default;
}

async function callHandler(handler, body) {
  process.env.VITE_GEMINI_API_KEY = 'x';
  let status = 0;
  let json;
  const res = { status(c) { status = c; return res; }, json(j) { json = j; return res; } };
  await handler({ method: 'POST', body: { userMessage: 'quiz me', locale: 'en', ...body }, headers: {} }, res);
  return { status, json };
}

test('handler: a valid card program is returned with ui:true and the card prompt was sent', async () => {
  const h = await loadHandler([{ text: '```\n' + GOOD + '\n```' }]);
  const { status, json } = await callHandler(h, { richUi: true });
  assert.equal(status, 200);
  assert.equal(json.ui, true);
  assert.ok(json.text.startsWith('root ='));
  assert.equal(globalThis.__calls.length, 1);
  assert.ok(globalThis.__calls[0].includes('VISUAL CARDS'));
});

test('handler: a broken card program triggers exactly one plain-text retry (no cards prompt)', async () => {
  const h = await loadHandler([{ text: 'root = Stack([x])\nx = Banana("hi")' }, { text: 'Plain answer.' }]);
  const { json } = await callHandler(h, { richUi: true });
  assert.equal(json.ui, false);
  assert.equal(json.text, 'Plain answer.');
  assert.equal(globalThis.__calls.length, 2);
  assert.ok(!globalThis.__calls[1].includes('VISUAL CARDS'));
});

test('handler: plain text reply costs one call; richUi off never sends the card prompt', async () => {
  let h = await loadHandler([{ text: 'Just text.' }]);
  let r = await callHandler(h, { richUi: true });
  assert.deepEqual([r.json.ui, r.json.text, globalThis.__calls.length], [false, 'Just text.', 1]);
  h = await loadHandler([{ text: 'Just text.' }]);
  r = await callHandler(h, {});
  assert.ok(!globalThis.__calls[0].includes('VISUAL CARDS'));
});

test('handler: server kill switch MENTOR_RICH_UI_OFF=1 ignores richUi', async () => {
  process.env.MENTOR_RICH_UI_OFF = '1';
  try {
    const h = await loadHandler([{ text: 'Just text.' }]);
    await callHandler(h, { richUi: true });
    assert.ok(!globalThis.__calls[0].includes('VISUAL CARDS'));
  } finally {
    delete process.env.MENTOR_RICH_UI_OFF;
  }
});

test('handler: a cut-off card program (MAX_TOKENS) is not shown as cards', async () => {
  const h = await loadHandler([{ text: GOOD, finishReason: 'MAX_TOKENS' }, { text: 'Short plain answer.' }]);
  const { json } = await callHandler(h, { richUi: true });
  assert.equal(json.ui, false);
  assert.equal(json.text, 'Short plain answer.');
});

test('handler: a complete reply flagged MAX_TOKENS is not reported as cut off; a real cut-off still is', async () => {
  let h = await loadHandler([{ text: 'Photosynthesis makes food for plants.', finishReason: 'MAX_TOKENS' }]);
  let r = await callHandler(h, {});
  assert.equal(r.json.finishReason, 'STOP');
  h = await loadHandler([{ text: 'Photosynthesis makes food for', finishReason: 'MAX_TOKENS' }]);
  r = await callHandler(h, {});
  assert.equal(r.json.finishReason, 'MAX_TOKENS');
});

test('handler: prompt tells the AI not to push the goal; thinking is off with 2048 headroom', async () => {
  const h = await loadHandler([{ text: 'ok.' }]);
  await callHandler(h, { studentContext: { goals: [{ title: 'Learn video editing' }] } });
  const sys = globalThis.__calls[0];
  assert.ok(sys.includes('Do not mention their goals'));
  assert.ok(sys.includes('about what the student just asked'));
});

test('prompt: concept questions get text + key points + one quiz', async () => {
  const { MENTOR_UI_PROMPT } = await loadTs('api/_lib/mentorUiPrompt.ts');
  assert.ok(MENTOR_UI_PROMPT.includes('CONCEPT QUESTIONS'));
  assert.ok(MENTOR_UI_PROMPT.includes('KeyPoints'));
});

test('MentorText: _italic_ renders, snake_case words stay as they are', async () => {
  const { renderMentorText } = await loadTs('tests/fixtures/mentorTextHarness.tsx');
  const html = renderMentorText('_( cut off )_ and my_var_name stays');
  assert.ok(html.includes('<em>( cut off )</em>'), html);
  assert.ok(html.includes('my_var_name'), html);
});
