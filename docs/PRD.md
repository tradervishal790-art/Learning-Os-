# PRD.md — Learning OS

## What it is
A personalized AI-powered learning platform that builds a roadmap from YouTube videos + Gemini API, adapts to the learner's style, and tracks retention over time.

Live: https://learning-os-steel.vercel.app
Repo: tradervishal790-art/Learning-Os-

## Core user flow
1. **Onboarding** — user sets a learning goal (up to 2 simultaneous goals). Two paths exist:
   - Blueprint Interview (11 Gemini-scored questions → 8 learning dimensions)
   - Taste Onboarding (user submits YouTube videos they've fully watched, 45+ min each → AI infers style from transcripts)
2. **Roadmap generation** — topic count derived from user's hours/deadline budget, foundation-first sequencing (Gemini `thinkingConfig`). Optional exam mode (`examType` + per-topic `examWeightage`) follows a named syllabus (CBSE/JEE/NEET etc.) with weightage badges.
3. **Video selection** — playlist pipeline scores videos via transcript analysis + metadata fallback (`PlaylistBuilder.ts`); selected videos lock in place (explicit "Regenerate" to change).
4. **Learning** — VideoIntel.tsx tracks watch behavior via YouTube IFrame API, generates Deep Notes (15-section Gemini breakdown), transcript-based human-style notes.
5. **Revision** — spaced repetition on a 1/3/7/15/30/60-day schedule, driven by real progress data, with a "Done" action (renamed from "Mark Done").
6. **Progress** — real data dashboard: completion %, streak, watch time, retention, mastery heatmap, weak areas.
7. **AI Mentor** — Hinglish, respectful tone, answers learner questions in context.

## Personalization model
- Test/onboarding result is only a **starting prior**, not a fixed label.
- Trait scores update continuously via a rolling window of recent behavior (video selections, completion/watch-time/retention) — not raw lifetime counts, not discrete type-switching.
- Deliberately injects occasional diverse-type videos to avoid filter-bubble bias.
- No transparency notification is shown when the profile silently updates (explicit decision).
- Full learning-profile/personality report is gated behind password re-authentication, not just collapsed UI — for perceived data control.

## Localization
- Goal: selecting Hindi in onboarding should localize the entire app, including AI-generated content (mentor replies, roadmap reasoning, research, Blueprint Interview report) — not just static UI strings.
- `Locale` = `'en' | 'hi' | 'hinglish'`.

## Non-goals / rejected
- No push notifications via Firebase Cloud Messaging (avoids Blaze plan billing) — revision reminders are in-app only, triggered on app/home load.
- No LangChain, Flowise/Bubble, or OmniRoute — rejected for unnecessary abstraction / incompatibility / reliability risk.
