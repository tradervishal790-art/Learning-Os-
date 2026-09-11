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
  if (!user?.email) return { ok: false, error: 'Session not found, please sign in again.' };
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
  if (!user) return { ok: false, error: 'Session not found, please sign in again.' };
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
      return 'This email is already registered — please sign in.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Email is not in a valid format.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect password.';
    case 'auth/user-not-found':
      return 'This email is not registered.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in the Firebase Console.';
    case 'auth/unauthorized-domain':
      return 'This website domain is not authorized in the Firebase Console.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the popup — allow popups and try again.';
    case 'auth/popup-closed-by-user':
      return 'The Google popup closed before sign-in could complete.';
    default:
      return 'Something went wrong, please try again.';
  }
}
