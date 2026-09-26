# TASKS.md — Learning OS

## Active
- [ ] Integrate LifeQuest-style 50-question Mind Map assessment → extract 8 learning dimensions in a single Gemini call.
- [ ] i18n wiring (3-phase handoff plan, see `hindi-i18n-wiring-prompt.md`):
  - [ ] Phase 1 — make selected locale real & persisted, remove `LOCKED_TO_ENGLISH`
  - [ ] Phase 2 — wire every component to `useTranslation()`, file-by-file with tsc+build after each
  - [ ] Phase 3 — make backend AI prompts (`api/*.ts`) language-aware

## Queued (repo cloned, awaiting explicit "start" order)
- [ ] Remove Prerequisites tab from `Notes.tsx` / `generate-notes.ts`
- [ ] Remove generic "Learning Path" tab from `Notes.tsx`; surface per-topic day-task inside Revision instead (already on 1/3/7/15/30/60 schedule)
- [ ] Rename "Mark Done" → "Done" in `Revision.tsx` and `ReviewSession.tsx`
- [ ] Add transcript-based human-style notes section (prompt already drafted)
- [ ] Add revision-due reminder with sound, triggered on app open/home load (in-app only, no FCM)

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
