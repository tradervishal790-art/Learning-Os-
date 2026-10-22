// api/_lib/auth.ts
//
// Shared guard for every AI/YouTube endpoint: the caller must hold a Firebase
// ID token (`Authorization: Bearer <token>`), and is rate-limited per user.
//
// TWO KINDS OF CALLER
//   - Account holders (email / Google): allowed everywhere, RATE_LIMIT per window.
//   - Guests (Firebase *anonymous* sessions, created automatically when a
//     visitor opens the dashboard without signing up): rejected on every
//     endpoint EXCEPT the ones that opt in with `{ allowAnonymous: true }`
//     (Mind Blueprint, video analysis, video search). Guests also get a much
//     tighter budget, because anonymous sessions cost nothing to create.
//   An endpoint that does not pass the option is login-only by default, so a
//   newly added AI endpoint can never be reached by guests by accident.
//
// Token check uses the public Identity Toolkit lookup — no admin SDK needed.
// Guest vs account is read from the token's `firebase.sign_in_provider` claim;
// the signature was already verified by that lookup, so decoding the payload
// afterwards is safe.
//
// NOTE: the short-window rate limits + token cache live in serverless-instance
// memory, so they are best-effort (each warm instance counts separately).
// HARD DAILY BUDGET (optional): set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// (free Upstash Redis) and the per-guest daily limit, a global guest cap
// (GUEST_GLOBAL_DAILY_LIMIT) and an optional all-users cap (GLOBAL_DAILY_LIMIT)
// are counted in one shared place instead of per warm instance. Without those
// env vars nothing changes. If Redis is down we fail OPEN (never lock students out).

import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBgRq-CzcRNch6hN9PU6OooS5dw7gd_e2M'; // public web key (same as src/firebase.ts)

const RATE_LIMIT = 150; // requests per window per account (across all endpoints)
const RATE_WINDOW_MS = 10 * 60 * 1000;
const TOKEN_CACHE_MS = 5 * 60 * 1000;

// Guest budgets (override with env vars without a redeploy of code).
const GUEST_RATE_LIMIT = Number(process.env.GUEST_RATE_LIMIT) || 40; // per guest, per 10 min
const GUEST_DAILY_LIMIT = Number(process.env.GUEST_DAILY_LIMIT) || 150; // per guest, per 24 h
const GUEST_IP_LIMIT = Number(process.env.GUEST_IP_LIMIT) || 200; // per IP (all guests), per 10 min — generous: hostels/colleges share one IP
const DAY_MS = 24 * 60 * 60 * 1000;

// Shared (hard) daily budget — see the NOTE at the top. All optional.
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const GUEST_GLOBAL_DAILY_LIMIT = Number(process.env.GUEST_GLOBAL_DAILY_LIMIT) || 5000; // all guests together, per UTC day
const GLOBAL_DAILY_LIMIT = Number(process.env.GLOBAL_DAILY_LIMIT) || 0; // every caller together, per UTC day; 0 = off

export interface RequireUserOptions {
  /** Let guest (anonymous) sessions through. Default false = login-only. */
  allowAnonymous?: boolean;
}

const hits = new Map<string, number[]>();
const tokenCache = new Map<string, { uid: string; anonymous: boolean; exp: number }>();

/** Records a hit for `key`; returns true when that key is over `limit` within `windowMs`. */
function overLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

/**
 * Increments each key in the shared Redis counter (one round trip) and returns the new
 * counts, or null when Redis is not configured / unreachable (callers then fail open).
 */
async function sharedCounts(keys: string[], ttlSeconds: number): Promise<number[] | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN || keys.length === 0) return null;
  try {
    const commands = keys.flatMap((k) => [['INCR', k], ['EXPIRE', k, String(ttlSeconds), 'NX']]);
    const r = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(1500), // never make a student wait on the budget check
    });
    if (!r.ok) return null;
    const out = (await r.json()) as { result?: unknown }[];
    const counts = keys.map((_, i) => out?.[i * 2]?.result);
    return counts.every((n) => typeof n === 'number') ? (counts as number[]) : null;
  } catch {
    return null;
  }
}

/** True when the (already verified) ID token belongs to an anonymous/guest session. Fails closed. */
function isAnonymousToken(idToken: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    return payload?.firebase?.sign_in_provider === 'anonymous';
  } catch {
    return true; // unreadable claim -> treat as guest (can only lose access, never gain it)
  }
}

async function verifyToken(idToken: string): Promise<{ uid: string; anonymous: boolean } | null> {
  const now = Date.now();
  const cached = tokenCache.get(idToken);
  if (cached && cached.exp > now) return { uid: cached.uid, anonymous: cached.anonymous };

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

    const anonymous = isAnonymousToken(idToken);
    if (tokenCache.size > 500) tokenCache.clear(); // keep memory bounded
    tokenCache.set(idToken, { uid, anonymous, exp: now + TOKEN_CACHE_MS });
    return { uid, anonymous };
  } catch {
    return null;
  }
}

/** UTC calendar day, e.g. 2026-10-22 — the key suffix for the daily counters. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

/**
 * Returns the caller's uid, or null after already sending a 401/403/429 response.
 * Usage:  const uid = await requireUser(req, res); if (!uid) return;
 * Guest-friendly endpoint:  requireUser(req, res, { allowAnonymous: true })
 *
 * A guest hitting a login-only endpoint gets 403 with `code: 'account-required'`;
 * the client (src/apiFetch.ts) turns that into the sign-in prompt.
 */
export async function requireUser(
  req: VercelRequest,
  res: VercelResponse,
  options: RequireUserOptions = {}
): Promise<string | null> {
  const header = req.headers.authorization ?? '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!idToken) {
    res.status(401).json({ error: 'Please sign in to use this feature.' });
    return null;
  }

  const session = await verifyToken(idToken);
  if (!session) {
    res.status(401).json({ error: 'Session expired — please sign in again.' });
    return null;
  }
  const { uid, anonymous } = session;

  if (anonymous) {
    if (!options.allowAnonymous) {
      res.status(403).json({
        error: 'Please sign in or create a free account to use this feature.',
        code: 'account-required',
      });
      return null;
    }
    // The IP bucket is shared by everyone on the same hostel / college / mobile-carrier
    // network, so hitting it is usually NOT this student's fault — say so, and don't
    // push them to sign up as if they had overspent.
    if (overLimit(`guest-ip:${clientIp(req)}`, GUEST_IP_LIMIT, RATE_WINDOW_MS)) {
      res.status(429).json({
        error: 'Your network is very busy right now — please wait a few minutes and try again. (Signing in with a free account also avoids this.)',
      });
      return null;
    }
    if (
      overLimit(`guest:${uid}`, GUEST_RATE_LIMIT, RATE_WINDOW_MS) ||
      overLimit(`guest-day:${uid}`, GUEST_DAILY_LIMIT, DAY_MS)
    ) {
      res.status(429).json({
        error: 'You have used a lot of free guest requests — please sign in (free) to continue.',
        code: 'account-required',
      });
      return null;
    }
    const counts = await sharedCounts(
      [`guest-day:${today()}:${uid}`, `guest-all:${today()}`, ...(GLOBAL_DAILY_LIMIT ? [`all:${today()}`] : [])],
      DAY_MS / 1000 + 3600
    );
    if (counts) {
      if (counts[0] > GUEST_DAILY_LIMIT) {
        res.status(429).json({
          error: 'You have used a lot of free guest requests — please sign in (free) to continue.',
          code: 'account-required',
        });
        return null;
      }
      if (counts[1] > GUEST_GLOBAL_DAILY_LIMIT || (GLOBAL_DAILY_LIMIT && counts[2] > GLOBAL_DAILY_LIMIT)) {
        res.status(429).json({
          error: 'Free guest capacity is full for today. Sign in (free) to keep learning, or come back tomorrow.',
          code: 'account-required',
        });
        return null;
      }
    }
    return uid;
  }

  if (overLimit(uid, RATE_LIMIT, RATE_WINDOW_MS)) {
    res.status(429).json({ error: 'Too many requests — please wait a few minutes.' });
    return null;
  }
  if (GLOBAL_DAILY_LIMIT) {
    const counts = await sharedCounts([`all:${today()}`], DAY_MS / 1000 + 3600);
    if (counts && counts[0] > GLOBAL_DAILY_LIMIT) {
      res.status(429).json({ error: 'The AI has reached its daily limit — please try again tomorrow.' });
      return null;
    }
  }
  return uid;
}
