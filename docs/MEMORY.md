# MEMORY.md — Learning OS (decision log, for AI agents)

Use this file as persistent context. Read before starting new work; append new decisions here as they're made — don't overwrite history.

## Standing decisions
- Firebase, not Supabase. Don't suggest switching.
- MiniMax is a fallback engine only, invoked on Gemini failure/quota — not a parallel primary.
- No Firebase Cloud Messaging / Blaze plan — revision reminders stay in-app, sound-based, triggered on load.
- Onboarding result (quiz or taste-based) is a *prior*, never a fixed label — personalization must keep updating from a rolling window of recent behavior.
- No transparency notification when the learning profile silently updates.
- Full profile/personality detail view requires password re-authentication.
- Grammar section = concept content only, MCQs explicitly excluded.
- Pushes to origin only on explicit request; token never persisted.
- Every commit verified with `tsc -b` + `vite build` first.

## Rejected paths (don't re-propose without new reasoning)
- LangChain — unnecessary abstraction here.
- Flowise / Bubble — incompatible with custom logic.
- OmniRoute — reliability/privacy risk.

## Known unresolved gap
- `api/blueprint-interview.ts` SYSTEM_INSTRUCTIONS hardcode Hinglish report output — a Hindi-answering user still gets a Hinglish report. Needs a language-aware instruction when i18n Phase 3 happens.

## In-flight collaboration note
- A separate session/other party already built i18n foundation (`LanguageContext.tsx`, `translations.ts`) and did an English-only string cleanup on Dashboard + others — both merged cleanly, no conflicts, different files.
- A handoff doc (`hindi-i18n-wiring-prompt.md`) exists for a different developer/AI to do the remaining i18n wiring in 3 phases (see TASKS.md); this assistant's role there is review + verify (tsc/build) + push, not to do the wiring itself.

## Style/tone facts worth remembering
- AI Mentor tone: respectful Hinglish.
- User (Vishal) communicates in Hinglish, prefers concise answers, is a self-taught dev with a non-IT background, thinks in terms of systems/structural fixes.
