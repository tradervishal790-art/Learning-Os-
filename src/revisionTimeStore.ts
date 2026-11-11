import { MIN_WATCH_SECONDS, markStudyDay } from './studyDay';

// ============================================================
// revisionTimeStore.ts — time spent actively in the Revision screen counts as
// study time (Progress "Total Study Time") and, past a minute, as a study day.
//
// Only ACTIVE time counts: the tab must be visible AND the learner must have
// touched the screen in the last minute — a Revision tab left open while
// scrolling reels elsewhere adds nothing. Stored on this device, per UTC day.
// ============================================================

export const REVISION_SECONDS_KEY = 'learning_os_revision_seconds';
const IDLE_MS = 60_000;
const FLUSH_EVERY_SECONDS = 15;
const KEEP_DAYS = 400;

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

export function readRevisionSecondsByDay(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(REVISION_SECONDS_KEY) ?? '{}');
    const out: Record<string, number> = {};
    if (raw && typeof raw === 'object') {
      for (const [key, value] of Object.entries(raw)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof value === 'number' && Number.isFinite(value) && value > 0) out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Adds active revision seconds to today. Returns today's total. */
export function addRevisionSeconds(seconds: number, now = new Date()): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  const all = readRevisionSecondsByDay();
  const key = dayKey(now);
  all[key] = Math.round((all[key] ?? 0) + seconds);
  const keys = Object.keys(all).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete all[old];
  try {
    localStorage.setItem(REVISION_SECONDS_KEY, JSON.stringify(all));
  } catch {
    return all[key];
  }
  if (all[key] >= MIN_WATCH_SECONDS) markStudyDay(now);
  return all[key];
}

/** Starts counting while the Revision screen is open. Call the returned function to stop. */
export function startRevisionTimer(): () => void {
  let pending = 0;
  let lastTouch = Date.now();
  const touch = () => { lastTouch = Date.now(); };
  const flush = () => {
    if (pending > 0) {
      addRevisionSeconds(pending);
      pending = 0;
    }
  };
  const touchEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
  touchEvents.forEach((name) => window.addEventListener(name, touch, { passive: true }));
  const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);
  const tick = window.setInterval(() => {
    if (document.visibilityState !== 'visible' || Date.now() - lastTouch > IDLE_MS) return;
    pending += 1;
    if (pending >= FLUSH_EVERY_SECONDS) flush();
  }, 1000);
  return () => {
    window.clearInterval(tick);
    touchEvents.forEach((name) => window.removeEventListener(name, touch));
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
    flush();
  };
}
