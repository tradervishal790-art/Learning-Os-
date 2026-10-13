import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import { loadNoteContent, saveNoteContent, getIndex, type NotePage } from './notebookStore';
import { SaveChip } from './SaveChip';

// ============================================================
// NoteEditor.tsx — Part 1 PLACEHOLDER editor.
// Plain title + plain-text pages, wired to real autosave so the whole
// notebook base (save, recover, sync) can be used and tested now.
// Part 2 swaps the textarea for the rich text editor; Part 3 adds the
// handwriting canvas on top of each page. The save plumbing stays.
// ============================================================

const AUTOSAVE_MS = 700;

export default function NoteEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useTranslation().notebook;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [title, setTitle] = useState('');
  const [pages, setPages] = useState<NotePage[]>([]);

  // Latest values for the unmount / pagehide flush (state would be stale there).
  const latest = useRef({ title: '', pages: [] as NotePage[] });
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      const content = await loadNoteContent(id);
      if (!alive) return;
      const meta = getIndex().notes.find((n) => n.id === id);
      if (!content || !meta) {
        setFailed(true);
        return;
      }
      latest.current = { title: meta.title, pages: content.pages };
      setTitle(meta.title);
      setPages(content.pages);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const flush = () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    void saveNoteContent(id, latest.current.title, latest.current.pages);
  };

  // Save whatever is pending when the student leaves the note or hides the tab.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const change = (nextTitle: string, nextPages: NotePage[]) => {
    latest.current = { title: nextTitle, pages: nextPages };
    dirty.current = true;
    setTitle(nextTitle);
    setPages(nextPages);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_MS);
  };

  const addPage = () => change(title, [...pages, { id: `pg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: '' }]);

  if (failed) {
    return (
      <div className="py-10 text-center text-sm text-gray-500 dark:text-white/60">
        <p className="mb-3">{t.editor.loadError}</p>
        <button onClick={onBack} className="underline">{t.editor.back}</button>
      </div>
    );
  }
  if (!ready) return null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white"
        >
          <ArrowLeft size={16} /> {t.editor.back}
        </button>
        <SaveChip />
      </div>

      <input
        value={title}
        onChange={(e) => change(e.target.value, pages)}
        placeholder={t.editor.titlePlaceholder}
        className="w-full bg-transparent text-2xl font-bold mb-4 outline-none placeholder:text-gray-300 dark:placeholder:text-white/30"
      />

      {pages.map((p, i) => (
        <div key={p.id} className="mb-4">
          {pages.length > 1 && (
            <div className="text-xs text-gray-400 dark:text-white/40 mb-1">
              {t.editor.pageLabel} {i + 1}
            </div>
          )}
          <textarea
            value={p.text}
            onChange={(e) => change(title, pages.map((x) => (x.id === p.id ? { ...x, text: e.target.value } : x)))}
            placeholder={i === 0 ? t.editor.bodyPlaceholder : ''}
            className="w-full min-h-[40vh] p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm leading-relaxed outline-none focus:border-gray-400 dark:focus:border-white/30 resize-y"
          />
        </div>
      ))}

      <button
        onClick={addPage}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10"
      >
        <Plus size={14} /> {t.editor.addPage}
      </button>
    </div>
  );
}
