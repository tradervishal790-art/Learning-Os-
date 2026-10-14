import { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ArrowLeft, Minimize2, Plus } from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { loadNoteContent, saveNoteContent, getIndex, type InkStroke, type NotePage } from './notebookStore';
import { useInkPrefs, type InkMode } from './inkPrefs';
import InkToolbar, { ModeSwitch } from './InkToolbar';
import { SaveChip } from './SaveChip';
import PageEditor from './PageEditor';
import EditorToolbar from './EditorToolbar';

// ============================================================
// NoteEditor.tsx — title + pages (rich text from Part 2, handwriting from
// Part 3) with autosave. Ink history (undo/redo) lives here, per page.
// ============================================================

const AUTOSAVE_MS = 700;
const newPageId = () => `pg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function NoteEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useTranslation().notebook;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [title, setTitle] = useState('');
  const [pages, setPages] = useState<NotePage[]>([]);
  const [active, setActive] = useState<Editor | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [focusNew, setFocusNew] = useState<string | null>(null);
  const [mode, setMode] = useState<InkMode>('type');
  const [prefs, setPrefs, resetPrefs] = useInkPrefs();
  const [activePage, setActivePage] = useState<string | null>(null);
  // Handwriting per page. The ref is the source of truth so two quick strokes never read stale data.
  const [ink, setInk] = useState<Record<string, InkStroke[]>>({});
  const inkRef = useRef<Record<string, InkStroke[]>>({});
  const hist = useRef<Record<string, { undo: InkStroke[][]; redo: InkStroke[][] }>>({});

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
      const initial: Record<string, InkStroke[]> = {};
      content.pages.forEach((p) => (initial[p.id] = p.ink ?? []));
      inkRef.current = initial;
      setInk(initial);
      setActivePage(content.pages[0]?.id ?? null);
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
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const commit = (nextTitle: string, nextPages: NotePage[]) => {
    latest.current = { title: nextTitle, pages: nextPages };
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_MS);
  };

  const changeTitle = (v: string) => {
    setTitle(v);
    commit(v, latest.current.pages);
  };

  // The editor owns the live document; we only mirror html + text for saving.
  // (No setPages here — re-rendering on every keystroke would be wasted work.)
  const changePage = (pageId: string, html: string, text: string) => {
    commit(
      latest.current.title,
      latest.current.pages.map((p) => (p.id === pageId ? { ...p, html, text } : p))
    );
    setStats((s) => ({ ...s, [pageId]: text }));
  };

  // ---------- handwriting ----------

  const applyInk = (pageId: string, next: InkStroke[]) => {
    inkRef.current = { ...inkRef.current, [pageId]: next };
    setInk(inkRef.current);
    commit(
      latest.current.title,
      latest.current.pages.map((p) => (p.id === pageId ? { ...p, ink: next } : p))
    );
  };

  /** A finished stroke / erase: remember the previous state so it can be undone. */
  const commitInk = (pageId: string, next: InkStroke[]) => {
    const h = (hist.current[pageId] ??= { undo: [], redo: [] });
    h.undo.push(inkRef.current[pageId] ?? []);
    if (h.undo.length > 60) h.undo.shift();
    h.redo = [];
    applyInk(pageId, next);
  };

  const undoInk = () => {
    const h = activePage ? hist.current[activePage] : undefined;
    if (!activePage || !h || h.undo.length === 0) return;
    h.redo.push(inkRef.current[activePage] ?? []);
    applyInk(activePage, h.undo.pop() as InkStroke[]);
  };

  const redoInk = () => {
    const h = activePage ? hist.current[activePage] : undefined;
    if (!activePage || !h || h.redo.length === 0) return;
    h.undo.push(inkRef.current[activePage] ?? []);
    applyInk(activePage, h.redo.pop() as InkStroke[]);
  };

  const eraseWholePage = () => {
    if (!activePage || (inkRef.current[activePage] ?? []).length === 0) return;
    if (window.confirm(t.ink.eraseAllConfirm)) commitInk(activePage, []);
  };

  const chooseMode = (m: InkMode) => {
    if (m !== 'type') active?.commands.blur();
    setMode(m);
  };

  // Ctrl/Cmd+Z in a pen mode undoes the drawing (in Type mode the text editor handles it).
  useEffect(() => {
    if (mode === 'type') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoInk();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redoInk();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const addPage = () => {
    const page: NotePage = { id: newPageId(), text: '', html: '<p></p>' };
    const next = [...latest.current.pages, page];
    commit(latest.current.title, next);
    inkRef.current = { ...inkRef.current, [page.id]: [] };
    setInk(inkRef.current);
    setPages(next);
    setFocusNew(page.id);
  };

  // Word/character counts across all pages, kept in a cheap side map.
  const [stats, setStats] = useState<Record<string, string>>({});
  const totals = useMemo(() => {
    const text = pages.map((p) => stats[p.id] ?? p.text).join('\n');
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { words, chars: text.replace(/\s/g, '').length, minutes: Math.max(1, Math.ceil(words / 200)) };
  }, [pages, stats]);

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
      {focusMode ? (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setFocusMode(false)}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/60 hover:text-black dark:hover:text-white"
          >
            <Minimize2 size={14} /> {t.editor.exitFocus}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white"
          >
            <ArrowLeft size={16} /> {t.editor.back}
          </button>
          <SaveChip />
        </div>
      )}

      {!focusMode && (
        <div className="sticky top-0 z-40 -mx-1 px-1 py-2 bg-white/95 dark:bg-black/95 backdrop-blur border-b border-gray-200 dark:border-white/10 mb-4">
          <ModeSwitch mode={mode} onMode={chooseMode} />
          {mode === 'type' ? (
            <EditorToolbar editor={active} onFocusMode={() => setFocusMode(true)} />
          ) : (
            <InkToolbar
              mode={mode}
              prefs={prefs}
              setPrefs={setPrefs}
              resetPrefs={resetPrefs}
              canUndo={(hist.current[activePage ?? '']?.undo.length ?? 0) > 0}
              canRedo={(hist.current[activePage ?? '']?.redo.length ?? 0) > 0}
              onUndo={undoInk}
              onRedo={redoInk}
              onEraseAll={eraseWholePage}
            />
          )}
        </div>
      )}

      <input
        value={title}
        onChange={(e) => changeTitle(e.target.value)}
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
          <PageEditor
            page={p}
            strokes={ink[p.id] ?? []}
            placeholder={i === 0 ? t.editor.bodyPlaceholder : ''}
            autoFocus={focusNew === p.id}
            primary={i === 0}
            mode={mode}
            prefs={prefs}
            onChange={changePage}
            onActive={(ed, pageId) => {
              setActive(ed);
              setActivePage(pageId);
            }}
            onInk={commitInk}
          />
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={addPage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10"
        >
          <Plus size={14} /> {t.editor.addPage}
        </button>
        <div className="text-xs text-gray-400 dark:text-white/40 flex gap-3">
          <span>{format(t.editor.words, totals.words)}</span>
          <span>{format(t.editor.chars, totals.chars)}</span>
          <span>{format(t.editor.readTime, totals.minutes)}</span>
        </div>
      </div>
    </div>
  );
}
