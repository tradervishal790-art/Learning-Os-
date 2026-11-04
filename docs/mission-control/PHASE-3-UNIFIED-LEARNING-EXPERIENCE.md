# Mission Control — Phase 3: Unified Learning Experience

**Branch:** `feat/mission-control-phase-2-intelligence`  
**Status:** Implementation substantially complete; full verification pending  
**Base:** Phase 2 Next-Action Intelligence  
**Non-negotiable constraints:** preserve the permanently visible Mission Control map and all five stages; reuse existing engines and stores; no duplicate learner database; do not merge to `main` without approval.

## Phase 3 acceptance scope

The goal is a continuous learning journey, not a set of disconnected pages.

| Connection | Required continuity | Audit status |
|---|---|---|
| Roadmap → Videos | Keep exact goal/topic ID, playlist and bridge | Existing hand-off already carries topic ID, bridge and goal context |
| Videos → Mentor | Carry the selected roadmap topic and difficulty, not just the last watched title | Implemented; tests added |
| Mentor → learner history | Keep the explicit topic context separate from saved chat history; consume navigation context once | Implemented |
| Notes ↔ lessons | Connect notes to the relevant lesson/topic without changing the notebook database or editor engine | Roadmap topic → existing topic-keyed Deep Notes hand-off implemented. Notebook library metadata linking intentionally deferred: `NoteMeta` has no stable goal/topic identity, and title/tag inference would create unsafe false links |
| Revision ↔ learned topics | Preserve topic ID and goal attribution when reviewing; offer a useful return path to learning/help | Contextual Ask Mentor action implemented; return-to-topic audit pending |
| Tests ↔ weak topics | Reuse scored attempt evidence and exact topic matching; never infer a topic from an unrelated test title | Existing Progress aggregation uses exact normalized `TestAttempt.topic` matching. Attempts do not store a stable `goalId`/`topicId`, so no new topic navigation or inferred links are added; same-title topics across goals remain an acknowledged ambiguity |
| Progress ↔ outcomes | Display actual shared engine outcomes, distinguish measured values from estimates | Shared refresh invalidation added for video engagement, roadmap, revision checkpoints/recall and scored test writes; cross-tab storage events refresh mounted Progress. Existing UI labels estimate vs observed recall/test evidence |
| Navigation/loading/empty states | Consistent return path, no blank transitions, preserve in-progress work | Pending end-to-end verification |

## Repository findings

- Roadmap already passes `topicId`, playlist videos, optional topic bridge, previous video ID, and active goal context to Video Intelligence. This path should be preserved rather than rebuilt.
- Video Intelligence already has a per-goal/per-topic search-state key and updates the roadmap using existing goal/topic IDs.
- Video Intelligence's Ask Mentor action previously populated only a generic prompt. Mentor independently selected the latest item in watch history as its hidden context. Those two sources could disagree, so Mentor could answer about a different lesson than the learner selected.
- Mentor already builds a rich learner snapshot from existing learning profile, active goals, roadmap, mastery, revision and recall stores. Phase 3 must extend this context, not duplicate it.
- Revision already retains topic IDs and optional goal IDs on generated items; marking recall updates the existing revision and roadmap engines.
- Tests already persist scored attempts and Progress aggregates exact-topic evidence through the existing mastery engine. A test paper title alone is not enough to safely attach an attempt to a roadmap topic.
- Notebook has an established local index + IndexedDB content + cloud sync design. Phase 3 must not add a second notes store or silently change notebook schema.

## Implemented in this phase so far

### Typed one-time Mentor hand-off

Added to `src/mentorPrefill.ts`:

- `MentorLearningContext` with topic title, optional goal title, difficulty and source.
- bounded input lengths and validation;
- session-only storage (not a persistent learner record);
- one-time consume semantics; malformed or unavailable storage degrades safely.

Updated `src/VideoIntel.tsx`:

- Ask Mentor now resolves the active roadmap topic using the existing active goal + topic ID.
- The selected topic title and difficulty are passed into the hand-off.
- The existing user prompt prefill remains unchanged for backward compatibility.

Updated `src/Mentor.tsx`:

- explicit hand-off context takes priority over the generic latest-watch-history fallback;
- topic, difficulty and source are included in the context sent with the next Mentor request;
- chat persistence and existing Mentor learner-context builder are unchanged.

### Roadmap → Notes hand-off

Updated `src/Roadmap.tsx` and `src/Dashboard.tsx`:

- the selected topic modal now offers a direct “Open topic notes” action;
- Dashboard passes that exact topic title and description to the existing Deep Notes component;
- the existing per-topic Deep Notes cache is reused, and the standalone notes session remains the fallback when Notes is opened without a selected topic;
- leaving Notes clears the transient topic selection so a later manual Notes visit does not silently open stale lesson context;
- no notebook index, IndexedDB schema, cloud document or editor engine was changed.

### Revision → Mentor hand-off

Updated `src/Revision.tsx`:

- each active revision card now offers a compact Ask Mentor action;
- the action carries the exact revision topic, goal title when available, difficulty and revision source;
- the prompt includes the checkpoint day so Mentor can explain the concept in the context of the current recall task;
- it uses the same one-time session hand-off and does not alter revision scheduling or recall scoring.

Added `tests/mentor-learning-context.test.mjs` for one-time consumption, malformed data, length bounds and source validation.\n\n### Progress refresh invalidation\n\nAdded a small shared event (`src/progressEvents.ts`) that invalidates the Progress read model without becoming a data store. Existing engagement, roadmap, revision checkpoint, recall and test stores notify after successful local writes/hydration. The Progress page subscribes while mounted and also listens for relevant cross-tab `storage` events; it still reads the existing stores as the source of truth. Added `tests/progress-events.test.mjs` for browser event dispatch and server-render safety.

## Remaining work before Phase 3 can be called complete

1. Finish Notebook library metadata linking using existing notebook metadata/index APIs; do not invent a second notes database.
2. Add a safe Test-results-to-topic/help path only when the attempt already has reliable topic identity; preserve unlinked/general tests as general tests.
3. Verify Progress refresh after writes from Videos, Revision and Tests, and ensure the UI labels estimated vs measured signals honestly.
4. Audit every connected page for blank loading states, stale selected topic, wrong active goal, empty states, and back/return behavior.
5. Add focused tests for each changed hand-off and run the repository's full test/build/lint pipeline.
6. Inspect the preview and fix regressions before declaring completion.

## Verification policy

Do not report Phase 3 complete until the remaining connections have been implemented, tests pass, and a full application build plus preview smoke test are verified. No merge to `main` is authorized by this phase-start request.
