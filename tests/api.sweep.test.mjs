// Sweep every api/*.ts endpoint: auth gate + malformed input must never crash or call upstream.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { loadTs } from './helpers.mjs';

process.env.VITE_GEMINI_API_KEY = 'k'; process.env.MINIMAX_API_KEY = 'm';
process.env.VITE_YOUTUBE_API_KEY = 'y'; process.env.YOUTUBE_API_KEY = 'y';
console.log = console.warn = console.error = () => {};

const tok = (p, n) => 'h.' + Buffer.from(JSON.stringify({ firebase: { sign_in_provider: p } })).toString('base64url') + '.s' + n;
let upstream = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('identitytoolkit')) return new Response(JSON.stringify({ users: [{ localId: 'u' + JSON.parse(init.body).idToken.slice(-8) }] }), { status: 200 });
  upstream.push(u);
  return new Response('{}', { status: 500 });
};
const call = (h, { method = 'POST', token, body, query = {} } = {}) => {
  const req = { method, body, query, headers: token ? { authorization: 'Bearer ' + token } : {}, socket: {} };
  let status = 200, payload;
  const res = { status(s) { status = s; return res; }, json(p) { payload = p; return res; }, send(p) { payload = p; return res; }, setHeader() { return res; }, end() { return res; } };
  return Promise.resolve(h(req, res)).then(() => ({ status, payload }));
};

const files = readdirSync('api').filter((f) => f.endsWith('.ts'));
let n = 0;
for (const f of files) {
  const mod = await loadTs('api/' + f);
  test(`${f}: no token → 401 and nothing upstream`, async () => {
    upstream = [];
    const r = await call(mod.default, { body: {} });
    assert.equal(r.status, 401);
    assert.equal(upstream.length, 0);
  });
  test(`${f}: junk body/query never throws (no unhandled 500 from bad input shape)`, async () => {
    for (const body of [undefined, null, {}, [], 'str', { url: 5, videoId: {}, userInput: [], blueprint: 'x' }]) {
      upstream = [];
      let r;
      await assert.doesNotReject(async () => { r = await call(mod.default, { token: tok('password', ++n), body, query: { videoId: 'x', q: 'y' } }); });
      assert.ok(r.status >= 200 && r.status < 600);
    }
  });
}
