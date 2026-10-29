import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

// Regression: exhausting the bounded in-memory bucket map must not reset
// a real user's active request quota.
test('auth rate limits remain active when the bucket map reaches capacity', async () => {
  const { requireUser } = await loadTs('api/_lib/auth.ts');
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes('identitytoolkit')) {
      const idToken = JSON.parse(init.body).idToken;
      return new Response(JSON.stringify({ users: [{ localId: 'uid-' + idToken.split('.').at(-1) }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error('Unexpected upstream request');
  };

  const token = (n) => 'h.' + Buffer.from(JSON.stringify({
    firebase: { sign_in_provider: 'password' },
  })).toString('base64url') + '.sig' + n;
  const request = (n) => ({
    method: 'POST',
    headers: { authorization: 'Bearer ' + token(n) },
    socket: { remoteAddress: '127.0.0.1' },
  });
  const response = () => {
    let status = 200;
    return {
      res: {
        status(next) { status = next; return this; },
        json() { return this; },
      },
      status: () => status,
    };
  };

  // Fill the map with distinct verified accounts. At capacity, a new key
  // should be denied rather than causing every existing quota to be cleared.
  for (let i = 0; i < 5000; i++) {
    const res = response();
    const uid = await requireUser(request(i), res.res);
    assert.equal(uid, 'uid-sig' + i);
  }
  const overflow = response();
  assert.equal(await requireUser(request(5000), overflow.res), null);
  assert.equal(overflow.status(), 429);

  // The original account already used one request. It may make 149 more;
  // request 151 overall must be rejected even after map saturation.
  for (let i = 0; i < 149; i++) {
    const res = response();
    assert.equal(await requireUser(request(0), res.res), 'uid-sig0');
  }
  const over = response();
  assert.equal(await requireUser(request(0), over.res), null);
  assert.equal(over.status(), 429);
});
