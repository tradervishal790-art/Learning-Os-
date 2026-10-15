import { useTranslation } from './i18n/LanguageContext';

export interface OcrState {
  status: 'loading' | 'ready' | 'error';
  text: string;
  confidence: 'high' | 'medium' | 'low';
}

/** Preview of "handwriting -> text". Nothing is inserted or removed until the student chooses. */
export default function InkOcrDialog({
  state, onText, onInsert, onClose,
}: {
  state: OcrState;
  onText: (v: string) => void;
  onInsert: (removeInk: boolean) => void;
  onClose: () => void;
}) {
  const t = useTranslation().notebook.ink;
  const btn = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10';
  const primary = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-black text-white dark:bg-white dark:text-black hover:opacity-80 disabled:opacity-30';
  const empty = state.status === 'ready' && !state.text.trim();
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t.ocrTitle}
      >
        <div className="font-semibold mb-3">{t.ocrTitle}</div>
        {state.status === 'loading' && <p className="text-sm text-gray-500 dark:text-white/60 py-6 text-center">{t.ocrLoading}</p>}
        {state.status === 'error' && <p className="text-sm text-red-600 dark:text-red-400 py-4">{t.ocrError}</p>}
        {empty && <p className="text-sm text-gray-500 dark:text-white/60 py-4">{t.ocrEmpty}</p>}
        {state.status === 'ready' && !empty && (
          <>
            {state.confidence !== 'high' && <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">{t.ocrLowConf}</p>}
            <p className="text-xs text-gray-400 dark:text-white/40 mb-1">{t.ocrEdit}</p>
            <textarea
              value={state.text}
              onChange={(e) => onText(e.target.value)}
              className="w-full min-h-[10rem] p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-sm leading-relaxed"
            />
          </>
        )}
        <div className="flex flex-wrap justify-end gap-2 mt-4">
          <button className={btn} onClick={onClose}>{t.ocrCancel}</button>
          {state.status === 'ready' && !empty && (
            <>
              <button className={btn} onClick={() => onInsert(true)}>{t.ocrInsertDelete}</button>
              <button className={primary} onClick={() => onInsert(false)}>{t.ocrInsert}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
