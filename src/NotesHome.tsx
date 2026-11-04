import { lazy, Suspense, useState } from 'react';
import { useTranslation } from './i18n/LanguageContext';
import { useNoteOpen } from './immersive';

// Dashboard's Notes tab: the student's own notebook (default) and the
// existing AI-generated Deep Notes, side by side. Notes.tsx is untouched.
const Notes = lazy(() => import('./Notes'));
const NoteLibrary = lazy(() => import('./NoteLibrary'));

const SWITCH_KEY = 'learning_os_notes_tab';

export default function NotesHome() {
  const t = useTranslation().notebook;
  const noteOpen = useNoteOpen();
  const [tab, setTab] = useState<'notebook' | 'ai'>(() =>
    localStorage.getItem(SWITCH_KEY) === 'ai' ? 'ai' : 'notebook'
  );
  const choose = (next: 'notebook' | 'ai') => {
    setTab(next);
    try {
      localStorage.setItem(SWITCH_KEY, next);
    } catch {
      // not critical
    }
  };
  const pill = (active: boolean) =>
    `h-9 rounded-full px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
      active
        ? 'bg-violet-500 text-white shadow-[0_0_18px_rgba(139,92,246,.45)]'
        : 'text-slate-300 hover:bg-white/10 hover:text-white'
    }`;

  // The library and AI notes sit on a dark glowing stage. While a note is open the stage is switched
  // off (same elements, only the classes change), because the editor draws its own paper colour and
  // the ink layer reads the app theme directly.
  return (
    <div className={noteOpen ? '' : 'dark'}>
      <div className={noteOpen ? '' : 'relative min-h-[calc(100dvh-64px)] overflow-hidden bg-[#080d19] text-slate-100'}>
        {!noteOpen && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-violet-600/[0.12] blur-[120px]" />
            <div className="absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />
          </div>
        )}
        <div className="relative">
          {!noteOpen && (
            <div className="mb-4 px-4 pt-4 md:mb-6 md:px-8 md:pt-8">
              <div role="tablist" className="inline-flex gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
                <button role="tab" aria-selected={tab === 'notebook'} className={pill(tab === 'notebook')} onClick={() => choose('notebook')}>{t.tabNotebook}</button>
                <button role="tab" aria-selected={tab === 'ai'} className={pill(tab === 'ai')} onClick={() => choose('ai')}>{t.tabAi}</button>
              </div>
            </div>
          )}
          <Suspense fallback={<div role="status" aria-live="polite" className="mx-4 rounded-xl border border-white/10 px-4 py-5 text-sm text-slate-400 md:mx-8">{t.loading}</div>}>
            {tab === 'notebook' ? (
              <div className={noteOpen ? 'px-2 pb-2 md:px-8 md:pb-8' : 'px-4 pb-4 md:px-8 md:pb-8'}>
                <NoteLibrary />
              </div>
            ) : (
              <Notes />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
