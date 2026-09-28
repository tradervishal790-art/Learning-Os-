// api/_lib/auth.ts
//
// Shared guard for every AI/YouTube endpoint: the caller must be signed in
// (Firebase ID token in `Authorization: Bearer <token>`) and is limited to
// RATE_LIMIT requests per RATE_WINDOW_MS per user.
//
// Token check uses the public Identity Toolkit lookup — no admin SDK needed.
// NOTE: rate-limit + token cache live in serverless-instance memory, so the
// limit is best-effort (each warm instance counts separately). For a hard
// global limit, move `hits` to Upstash Redis / Firestore.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBgRq-CzcRNch6hN9PU6OooS5dw7gd_e2M'; // public web key (same as src/firebase.ts)

const RATE_LIMIT = 150; // requests per window per user (across all endpoints)
const RATE_WINDOW_MS = 10 * 60 * 1000;
const TOKEN_CACHE_MS = 5 * 60 * 1000;

const hits = new Map<string, number[]>();
const tokenCache = new Map<string, { uid: string; exp: number }>();

function rateLimited(uid: string): boolean {
  const now = Date.now();
  const recent = (hits.get(uid) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(uid, recent);
    return true;
  }
  recent.push(now);
  hits.set(uid, recent);
  return false;
}

async function verifyToken(idToken: string): Promise<string | null> {
  const now = Date.now();
  const cached = tokenCache.get(idToken);
  if (cached && cached.exp > now) return cached.uid;

  try {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const uid: string | undefined = data?.users?.[0]?.localId;
    if (!uid) return null;

    if (tokenCache.size > 500) tokenCache.clear(); // keep memory bounded
    tokenCache.set(idToken, { uid, exp: now + TOKEN_CACHE_MS });
    return uid;
  } catch {
    return null;
  }
}

/**
 * Returns the caller's uid, or null after already sending a 401/429 response.
 * Usage:  const uid = await requireUser(req, res); if (!uid) return;
 */
export async function requireUser(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const header = req.headers.authorization ?? '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!idToken) {
    res.status(401).json({ error: 'Please sign in to use this feature.' });
    return null;
  }

  const uid = await verifyToken(idToken);
  if (!uid) {
    res.status(401).json({ error: 'Session expired — please sign in again.' });
    return null;
  }

  if (rateLimited(uid)) {
    res.status(429).json({ error: 'Too many requests — please wait a few minutes.' });
    return null;
  }
  return uid;
}
