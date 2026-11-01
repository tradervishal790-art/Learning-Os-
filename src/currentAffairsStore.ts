import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { authFetch } from './apiFetch';

// ============================================================
// currentAffairsStore.ts
//
// DAILY CONTENT (shared by every student, so only the FIRST student of the
// day in each language costs one AI call):
//   1. this device's localStorage            (instant, offline)
//   2. shared Firestore doc                   shared_current_affairs/{date}_{locale}
//   3. generate via /api/research?op=current-affairs, then save to 1 + 2
//
// Current Affairs is a read-first news experience. Quiz and quiz-progress
// storage were removed; article bookmarks remain in caSavedStore.ts.
// ============================================================

export type CACategory = 'national' | 'international' | 'economy' | 'sports' | 'scitech';

export interface CAPoint {
  category: CACategory;
  text: string;
  source: string;
  link?: string; // original article (absent on very old cached days)
}
export interface CADay {
  date: string; // IST date, YYYY-MM-DD
  locale: string;
  points: CAPoint[];
}

// Bump when the content format changes so older cached/shared copies are ignored.
const CONTENT_VERSION = 'v3';
const DAY_KEY_PREFIX = 'learning_os_ca_day_';
const KEEP_DAYS = 8;

// ── Dates (India time, so "today" matches what Indian students expect) ──────
export function istDateKey(daysAgo = 0): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000 - daysAgo * 86400000).toISOString().slice(0, 10);
}

// ── Daily content ───────────────────────────────────────────────────────────
function localKey(date: string, locale: string): string {
  return `${DAY_KEY_PREFIX}${date}_${locale}_${CONTENT_VERSION}`;
}

function readLocal(date: string, locale: string): CADay | null {
  try {
    const raw = localStorage.getItem(localKey(date, locale));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CADay;
    return Array.isArray(parsed?.points) && parsed.points.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(day: CADay): void {
  try {
    localStorage.setItem(localKey(day.date, day.locale), JSON.stringify(day));
    // Drop days older than KEEP_DAYS so storage never grows.
    const oldest = istDateKey(KEEP_DAYS);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(DAY_KEY_PREFIX) && k.slice(DAY_KEY_PREFIX.length, DAY_KEY_PREFIX.length + 10) < oldest) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // Storage full/unavailable — the shared copy still works.
  }
}

async function pullShared(date: string, locale: string): Promise<CADay | null> {
  if (!auth.currentUser) return null;
  try {
    const snap = await getDoc(doc(db, 'shared_current_affairs', `${date}_${locale}_${CONTENT_VERSION}`));
    if (!snap.exists()) return null;
    const d = snap.data();
    if (!Array.isArray(d?.points) || d.points.length === 0) return null;
    return { date, locale, points: d.points as CAPoint[] };
  } catch {
    return null; // offline / rules not deployed yet
  }
}

function pushShared(day: CADay): void {
  if (!auth.currentUser || auth.currentUser.isAnonymous) return; // guests may not write shared caches
  void setDoc(doc(db, 'shared_current_affairs', `${day.date}_${day.locale}_${CONTENT_VERSION}`), {
    points: day.points,
    updatedAt: new Date().toISOString(),
  }).catch(() => {
    // Best-effort — this student still has it locally.
  });
}

/**
 * Loads one day. With generateIfMissing=false (used for the "previous days" list) it only
 * looks at this device + the shared doc and returns null if nobody has opened that day.
 */
export async function loadCurrentAffairsDay(date: string, locale: string, generateIfMissing: boolean): Promise<CADay | null> {
  const local = readLocal(date, locale);
  if (local) return local;

  const shared = await pullShared(date, locale);
  if (shared) {
    writeLocal(shared);
    return shared;
  }
  if (!generateIfMissing) return null;

  const response = await authFetch('/api/research?op=current-affairs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Could not load Current Affairs (${response.status})`);
  if (!Array.isArray(data?.points) || data.points.length === 0) throw new Error('Current Affairs came back empty — please try again.');

  const day: CADay = { date, locale, points: data.points };
  writeLocal(day);
  pushShared(day);
  return day;
}

