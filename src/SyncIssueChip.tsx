import { useState } from 'react';
import { CloudOff, Loader2 } from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import { retryFailedSyncs } from './cloudSync';
import { useFailedSyncCount } from './syncStatus';

/** Small global notice: some changes are saved on this device only, because the cloud write failed. Hidden when everything is synced. */
export default function SyncIssueChip() {
  const t = useTranslation().notebook.polish;
  const count = useFailedSyncCount();
  const [busy, setBusy] = useState(false);
  if (count === 0) return null;
  return (
    <div
      role="status"
      className="fixed left-3 bottom-20 md:bottom-4 z-40 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 shadow dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-100"
    >
      <CloudOff size={14} className="shrink-0" aria-hidden />
      <span>{t.syncIssueMsg}</span>
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void retryFailedSyncs().finally(() => setBusy(false));
        }}
        className="inline-flex items-center gap-1 font-medium underline disabled:opacity-60"
      >
        {busy && <Loader2 size={12} className="animate-spin" aria-hidden />}
        {t.syncIssueRetry}
      </button>
    </div>
  );
}
