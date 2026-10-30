import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { registerDialogHost, type DialogReq } from './dialogApi';
import { useLanguage } from './i18n/LanguageContext';

// appDialogs.tsx — draws the in-app confirm / prompt / notice boxes asked for through dialogApi.ts.

const LABELS = {
  en: { ok: 'OK', cancel: 'Cancel' },
  hi: { ok: 'ठीक है', cancel: 'रद्द करें' },
  hinglish: { ok: 'OK', cancel: 'Cancel' },
} as const;

const LAYER = 'z-[90]'; // above every note dialog / toast

function TextBox({ message, initial, okLabel, cancelLabel, onDone }: {
  message: string; initial: string; okLabel: string; cancelLabel: string; onDone: (v: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const btn = 'px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10';
  return (
    <div className={`fixed inset-0 ${LAYER} bg-black/40 flex items-center justify-center p-4`} onClick={() => onDone(null)}>
      <div
        role="dialog"
        aria-label={message}
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onDone(null);
        }}
      >
        <label className="block text-sm leading-relaxed mb-3">{message}
          <input
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) onDone(value);
            }}
            className="mt-2 w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-sm"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={() => onDone(null)}>{cancelLabel}</button>
          <button onClick={() => onDone(value)} className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white dark:bg-indigo-500 hover:opacity-80">{okLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function AppDialogHost() {
  const { locale } = useLanguage();
  const L = LABELS[locale] ?? LABELS.en;
  const [queue, setQueue] = useState<DialogReq[]>([]);

  useEffect(() => {
    registerDialogHost((r) => setQueue((q) => [...q, r]));
    return () => registerDialogHost(null);
  }, []);

  const current = queue[0];
  const finish = useCallback(() => setQueue((q) => q.slice(1)), []);

  if (!current) return null;
  if (current.kind === 'confirm') {
    return (
      <ConfirmDialog
        layer={LAYER}
        danger={current.danger}
        message={current.message}
        confirmLabel={current.confirmLabel ?? L.ok}
        cancelLabel={L.cancel}
        onConfirm={() => { current.resolve(true); finish(); }}
        onCancel={() => { current.resolve(false); finish(); }}
      />
    );
  }
  if (current.kind === 'notice') {
    const done = () => { current.resolve(); finish(); };
    return (
      <ConfirmDialog layer={LAYER} message={current.message} confirmLabel={L.ok} cancelLabel={L.cancel} onConfirm={done} onCancel={done} />
    );
  }
  return (
    <TextBox
      key={queue.length + current.message}
      message={current.message}
      initial={current.initial}
      okLabel={L.ok}
      cancelLabel={L.cancel}
      onDone={(v) => { current.resolve(v); finish(); }}
    />
  );
}
