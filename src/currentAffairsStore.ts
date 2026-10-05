import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { authFetch } from './apiFetch';
import { pushToCloud, pullFromCloud } from './cloudSync';

// ============================================================
// currentAffairsStore.ts
//
// DAILY CONTENT (shared by every student, so only the FIRST student of the
// day in each language costs one AI call):
//   1. this device's localStorage            (instant, offline)
//   2. shared Firestore doc                   shared_current_affairs/{date}_{locale}
//   3. generate via /api/research?op=current-affairs, then save to 1 + 2
//
// PROGRESS (private to the student): quiz score per day, the streak, and the
// last few wrong answers. localStorage is the source of truth, saves are also
// pushed to users/{uid}/data/currentAffairsProgress (same pattern as
// revisionstore.ts), pulled once on a device that has nothing yet.
// ============================================================

export type CACategory = 'national' | 'international' | 'economy' | 'sports' | 'scitech';

export interface CAPoint {
  category: CACategory;
  text: string;
  source: string;
}
export interface CAQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
export interface CADay {
  date: string; // IST date, YYYY-MM-DD
  locale: string;
  points: CAPoint[];
  quiz: CAQuizQuestion[];
}

const DAY_KEY_PREFIX = 'learning_os_ca_day_';
const PROGRESS_KEY = 'learning_os_ca_progress';
const CLOUD_KEY = 'currentAffairsProgress';
const KEEP_DAYS = 8;
const MAX_MISTAKES = 30;

// ── Dates (India time, so "today" matches what Indian students expect) ──────
export function istDateKey(daysAgo = 0): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000 - daysAgo * 86400000).toISOString().slice(0, 10);
}

// ── Daily content ───────────────────────────────────────────────────────────
function localKey(date: string, locale: string): string {
  return `${DAY_KEY_PREFIX}${date}_${locale}`;
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
    const snap = await getDoc(doc(db, 'shared_current_affairs', `${date}_${locale}`));
    if (!snap.exists()) return null;
    const d = snap.data();
    if (!Array.isArray(d?.points) || d.points.length === 0) return null;
    return { date, locale, points: d.points as CAPoint[], quiz: Array.isArray(d.quiz) ? (d.quiz as CAQuizQuestion[]) : [] };
  } catch {
    return null; // offline / rules not deployed yet
  }
}

function pushShared(day: CADay): void {
  if (!auth.currentUser) return;
  void setDoc(doc(db, 'shared_current_affairs', `${day.date}_${day.locale}`), {
    points: day.points,
    quiz: day.quiz,
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

  const day: CADay = { date, locale, points: data.points, quiz: Array.isArray(data.quiz) ? data.quiz : [] };
  writeLocal(day);
  pushShared(day);
  return day;
}

// ── Progress ────────────────────────────────────────────────────────────────
export interface CAMistake {
  date: string;
  question: string;
  correctAnswer: string;
  explanation: string;
}
export interface CAProgress {
  quizzes: Record<string, { score: number; total: number }>; // date -> result
  mistakes: CAMistake[]; // newest first
}

const EMPTY: CAProgress = { quizzes: {}, mistakes: [] };

export function loadProgress(): CAProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { quizzes: {}, mistakes: [] };
    const p = JSON.parse(raw);
    return {
      quizzes: p?.quizzes && typeof p.quizzes === 'object' ? p.quizzes : {},
      mistakes: Array.isArray(p?.mistakes) ? p.mistakes : [],
    };
  } catch {
    return { quizzes: {}, mistakes: [] };
  }
}

function saveProgress(p: CAProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // non-critical
  }
  void pushToCloud(CLOUD_KEY, p);
}

/** Pull the cloud copy on a device that has no progress yet (new phone / browser). */
export async function hydrateCurrentAffairsFromCloud(): Promise<void> {
  const local = loadProgress();
  if (Object.keys(local.quizzes).length > 0) return;
  const cloud = await pullFromCloud<CAProgress>(CLOUD_KEY);
  if (cloud && cloud.quizzes && Object.keys(cloud.quizzes).length > 0) {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...EMPTY, ...cloud }));
    } catch {
      // Best-effort.
    }
  }
}

/** Saves a finished day's quiz. A day is only counted once (first completion). */
export function recordQuizResult(date: string, score: number, total: number, wrong: CAMistake[]): CAProgress {
  const p = loadProgress();
  if (p.quizzes[date]) return p;
  p.quizzes[date] = { score, total };
  p.mistakes = [...wrong, ...p.mistakes].slice(0, MAX_MISTAKES);
  saveProgress(p);
  return p;
}

/** Consecutive IST days with a finished quiz, ending today (or yesterday if today isn't done yet). */
export function computeStreak(p: CAProgress): number {
  let day = p.quizzes[istDateKey(0)] ? 0 : 1;
  let streak = 0;
  while (p.quizzes[istDateKey(day)]) {
    streak++;
    day++;
  }
  return streak;
}

// ------------------------------------------------------------------------
// FIRESTORE RULES — add this next to the existing shared_* rules in the
// Firebase console (Firestore Database -> Rules). Without it the shared
// read/write fails closed (permission-denied -> caught): every student then
// generates their own copy through the API, so the feature still works, it
// just loses the "one AI call per day for everyone" saving.
//
//   match /shared_current_affairs/{docId} {
//     allow read, write: if request.auth != null;
//   }
// ------------------------------------------------------------------------
