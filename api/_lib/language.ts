// api/_lib/language.ts
//
// Shared language-instruction builder. The user picks a learning-content
// language ('hindi' | 'english' | 'hinglish') at onboarding, editable
// later from Settings (Dashboard.tsx) — see src/languagePreference.ts on
// the client side, which reads it and sends it as `language` in every
// content-generation request.
//
// Before this file existed, only generate-roadmap.ts respected this
// choice — generate-notes.ts, mentor-chat.ts, research.ts, and
// blueprint-interview.ts each hardcoded their own output to Hinglish
// regardless of what the user picked. This centralizes the instruction
// so all five stay in sync and a future language addition only needs
// one edit.
//
// Default is 'hinglish' (not 'english') to match the app's original
// hardcoded behavior — existing users who onboarded before this file
// existed, or whose stored preference is missing/unrecognized, see no
// change in tone.

export function languageInstruction(language: string | undefined): string {
  const normalized = (language || 'hinglish').toLowerCase();
  if (normalized === 'hindi') return 'Sab kuch Hindi (Devanagari) mein likho.';
  if (normalized === 'english') return 'Write everything in clear English.';
  return 'Sab kuch Hinglish (Hindi-English mix, jaise students aapas mein baat karte hain) mein likho.';
}
