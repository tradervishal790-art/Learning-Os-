import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthChange,
  createProfileLockAccount as createAccount,
  signInProfileLock as signIn,
  signInWithGoogleProfileLock as signInWithGoogle,
  signOutOfApp,
} from './authStore';
import { loadSavedTheme } from './ThemeContext';
import { hydrateLearningProfileFromCloud } from './learningProfileStore';
import { hydrateGoalsFromCloud, getSavedGoals } from './goalsStore';
import { hydrateRoadmapDataFromCloud } from './roadmapData';
import { hydrateRevisionFromCloud } from './revisionstore';
import { hydrateActiveDaysFromCloud } from './Dashboard';

// ============================================================
// AuthGate.tsx
//
// Wraps the entire app. Nothing (landing page, onboarding, dashboard)
// renders until a user is signed in — each user has their OWN account
// (email+password or Google), so their data on this device is only
// reachable by them. Free on Firebase's Spark plan (see authStore.ts).
//
// This renders BEFORE ThemeProvider (see main.tsx), so it applies the
// same saved-theme-or-device-preference class to <html> itself on
// mount, then uses plain black/white + Tailwind `dark:` classes —
// light or dark depending on the device, never forced to one.
// ============================================================

export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | 'loading'>('loading');
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      if (u) {
        // CROSS-DEVICE SYNC: pull this account's cloud data down into
        // localStorage BEFORE letting <App> mount — App.tsx reads
        // localStorage synchronously in its useState initializers on
        // first render, so hydrating after that would be too late and
        // a new device would flash "no data" even though the cloud has
        // it. Order matters: goals must hydrate first, because the
        // roadmap hydration step needs to know which goal ids exist.
        // Every step is best-effort (never throws), so a slow/offline
        // network just means it resolves with nothing changed, not a
        // stuck loading screen.
        void (async () => {
          await hydrateLearningProfileFromCloud();
          await hydrateGoalsFromCloud();
          const goals = getSavedGoals();
          if (goals.length > 0) {
            await Promise.all(goals.map((g) => hydrateRoadmapDataFromCloud(g.id)));
          } else {
            await hydrateRoadmapDataFromCloud(undefined); // legacy single-roadmap users
          }
          await hydrateRevisionFromCloud();
          await hydrateActiveDaysFromCloud();
        })().finally(() => setUser(u));
      } else {
        setUser(u);
      }
    });
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

  if (user === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-black/60 dark:text-white/60 text-sm">
        Loading...
      </div>
    );
  }

  if (user) {
    return (
      <>
        {children}
        {/* Small always-available sign-out affordance, since this gate
            replaces the app's previous "no login" state entirely. */}
        <button
          onClick={() => signOutOfApp()}
          className="fixed bottom-4 right-4 z-50 text-xs px-3 py-1.5 rounded-full bg-white/70 dark:bg-black/70 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white border border-black/10 dark:border-white/10 backdrop-blur"
        >
          Sign out ({user.displayName || user.email})
        </button>
      </>
    );
  }

  const submit = async () => {
    if (!email || password.length < 6) {
      setError('Enter a valid email and a password with at least 6 characters.');
      return;
    }
    if (mode === 'create' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setBusy(true);
    setError('');
    const result = mode === 'create' ? await createAccount(email, password, name) : await signIn(email, password);
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  const google = async () => {
    setBusy(true);
    setError('');
    const result = await signInWithGoogle();
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
          {mode === 'create' ? 'Create a new account' : 'Sign in to your account'}
        </p>

        {mode === 'create' && (
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="Name"
            className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white text-sm mb-3 outline-none focus:border-black/30 dark:focus:border-white/30"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          placeholder="Email"
          className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white text-sm mb-3 outline-none focus:border-black/30 dark:focus:border-white/30"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          placeholder="Password"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white text-sm mb-3 outline-none focus:border-black/30 dark:focus:border-white/30"
        />

        {error && <p className="text-xs text-red-500 dark:text-red-400 mb-3">{error}</p>}

        <button
          disabled={busy}
          onClick={submit}
          className="w-full py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-semibold disabled:opacity-50 mb-3"
        >
          {busy ? '...' : mode === 'create' ? 'Create Account' : 'Sign In'}
        </button>

        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 h-px bg-black/10 dark:bg-white/10" />
          <span className="text-[10px] text-black/30 dark:text-white/30">OR</span>
          <div className="flex-1 h-px bg-black/10 dark:bg-white/10" />
        </div>

        <button
          disabled={busy}
          onClick={google}
          className="w-full py-3 rounded-xl border border-black/10 dark:border-white/10 text-black dark:text-white text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 mb-4"
        >
          Continue with Google
        </button>

        <button
          onClick={() => { setMode(mode === 'create' ? 'signin' : 'create'); setError(''); setName(''); }}
          className="w-full text-center text-xs text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
        >
          {mode === 'create' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </div>
    </div>
  );
}
