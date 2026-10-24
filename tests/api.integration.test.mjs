// Integration tests: real Vercel handlers + real auth + real Gemini→MiniMax fallback.
// Only the network (Firebase lookup, Gemini, MiniMax, Upstash) is faked.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

process.env.VITE_GEMINI_API_KEY = 'gem-key-1';
process.env.GEMINI_API_KEY_2 = 'gem-key-2';
process.env.GEMINI_API_KEY_3 = 'gem-key-3';
process.env.MINIMAX_API_KEY = 'mm-key';
process.env.GUEST_RATE_LIMIT = '3';
process.env.GUEST_IP_LIMIT = '1000';
console.log = () => {}; console.warn = () => {}; console.error = () => {}; // silence handler logs

const jwt = (provider) =>
  'h.' + Buffer.from(JSON.stringify({ firebase: { sign_in_provider: provider } })).toString('base64url') + '.s';
const USER = (n = 1) => jwt('password') + n;
const GUEST = (n = 1) => jwt('anonymous') + n;

// ---- fake network ----
let calls, plan;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const gemOk = (text) => json(200, { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });
beforeEach(() => {
  calls = [];
  plan = { firebase: (init) => json(200, { users: [{ localId: 'uid-' + JSON.parse(init.body).idToken.slice(-12) }] }), gemini: () => gemOk('hello'), minimax: () => json(200, { choices: [{ message: { content: 'mm-reply' } }] }) };
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const rec = { url: u, body: init.body ? safe(init.body) : null, headers: init.headers };
    calls.push(rec);
    if (u.includes('identitytoolkit')) return plan.firebase(init);
    if (u.includes('generativelanguage')) return plan.gemini(u, rec);
    if (u.includes('minimax')) return plan.minimax(rec);
    if (u.includes('upstash')) return plan.upstash ? plan.upstash(rec) : json(500, {});
    throw new Error('Unexpected network call: ' + u);
  };
});
const safe = (b) => { try { return JSON.parse(b); } catch { return b; } };
const gemCalls = () => calls.filter((c) => c.url.includes('generativelanguage'));
const mmCalls = () => calls.filter((c) => c.url.includes('minimax'));

// ---- fake req/res ----
function call(handler, { method = 'POST', token, body, ip = '1.1.1.1' } = {}) {
  const req = { method, body, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), 'x-forwarded-for': ip }, socket: {} };
  let status = 200, payload;
  const res = { status(s) { status = s; return res; }, json(p) { payload = p; return res; }, setHeader() { return res; } };
  return handler(req, res).then(() => ({ status, payload }));
}

const mentor = (await loadTs('api/mentor-chat.ts')).default;
const expand = (await loadTs('api/expand-query.ts')).default;
const BLUEPRINT = { role: 'student', goal: 'exam', language: 'english', hours: 5, style: { pace: 5, practical: 5, depth: 5, structure: 5, storytelling: 5, languageComplexity: 5 } };

// ================= AUTH =================
test('auth: no token → 401, no upstream AI call', async () => {
  const r = await call(mentor, { body: { userMessage: 'hi' } });
  assert.equal(r.status, 401);
  assert.equal(gemCalls().length, 0);
});

test('auth: Firebase rejects token → 401', async () => {
  plan.firebase = () => json(400, {});
  const r = await call(mentor, { token: USER(10), body: { userMessage: 'hi' } });
  assert.equal(r.status, 401);
  assert.equal(gemCalls().length, 0);
});

test('auth: Firebase down (network error) → 401, not a crash', async () => {
  plan.firebase = () => { throw new Error('offline'); };
  const r = await call(mentor, { token: USER(11), body: { userMessage: 'hi' } });
  assert.equal(r.status, 401);
});

test('auth: guest on login-only endpoint → 403 account-required', async () => {
  const r = await call(mentor, { token: GUEST(1), body: { userMessage: 'hi' } });
  assert.equal(r.status, 403);
  assert.equal(r.payload.code, 'account-required');
  assert.equal(gemCalls().length, 0);
});

test('auth: guest allowed on expand-query (allowAnonymous)', async () => {
  plan.gemini = () => gemOk('{"queries":["a","b"],"searchHint":"h"}');
  const r = await call(expand, { token: GUEST(2), body: { userInput: 'physics', blueprint: BLUEPRINT } });
  assert.equal(r.status, 200);
});

test('auth: guest rate limit → 429 account-required after GUEST_RATE_LIMIT', async () => {
  plan.gemini = () => gemOk('{"queries":["a"],"searchHint":""}');
  const t = GUEST(3);
  const out = [];
  for (let i = 0; i < 5; i++) out.push((await call(expand, { token: t, body: { userInput: 'x', blueprint: BLUEPRINT } })).status);
  assert.deepEqual(out, [200, 200, 200, 429, 429]);
});

test('auth: token verified once, then cached (1 Firebase lookup for 3 calls)', async () => {
  const t = USER(12);
  for (let i = 0; i < 3; i++) await call(mentor, { token: t, body: { userMessage: 'hi' } });
  assert.equal(calls.filter((c) => c.url.includes('identitytoolkit')).length, 1);
});

test('auth: account holder rate-limited at 150 per window', async () => {
  const t = USER(13);
  let last;
  for (let i = 0; i < 151; i++) last = await call(mentor, { token: t, body: { userMessage: '' } }); // 400s still count
  assert.equal(last.status, 429);
});

// ================= MENTOR HANDLER =================
test('mentor: 405 on GET', async () => {
  const r = await call(mentor, { method: 'GET', token: USER(20) });
  assert.equal(r.status, 405);
});

test('mentor: empty / whitespace message → 400', async () => {
  for (const userMessage of ['', '   ', undefined]) {
    const r = await call(mentor, { token: USER(21), body: { userMessage } });
    assert.equal(r.status, 400);
  }
});

test('mentor: happy path returns Gemini text and sends key, locale and history', async () => {
  plan.gemini = () => gemOk('Namaste!');
  const r = await call(mentor, {
    token: USER(22),
    body: { userMessage: 'Explain gravity', locale: 'hi', context: 'Newton video', history: [{ role: 'user', content: 'prev q' }, { role: 'mentor', content: 'prev a' }] },
  });
  assert.equal(r.status, 200);
  assert.equal(r.payload.text, 'Namaste!');
  const g = gemCalls()[0];
  assert.match(g.url, /key=gem-key-1/);
  assert.match(g.body.system_instruction.parts[0].text, /Hindi \(Devanagari/);
  assert.match(g.body.system_instruction.parts[0].text, /Newton video/);
  assert.equal(g.body.generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.deepEqual(g.body.contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.equal(g.body.contents.at(-1).parts[0].text, 'Explain gravity');
});

test('mentor: unknown locale falls back to Hinglish', async () => {
  await call(mentor, { token: USER(23), body: { userMessage: 'hi', locale: 'fr' } });
  assert.match(gemCalls()[0].body.system_instruction.parts[0].text, /Hinglish/);
});

test('mentor: ui:true switches to the OpenUI prompt', async () => {
  await call(mentor, { token: USER(24), body: { userMessage: 'quiz me', ui: true } });
  const sys = gemCalls()[0].body.system_instruction.parts[0].text;
  assert.doesNotMatch(sys, /Maximum 120 words/);
});

test('mentor: very long context is truncated to 120 chars in the prompt', async () => {
  await call(mentor, { token: USER(25), body: { userMessage: 'hi', context: 'A'.repeat(500) } });
  const sys = gemCalls()[0].body.system_instruction.parts[0].text;
  assert.ok(!sys.includes('A'.repeat(121)));
  assert.ok(sys.includes('A'.repeat(120)));
});

// ================= FALLBACK CHAIN =================
test('fallback: first Gemini key 429 → second key answers, MiniMax untouched', async () => {
  let n = 0;
  plan.gemini = () => (n++ === 0 ? json(429, {}) : gemOk('from key 2'));
  const r = await call(mentor, { token: USER(30), body: { userMessage: 'hi' } });
  assert.equal(r.payload.text, 'from key 2');
  assert.equal(mmCalls().length, 0);
  assert.match(gemCalls()[1].url, /key=gem-key-2/);
});

test('fallback: all Gemini keys 503 → MiniMax answers', async () => {
  plan.gemini = () => json(503, {});
  const r = await call(mentor, { token: USER(31), body: { userMessage: 'hi' } });
  assert.equal(r.status, 200);
  assert.equal(r.payload.text, 'mm-reply');
  assert.equal(mmCalls().length, 1);
  assert.equal(mmCalls()[0].headers.Authorization, 'Bearer mm-key');
  assert.equal(r.payload.finishReason, null);
});

test('fallback: Gemini empty body counts as failure → MiniMax', async () => {
  plan.gemini = () => gemOk('   ');
  const r = await call(mentor, { token: USER(32), body: { userMessage: 'hi' } });
  assert.equal(r.payload.text, 'mm-reply');
});

test('fallback: Gemini network error → MiniMax', async () => {
  plan.gemini = () => { throw new Error('ECONNRESET'); };
  const r = await call(mentor, { token: USER(33), body: { userMessage: 'hi' } });
  assert.equal(r.payload.text, 'mm-reply');
});

test('fallback: both providers down → 500 with friendly message (no stack leak)', async () => {
  plan.gemini = () => json(500, {});
  plan.minimax = () => json(402, {});
  const r = await call(mentor, { token: USER(34), body: { userMessage: 'hi' } });
  assert.equal(r.status, 500);
  assert.match(r.payload.error, /Something went wrong/);
  assert.doesNotMatch(JSON.stringify(r.payload), /402|stack/);
});

test('fallback: MiniMax request is OpenAI-shaped (system + assistant roles mapped)', async () => {
  plan.gemini = () => json(500, {});
  await call(mentor, { token: USER(35), body: { userMessage: 'now', history: [{ role: 'user', content: 'q' }, { role: 'mentor', content: 'a' }] } });
  const m = mmCalls()[0].body.messages;
  assert.equal(m[0].role, 'system');
  assert.ok(m.some((x) => x.role === 'assistant' && x.content === 'a'));
  assert.equal(m.at(-1).content, 'now');
});

// ================= EXPAND-QUERY =================
test('expand-query: validation (400 on missing input / blueprint)', async () => {
  assert.equal((await call(expand, { token: USER(40), body: { blueprint: BLUEPRINT } })).status, 400);
  assert.equal((await call(expand, { token: USER(40), body: { userInput: 'x' } })).status, 400);
});

test('expand-query: strips ```json fences and caps at 5 queries', async () => {
  plan.gemini = () => gemOk('```json\n{"queries":["1","2","3","4","5","6","7"],"searchHint":"h"}\n```');
  const r = await call(expand, { token: USER(41), body: { userInput: 'x', blueprint: BLUEPRINT } });
  assert.equal(r.status, 200);
  assert.equal(r.payload.queries.length, 5);
});

test('expand-query: non-JSON model output → 502 (not 500/crash)', async () => {
  plan.gemini = () => gemOk('sorry I cannot');
  const r = await call(expand, { token: USER(42), body: { userInput: 'x', blueprint: BLUEPRINT } });
  assert.equal(r.status, 502);
});

test('expand-query: empty queries array → 502', async () => {
  plan.gemini = () => gemOk('{"queries":[]}');
  const r = await call(expand, { token: USER(43), body: { userInput: 'x', blueprint: BLUEPRINT } });
  assert.equal(r.status, 502);
});

test('expand-query: uses the dedicated "research" key (key 3) first', async () => {
  plan.gemini = () => gemOk('{"queries":["a"]}');
  await call(expand, { token: USER(44), body: { userInput: 'x', blueprint: BLUEPRINT } });
  assert.match(gemCalls()[0].url, /key=gem-key-3/);
});

test('expand-query: Hindi blueprint adds Hindi hint to prompt', async () => {
  plan.gemini = () => gemOk('{"queries":["a"]}');
  await call(expand, { token: USER(45), body: { userInput: 'x', blueprint: { ...BLUEPRINT, language: 'hindi' } } });
  assert.match(JSON.stringify(gemCalls()[0].body.contents), /hindi mein samjhaye/);
});

// ================= SHARED DAILY BUDGET (Upstash) =================
test('budget: Upstash over guest daily cap → 429; Upstash down → fails OPEN', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://x.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
  process.env.GUEST_DAILY_LIMIT = '10';
  const exp2 = (await loadTs('api/expand-query.ts')).default; // fresh module reads new env
  plan.gemini = () => gemOk('{"queries":["a"]}');

  plan.upstash = () => json(200, [{ result: 11 }, { result: 1 }, { result: 1 }, { result: 1 }]);
  let r = await call(exp2, { token: GUEST(50), body: { userInput: 'x', blueprint: BLUEPRINT } });
  assert.equal(r.status, 429);
  assert.equal(r.payload.code, 'account-required');

  plan.upstash = () => json(200, [{ result: 1 }, { result: 1 }, { result: 1 }, { result: 1 }]);
  r = await call(exp2, { token: GUEST(51), body: { userInput: 'x', blueprint: BLUEPRINT } });
  assert.equal(r.status, 200);

  plan.upstash = () => { throw new Error('redis down'); };
  r = await call(exp2, { token: GUEST(52), body: { userInput: 'x', blueprint: BLUEPRINT } });
  assert.equal(r.status, 200, 'must fail open so students are never locked out');
});

// ================= HISTORY NORMALISATION (client → Gemini contract) =================
test('history: welcome message dropped, duplicate trailing user msg dropped, roles alternate', async () => {
  await call(mentor, {
    token: USER(60),
    body: { userMessage: 'same q', history: [{ role: 'mentor', content: 'Welcome!' }, { role: 'user', content: 'a' }, { role: 'mentor', content: 'b' }, { role: 'user', content: 'same q' }] },
  });
  const c = gemCalls()[0].body.contents;
  assert.equal(c[0].role, 'user');
  assert.deepEqual(c.map((x) => x.role), ['user', 'model', 'user']);
  assert.ok(!JSON.stringify(c).includes('Welcome!'));
});

test('history: only last 6 turns are sent', async () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'mentor' : 'user', content: 'm' + i }));
  await call(mentor, { token: USER(61), body: { userMessage: 'now', history } });
  assert.ok(!JSON.stringify(gemCalls()[0].body.contents).includes('m3"'));
});

test('history: garbage entries (null, wrong types) do not crash the handler', async () => {
  const r = await call(mentor, { token: USER(62), body: { userMessage: 'hi', history: [null, { role: 'user' }, { role: 'user', content: 5 }, 'x'] } });
  assert.equal(r.status, 200);
});

test('mentor: studentContext of wrong type is ignored, not fatal', async () => {
  for (const studentContext of ['str', 42, [], { nested: { a: 1 } }]) {
    const r = await call(mentor, { token: USER(63), body: { userMessage: 'hi', studentContext } });
    assert.equal(r.status, 200);
  }
});
