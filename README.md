# Learning OS

AI-powered learning platform: type what you want to learn, get a roadmap, watch the right YouTube videos, get notes, and revise on a spaced-repetition schedule. Works in English, Hindi and Hinglish.

Live: https://learning-os-steel.vercel.app

## Core loop

Goal → roadmap → video → notes → revision (Day 1/3/7/15/30/60) → progress.

A visitor can try it without signing up: the first roadmap and notes are free (capped per day on the server); an account is only asked for once that free quota is used.

## Stack

React 19 + TypeScript + Vite + Tailwind · Firebase (Auth, Firestore) · Gemini (MiniMax as automatic fallback) · Vercel serverless functions in `api/`.

## Run locally

```bash
npm ci
npm run dev        # app on http://localhost:5173
npm test           # node --test tests/*.test.mjs
npm run build      # typecheck + production build
npm run lint
```

`api/*` are Vercel functions; run them with `vercel dev` (the Vite dev server alone does not serve `/api`).

## Environment variables

| Variable | Used for |
| --- | --- |
| `VITE_GEMINI_API_KEY` | Primary Gemini key (read by the serverless functions too) |
| `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` | Backup key for notes/roadmap/mentor; dedicated key for research — see `api/_lib/aiFallback.ts` |
| `MINIMAX_API_KEY`, `MINIMAX_MODEL` | Fallback model when Gemini fails or hits quota |
| `YOUTUBE_API_KEY` | YouTube search/metadata proxy |
| `FIREBASE_WEB_API_KEY` | Server-side ID-token check (defaults to the public web key) |
| `GUEST_RATE_LIMIT`, `GUEST_DAILY_LIMIT`, `GUEST_IP_LIMIT` | Optional overrides for guest request budgets (`api/_lib/auth.ts`) |
| `VITE_YOUTUBE_API_KEY` | YouTube key read client-side where a feature still calls it directly |

## Where things are

- `src/` — app (pages like `Dashboard`, `Roadmap`, `Revision`, `VideoIntel`; stores like `goalsStore`, `revisionstore`)
- `api/` — serverless endpoints; `api/_lib/auth.ts` is the shared auth and rate-limit guard
- `docs/` — `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `RULES.md`, `TASKS.md`
- `tests/` — unit tests (`node --test`)
- `scripts/warm-cache.mjs` — pre-warms popular topics (see `docs/WARM_CACHE.md`)
