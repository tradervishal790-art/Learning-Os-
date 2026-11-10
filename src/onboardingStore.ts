import { auth } from './firebase';
import { pushToCloud, pullFromCloud } from './cloudSync';
import { serverIso } from './serverClock';
import { resolveOnboarding, type OnboardingMeta } from './onboardingResolve';
import type { UserOnboardingData } from './types';

// ============================================================
// onboardingStore.ts
//
// Onboarding answers (name, role, goal, language, hours, deadline...) used to live ONLY in
// localStorage, so signing in on a second device asked everything again. They are now also
// synced to Firestore (users/{uid}/data/onboarding) via the same cloudSync layer as the other
// stores. localStorage stays the synchronous source of truth.
//
// Conflicts: every save is stamped with a savedAt time; on sign-in the NEWER copy wins
// (see onboardingResolve.ts).
// ============================================================

export const ONBOARDING_STORAGE_KEY = 'learning_os_onboarding_data';
const META_KEY = 'learning_os_onboarding_meta';
const CLOUD_KEY = 'onboarding';

interface CloudValue {
  data: UserOnboardingData;
  savedAt: string;
}

export function loadOnboardingData(): UserOnboardingData | null {
  try {
    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as UserOnboardingData) : null;
  } catch {
    return null;
  }
}

function readMeta(): OnboardingMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as OnboardingMeta) : null;
  } catch {
    return null;
  }
}

function writeLocal(data: UserOnboardingData, savedAt: string): void {
  const u = auth.currentUser;
  const meta: OnboardingMeta = { savedAt, uid: u?.uid ?? null, anon: !u || u.isAnonymous };
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Storage full / blocked — the in-memory state still works for this session.
  }
}

/** Save locally (stamped) and push to the account. Use this for EVERY onboarding-data write. */
export function saveOnboardingData(data: UserOnboardingData): void {
  const savedAt = serverIso();
  writeLocal(data, savedAt);
  void pushToCloud<CloudValue>(CLOUD_KEY, { data, savedAt });
}

/**
 * Call once per sign-in. Pulls the account's onboarding answers and applies the newest copy.
 * Returns the data ONLY when the cloud copy replaced the local one (caller should refresh state);
 * returns null when nothing changed.
 */
export async function hydrateOnboardingFromCloud(): Promise<UserOnboardingData | null> {
  const u = auth.currentUser;
  if (!u) return null;

  const cloud = await pullFromCloud<CloudValue>(CLOUD_KEY);
  const hasCloud = !!cloud?.data;
  const local = loadOnboardingData();
  const meta = readMeta();

  const decision = resolveOnboarding({
    hasLocal: !!local,
    localMeta: meta,
    hasCloud,
    cloudSavedAt: cloud?.savedAt ?? null,
    currentUid: u.uid,
  });

  if (decision.action === 'keep-local-push' && local) {
    const savedAt = meta?.savedAt && Date.parse(meta.savedAt) ? meta.savedAt : serverIso();
    writeLocal(local, savedAt); // re-stamp with this account's uid
    void pushToCloud<CloudValue>(CLOUD_KEY, { data: local, savedAt });
    return null;
  }
  if (decision.action === 'use-cloud' && cloud?.data) {
    writeLocal(cloud.data, cloud.savedAt || serverIso());
    return cloud.data;
  }
  return null;
}
