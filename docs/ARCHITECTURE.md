# ARCHITECTURE.md — Learning OS

## Stack
- React + TypeScript + Vite, Tailwind CSS
- Firebase (Auth, Firestore, Analytics) — no Supabase
- Gemini API (primary AI) with **MiniMax as automatic fallback** — a shared server-side fallback engine sits in front of every Gemini-calling endpoint; on Gemini failure/quota, calls switch to MiniMax immediately, no manual intervention.
- Deployed on Vercel, repo on GitHub

## Repo layout (top-level)
```
api/        → serverless functions (Gemini/YouTube proxies, roadmap/notes/blueprint endpoints)
src/        → app code (components, stores, contexts)
public/     → static assets
scripts/    → build/utility scripts
```

## Security
- Gemini and YouTube API keys are **never** client-side. All calls go through server-side proxy endpoints in `api/`.
- A security audit confirmed no committed secrets; 5 client files that previously exposed keys were routed through the new proxies.

## State & persistence
- `localStorage`-backed stores follow one shared pattern: `goalsStore.ts`, `hintsStore.ts`, `roadmapData.ts`, `revisionstore.ts`, `learningProfileStore.ts`.
- **cloudSync.ts** (generic): push-on-save + pull-on-signin against Firestore path `users/{uid}/data/{key}`, best-effort/non-blocking. Covers: `learningProfileStore`, `goalsStore`, `roadmapData` (per-goal), `revisionstore`, Dashboard active-days streak.
- `AuthGate.tsx` orchestrates hydration order before `<App>` mounts: profile → goals → per-goal roadmaps → revision → streak, so a new device never flashes empty state.

## Key modules
- `PlaylistBuilder.ts` — transcript analysis + metadata fallback + weighted scoring for video selection.
- `VideoIntel.tsx` — YouTube IFrame API behavior tracking + Deep Notes (15-section Gemini call).
- `api/generate-roadmap.ts` — blueprint-driven roadmap; reads `examType`/syllabus + weightage when present.
- `api/blueprint-interview.ts` — 11-question Gemini-scored interview; `SYSTEM_INSTRUCTIONS` currently hardcodes Hinglish output (known gap — not language-aware yet).
- `api/analyze-taste-video.ts` + `TasteOnboarding.tsx` — alternative onboarding via watched-video analysis.
- `ThemeContext.tsx` — dark/light mode.
- `hintsStore.ts` + `HintBubble.tsx` — section-by-section feature hints, static copy only (zero AI cost), global "Skip tour".
- `src/i18n/LanguageContext.tsx` (+ `translations.ts`) — i18n foundation; `Locale = 'en' | 'hi' | 'hinglish'`, currently behind a `LOCKED_TO_ENGLISH` flag.

## AI call bundling
Where possible, related AI outputs are bundled into a single Gemini call to control cost — e.g. Blueprint Interview scoring, `deepDiveChat` + `deepDiveQuestions`.

## Build verification
Every commit is verified with `tsc -b` + `vite build` before committing.

## Git workflow
- Local commits happen freely during work.
- Pushes to `origin` only happen on explicit user request.
- Push is done via a one-time inline authenticated URL; the token is never persisted to git remote config or shell history, and is issued/revoked by the user per session.
