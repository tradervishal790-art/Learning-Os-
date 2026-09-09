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

// ============================================================
// AuthGate.tsx
//
// Wraps the entire app. Nothing (landing page, onboarding, dashboard)
// renders until a user is signed in — each user has their OWN account
// (email+password or Google), so their data on this device is only
// reachable by them. Free on Firebase's Spark plan (see authStore.ts).
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
    const unsubscribe = onAuthChange((u) => setUser(u));
    return unsubscribe;
  }, []);

  if (user === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white/60 text-sm">
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
          className="fixed bottom-4 right-4 z-50 text-xs px-3 py-1.5 rounded-full bg-black/70 text-white/70 hover:text-white border border-white/10 backdrop-blur"
        >
          Sign out ({user.displayName || user.email})
        </button>
      </>
    );
  }

  const submit = async () => {
    if (!email || password.length < 6) {
      setError('Sahi email aur kam se kam 6-character password daalo.');
      return;
    }
    if (mode === 'create' && !name.trim()) {
      setError('Apna naam daalo.');
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
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="mb-1 flex items-baseline gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Learning
          </h1>
          <h1 className="text-3xl font-bold tracking-[0.15em] uppercase text-white">
            OS
          </h1>
        </div>
        <p className="text-sm text-white/50 mb-6">
          {mode === 'create' ? 'Naya account banao' : 'Apne account se sign in karo'}
        </p>

        {mode === 'create' && (
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="Naam"
            className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm mb-3 outline-none focus:border-white/30"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          placeholder="Email"
          className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm mb-3 outline-none focus:border-white/30"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          placeholder="Password"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm mb-3 outline-none focus:border-white/30"
        />

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <button
          disabled={busy}
          onClick={submit}
          className="w-full py-3 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-50 mb-3"
        >
          {busy ? '...' : mode === 'create' ? 'Create Account' : 'Sign In'}
        </button>

        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] text-white/30">OR</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <button
          disabled={busy}
          onClick={google}
          className="w-full py-3 rounded-xl border border-white/10 text-white text-sm font-medium hover:bg-white/5 mb-4"
        >
          Continue with Google
        </button>

        <button
          onClick={() => { setMode(mode === 'create' ? 'signin' : 'create'); setError(''); setName(''); }}
          className="w-full text-center text-xs text-white/40 hover:text-white/70"
        >
          {mode === 'create' ? 'Pehle se account hai? Sign in karo' : 'Naya user ho? Account banao'}
        </button>
      </div>
    </div>
  );
}
