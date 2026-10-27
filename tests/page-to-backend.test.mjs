// Page -> backend connection test, over a REAL HTTP socket.
//
// What is real:  the built page (dist/), vercel.json's rewrite rule, every api/*.ts handler, the auth gate,
//                JSON parsing, status codes, the request the page sends (Authorization: Bearer <id token>).
// What is faked: only the outside world the handlers call (Firebase token lookup, Gemini).
// What it cannot prove: that Vercel's env vars are set, or that the deployed site is up. Check the live site by hand:
//   open <your-site>/api/mentor-chat in a browser -> {"error":"POST only"} (405) means the function is deployed and running;
//   a 404 / HTML page means routing is broken; FUNCTION_INVOCATION_FAILED means it crashes (usually a missing env var).
//
// Needs `npm run build` first; skipped (not failed) when dist/ is missing.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { loadTs } from './helpers.mjs';

process.env.VITE_GEMINI_API_KEY = 'gem-key';
process.env.MINIMAX_API_KEY = 'mm-key';
process.env.YOUTUBE_API_KEY = 'yt-key';
console.log = console.warn = console.error = () => {};

const DIST = join(process.cwd(), 'dist');
const hasDist = existsSync(join(DIST, 'index.html'));
const skip = hasDist ? false : 'dist/ missing — run `npm run build` first';

// ---- the outside world (only calls that leave localhost are faked) ----
const realFetch = globalThis.fetch;
let outbound = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith('http://127.0.0.1')) return realFetch(url, init);
  outbound.push(u);
  if (u.includes('identitytoolkit')) return new Response(JSON.stringify({ users: [{ localId: 'uid-' + JSON.parse(init.body).idToken.slice(-8) }] }), { status: 200 });
  if (u.includes('generativelanguage')) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hello from the backend' }] }, finishReason: 'STOP' }] }), { status: 200 });
  return new Response('{}', { status: 500 });
};
const idToken = (provider, n) => 'h.' + Buffer.from(JSON.stringify({ firebase: { sign_in_provider: provider } })).toString('base64url') + '.s' + n;

// ---- a tiny Vercel: vercel.json rewrite + /api/<name> -> handler ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const apiFiles = readdirSync('api').filter((f) => f.endsWith('.ts'));
const handlers = {};
let server, base;

before(async () => {
  if (!hasDist) return;
  for (const f of apiFiles) handlers[f.replace(/\.ts$/, '')] = (await loadTs('api/' + f)).default;
  server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); return res; };
    res.send = (b) => res.end(typeof b === 'string' || Buffer.isBuffer(b) ? b : JSON.stringify(b));
    if (url.pathname.startsWith('/api/')) {
      const h = handlers[url.pathname.slice(5)];
      if (!h) return res.status(404).json({ error: 'no such function' }); // Vercel: 404, never index.html
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString();
      try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = raw; }
      req.query = Object.fromEntries(url.searchParams);
      try { await h(req, res); } catch (e) { if (!res.writableEnded) res.status(500).json({ error: 'FUNCTION_INVOCATION_FAILED' }); }
      if (!res.writableEnded) res.end();
      return;
    }
    const file = join(DIST, url.pathname);
    const exact = url.pathname !== '/' && existsSync(file) && !file.endsWith('/');
    const path = exact ? file : join(DIST, 'index.html'); // "/((?!api/).*)" -> /index.html
    res.setHeader('content-type', MIME[extname(path)] ?? 'application/octet-stream');
    res.end(readFileSync(path));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

const post = (path, { token, body } = {}) =>
  realFetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body ?? {}) });

// ================= the page =================
test('page: / serves index.html and every script/style it references exists', { skip }, async () => {
  const html = await (await realFetch(base + '/')).text();
  assert.match(html, /<div id="root"/);
  const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 2, 'index.html should reference built assets');
  for (const r of refs) assert.equal((await realFetch(base + r)).status, 200, r);
});

test('page: deep links (/notes, /live/abc) fall back to index.html so the SPA can route', { skip }, async () => {
  for (const p of ['/notes', '/live/abc123']) {
    const r = await realFetch(base + p);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /<div id="root"/);
  }
});

test('page: an unknown /api/ route is a JSON 404, not the HTML shell', { skip }, async () => {
  const r = await post('/api/does-not-exist');
  assert.equal(r.status, 404);
  assert.match(r.headers.get('content-type'), /json/);
});

// ================= page -> backend =================
test('connection: every /api/* path the page calls has a handler behind it', { skip }, () => {
  const src = readdirSync('src').filter((f) => /\.tsx?$/.test(f)).map((f) => readFileSync(join('src', f), 'utf8')).join('\n');
  const called = new Set([...src.matchAll(/['"`]\/api\/([a-z0-9-]+)/g)].map((m) => m[1]));
  assert.ok(called.size >= 10);
  for (const name of called) assert.ok(handlers[name], `page calls /api/${name} but api/${name}.ts does not exist`);
  for (const name of Object.keys(handlers)) assert.ok(called.has(name), `api/${name}.ts is never called by the page`);
});

test('connection: with no sign-in every endpoint answers 401 JSON and calls nothing upstream', { skip }, async () => {
  for (const name of Object.keys(handlers)) {
    outbound = [];
    const r = await post('/api/' + name);
    if (r.status === 405) continue; // GET-only endpoints (method check comes first)
    assert.equal(r.status, 401, name);
    assert.match(r.headers.get('content-type') ?? '', /json/, name);
    assert.equal(outbound.length, 0, name + ' reached upstream without auth');
  }
});

test('connection: signed-in request goes page -> API -> Gemini -> back as JSON', { skip }, async () => {
  outbound = [];
  const r = await post('/api/mentor-chat', { token: idToken('password', 1), body: { userMessage: 'hi' } });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(JSON.stringify(j).includes('hello from the backend'));
  assert.ok(outbound.some((u) => u.includes('identitytoolkit')), 'token should be verified with Firebase');
  assert.ok(outbound.some((u) => u.includes('generativelanguage')), 'Gemini should be called server-side');
});

test('connection: guest session is told to sign up (403 account-required) on a login-only endpoint', { skip }, async () => {
  const r = await post('/api/mentor-chat', { token: idToken('anonymous', 2), body: { userMessage: 'hi' } });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).code, 'account-required');
});

test('connection: no secret key ever reaches the browser (built JS + HTML)', { skip }, () => {
  const files = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(DIST, 'assets', f), 'utf8'));
  files.push(readFileSync(join(DIST, 'index.html'), 'utf8'));
  // The Firebase *web* key in src/firebase.ts is public by design (it identifies the project; Firestore rules
  // protect the data), so that one key is allowed. Any OTHER Google key (Gemini / YouTube) would be a leak.
  const publicKey = /apiKey:\s*["'](AIza[\w-]{35})["']/.exec(readFileSync('src/firebase.ts', 'utf8'))?.[1];
  for (const text of files) {
    for (const bad of ['gem-key', 'mm-key', 'yt-key', 'generativelanguage.googleapis.com/v1beta/models']) {
      assert.ok(!text.includes(bad), `built bundle contains "${bad}"`);
    }
    for (const key of text.match(/AIza[\w-]{35}/g) ?? []) assert.equal(key, publicKey, 'an unexpected Google API key is inside the browser bundle');
  }
});
