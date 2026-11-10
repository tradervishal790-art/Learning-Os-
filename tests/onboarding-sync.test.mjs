import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { resolveOnboarding } = await loadTs('src/onboardingResolve.ts');
const UID = 'u1';
const meta = (savedAt, uid = UID, anon = false) => ({ savedAt, uid, anon });

test('new device (no local, cloud has data) restores from cloud', () => {
  const d = resolveOnboarding({ hasLocal: false, localMeta: null, hasCloud: true, cloudSavedAt: '2026-11-01T00:00:00Z', currentUid: UID });
  assert.equal(d.action, 'use-cloud');
});

test('latest timestamp wins: newer local is pushed, newer cloud overwrites local', () => {
  const newerLocal = resolveOnboarding({ hasLocal: true, localMeta: meta('2026-11-05T00:00:00Z'), hasCloud: true, cloudSavedAt: '2026-11-01T00:00:00Z', currentUid: UID });
  assert.equal(newerLocal.action, 'keep-local-push');
  const newerCloud = resolveOnboarding({ hasLocal: true, localMeta: meta('2026-11-01T00:00:00Z'), hasCloud: true, cloudSavedAt: '2026-11-05T00:00:00Z', currentUid: UID });
  assert.equal(newerCloud.action, 'use-cloud');
});

test('legacy local copy without a timestamp loses to the cloud, but is uploaded if cloud is empty', () => {
  assert.equal(resolveOnboarding({ hasLocal: true, localMeta: null, hasCloud: true, cloudSavedAt: '2026-11-01T00:00:00Z', currentUid: UID }).action, 'use-cloud');
  assert.equal(resolveOnboarding({ hasLocal: true, localMeta: null, hasCloud: false, cloudSavedAt: null, currentUid: UID }).action, 'keep-local-push');
});

test("another real account's leftover local copy never beats cloud and is never uploaded", () => {
  const foreign = meta('2026-12-01T00:00:00Z', 'someone-else', false);
  assert.equal(resolveOnboarding({ hasLocal: true, localMeta: foreign, hasCloud: true, cloudSavedAt: '2026-11-01T00:00:00Z', currentUid: UID }).action, 'use-cloud');
  assert.equal(resolveOnboarding({ hasLocal: true, localMeta: foreign, hasCloud: false, cloudSavedAt: null, currentUid: UID }).action, 'noop');
});

test('a guest copy from a different (anonymous) uid still takes part in latest-wins', () => {
  const guest = meta('2026-11-05T00:00:00Z', 'guest-uid', true);
  assert.equal(resolveOnboarding({ hasLocal: true, localMeta: guest, hasCloud: true, cloudSavedAt: '2026-11-01T00:00:00Z', currentUid: UID }).action, 'keep-local-push');
});

test('nothing anywhere is a no-op', () => {
  assert.equal(resolveOnboarding({ hasLocal: false, localMeta: null, hasCloud: false, cloudSavedAt: null, currentUid: UID }).action, 'noop');
});
