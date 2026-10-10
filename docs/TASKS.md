# TASKS.md — Learning OS

## Active
- [ ] Integrate LifeQuest-style 50-question Mind Map assessment → extract 8 learning dimensions in a single Gemini call.
- [ ] i18n wiring (3-phase handoff plan, see `hindi-i18n-wiring-prompt.md`):
  - [ ] Phase 1 — make selected locale real & persisted, remove `LOCKED_TO_ENGLISH`
  - [ ] Phase 2 — wire every component to `useTranslation()`, file-by-file with tsc+build after each
  - [ ] Phase 3 — make backend AI prompts (`api/*.ts`) language-aware

## Guest mode (code done, committed locally, not pushed — needs YOU in the Firebase console)
- [ ] Firebase Console -> Authentication -> Sign-in method: make sure **Anonymous** is enabled (Live Test join already uses it, so it may be on)
- [ ] Firestore rules: for `shared_video_analysis`, `shared_topic_pools`, `shared_current_affairs`, `shared_channel_days`, `shared_video_summaries` split `read` (signed-in) from `write` (signed-in AND `request.auth.token.firebase.sign_in_provider != 'anonymous'`) — exact text at the bottom of `sharedVideoCache.ts`, `currentAffairsStore.ts`, `channelDigestStore.ts`. Do NOT touch the `liveTests` rules (joiners are anonymous on purpose).
- [ ] Smoke test in a browser: landing -> Sign in button; guest -> Mind Blueprint, Videos, Dictionary open; Roadmap/Notes/Tests/Mentor/Research/Current Affairs show the sign-in card; sign up as a guest -> same uid, data kept, pending roadmap builds
- [ ] Hard AI budget: guest limits are per-serverless-instance memory (best effort). Before a big push add a shared counter (Upstash Redis or Firestore via firebase-admin) as a global daily Gemini cap
- [ ] YouTube Data API daily quota (default 10,000 units; a search costs 100) is shared by every guest — watch it in Google Cloud Console once traffic starts
- [ ] Firestore Spark limits (20k writes/day): guests also sync to `users/{uid}/data/*` — watch usage
- [ ] Edge: guest signs in with a Google/email account that ALREADY exists -> guest's server-side data is not merged (local device data stays); decide if a merge is worth building
- [ ] Not done: `/live/<code>` result screen has no "make your own practice" CTA yet

## Queued (repo cloned, awaiting explicit "start" order)
- [ ] Remove Prerequisites tab from `Notes.tsx` / `generate-notes.ts`
- [ ] Remove generic "Learning Path" tab from `Notes.tsx`; surface per-topic day-task inside Revision instead (already on 1/3/7/15/30/60 schedule)
- [ ] Rename "Mark Done" → "Done" in `Revision.tsx` and `ReviewSession.tsx`
- [ ] Add transcript-based human-style notes section (prompt already drafted)
- [ ] Add revision-due reminder with sound, triggered on app open/home load (in-app only, no FCM)

## Current Affairs (built, committed locally, not pushed)
- [x] Sidebar section, daily points + category tabs, 5-question quiz with instant feedback, streak, last-6-days picker, missed-questions list
- [ ] Paste Firestore rule for `shared_current_affairs` (see bottom of `src/currentAffairsStore.ts`) in Firebase Console
- [ ] Not done: "today's CA done" tick on the home Get Started card; sending wrong answers into Revision (Revision is roadmap-topic based, so misses are kept in a small list inside Current Affairs instead)

## Known gaps
- [ ] `api/blueprint-interview.ts` hardcodes Hinglish report output regardless of input language — needs language-aware instruction.

## New feature planned
- [ ] "Grammar" section — 16-chapter English grammar syllabus (Articles → Word Power). Concept/content only, no MCQs.

## Done (for reference — don't redo)
- [x] Server-side proxies for Gemini/YouTube keys
- [x] Multi-goal support (up to 2), localStorage persistence
- [x] Video locking + Regenerate
- [x] Blueprint-driven roadmap + exam mode (examType/examWeightage)
- [x] Live spaced-repetition revision
- [x] Static quiz → Gemini blueprint interview → static question + single-call architecture
- [x] Taste Onboarding (video-based) as alternative to quiz
- [x] Full learning-profile report moved to collapsed Settings section
- [x] Password re-auth gate for detailed profile report
- [x] Personality engine: rolling-window trait updates, no fixed labels
- [x] Cross-device cloud sync (cloudSync.ts + AuthGate hydration order)
- [x] Dashboard "Get Started" checklist + progressive sidebar locking
- [x] Feature-hints system (hintsStore + HintBubble)
- [x] MiniMax automatic fallback for Gemini
- [x] Hindi/English/Hinglish translation content drafted for all screens (not yet wired)
