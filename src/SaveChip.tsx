import { Check, CloudOff, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import { useSaveStatus, retrySync } from './notebookStore';

/** "Saving… / Saved / Offline" indicator. Only claims what is actually true. */
export function SaveChip() {
  const t = useTranslation().notebook;
  const status = useSaveStatus();
  const base = 'inline-flex items-center gap-1.5 text-xs';
  if (status === 'saving')
    return (
      <span className={`${base} text-gray-500 dark:text-white/60`}>
        <Loader2 size={13} className="animate-spin" /> {t.saving}
      </span>
    );
  if (status === 'saved')
    return (
      <span className={`${base} text-gray-500 dark:text-white/60`}>
        <Check size={13} /> {t.saved}
      </span>
    );
  if (status === 'error')
    return (
      <span className={`${base} text-red-600 dark:text-red-400`}>
        <AlertTriangle size={13} /> {t.saveError}
      </span>
    );
  return (
    <span className={`${base} text-amber-600 dark:text-amber-400`}>
      <CloudOff size={13} /> {status === 'offline' ? t.offline : t.savedLocal}
      <button onClick={() => void retrySync()} className="underline ml-1">
        {t.syncNow}
      </button>
    </span>
  );
}
