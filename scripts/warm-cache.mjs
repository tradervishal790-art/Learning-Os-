#!/usr/bin/env node
// ============================================================
// scripts/warm-cache.mjs — "pre-warm" the shared video/Shorts cache.
//
// Fills Firestore `shared_topic_pools` (the same cache the app reads in
// src/sharedVideoCache.ts) with popular topics and Shorts interests BEFORE
// users ask, so the first user also gets instant results and spends no quota.
//
// How it works (no new dependencies, no service-account file):
//   1. Signs in to Firebase (anonymous by default, or WARM_EMAIL/WARM_PASSWORD).
//   2. Calls the app's own /api/youtube proxy, so filtering/ranking is IDENTICAL
//      to what a real user would get.
//   3. Writes the result to Firestore through the REST API under the exact key
//      the app uses.
//
// Safe to re-run: entries that are still fresh are skipped, and a daily quota
// budget stops the run early. Progress therefore continues over several days.
//
//   node scripts/warm-cache.mjs --dry-run     # list jobs + estimated quota, no network
//   node scripts/warm-cache.mjs --selftest    # offline checks of keys/encoding
//   node scripts/warm-cache.mjs               # real run
//
// Env (all optional): APP_URL, WARM_EMAIL, WARM_PASSWORD, WARM_BUDGET_UNITS,
//   WARM_LANGS ("any,hi"), FIREBASE_WEB_API_KEY, FIREBASE_PROJECT_ID.
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APP_URL = (process.env.APP_URL || 'https://learning-os-steel.vercel.app').replace(/\/$/, '');
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBgRq-CzcRNch6hN9PU6OooS5dw7gd_e2M'; // public web key (same as src/firebase.ts)
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'learning--os';
const BUDGET_UNITS = Number(process.env.WARM_BUDGET_UNITS || 6000); // YouTube quota this run may use (daily cap is 10,000)
const UNITS_PER_SEARCH = 101; // search.list (100) + videos.list (1)
const REFRESH_DAYS = 25; // YouTube data must not be kept stale; the app also expires at 30 days
const PAUSE_MS = 5000; // the proxy allows 150 requests / 10 min per user
const COLLECTION = 'shared_topic_pools';

const args = new Set(process.argv.slice(2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Keys: MUST match the app exactly (FocusPlayer.tsx / shortsData.ts) ----
export const normShort = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
export const normTopic = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);

export function buildJobs(cfg, langsOverride) {
  const jobs = [];
  for (const raw of cfg.interests ?? []) {
    const interest = raw.trim();
    if (!interest) continue;
    jobs.push({
      label: `shorts: ${interest}`,
      id: `search_shorts_${normShort(interest)}`,
      kind: 'shorts',
      params: { shorts: '1', maxResults: '25', q: `${interest} shorts` },
    });
  }
  const langs = langsOverride?.length ? langsOverride : cfg.langs?.length ? cfg.langs : ['any'];
  for (const lang of langs) {
    for (const raw of cfg.topics ?? []) {
      const topic = raw.trim();
      if (!topic) continue;
      const params = { maxResults: '12', q: `${topic} lecture explained` };
      if (lang !== 'any') params.relevanceLanguage = lang;
      jobs.push({
        label: `topic [${lang}]: ${topic}`,
        id: `search_focus_${lang}_${normTopic(topic)}`,
        kind: 'topic',
        params,
      });
    }
  }
  // A Firestore document id cannot contain "/" (the app skips those too).
  return jobs.filter((j) => {
    if (j.id.includes('/')) {
      console.warn(`skip (contains "/"): ${j.label}`);
      return false;
    }
    return true;
  });
}

// ---- Same item shapes the app stores ----
export function mapItems(kind, items) {
  return (items ?? [])
    .filter((it) => it?.id?.videoId)
    .map((it) =>
      kind === 'shorts'
        ? { id: it.id.videoId, title: it.snippet?.title ?? '', channel: it.snippet?.channelTitle ?? '' }
        : {
            id: it.id.videoId,
            title: it.snippet?.title ?? '',
            thumbnail: it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url ?? '',
            channel: it.snippet?.channelTitle ?? '',
            channelId: it.snippet?.channelId ?? '',
          }
    );
}

// ---- Firestore REST encoding ----
const str = (v) => ({ stringValue: String(v ?? '') });
export function encodeDoc(items, nextPageToken) {
  return {
    fields: {
      candidates: {
        arrayValue: {
          values: items.map((it) => ({
            mapValue: { fields: Object.fromEntries(Object.entries(it).map(([k, v]) => [k, str(v)])) },
          })),
        },
      },
      nextPageToken: nextPageToken ? str(nextPageToken) : { nullValue: null },
      updatedAt: str(new Date().toISOString()),
    },
  };
}

const docUrl = (id) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${encodeURIComponent(id)}`;

async function signIn() {
  const email = process.env.WARM_EMAIL;
  const password = process.env.WARM_PASSWORD;
  const endpoint = email && password ? 'accounts:signInWithPassword' : 'accounts:signUp';
  const body = email && password ? { email, password, returnSecureToken: true } : { returnSecureToken: true };
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.idToken) {
    throw new Error(
      `Firebase sign-in failed (${j?.error?.message ?? r.status}). Enable Anonymous sign-in in Firebase Console, or set WARM_EMAIL and WARM_PASSWORD.`
    );
  }
  return j.idToken;
}

async function isFresh(id, token) {
  const r = await fetch(docUrl(id), { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return false;
  if (!r.ok) return false; // unreadable -> just refresh it
  const j = await r.json().catch(() => null);
  const updated = j?.fields?.updatedAt?.stringValue;
  const age = Date.now() - new Date(updated ?? 0).getTime();
  return age < REFRESH_DAYS * 24 * 60 * 60 * 1000;
}

async function fetchFromProxy(job, token) {
  const qs = new URLSearchParams(job.params).toString();
  const r = await fetch(`${APP_URL}/api/youtube?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: j };
}

async function putDoc(id, items, nextPageToken, token) {
  const r = await fetch(docUrl(id), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(encodeDoc(items, nextPageToken)),
  });
  if (!r.ok) throw new Error(`Firestore write failed (${r.status})`);
}

function selftest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`selftest failed: ${msg}`);
  };
  assert(normShort('  Cricket   Fun ') === 'cricket fun', 'normShort');
  const jobs = buildJobs({ interests: ['Cricket'], topics: ["Newton's laws"], langs: ['any', 'hi'] });
  assert(jobs[0].id === 'search_shorts_cricket', 'shorts key');
  assert(jobs[1].id === "search_focus_any_newton's laws", 'focus key');
  assert(jobs[2].params.relevanceLanguage === 'hi', 'language param');
  assert(jobs[1].params.q === "Newton's laws lecture explained", 'topic query');
  const m = mapItems('topic', [{ id: { videoId: 'abc' }, snippet: { title: 'T', channelTitle: 'C', channelId: 'X', thumbnails: { medium: { url: 'u' } } } }]);
  assert(m[0].thumbnail === 'u' && m[0].channelId === 'X', 'topic mapping');
  const d = encodeDoc(m, null);
  assert(d.fields.candidates.arrayValue.values[0].mapValue.fields.id.stringValue === 'abc', 'encoding');
  assert('nullValue' in d.fields.nextPageToken, 'null token');
  console.log('selftest ok');
}

async function main() {
  if (args.has('--selftest')) return selftest();

  const here = dirname(fileURLToPath(import.meta.url));
  const cfg = JSON.parse(readFileSync(join(here, 'warm-topics.json'), 'utf8'));
  const langsOverride = process.env.WARM_LANGS?.split(',').map((s) => s.trim()).filter(Boolean);
  const jobs = buildJobs(cfg, langsOverride);

  if (args.has('--dry-run')) {
    console.log(`${jobs.length} jobs, ~${jobs.length * UNITS_PER_SEARCH} quota units if every one needs fetching.`);
    console.log(`Per run budget: ${BUDGET_UNITS} units (~${Math.floor(BUDGET_UNITS / UNITS_PER_SEARCH)} fetches).`);
    jobs.forEach((j) => console.log(' -', j.label));
    return;
  }

  const token = await signIn();
  let spent = 0;
  let warmed = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs) {
    if (spent + UNITS_PER_SEARCH > BUDGET_UNITS) {
      console.log(`Budget reached (${spent} units). Remaining jobs continue on the next run.`);
      break;
    }
    if (await isFresh(job.id, token)) {
      skipped++;
      continue;
    }
    const { ok, status, data } = await fetchFromProxy(job, token);
    if (status === 429 || status === 403) {
      console.log(`Stopped: proxy answered ${status} (${data?.error ?? 'quota/limit'}). Will resume next run.`);
      break;
    }
    if (!ok) {
      failed++;
      console.warn(`fail ${status}: ${job.label}`);
      await sleep(PAUSE_MS);
      continue;
    }
    const items = mapItems(job.kind, data.items);
    spent += UNITS_PER_SEARCH;
    if (items.length === 0) {
      failed++;
      console.warn(`no results: ${job.label}`);
    } else {
      try {
        await putDoc(job.id, items, job.kind === 'topic' ? data.nextPageToken ?? null : null, token);
        warmed++;
        console.log(`warmed (${items.length}): ${job.label}`);
      } catch (e) {
        failed++;
        console.warn(`${e.message}: ${job.label}`);
      }
    }
    await sleep(PAUSE_MS);
  }

  console.log(`Done. warmed=${warmed} skipped(fresh)=${skipped} failed=${failed} quotaUsed~${spent}`);
  if (warmed === 0 && failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
