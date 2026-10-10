// src/apiFetch.ts
// fetch() wrapper for our /api/* endpoints — attaches the Firebase ID token
// so the server can verify who is calling (endpoints reject anonymous calls).
//
// GUESTS: a visitor who has not signed up holds a Firebase *anonymous* session.
// Login-only endpoints answer such callers with 403 `code: 'account-required'`;
// we turn that into a window event so the sign-in prompt (AuthPrompt.tsx) opens
// no matter which screen made the call — one place instead of a check per feature.

import { auth } from './firebase';

export const ACCOUNT_REQUIRED_EVENT = 'learning-os:account-required';

/** True when this ID token's sign-in provider claim says "anonymous". */
function tokenIsAnonymous(token: string): boolean {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part))?.firebase?.sign_in_provider === 'anonymous';
  } catch {
    return false;
  }
}

/** Fresh-enough ID token for the current session (null when signed out). */
export async function getFreshIdToken(): Promise<string | null> {
  await auth.authStateReady(); // wait until Firebase has restored the session
  const user = auth.currentUser;
  if (!user) return null;
  let token = await user.getIdToken();
  // Right after a guest upgrades to a real account, the cached token still says
  // "anonymous" until it refreshes — force a refresh so the server sees the account.
  if (!user.isAnonymous && tokenIsAnonymous(token)) token = await user.getIdToken(true);
  return token;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await getFreshIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });

  if (response.status === 403 || response.status === 429) {
    try {
      const body = await response.clone().json();
      if (body?.code === 'account-required') {
        window.dispatchEvent(new CustomEvent(ACCOUNT_REQUIRED_EVENT, { detail: { message: body.error } }));
      }
    } catch {
      // Not JSON — nothing to signal.
    }
  }
  return response;
}
