import { useEffect } from 'react';

/** "Save or discard?" box shown when the student leaves a note that has changes they did not save. */
export default function UnsavedDialog({
  message, saveLabel, discardLabel, keepLabel, busy = false, onSave, onDiscard, onKeep,
}: {
  message: string;
  saveLabel: string;
  discardLabel: string;
  keepLabel: string;
  busy?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onKeep: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onKeep();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKeep]);

  const btn = 'px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50';
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onKeep}>
      <div
        role="alertdialog"
        aria-label={message}
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm leading-relaxed mb-5">{message}</p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button className={btn} disabled={busy} onClick={onKeep}>{keepLabel}</button>
          <button className={`${btn} text-red-600 dark:text-red-400`} disabled={busy} onClick={onDiscard}>{discardLabel}</button>
          <button
            autoFocus
            disabled={busy}
            onClick={onSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white dark:bg-indigo-500 hover:opacity-80 disabled:opacity-50"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
