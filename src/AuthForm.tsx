import { useState } from 'react';
import {
  createProfileLockAccount as createAccount,
  signInProfileLock as signIn,
  signInWithGoogleProfileLock as signInWithGoogle,
} from './authStore';
import { useTranslation } from './i18n/LanguageContext';

// ============================================================
// AuthForm.tsx
//
// The email/password + Google sign-in form, shared by:
//   - the sign-in modal (AuthPrompt.tsx) that guests see when they reach a
//     feature that needs an account, and
//   - the full-page fallback in AuthGate.tsx (used only if a guest session
//     cannot be started, e.g. the Anonymous provider is off in Firebase).
// When the visitor is currently a guest, the auth functions UPGRADE that
// guest (same uid) instead of creating a second user — see authStore.ts.
// ============================================================

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white text-sm mb-3 outline-none focus:border-black/30 dark:focus:border-white/30';

export default function AuthForm({ onSuccess, initialMode = 'signin' }: { onSuccess?: () => void; initialMode?: 'signin' | 'create' }) {
  const t = useTranslation();
  const [mode, setMode] = useState<'signin' | 'create'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    else onSuccess?.();
  };

  const google = async () => {
    setBusy(true);
    setError('');
    const result = await signInWithGoogle(t.authErrors);
    setBusy(false);
    if (!result.ok) {
      console.error('Google sign-in failed:', result.error);
      setError(result.error);
    } else {
      onSuccess?.();
    }
  };

  return (
    <div className="w-full">
      {mode === 'create' && (
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          placeholder={t.authScreen.namePlaceholder}
          className={inputClass}
        />
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setError(''); }}
        placeholder={t.authScreen.emailPlaceholder}
        className={inputClass}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError(''); }}
        placeholder={t.authScreen.passwordPlaceholder}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className={inputClass}
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
  );
}
