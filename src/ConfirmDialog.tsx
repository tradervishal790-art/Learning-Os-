import { useEffect } from 'react';

/** A small in-app "are you sure?" box (works with touch; replaces the browser's confirm()). */
export default function ConfirmDialog({
  message, confirmLabel, cancelLabel, danger = false, onConfirm, onCancel,
}: {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const btn = 'px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10';
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-label={message}
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm leading-relaxed mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onCancel}>{cancelLabel}</button>
          <button
            autoFocus
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium border-transparent ${
              danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white hover:opacity-80'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
