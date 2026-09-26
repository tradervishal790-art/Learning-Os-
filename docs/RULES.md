# RULES.md — Learning OS

## Before every commit
- Run `tsc -b` and `vite build`. Do not commit if either fails.

## Git
- Commit locally as often as needed.
- **Never push to `origin` without explicit user request.**
- When pushing, use a one-time inline `git push https://<user>:<token>@...` URL. Never persist the token in git config or shell history. Token is short-lived, issued/revoked by the user.
- On remote conflicts, prefer a plain `git merge origin/main` — work is expected to stay in different files/sections.

## Secrets
- Gemini/YouTube API keys must **never** reach the client. All third-party API calls go through `api/` serverless proxies.

## AI cost discipline
- Bundle related AI outputs into a single Gemini call wherever the data can be gathered in one pass (e.g. interview scoring, deep-dive chat + questions).
- Use MiniMax as fallback, not as a parallel primary — only invoked on Gemini failure/quota.
- Static/UI content (hints, copy) must not call AI.

## Rejected approaches (don't reintroduce without a new decision)
- LangChain — unnecessary abstraction for this codebase.
- Flowise / Bubble — incompatible with custom logic needs.
- OmniRoute — reliability/privacy risk.
- Firebase Cloud Messaging / Blaze plan — avoided to prevent billing setup; use in-app reminders only.

## Personalization rules
- Never treat an onboarding/quiz result as a fixed label — it's a starting prior only.
- Update trait scores from a rolling window of recent behavior, not lifetime totals.
- Deliberately inject some diverse-type content to avoid filter-bubble bias.
- Do not show a transparency notification when the profile updates silently (decided against).
- Full profile/personality detail report requires password re-authentication to view.

## Localization
- When wiring i18n, do it file-by-file with `tsc`/build verification after each file, not in one large sweep.
- AI-generated content (mentor, roadmap reasoning, research, interview report) must respect the user's selected locale — not just static strings.

## Scope discipline
- Grammar section content = concept/meaning only; MCQs are explicitly out of scope (sourced separately by user).
