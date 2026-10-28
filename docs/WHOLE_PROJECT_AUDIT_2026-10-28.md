# Learning OS — whole-repository audit

Date: 2026-10-28  
Audit branch: `audit/whole-project-bugfixes`  
Base: `main` (no changes made directly to `main`)

## Confirmed findings and changes

### 1. API rate-limit buckets could be reset by high-cardinality traffic — fixed on this branch
- **Severity:** High (API cost/abuse-control weakness)
- **Location:** `api/_lib/auth.ts`
- **Evidence:** the old `hits.size > 5000` path cleared the entire map. Once enough distinct identities/IPs had populated it, the next request could clear active per-user and guest-IP counters.
- **Change:** prune expired buckets at capacity, retain each bucket's own time window, bound the map, and reject new keys while full instead of erasing live quotas.
- **Regression test:** `tests/auth-rate-limit.test.mjs` fills the bucket map and verifies an existing account's quota remains enforced.

### 2. Learner name was sent as a Google Analytics event parameter — fixed on this branch
- **Severity:** Medium (privacy/data minimisation)
- **Location:** `src/firebase.ts`, `trackOnboardingComplete`
- **Evidence:** onboarding analytics included `user_name: data.name`. Names are unnecessary for aggregate product analytics and should not be sent as analytics event parameters.
- **Change:** removed the name from the analytics event; role, goal, and language remain.

### 3. Revision checkpoints could fail to merge across devices — fixed on this branch
- **Severity:** Medium (progress loss / misleading overdue reminders)
- **Location:** `src/revisionstore.ts`, `hydrateRevisionFromCloud`
- **Evidence:** hydration returned early whenever the current device had any local review data. A second device with even one local topic therefore skipped remote checkpoints for other topics; a later whole-map save could overwrite the missing remote records.
- **Change:** merge local and cloud checkpoint days as a validated, deduplicated union, persist the union locally, and publish it back to cloud.
- **Regression test:** `tests/revisionstore.test.mjs` covers union/deduplication and malformed values.

### 4. Live-test allow-list documents exposed participant metadata — fixed on this branch
- **Severity:** High (participant privacy)
- **Location:** `firestore.rules`, `src/liveTest.ts`, `src/LiveJoin.tsx`
- **Evidence:** the old rules let any signed-in account directly read `allowed/{phone}` documents containing phone/name and `done/{phone}` markers containing UID/phone.
- **Change:** the allow-list can now be read only by the host or by a signed-in UID that already owns the corresponding player slot. The join flow first attempts the player write (whose rule checks allow-list membership), then reads its own allow-list entry. Existing done markers are readable only by the host or the matching UID. The UI uses a neutral message for permission-denied join attempts. Static regression guards are in `tests/live-test-security.test.mjs`; Firestore Emulator validation is still required.
- **Residual limitation:** phone numbers are not OTP-verified, as documented in `src/liveTest.ts`; a person who knows another participant's phone number may still attempt to claim that slot before it is taken. Preventing identity spoofing requires phone verification or another trusted identity step. The rules change must be deployed to Firebase before production is protected.

### 5. Several local-first stores cannot tell the user when cloud sync failed
- **Severity:** Medium (cross-device reliability)
- **Locations:** `src/cloudSync.ts`, `src/roadmapData.ts`, `src/revisionstore.ts`, `src/testBankStore.ts`, `src/revisionRecallStore.ts`
- **Evidence:** generic `pushToCloud` catches errors and resolves silently; callers fire-and-forget. The local copy usually remains, but users may believe their data is synced when it has not reached Firestore.
- **Status:** design/reliability risk, not a claim that every save fails. A consistent pending/failed sync indicator and retry queue need a dedicated change and cross-device tests.

### 6. Daily Test data is browser-local unless the learner exports/imports a backup
- **Severity:** Medium (device loss / migration risk; documented behaviour)
- **Location:** `src/dailyTestStore.ts`
- **Evidence:** the module explicitly stores the question bank, pending test, queue, and completion history in localStorage only. Clearing browser data or changing browser/device loses this state unless a backup exists.
- **Status:** current design is explicit, so this is a product limitation rather than an accidental regression. Consider adding cloud sync and a tested migration path.

### 7. Notebook ink cleanup can leave orphaned cloud ink documents
- **Severity:** Low–Medium (cloud storage cleanup)
- **Location:** `src/notebookStore.ts`
- **Evidence:** deletion of an ink document depends on the in-memory `inkSigs` cache containing that page key. A session that has not populated the signature cache may skip deleting a cloud ink document when local content no longer has ink.
- **Status:** code-path risk; needs a targeted mocked-cloud regression test before calling it a reproduced bug.

### 8. Daily-test backups accepted malformed question objects — fixed on this branch
- **Severity:** Medium (daily-test screen could fail on corrupted/imported data)
- **Location:** `src/dailyTestStore.ts`
- **Evidence:** the prior state guard checked only that `bank` was an array. A backup containing `null` or malformed question fields could pass import and later crash code that reads `question`, `options`, or `modelAnswer`.
- **Change:** validate question/paper shape, state ranges, and queue IDs before accepting a backup; guard the ready-question predicate against malformed runtime values.
- **Regression test:** `tests/daily-test-backup.test.mjs` covers malformed and valid backup imports.

## Validation and limits

- The Notes font-preservation commit on PR #70 passed its GitHub Actions CI: install, lint, TypeScript/build, and test steps all succeeded.
- This audit branch adds regression tests for rate-limit capacity, revision merging, live-test privacy guards, and malformed daily-test backups. Its own latest CI must pass before these changes are treated as verified.
- This is a static/code-and-test audit, not a full manual QA run on Android, desktop, offline mode, two real accounts/devices, or production Firebase rules. Those require environment/device access.
- High-priority next steps are Firebase Emulator validation and deployment of the live-test rules, identity verification for phone-based joining, and a durable cloud-sync retry/status design. Do not label the entire project “bug-free”; use the remaining findings and manual-test gaps as the exit checklist.
