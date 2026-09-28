import { useState } from 'react';
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import type { DashboardPageId } from './types';
import { verifySectionPassword } from './sectionPasswords';
import { isProtectedPage, unlockSection, useSectionUnlocked } from './sectionLock';

interface Props {
  page: DashboardPageId;
  children: ReactNode;
}

export default function SectionLockGate({ page, children }: Props) {
  const t = useTranslation();
  const unlocked = useSectionUnlocked(page);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isProtectedPage(page) || unlocked) return <>{children}</>;

  const submit = async () => {
    if (!password) {
      setError(t.sectionLock.enterPassword);
      return;
    }
    setBusy(true);
    setError('');
    let ok = false;
    try {
      ok = await verifySectionPassword(page, password);
    } catch {
      setError(t.sectionLock.checkFailed);
      setBusy(false);
      return;
    }
    setBusy(false);
    if (ok) {
      setPassword('');
      unlockSection(page);
    } else {
      setError(t.sectionLock.wrongPassword);
    }
  };

  return (
    <div className="flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
          <Lock className="w-5 h-5 text-gray-700 dark:text-white/80" />
        </div>
        <h2 className="text-lg font-semibold text-black dark:text-white">{t.sectionLock.title}</h2>
        <p className="mt-1 mb-5 text-sm text-gray-500 dark:text-white/50">{t.sectionLock.subtitle}</p>

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

        {error && <p className="mb-3 text-xs text-red-500 break-words">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
        >
          {busy ? t.sectionLock.checking : t.sectionLock.unlockCta}
        </button>
      </div>
    </div>
  );
}
