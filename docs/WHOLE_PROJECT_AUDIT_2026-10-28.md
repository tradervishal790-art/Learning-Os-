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

### 4. Live-test allow-list privacy and phone-slot impersonation — repository fix in progress; deployment verification pending
- **Severity:** High (participant privacy / unauthorized test entry)
- **Location:** `firestore.rules`, `src/liveTest.ts`, `src/LiveJoin.tsx`, `src/LiveHost.tsx`, `docs/LIVE_TEST.md`
- **Evidence:** the old rules let any signed-in account directly read `allowed/{phone}` documents containing phone/name and `done/{phone}` markers containing UID/phone. Even after those reads were restricted, anyone who knew an allowed phone number could race to claim its player slot because the join flow had no proof that the person was the intended student.
- **Change on isolated branch:** allow-list reads/listing remain host-only except for the matching participant after slot ownership; `done/{phone}` reads are restricted to host/matching UID. Hosts now receive a cryptographically random 12-character per-student access code, and Firestore player creation checks that code against the host-only allow-list entry. The participant form asks for it and stores it locally for refresh. Existing codes are preserved when a host re-adds an entry. The stale setup guide that showed permissive rules is replaced with deployment instructions for the repository's `firestore.rules`. Static regression tests cover code generation, rules, join persistence, and host sharing.
- **Residual limitation / release gate:** phone numbers still are not OTP-verified; an access code is a bearer secret and can be forwarded. Validate the exact rules with the Firebase Emulator, deploy them to the correct Firebase project, and verify two separate participant UIDs before claiming production protection. Existing allow-list entries created before access codes must be re-added by the host to issue a code.

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
- PR #71's merged CI and the post-merge `main` push CI passed on 2026-10-28. The isolated access-code follow-up must pass its own CI before its changes are treated as verified.
- This remains a static/code-and-test audit, not a full manual QA run on Android, desktop, offline mode, two real accounts/devices, or production Firebase rules. Those require environment/device access.
- High-priority next steps are Firebase Emulator validation/deployment of the updated live-test rules, two-UID authorization tests, and a durable cloud-sync retry/status design. Do not label the entire project “bug-free”; use the remaining findings and manual-test gaps as the exit checklist.
