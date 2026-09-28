// src/apiFetch.ts
// fetch() wrapper for our /api/* endpoints — attaches the Firebase ID token
// so the server can verify who is calling (endpoints reject anonymous calls).

import { auth } from './firebase';

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  await auth.authStateReady(); // wait until Firebase has restored the session
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
