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

- Current Affairs: general mix for govt exams (SSC/Banking/UPSC), not one exam. Content is AI-summarised from public RSS headlines only (no invented facts, own words, source shown on each point), generated once per day per language and shared across users. No cron: first opener triggers it.

- Guest mode / distribution (decided 2026-10-09): nobody is forced to sign up first. Opening the dashboard starts a Firebase *anonymous* session (a guest); the site has an optional "Sign in" button top-right (landing + dashboard), Adobe-style.
  - Open to guests: Mind Blueprint (+ taste onboarding), video analysis, video section/search, dictionary, Live Test *join* (`/live/<code>`, already public).
  - Login/sign-up required: Roadmap, Notes, Research, Current Affairs (+ channel digest), Tests (take, build, photo import, host live), Mentor, Revision, Progress.
  - Signing up while a guest LINKS the credential to the same uid (`linkWithCredential` / `linkWithPopup`) — guest data carries over. A guest who finishes onboarding gets their roadmap built automatically right after sign-up (`learning_os_pending_roadmap`).
  - Enforcement is server-side: `requireUser()` in `api/_lib/auth.ts` rejects guests (403 `account-required`) unless the endpoint passes `{ allowAnonymous: true }` (blueprint-interview, analyze-video, expand-query, analyze-taste-video, verify-bridge, youtube). Default for any new endpoint = login-only. Guests get tight rate limits (env: GUEST_RATE_LIMIT / GUEST_DAILY_LIMIT / GUEST_IP_LIMIT).
  - Guests may read but not write the `shared_*` Firestore caches (anonymous accounts are free to mint → cache-poisoning risk).

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

- Daily Test (Test section): user uploads photos/PDFs once -> question bank (built in TestBuilder variant="daily", so every question has an answer; no AI beyond photo reading). N questions/day, timer = N x minutes-per-question. A missed day's test stays pending and is the next test (same questions); a new one is made the next calendar day after submit. No repeats until the whole bank is used; new round serves previously-wrong questions first. localStorage ONLY (no cloud sync) with Backup/Restore JSON. Files: src/dailyTestStore.ts, src/DailyTest.tsx; hook in Test.tsx submitTest.
