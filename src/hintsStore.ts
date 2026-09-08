// ============================================================
// hintsStore.ts
//
// Tracks which one-line "feature hints" (HintBubble.tsx) the learner has
// already seen, so each one shows exactly once, the first time they reach
// that section — not on every visit.
//
// Named "hints", not "onboarding", on purpose: Onboarding3D.tsx is the
// signup flow (role/goal/language/name). This is a separate, unrelated
// feature — in-context tips shown as the learner explores the app.
//
// Same pattern as goalsStore.ts / learningProfileStore.ts: plain
// localStorage, no Firestore (Firestore isn't used for user data in this
// app yet — see firebase.ts).
// ============================================================

const HINTS_STORAGE_KEY = 'learning_os_seen_hints';

interface HintsState {
  seenHints: string[];
  skippedAll: boolean;
}

function load(): HintsState {
  try {
    const saved = localStorage.getItem(HINTS_STORAGE_KEY);
    if (!saved) return { seenHints: [], skippedAll: false };
    const parsed = JSON.parse(saved);
    return {
      seenHints: Array.isArray(parsed?.seenHints) ? parsed.seenHints : [],
      skippedAll: parsed?.skippedAll === true,
    };
  } catch {
    return { seenHints: [], skippedAll: false };
  }
}

function save(state: HintsState): void {
  try {
    localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort — a hint re-showing once is not worth crashing over.
  }
}

/** Should this hint id be shown right now? */
export function shouldShowHint(id: string): boolean {
  const state = load();
  if (state.skippedAll) return false;
  return !state.seenHints.includes(id);
}

/** Mark a single hint as seen (its own "x" / "Got it" dismiss). */
export function markHintSeen(id: string): void {
  const state = load();
  if (state.seenHints.includes(id)) return;
  save({ ...state, seenHints: [...state.seenHints, id] });
}

/** "Skip tour" — hides every remaining hint, everywhere, permanently. */
export function skipAllHints(): void {
  const state = load();
  save({ ...state, skippedAll: true });
}
