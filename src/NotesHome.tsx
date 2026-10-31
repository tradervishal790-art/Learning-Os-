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
    `h-10 px-4 rounded-full text-sm font-medium transition-all ${
      active
        ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white'
        : 'card text-gray-600 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/10'
    }`;

  return (
    <div>
      {!noteOpen && (
      <div className="flex gap-2 mb-4 md:mb-6 px-4 pt-4 md:px-8 md:pt-8">
        <button className={pill(tab === 'notebook')} onClick={() => choose('notebook')}>{t.tabNotebook}</button>
        <button className={pill(tab === 'ai')} onClick={() => choose('ai')}>{t.tabAi}</button>
      </div>
      )}
      <Suspense fallback={<div role="status" aria-live="polite" className="mx-4 rounded-xl border border-gray-200 px-4 py-5 text-sm text-gray-500 dark:border-white/10 dark:text-white/50 md:mx-8">Opening your learning workspace…</div>}>
        {tab === 'notebook' ? (
          <div className={noteOpen ? "px-2 pb-2 md:px-8 md:pb-8" : "px-4 pb-4 md:px-8 md:pb-8"}>
            <NoteLibrary />
          </div>
        ) : (
          <Notes />
        )}
      </Suspense>
    </div>
  );
}
