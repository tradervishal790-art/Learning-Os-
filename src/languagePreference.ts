// src/languagePreference.ts
//
// Single source of truth for reading the user's learning-content language
// preference on the client. Set during onboarding (Onboarding3D.tsx) and
// editable later from Settings (Dashboard.tsx's languageOptions), it's
// persisted in the same 'learning_os_onboarding_data' localStorage key
// App.tsx already writes userData to.
//
// Read directly from localStorage here instead of prop-drilling through
// Notes.tsx / Mentor.tsx / Research.tsx / BlueprintInterview.tsx /
// ReviewSession.tsx — same lightweight pattern as goalsStore.ts /
// hintsStore.ts, and avoids adding a `language` prop to every layer of
// component that sits between App.tsx (which owns userData) and these
// leaf components (which don't currently receive it at all).

const ONBOARDING_STORAGE_KEY = 'learning_os_onboarding_data';

export type ContentLanguage = 'hindi' | 'english' | 'hinglish' | 'any';

const VALID: ContentLanguage[] = ['hindi', 'english', 'hinglish', 'any'];

/** Defaults to 'hinglish' — matches the app's original hardcoded output
 *  for generate-notes/mentor-chat/research/blueprint-interview, so a user
 *  who hasn't set a language (or whose stored value is unrecognized) sees
 *  no change from before this feature existed. */
export function getUserLanguage(): ContentLanguage {
  try {
    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!saved) return 'hinglish';
    const parsed = JSON.parse(saved);
    const lang = parsed?.language;
    return VALID.includes(lang) ? lang : 'hinglish';
  } catch {
    return 'hinglish';
  }
}
