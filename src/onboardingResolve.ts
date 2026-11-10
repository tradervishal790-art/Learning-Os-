// ============================================================
// onboardingResolve.ts — pure "which copy wins?" rule for onboarding answers.
// No Firebase / DOM imports so it can be unit-tested on its own.
//
// Rule: the copy with the LATEST savedAt wins.
//   - A local copy written by a different, real (non-guest) account is "foreign" (shared device):
//     it never beats the cloud and is never uploaded into this account.
//   - A local copy with no timestamp (saved before this feature existed) counts as oldest.
// ============================================================

export interface OnboardingMeta {
  savedAt: string;
  uid: string | null;
  /** True when the copy was written by a guest (or signed-out) session. */
  anon: boolean;
}

export type OnboardingDecision =
  | { action: 'keep-local-push' } // local is newest (or cloud empty): upload it
  | { action: 'use-cloud' } //      cloud is newest (or local unusable): overwrite local
  | { action: 'noop' }; //          nothing anywhere

export function resolveOnboarding(opts: {
  hasLocal: boolean;
  localMeta: OnboardingMeta | null;
  hasCloud: boolean;
  cloudSavedAt: string | null;
  currentUid: string;
}): OnboardingDecision {
  const { hasLocal, localMeta, hasCloud, cloudSavedAt, currentUid } = opts;

  const localUsable =
    hasLocal && (!localMeta || localMeta.uid === currentUid || localMeta.anon || localMeta.uid === null);

  if (!hasCloud) return localUsable ? { action: 'keep-local-push' } : { action: 'noop' };
  if (!localUsable) return { action: 'use-cloud' };

  const localAt = Date.parse(localMeta?.savedAt ?? '') || 0;
  const cloudAt = Date.parse(cloudSavedAt ?? '') || 0;
  return localAt > cloudAt ? { action: 'keep-local-push' } : { action: 'use-cloud' };
}
