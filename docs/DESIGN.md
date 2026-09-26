# DESIGN.md — Learning OS

## Visual theme
- Black/white base theme, minimal.
- Dark/light mode toggle via `ThemeContext.tsx`.
- Mobile: hamburger sidebar.

## Navigation & onboarding aids
- Sidebar sections (Revision/Notes/Videos/Progress) are **progressively locked** with a lock icon until a roadmap exists; clicking a locked section redirects to Roadmap instead of showing an empty page.
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
