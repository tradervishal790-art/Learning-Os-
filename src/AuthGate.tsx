import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { onAuthChange, signInAsGuest } from './authStore';
import { loadSavedTheme } from './ThemeContext';
import { useTranslation } from './i18n/LanguageContext';
import AuthForm from './AuthForm';

// ============================================================
// AuthGate.tsx
//
// Wraps the app. Nobody is forced to sign up first:
//   - Landing page ("/") is public and renders immediately.
//   - /onboarding and /dashboard open for GUESTS: if nobody is signed in,
//     a guest (Firebase anonymous) session starts automatically. The features
//     that need a real account ask for sign-in themselves — see AuthPrompt.tsx
//     (client) and api/_lib/auth.ts (server, the real enforcement).
//   - Only if a guest session cannot start (e.g. the Anonymous provider is
//     switched off in the Firebase console) do we fall back to the old
//     full-page sign-in, so the app never ends up on a blank screen.
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
  // Firebase's auth check. Only /onboarding and /dashboard need a session.
  const isPublicRoute = location.pathname === '/';
  const [status, setStatus] = useState<'loading' | 'ready' | 'login'>('loading');
  const startingGuest = useRef(false);

  useEffect(() => {
    if (isPublicRoute) return;
    // Resolves WHO is signed in — nothing else. Per-section cloud hydration
    // happens when that section opens (see App.tsx, Roadmap.tsx, Revision.tsx, Test.tsx).
    const unsubscribe = onAuthChange((user) => {
      if (user) {
        setStatus('ready');
        return;
      }
      // Nobody signed in -> start a guest session (once; its own auth event flips us to 'ready').
      if (startingGuest.current) return;
      startingGuest.current = true;
      signInAsGuest()
        .catch((err) => {
          console.error('Guest sign-in failed — falling back to full sign-in:', err);
          setStatus('login');
        })
        .finally(() => {
          startingGuest.current = false;
        });
    });
    return unsubscribe;
  }, [isPublicRoute]);

  // Apply the device/saved theme to <html> immediately — ThemeProvider
  // (inside App) hasn't mounted yet at this point, so without this the
  // login screen would render before the dark/light class is set.
  useEffect(() => {
    const root = document.documentElement;
    if (loadSavedTheme() === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, []);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-black/60 dark:text-white/60 text-sm">
        Loading...
      </div>
    );
  }

  if (status === 'ready') {
    return <>{children}</>;
  }

  // status === 'login' — fallback full-page sign-in (guest session unavailable).
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="mb-1 flex items-baseline gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">Learning</h1>
          <h1 className="text-3xl font-bold tracking-[0.15em] uppercase text-black dark:text-white">OS</h1>
        </div>
        <p className="text-sm text-black/50 dark:text-white/50 mb-6">{t.authScreen.subtitleSignin}</p>
        <AuthForm />
      </div>
    </div>
  );
}
