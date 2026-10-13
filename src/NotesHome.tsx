import { lazy, Suspense, useState } from 'react';
import { useTranslation } from './i18n/LanguageContext';

// Dashboard's Notes tab: the student's own notebook (default) and the
// existing AI-generated Deep Notes, side by side. Notes.tsx is untouched.
const Notes = lazy(() => import('./Notes'));
const NoteLibrary = lazy(() => import('./NoteLibrary'));

const SWITCH_KEY = 'learning_os_notes_tab';

export default function NotesHome() {
  const t = useTranslation().notebook;
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
    `px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
      active
        ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
        : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10'
    }`;

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button className={pill(tab === 'notebook')} onClick={() => choose('notebook')}>{t.tabNotebook}</button>
        <button className={pill(tab === 'ai')} onClick={() => choose('ai')}>{t.tabAi}</button>
      </div>
      <Suspense fallback={null}>{tab === 'notebook' ? <NoteLibrary /> : <Notes />}</Suspense>
    </div>
  );
}
