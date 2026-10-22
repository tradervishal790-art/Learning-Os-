# TASKS.md — Learning OS

## Active
- [ ] Integrate LifeQuest-style 50-question Mind Map assessment → extract 8 learning dimensions in a single Gemini call.
- [ ] i18n wiring (3-phase handoff plan, see `hindi-i18n-wiring-prompt.md`):
  - [x] Phase 1 — locale persisted, `LOCKED_TO_ENGLISH` is false
  - [ ] Phase 2 — wire every component to `useTranslation()`, file-by-file with tsc+build after each
  - [~] Phase 3 — mentor, blueprint-interview, generate-notes done; see Known gaps

## Guest mode (code done, committed locally, not pushed — needs YOU in the Firebase console)
- [ ] Firebase Console -> Authentication -> Sign-in method: make sure **Anonymous** is enabled (Live Test join already uses it, so it may be on)
- [ ] (Rules text is already in `firestore.rules` - just publish it.) Firestore rules: for `shared_video_analysis`, `shared_topic_pools`, `shared_current_affairs`, `shared_channel_days`, `shared_video_summaries` split `read` (signed-in) from `write` (signed-in AND `request.auth.token.firebase.sign_in_provider != 'anonymous'`) — exact text at the bottom of `sharedVideoCache.ts`, `currentAffairsStore.ts`, `channelDigestStore.ts`. Do NOT touch the `liveTests` rules (joiners are anonymous on purpose).
- [ ] Smoke test in a browser: landing -> Sign in button; guest -> Mind Blueprint, Videos, Dictionary open; Roadmap/Notes/Tests/Mentor/Research/Current Affairs show the sign-in card; sign up as a guest -> same uid, data kept, pending roadmap builds
- [x] Hard AI budget: code done in `api/_lib/auth.ts` (Upstash Redis REST, no new dependency). YOU: create a free Upstash Redis and set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel; optional `GUEST_GLOBAL_DAILY_LIMIT` (default 5000), `GLOBAL_DAILY_LIMIT` (default off). Without the env vars nothing changes; if Redis is down it fails open.
- [ ] YouTube Data API daily quota (default 10,000 units; a search costs 100) is shared by every guest — watch it in Google Cloud Console once traffic starts
- [ ] Firestore Spark limits (20k writes/day): guests also sync to `users/{uid}/data/*` — watch usage
- [ ] Edge: guest signs in with a Google/email account that ALREADY exists -> guest's server-side data is not merged (local device data stays); decide if a merge is worth building
- [x] `/live/<code>` submitted screen now has a close-the-page reassurance + "Make your own practice tests" CTA

## Queued items — verified DONE in code (Oct 22, 2026 audit; this list was stale)
- [x] Prerequisites tab removed (replaced by transcript-based `myNotes`)
- [x] Generic "Learning Path" tab removed; day-task now comes from `revisionData.getTaskForTopic`
- [x] "Mark Done" renamed to "Done"
- [x] Transcript-based human-style notes (`myNotes`) in `api/generate-notes.ts`
- [x] Revision-due reminder with sound on app open (`playReminderBell` in Dashboard; chime now at most once per 3 h, banner always shows)

## Current Affairs (built, committed locally, not pushed)
- [x] Sidebar section, daily points + category tabs, 5-question quiz with instant feedback, streak, last-6-days picker, missed-questions list
- [x] Firestore rule for `shared_current_affairs` is already in `firestore.rules` (publish that file in the Firebase Console if not yet published)
- [x] "Today's CA done" status on the home page: `CurrentAffairsChip.tsx` (shown only to learners who finished a CA quiz before; deliberately NOT in the Get Started card, which hides for good after setup)
- [ ] Not done: sending wrong answers into Revision (Revision is roadmap-topic based, so misses are kept in a small list inside Current Affairs instead)

## Known gaps
- [x] `api/blueprint-interview.ts` is language-aware (fixed). `api/generate-notes.ts` was the same gap; now takes `locale` too.
- [ ] Other prompts to check for a hardcoded language: `generate-roadmap`, `research`, `extract-questions` ops, `noteAi`.

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

## UX problems found in the Oct 22 audit — still open
- [ ] Taste Onboarding needs 5 videos x 45+ min before any value; consider a skippable/shorter path (check whether any skip exists)
- [ ] ~40 components still English-only (BottomNav, Test, ReviewSession, Dictionary, DailyTest, StudyPlan, FocusPlayer, LiveHost/LiveJoin ...) -> Phase 2 i18n
- [ ] ~14 native `prompt()`/`confirm()` left (NoteLibrary rename/folder/tags/delete, EditorToolbar link, NoteEditor, PageAttachments, StudyPlan, LiveHost, RevisionSheet, NoteTools) -> need an in-app prompt dialog next to `ConfirmDialog`
- [ ] Daily Test bank is localStorage-only: a lost phone / cleared browser loses it (Backup/Restore exists but is manual)
- [ ] Per-instance rate limits are inconsistent unless the Redis budget is enabled
- [ ] ~22 generic "Failed to..." error strings; most don't say what the student can do next

## Fixed in the Oct 22 audit
- [x] Crash screen "Clear local data" is now warn -> optional save-a-copy -> confirm (was one tap, `localStorage.clear()`)
- [x] Stale-deploy chunk failures reload once automatically (`vite:preloadError` in `main.tsx`)
- [x] Timed-test submit / delete-test use the in-app dialog (native confirm() can be blocked in WhatsApp / in-app browsers)
- [x] First-load screen shows a slow-connection message + retry after 8 s
- [x] Notes follow the chosen language; cached notes in another language regenerate
- [x] Shared-network (hostel/college) guest limit no longer says "you used too many requests"
