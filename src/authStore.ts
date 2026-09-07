import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithPopup,
  updateProfile,
  GoogleAuthProvider,
  EmailAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

// ============================================================
// authStore.ts
//
// Real Firebase Email/Password + Google auth, gating the WHOLE app (see
// AuthGate.tsx) — each user has their own account/password, so their
// onboarding data, learning profile, roadmap, and engagement history are
// only reachable after they sign in on that device.
//
// COST: Email/Password and Google sign-in are on Firebase's free Spark
// plan up to 50,000 monthly active users — this will not incur charges
// at this app's scale. Only phone/SMS auth is billed; we don't use it.
//
// SETUP REQUIRED (one-time, Firebase Console — cannot be done from code):
//   Firebase Console -> Authentication -> Sign-in method -> enable
//   "Email/Password" AND "Google" providers. If either isn't enabled,
//   the matching function below fails with auth/operation-not-allowed.
// ============================================================

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export async function signOutOfApp(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/** First-time setup: creates the account, sets their display name, and signs them in immediately. */
export async function createProfileLockAccount(email: string, password: string, displayName?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName?.trim()) await updateProfile(credential.user, { displayName: displayName.trim() });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: mapAuthError(err?.code) };
  }
}

/** Session expired / signed out on this device — sign back in with the same credentials. */
export async function signInProfileLock(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: mapAuthError(err?.code) };
  }
}

/**
 * Already signed in on this device but viewing a sensitive report —
 * re-confirms identity with the password before revealing it (step-up
 * auth), without forcing a full sign-out/sign-in cycle.
 */
export async function reauthenticateProfileLock(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = auth.currentUser;
  if (!user?.email) return { ok: false, error: 'Session mil nahi rahi, dobara sign in karo.' };
  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: mapAuthError(err?.code) };
  }
}

/**
 * Google sign-in — works for BOTH first-time create and later sign-in;
 * Firebase auto-creates the account on first Google sign-in, so the
 * caller doesn't need to know create vs signin mode like the email flow.
 */
export async function signInWithGoogleProfileLock(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: mapAuthError(err?.code) };
  }
}

/** True if the currently signed-in user's account is Google-based (no password to re-enter). */
export function isGoogleAccount(): boolean {
  return auth.currentUser?.providerData?.[0]?.providerId === 'google.com';
}

/** Step-up confirmation for a Google-based account — re-shows the Google popup instead of asking a password. */
export async function reauthenticateProfileLockGoogle(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = auth.currentUser;
  if (!user) return { ok: false, error: 'Session mil nahi rahi, dobara sign in karo.' };
  try {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: mapAuthError(err?.code) };
  }
}

function mapAuthError(code?: string): string {
  const known = mapKnownAuthError(code);
  // Always append the raw code — generic messages hide the real cause;
  // the user can act on 'auth/unauthorized-domain' etc. directly.
  return code ? `${known} (${code})` : known;
}

function mapKnownAuthError(code?: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ye email pehle se registered hai — sign in karo.';
    case 'auth/weak-password':
      return 'Password kam se kam 6 characters ka hona chahiye.';
    case 'auth/invalid-email':
      return 'Email sahi format me nahi hai.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Galat password.';
    case 'auth/user-not-found':
      return 'Ye email registered nahi hai.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in Firebase Console me enable nahi hai.';
    case 'auth/unauthorized-domain':
      return 'Ye website domain Firebase Console me authorized nahi hai.';
    case 'auth/popup-blocked':
      return 'Browser ne popup block kar diya — popup allow karo aur dobara try karo.';
    case 'auth/popup-closed-by-user':
      return 'Google popup band ho gaya sign-in complete hone se pehle.';
    default:
      return 'Kuch gadbad ho gayi, dobara try karo.';
  }
}
