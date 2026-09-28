import { useState } from 'react';
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import { isGoogleAccount, reauthenticateProfileLock, reauthenticateProfileLockGoogle } from './authStore';
import { unlockSections, useSectionsUnlocked } from './sectionLock';

interface Props {
  /** When false the gate is transparent (Home, Test) and just renders children. */
  enabled: boolean;
  children: ReactNode;
}

export default function SectionLockGate({ enabled, children }: Props) {
  const t = useTranslation();
  const unlocked = useSectionsUnlocked();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!enabled || unlocked) return <>{children}</>;

  const google = isGoogleAccount();

  const submit = async () => {
    if (!google && !password) {
      setError(t.sectionLock.enterPassword);
      return;
    }
    setBusy(true);
    setError('');
    const result = google
      ? await reauthenticateProfileLockGoogle(t.authErrors)
      : await reauthenticateProfileLock(password, t.authErrors);
    setBusy(false);
    if (result.ok) {
      setPassword('');
      unlockSections();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
          <Lock className="w-5 h-5 text-gray-700 dark:text-white/80" />
        </div>
        <h2 className="text-lg font-semibold text-black dark:text-white">{t.sectionLock.title}</h2>
        <p className="mt-1 mb-5 text-sm text-gray-500 dark:text-white/50">
          {google ? t.sectionLock.subtitleGoogle : t.sectionLock.subtitle}
        </p>

        {!google && (
          <input
            type="password"
            value={password}
            autoFocus
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy) submit();
            }}
            placeholder={t.sectionLock.passwordPlaceholder}
            className="w-full mb-3 px-4 py-2.5 rounded-xl text-sm bg-transparent border border-gray-300 dark:border-white/15 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none focus:border-black dark:focus:border-white/50"
          />
        )}

        {error && <p className="mb-3 text-xs text-red-500 break-words">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
        >
          {busy ? t.sectionLock.checking : google ? t.sectionLock.googleCta : t.sectionLock.unlockCta}
        </button>
      </div>
    </div>
  );
}
