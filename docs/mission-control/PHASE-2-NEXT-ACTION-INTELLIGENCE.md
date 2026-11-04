# Mission Control — Phase 2: Next-Action Intelligence

**Branch:** `feat/mission-control-phase-2-intelligence`  
**Base:** `feat/mission-control-phase-1-audit`  
**Scope:** Evidence-aware next action, active-goal context hydration, and safe local-first recommendation behavior.  
**Map constraint:** All five Mission Control stages and the permanent map remain intact.

## Outcome

Mission Control now chooses a suggested next action from the learner data already owned by the existing profile, goals, roadmap, revision, recall, video-engagement, and test stores. The decision engine is pure and deterministic. It does not write learner data, create a new event store, or replace an existing learning engine.

The primary Continue Learning action remains available. The separate Suggested next step now carries a short explanation and routes to the correct existing screen/action.

## 1. Recommendation priority

The engine in `src/missionControlLogic.ts` applies this order:

1. **Know Me — profile setup:** if no Learning Profile exists, invite the learner to complete it.
2. **Plan — choose a goal:** if there is no active goal, route to the existing Roadmap/goal flow.
3. **Retain — overdue revision:** prioritize overdue recall checkpoints.
4. **Retain — due today:** prioritize due-today recall checkpoints.
5. **Learn — strengthen a weak topic:** open Mentor when existing evidence identifies a genuinely weak topic.
6. **Prove — test completed roadmap:** if every active roadmap topic is complete and no topic is active, suggest a test.
7. **Learn — continue active topic:** route through the existing saved-video handler so the correct goal/topic context is retained.
8. **Plan — roadmap fallback:** if there is no active topic or no roadmap, route to Roadmap rather than an empty Videos page.

Every recommendation includes a stage ID, concise title, explanation, and confidence label. The confidence is kept as decision metadata; the UI does not overstate a measured score.

## 2. Evidence reused — no duplicate data layer

| Existing store / engine | Used by Mission Control for |
|---|---|
| `learningProfileStore` | Whether profile setup is complete |
| `goalsStore` | Whether an active learning goal exists |
| `roadmapData` | Current topic, active-goal roadmap size, completed topics |
| `revisionData` + `revisionstore` | Due-today and overdue review counts |
| `revisionRecallStore` | Measured recall weakness |
| `engagementStore` | Topic session history and latest negative video feedback |
| `testStore` + `topicMastery` | Existing scored test evidence and topic mastery |
| `progressData` | Existing mastery aggregation and weak-area ranking |

The recommendation reads the selected active goal's mastery context, so a weak topic in a second active goal does not redirect the learner away from the goal currently being viewed.

## 3. False-positive protection

The Progress engine assigns a baseline score of 40 to a topic with status `learning`. That baseline is a workflow state, not proof that the learner is struggling.

Phase 2 explicitly prevents this from triggering Mentor:

- A low baseline alone is not considered a weak topic.
- A low measured recall score, low scored-test accuracy, or latest negative video feedback can count as evidence.
- Negative video feedback is taken from the latest valid session for that topic, rather than allowing an old dislike to keep the learner in a permanent help loop.
- Missing test/recall data stays unknown; it is not converted into a zero score.
- Revision urgency takes priority over weak-topic support.

## 4. Hydration and first-load behavior

Mission Control now performs bounded, on-demand hydration when the dashboard is active:

- Only active-goal roadmaps are requested (at most the existing two active goals).
- Shared revision checkpoints/dates, recall scores, and test attempts use their existing hydration functions.
- Existing local-first merge/skip behavior in those stores is preserved.
- No inactive historical goal roadmaps are fetched.
- No new Firestore collection, document key, database, or schema was introduced.
- A short 3-second fallback prevents the Suggested next step from remaining disabled indefinitely on a slow/offline connection. Local data remains usable while cloud hydration continues.

The app-level dashboard hydration now signals Dashboard after the existing profile/personality/goal/streak hydration finishes. Dashboard refreshes its local-backed React profile state at that boundary. This closes an important new-device gap: a Learning Profile restored from Firestore must not still appear missing merely because Dashboard initialized its React state before the cloud read completed.

Dashboard hydration is keyed to guest versus signed-in state so a guest-to-account transition can trigger the account hydration path. Active goal selection is revalidated after goal hydration; an ended or missing goal is not kept as the selected active goal.

## 5. UI and navigation behavior

- Five core map stages remain visible and unchanged.
- The suggested-action strip now shows a real title and a short reason.
- The suggestion is temporarily disabled while initial learner context is being checked, then becomes available from local/cloud-backed data.
- Profile opens the existing profile flow.
- Revision, Mentor, Test, and Roadmap open their existing screens.
- Video continuation uses the existing saved-video callback, preserving the current topic ID and selected goal.
- The existing Continue Learning CTA and all map nodes remain available.

## 6. Tests added

`tests/missionControlLogic.test.mjs` covers ten decision cases:

1. profile setup takes priority;
2. no active goal routes to Plan;
3. overdue revision outranks due-today;
4. due-today revision outranks weak-topic support;
5. measured weak current topic opens Mentor;
6. the default 40-point learning baseline does not trigger Mentor;
7. measured weak non-current topic opens Mentor;
8. completed roadmap recommends a test;
9. empty roadmap recommends Roadmap;
10. existing Continue Learning routing is preserved.

The decision-engine test harness was executed in an isolated Node test workspace: **10 passed, 0 failed**. The pure TypeScript decision module also passed a standalone strict TypeScript check.

## 7. Verification limits

- GitHub Actions returned no workflow runs for the inspected Phase 2 commit.
- The Vercel status was still pending at the time of the repository check.
- A full repository `npm run build` could not be run in this environment: cloning the repository failed because the runtime could not resolve `github.com`, and the repository dependencies were therefore unavailable locally.
- The full Vite/React application build and browser interaction still need the Vercel preview or a local environment with dependencies installed.

No full-build success is claimed.

## 8. Guardrails preserved

- No merge to `main`.
- No replacement of the working roadmap, revision, video, test, Mentor, or mastery engines.
- No duplicate database or learning-event store.
- No removal, hiding, or redesign of the permanently visible five-stage map.
- No cloud replication of local-only Mentor chat, research history, or video engagement history.
