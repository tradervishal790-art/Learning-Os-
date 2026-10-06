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

- `src/CurrentAffairs.tsx` + `src/currentAffairsStore.ts` + `api/_lib/currentAffairs.ts` — daily Current Affairs (general mix for govt exams). Server fetches public news RSS (The Hindu, Indian Express, PIB) and makes ONE AI call -> 10-15 short points + 5 MCQs. Each point links to its original article: the AI returns only the numbered item it used and the server attaches that item's real URL (AI never writes URLs). Max 7 points per source. Served via `api/research.ts?op=current-affairs` (12-function Hobby limit). First student of the day per language generates it; saved to Firestore `shared_current_affairs/{IST-date}_{locale}_v2 (bump CONTENT_VERSION in the store when the format changes)` so everyone else costs 0 AI. Private progress (quiz score, streak, last missed questions) in localStorage + cloudSync key `currentAffairsProgress`.
- `src/ChannelDigest.tsx` + `src/channelDigestStore.ts` + `api/_lib/channelDigest.ts` — YouTube-channel digest, a second view inside Current Affairs (switch at the top). Student adds up to 5 channels (link / @handle / name; resolved via `api/research.ts?op=channel-resolve`; list in localStorage + cloudSync key `caChannels`). It covers ONLY YESTERDAY (IST 12 AM-12 AM, the latest completed day — today is rejected because the list would be partial) and EVERY video of that day, one by one, with no cap: `?op=channel-videos` lists the day's finished videos from the channel's uploads playlist (live/upcoming skipped, Shorts included, oldest first); then the client loops (3 at a time) over `?op=video-summary`, which summarises ONE video per call (server fetches the title/description itself, transcript via unofficial `youtube-transcript` — may fail from datacenter IPs, in which case the video is summarised from title+description and flagged `hasTranscript:false`) into a gist + topic-wise points (national/international/economy/sports/scitech/other). The AI never writes URLs; the server builds the watch link. Results appear on screen as each video finishes, with a progress bar and a retry for failed videos. CACHING (two layers, each = localStorage -> shared Firestore -> API): the day's video list `shared_channel_days/{channelId}_{date}_v2` and EACH video's summary `shared_video_summaries/{videoId}_{locale}_v2` — so a video is summarised once for everybody and an interrupted run resumes (bump CONTENT_VERSION in the store when the format changes; add the two Firestore rules from the comment at the bottom of the store). Built on demand (option B). Planned next (option A): a Vercel Cron at `30 18 * * *` UTC (= 12:00 AM IST) + firebase-admin service account to pre-build yesterday's digests overnight.

## AI call bundling
Where possible, related AI outputs are bundled into a single Gemini call to control cost — e.g. Blueprint Interview scoring, `deepDiveChat` + `deepDiveQuestions`.

## Build verification
Every commit is verified with `tsc -b` + `vite build` before committing.

## Git workflow
- Local commits happen freely during work.
- Pushes to `origin` only happen on explicit user request.
- Push is done via a one-time inline authenticated URL; the token is never persisted to git remote config or shell history, and is issued/revoked by the user per session.
