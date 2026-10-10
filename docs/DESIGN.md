# DESIGN.md — Learning OS

## Visual theme
- Black/white base theme, minimal.
- Dark/light mode toggle via `ThemeContext.tsx`.
- Mobile: hamburger sidebar.

## Navigation & onboarding aids
- Sidebar sections (Revision/Notes/Videos/Progress) are **progressively locked** with a lock icon until a roadmap exists; clicking a locked section redirects to Roadmap instead of showing an empty page.
- Guests (no account yet) see a 🔒 on every account-only section (Roadmap, Revision, Notes, Test, Mentor, Progress, Research, Current Affairs); tapping one opens the sign-in modal instead of navigating. A "Sign in" button sits top-right on the landing page and in the dashboard header while the visitor is a guest.
- Dashboard shows a "Get Started" checklist (3 steps: set learning style / build roadmap / watch first video), each checked against real state, auto-hides once complete.
- `HintBubble.tsx` gives one-line, per-section tips with individual dismiss + a global "Skip tour" — static copy, no AI cost.

## Tone
- AI Mentor speaks in a respectful Hinglish tone.
- Blueprint Interview report defaults to Hinglish output (currently hardcoded — see known gap in ARCHITECTURE.md).

## Content disclosure
- Full learning-profile / personality report is **not** shown on the home page by default — it's collapsed inside Settings, and gated behind password re-authentication for the detailed view.
- No transparency popup when the profile silently updates in the background — keep it invisible to avoid interrupting the learning flow.

## Exam mode
- Topic cards show a weightage badge (`high` / `medium` / `low`) when an exam type is set on the goal.

## Localization UX goal
- When a user picks Hindi, **every** screen and AI output should switch — not just onboarding — including mentor replies and reports.

## Anti-"vibe-coded" rules (home/dashboard, Oct 2026)
- Icons, not words, for chrome buttons (hamburger, settings gear); always with aria-label.
- No rainbow gradient text; no emoji as UI icons (use lucide); no staggered fade-in on every card.
- Don't repeat three identical bordered cards: group related stats in one surface with hairline dividers.
- No card-inside-card, no stack of full-width bordered buttons: one primary action, others as pills/text links.
