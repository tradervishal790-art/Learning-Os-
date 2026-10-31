import { useEffect } from 'react';

/** A small in-app confirmation dialog that works consistently on touch devices. */
export default function ConfirmDialog({
  message, confirmLabel, cancelLabel, danger = false, layer = 'z-50', onConfirm, onCancel,
}: {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  layer?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className={`fixed inset-0 ${layer} bg-black/45 backdrop-blur-[3px] flex items-center justify-center p-4`} onClick={onCancel}>
      <div
        role="alertdialog"
        aria-label={message}
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-white/10 p-5 shadow-2xl shadow-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm leading-relaxed text-gray-800 dark:text-white/85 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="los-btn los-btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={`los-btn ${danger ? 'los-btn-danger' : 'los-btn-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
