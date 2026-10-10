import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, onIdTokenChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { ACCOUNT_REQUIRED_EVENT } from './apiFetch';
import { format } from './i18n/format';
import { useTranslation } from './i18n/LanguageContext';
import AuthForm from './AuthForm';

// ============================================================
// AuthPrompt.tsx
//
// Guest -> account, on demand. Learning OS is browsable without signing up
// (Mind Blueprint, video analysis, video search, dictionary). Features that
// need an account call `requireAccount('Notes')`: a guest gets the sign-in
// modal and `false`; an account holder gets `true` and nothing happens.
//
// Also: the header "Sign in" button (<SignInButton />), the in-page
// "sign in to continue" card (<LoginRequired />), and an automatic prompt
// whenever the server answers `account-required` (see apiFetch.ts).
// ============================================================

interface AuthPromptValue {
  user: User | null;
  /** True when there is no real account yet: signed out, or an anonymous guest session. */
  isGuest: boolean;
  /** true => caller has a real account. false => the sign-in modal was opened. */
  requireAccount: (feature?: string) => boolean;
  /** Opens the sign-in modal. `mode` picks the tab shown first (default: create account). */
  openSignIn: (feature?: string, mode?: 'signin' | 'create') => void;
}

const AuthPromptContext = createContext<AuthPromptValue | null>(null);

export function useAuthPrompt(): AuthPromptValue {
  const ctx = useContext(AuthPromptContext);
  if (!ctx) throw new Error('useAuthPrompt must be used inside <AuthPromptProvider>');
  return ctx;
}

export function AuthPromptProvider({ children }: { children: ReactNode }) {
  const t = useTranslation();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  // Linking a guest to an account mutates the SAME User object (isAnonymous flips
  // in place), so React would not notice — bump a counter on every auth event.
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<'signin' | 'create'>('create');

  useEffect(() => {
    const sync = (u: User | null) => {
      setUser(u);
      setTick((n) => n + 1);
    };
    const offState = onAuthStateChanged(auth, sync);
    const offToken = onIdTokenChanged(auth, sync);
    return () => {
      offState();
      offToken();
    };
  }, []);

  const hasAccount = !!user && !user.isAnonymous;

  const openSignIn = useCallback((f?: string, m: 'signin' | 'create' = 'create') => {
    setFeature(f);
    setMode(m);
    setOpen(true);
  }, []);

  const requireAccount = useCallback(
    (f?: string) => {
      const u = auth.currentUser;
      if (u && !u.isAnonymous) return true;
      openSignIn(f);
      return false;
    },
    [openSignIn]
  );

  // Server said "this needs an account" (any screen, any feature).
  useEffect(() => {
    const onRequired = () => openSignIn();
    window.addEventListener(ACCOUNT_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(ACCOUNT_REQUIRED_EVENT, onRequired);
  }, [openSignIn]);

  // Close the modal the moment the visitor has a real account.
  useEffect(() => {
    if (hasAccount) setOpen(false);
  }, [hasAccount]);

  const value = useMemo<AuthPromptValue>(
    () => ({ user, isGuest: !hasAccount, requireAccount, openSignIn }),
    [user, hasAccount, requireAccount, openSignIn]
  );

  return (
    <AuthPromptContext.Provider value={value}>
      {children}
      {open && !hasAccount && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#0a0a0a] border border-black/10 dark:border-white/10 p-6 max-h-[92vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-black dark:text-white mb-1">
              {feature ? format(t.authPrompt.featureTitle, feature) : t.authPrompt.guestTitle}
            </h2>
            <p className="text-sm text-black/50 dark:text-white/50 mb-5">{t.authPrompt.subtitle}</p>
            <AuthForm key={mode} initialMode={mode} onSuccess={() => setOpen(false)} />
            <button
              onClick={() => setOpen(false)}
              className="w-full mt-2 text-center text-xs text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
            >
              {t.authPrompt.notNow}
            </button>
          </div>
        </div>
      )}
    </AuthPromptContext.Provider>
  );
}

/** Header button (top-right, Adobe-style). Renders nothing once the visitor has an account. */
export function SignInButton({ className = '' }: { className?: string }) {
  const t = useTranslation();
  const { isGuest, openSignIn } = useAuthPrompt();
  if (!isGuest) return null;
  return (
    <button onClick={() => openSignIn(undefined, 'signin')} className={className}>
      {t.authPrompt.signInButton}
    </button>
  );
}

/** Shown in place of a page that needs an account (also covers direct links like /dashboard/notes). */
export function LoginRequired({ feature }: { feature: string }) {
  const t = useTranslation();
  const { openSignIn } = useAuthPrompt();
  return (
    <div className="p-4 md:p-8 flex items-center justify-center min-h-[50vh]">
      <div className="max-w-md w-full text-center rounded-3xl border border-gray-200 dark:border-white/10 p-8">
        <div className="text-3xl mb-3">🔒</div>
        <h3 className="text-lg font-bold mb-2">{t.authPrompt.lockedTitle}</h3>
        <p className="text-sm text-gray-500 dark:text-white/50 mb-6">{format(t.authPrompt.lockedBody, feature)}</p>
        <button
          onClick={() => openSignIn(feature)}
          className="px-6 py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-semibold"
        >
          {t.authPrompt.lockedCta}
        </button>
      </div>
    </div>
  );
}
