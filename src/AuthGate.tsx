import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { User } from 'firebase/auth';
import {
  onAuthChange,
  createProfileLockAccount as createAccount,
  signInProfileLock as signIn,
  signInWithGoogleProfileLock as signInWithGoogle,
} from './authStore';
import { loadSavedTheme } from './ThemeContext';
import { useTranslation } from './i18n/LanguageContext';

// ============================================================
// AuthGate.tsx
//
// Wraps the entire app. Landing page ("/") is public and always renders
// immediately. /onboarding and /dashboard are gated — nothing on those
// routes renders until a user is signed in — each user has their OWN
// account (email+password or Google), so their data on this device is
// only reachable by them. Free on Firebase's Spark plan (see authStore.ts).
//
// This renders BEFORE ThemeProvider (see main.tsx), so it applies the
// same saved-theme-or-device-preference class to <html> itself on
// mount, then uses plain black/white + Tailwind `dark:` classes —
// light or dark depending on the device, never forced to one.
// ============================================================

export default function AuthGate({ children }: { children: ReactNode }) {
  const t = useTranslation();
  const location = useLocation();
  // Landing page ("/") is public marketing content — it must render
  // instantly for every visitor (new or returning) without waiting on
  // Firebase's auth check or any cloud hydration. Only /onboarding and
  // /dashboard actually need a signed-in user and their synced data, so
  // only those routes go through the loading/sign-in gate below.
  const isPublicRoute = location.pathname === '/';
  const [user, setUser] = useState<User | null | 'loading'>('loading');
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Just resolve WHO is signed in — nothing else. This used to also pull
    // every store's cloud data down in one big sequential chain before
    // letting <App> mount, which meant even a returning user sat on a
    // "Loading..." screen until all of it finished. Cloud hydration now
    // happens per-section, only when that section is actually opened (see
    // App.tsx for goals/profile/active-days, and Roadmap.tsx, Revision.tsx,
    // Test.tsx for their own goal/topic-specific data) — so a device only
    // ever fetches what the user is about to look at, not everything at once.
    const unsubscribe = onAuthChange((u) => setUser(u));
    return unsubscribe;
  }, []);

  // Apply the device/saved theme to <html> immediately — ThemeProvider
  // (inside App) hasn't mounted yet at this point, so without this the
  // login screen would render before the dark/light class is set.
  useEffect(() => {
    const root = document.documentElement;
    if (loadSavedTheme() === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, []);

  // Landing page renders immediately, no matter what `user` currently is —
  // the onAuthChange listener above still runs in the background, so by
  // the time the visitor clicks through to /onboarding or /dashboard, the
  // auth state (and, for a returning user, their hydrated cloud data) is
  // usually already resolved and that route won't need to wait either.
  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (user === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-black/60 dark:text-white/60 text-sm">
        Loading...
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  const submit = async () => {
    if (!email || password.length < 6) {
      setError(t.authScreen.validationEmailPassword);
      return;
    }
    if (mode === 'create' && !name.trim()) {
      setError(t.authScreen.validationName);
      return;
    }
    setBusy(true);
    setError('');
    const result = mode === 'create' ? await createAccount(email, password, name, t.authErrors) : await signIn(email, password, t.authErrors);
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  const google = async () => {
    setBusy(true);
    setError('');
    const result = await signInWithGoogle(t.authErrors);
    setBusy(false);
    if (!result.ok) {
      console.error('Google sign-in failed:', result.error);
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="mb-1 flex items-baseline gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">
            Learning
          </h1>
          <h1 className="text-3xl font-bold tracking-[0.15em] uppercase text-black dark:text-white">
            OS
          </h1>
        </div>
        <p className="text-sm text-black/50 dark:text-white/50 mb-6">
          {mode === 'create' ? t.authScreen.subtitleCreate : t.authScreen.subtitleSignin}
        </p>

        {mode === 'create' && (
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder={t.authScreen.namePlaceholder}
            className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white text-sm mb-3 outline-none focus:border-black/30 dark:focus:border-white/30"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          placeholder={t.authScreen.emailPlaceholder}
          className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white text-sm mb-3 outline-none focus:border-black/30 dark:focus:border-white/30"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          placeholder={t.authScreen.passwordPlaceholder}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white text-sm mb-3 outline-none focus:border-black/30 dark:focus:border-white/30"
        />

        {error && <p className="text-xs text-red-500 dark:text-red-400 mb-3">{error}</p>}

        <button
          disabled={busy}
          onClick={submit}
          className="w-full py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-semibold disabled:opacity-50 mb-3"
        >
          {busy ? '...' : mode === 'create' ? t.authScreen.createAccountCta : t.authScreen.signInCta}
        </button>

        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 h-px bg-black/10 dark:bg-white/10" />
          <span className="text-[10px] text-black/30 dark:text-white/30">{t.authScreen.orDivider}</span>
          <div className="flex-1 h-px bg-black/10 dark:bg-white/10" />
        </div>

        <button
          disabled={busy}
          onClick={google}
          className="w-full py-3 rounded-xl border border-black/10 dark:border-white/10 text-black dark:text-white text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 mb-4"
        >
          {t.authScreen.googleCta}
        </button>

        <button
          onClick={() => { setMode(mode === 'create' ? 'signin' : 'create'); setError(''); setName(''); }}
          className="w-full text-center text-xs text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
        >
          {mode === 'create' ? t.authScreen.switchToSignin : t.authScreen.switchToCreate}
        </button>
      </div>
    </div>
  );
}
