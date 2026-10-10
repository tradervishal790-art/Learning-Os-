import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithCredential,
  signInAnonymously,
  linkWithCredential,
  linkWithPopup,
  updateProfile,
  GoogleAuthProvider,
  EmailAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import { clearAllMentorChats } from './mentorChatStore';
import { auth } from './firebase';
import type { TranslationShape } from './i18n/translations';

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
// GUEST MODE: nobody is forced to sign up first. Opening the dashboard
// signs the visitor in ANONYMOUSLY (a "guest"); the features that need a
// real account (roadmap, notes, tests, mentor, research, current affairs)
// ask them to sign in at that moment. Signing up while a guest LINKS the new
// credential to the same Firebase user — the uid never changes, so everything
// the guest did (Mind Blueprint result, searches, goals) stays theirs.
//
// SETUP REQUIRED (one-time, Firebase Console — cannot be done from code):
//   Firebase Console -> Authentication -> Sign-in method -> enable
//   "Email/Password", "Google" AND "Anonymous" providers. If one isn't
//   enabled, the matching function below fails with auth/operation-not-allowed
//   (guest sign-in failing just falls back to the old full-page sign-in).
// ============================================================

/** A guest = anonymous Firebase session (no email/Google attached yet). */
export function isGuestUser(user: User | null | undefined): boolean {
  return !!user?.isAnonymous;
}

/** Starts a guest session. Safe to call when already signed in (returns the existing user). */
export async function signInAsGuest(): Promise<User> {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

/** After linking, the cached ID token still says "anonymous" — refresh so server + Firestore rules see the account. */
async function refreshAfterUpgrade(user: User): Promise<void> {
  try {
    await user.getIdToken(true);
  } catch {
    // Non-fatal: authFetch also self-heals a stale anonymous token.
  }
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export async function signOutOfApp(): Promise<void> {
  clearAllMentorChats(); // shared-phone safety: don't leave this student's chat on the device
  await signOut(auth);
  // Back to the public landing page — staying on /dashboard would just open a new guest session.
  window.location.assign('/');
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/** First-time setup: creates the account, sets their display name, and signs them in immediately. */
export async function createProfileLockAccount(
  email: string,
  password: string,
  displayName: string | undefined,
  authErrors: TranslationShape['authErrors']
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const guest = auth.currentUser;
    let user: User;
    if (guest?.isAnonymous) {
      // Upgrade the guest in place — same uid, so their guest data carries over.
      const linked = await linkWithCredential(guest, EmailAuthProvider.credential(email, password));
      user = linked.user;
    } else {
      user = (await createUserWithEmailAndPassword(auth, email, password)).user;
    }
    if (displayName?.trim()) await updateProfile(user, { displayName: displayName.trim() });
    await refreshAfterUpgrade(user);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: mapAuthError(err?.code, authErrors) };
  }
}

/** Session expired / signed out on this device — sign back in with the same credentials. */
export async function signInProfileLock(
  email: string,
  password: string,
  authErrors: TranslationShape['authErrors']
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: mapAuthError(err?.code, authErrors) };
  }
}

/**
 * Already signed in on this device but viewing a sensitive report —
 * re-confirms identity with the password before revealing it (step-up
 * auth), without forcing a full sign-out/sign-in cycle.
 */
export async function reauthenticateProfileLock(
  password: string,
  authErrors: TranslationShape['authErrors']
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = auth.currentUser;
  if (!user?.email) return { ok: false, error: authErrors.sessionExpired };
  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: mapAuthError(err?.code, authErrors) };
  }
}

/**
 * Google sign-in — works for BOTH first-time create and later sign-in;
 * Firebase auto-creates the account on first Google sign-in, so the
 * caller doesn't need to know create vs signin mode like the email flow.
 */
export async function signInWithGoogleProfileLock(
  authErrors: TranslationShape['authErrors']
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const provider = new GoogleAuthProvider();
    const guest = auth.currentUser;
    if (guest?.isAnonymous) {
      try {
        // Upgrade the guest in place (same uid) — guest data carries over.
        const linked = await linkWithPopup(guest, provider);
        await refreshAfterUpgrade(linked.user);
        return { ok: true };
      } catch (err: any) {
        if (err?.code !== 'auth/credential-already-in-use') throw err;
        // This Google account already has a Learning OS account — just sign into it.
        const existing = GoogleAuthProvider.credentialFromError(err);
        if (!existing) throw err;
        await signInWithCredential(auth, existing);
        return { ok: true };
      }
    }
    await signInWithPopup(auth, provider);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: mapAuthError(err?.code, authErrors) };
  }
}

/** True if the currently signed-in user's account is Google-based (no password to re-enter). */
export function isGoogleAccount(): boolean {
  return auth.currentUser?.providerData?.[0]?.providerId === 'google.com';
}

/** Step-up confirmation for a Google-based account — re-shows the Google popup instead of asking a password. */
export async function reauthenticateProfileLockGoogle(
  authErrors: TranslationShape['authErrors']
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = auth.currentUser;
  if (!user) return { ok: false, error: authErrors.sessionExpired };
  try {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: mapAuthError(err?.code, authErrors) };
  }
}

function mapAuthError(code: string | undefined, authErrors: TranslationShape['authErrors']): string {
  const known = mapKnownAuthError(code, authErrors);
  // Always append the raw code — generic messages hide the real cause;
  // the user can act on 'auth/unauthorized-domain' etc. directly.
  return code ? `${known} (${code})` : known;
}

function mapKnownAuthError(code: string | undefined, authErrors: TranslationShape['authErrors']): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return authErrors.emailAlreadyInUse;
    case 'auth/weak-password':
      return authErrors.weakPassword;
    case 'auth/invalid-email':
      return authErrors.invalidEmail;
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return authErrors.wrongPassword;
    case 'auth/user-not-found':
      return authErrors.userNotFound;
    case 'auth/operation-not-allowed':
      return authErrors.operationNotAllowed;
    case 'auth/unauthorized-domain':
      return authErrors.unauthorizedDomain;
    case 'auth/popup-blocked':
      return authErrors.popupBlocked;
    case 'auth/popup-closed-by-user':
      return authErrors.popupClosedByUser;
    default:
      return authErrors.genericAuthError;
  }
}
