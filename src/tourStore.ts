// src/tourStore.ts
//
// Tracks whether the first-run guided spotlight tour (Onborda.tsx) has
// already played for this learner, so it auto-starts once and never again
// uninvited. Same plain-localStorage pattern as hintsStore.ts.

const TOUR_STORAGE_KEY = 'learning_os_seen_tour';

export function hasSeenTour(tourName: string): boolean {
  try {
    const saved = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!saved) return false;
    const seen = JSON.parse(saved);
    return Array.isArray(seen) && seen.includes(tourName);
  } catch {
    return false;
  }
}

export function markTourSeen(tourName: string): void {
  try {
    const saved = localStorage.getItem(TOUR_STORAGE_KEY);
    const seen = saved ? JSON.parse(saved) : [];
    const list = Array.isArray(seen) ? seen : [];
    if (!list.includes(tourName)) {
      localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify([...list, tourName]));
    }
  } catch {
    // Best-effort — worst case the tour replays once more.
  }
}
