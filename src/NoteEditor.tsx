import { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ArrowLeft, Minimize2, Plus } from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { loadNoteContent, saveNoteContent, getIndex, type InkStroke, type NotePage } from './notebookStore';
import { useInkPrefs, type InkMode } from './inkPrefs';
import InkToolbar, { ModeSwitch } from './InkToolbar';
import InkOcrDialog, { type OcrState } from './InkOcrDialog';
import { recognizeHandwriting } from './inkOcrApi';
import { getClipboard, nextPasteOffset, setClipboard, useClipboardCount } from './inkClipboard';
import {
  cloneStrokes, deleteSelected, neatenSelected, pickStrokes, recolorSelected, renderStrokesPng, reorderSelected, rewidthSelected,
} from './inkEdit';
import { SaveChip } from './SaveChip';
import PageEditor from './PageEditor';
import EditorToolbar from './EditorToolbar';

// ============================================================
// NoteEditor.tsx — title + pages (rich text from Part 2, handwriting from
// Part 3) with autosave. Ink history (undo/redo) lives here, per page.
// ============================================================

const AUTOSAVE_MS = 700;
const OCR_OK_KEY = 'learning_os_ink_ocr_ok';
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
  const editors = useRef<Record<string, Editor>>({});
  const [selection, setSelection] = useState<{ pageId: string; ids: string[] } | null>(null);
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [ocr, setOcr] = useState<(OcrState & { pageId: string; ids: string[] }) | null>(null);
  const ocrToken = useRef(0);
  const clipCount = useClipboardCount();

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

  // ---------- selecting & editing handwriting ----------

  const flash = (message: string) => {
    clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(''), 3000);
  };

  /** The page and stroke ids currently selected (ids that no longer exist are dropped). */
  const currentSelection = (): { pageId: string; ids: Set<string> } | null => {
    if (!selection) return null;
    const alive = new Set((inkRef.current[selection.pageId] ?? []).map((s) => s.id));
    const ids = new Set(selection.ids.filter((id) => alive.has(id)));
    return ids.size > 0 ? { pageId: selection.pageId, ids } : null;
  };

  const selectOn = (pageId: string, ids: string[]) => {
    setSelection(ids.length > 0 ? { pageId, ids } : null);
    setActivePage(pageId);
  };

  const withSelection = (fn: (pageId: string, ids: Set<string>, strokes: InkStroke[]) => void) => {
    const sel = currentSelection();
    if (sel) fn(sel.pageId, sel.ids, inkRef.current[sel.pageId] ?? []);
  };

  const selectAll = () => {
    if (activePage) selectOn(activePage, (inkRef.current[activePage] ?? []).map((x) => x.id));
  };
  const deleteSel = () =>
    withSelection((pg, ids, all) => {
      commitInk(pg, deleteSelected(all, ids));
      setSelection(null);
    });
  const copySel = () => withSelection((_pg, ids, all) => setClipboard(pickStrokes(all, ids)));
  const cutSel = () => {
    copySel();
    deleteSel();
  };
  const pasteInto = (pg: string, source: InkStroke[]) => {
    const off = nextPasteOffset();
    const copies = cloneStrokes(source, off, off);
    commitInk(pg, [...(inkRef.current[pg] ?? []), ...copies]);
    selectOn(pg, copies.map((x) => x.id));
  };
  const pasteSel = () => {
    const pg = activePage ?? latest.current.pages[0]?.id;
    if (pg && getClipboard().length > 0) pasteInto(pg, getClipboard());
  };
  const duplicateSel = () =>
    withSelection((pg, ids, all) => {
      const copies = cloneStrokes(pickStrokes(all, ids), 24, 24);
      commitInk(pg, [...all, ...copies]);
      selectOn(pg, copies.map((x) => x.id));
    });
  const recolorSel = (color: string) => withSelection((pg, ids, all) => commitInk(pg, recolorSelected(all, ids, color)));
  const rewidthSel = (w: number) => withSelection((pg, ids, all) => commitInk(pg, rewidthSelected(all, ids, w)));
  const reorderSel = (where: 'front' | 'back') => withSelection((pg, ids, all) => commitInk(pg, reorderSelected(all, ids, where)));
  const neatenSel = () =>
    withSelection((pg, ids, all) => {
      const r = neatenSelected(all, ids);
      if (r.changed === 0) flash(t.ink.selNeatNone);
      else commitInk(pg, r.strokes);
    });

  // Handwriting -> text: only a PICTURE of the selected strokes is sent, and only after the student agrees.
  const startOcr = async () => {
    const sel = currentSelection();
    if (!sel) return;
    if (localStorage.getItem(OCR_OK_KEY) !== '1') {
      if (!window.confirm(t.ink.ocrConsent)) return;
      try {
        localStorage.setItem(OCR_OK_KEY, '1');
      } catch {
        // ask again next time
      }
    }
    const png = renderStrokesPng(pickStrokes(inkRef.current[sel.pageId] ?? [], sel.ids));
    const token = ++ocrToken.current;
    if (!png) return flash(t.ink.ocrEmpty);
    const ids = [...sel.ids];
    setOcr({ status: 'loading', text: '', confidence: 'low', pageId: sel.pageId, ids });
    try {
      const r = await recognizeHandwriting(png.data);
      if (token === ocrToken.current) setOcr({ status: 'ready', text: r.text, confidence: r.confidence, pageId: sel.pageId, ids });
    } catch {
      if (token === ocrToken.current) setOcr({ status: 'error', text: '', confidence: 'low', pageId: sel.pageId, ids });
    }
  };

  const closeOcr = () => {
    ocrToken.current++; // a reply that arrives later is ignored
    setOcr(null);
  };

  const insertOcr = (removeInk: boolean) => {
    if (!ocr) return;
    const editor = editors.current[ocr.pageId];
    const nodes = ocr.text
      .split('\n')
      .map((line) => (line.trim() ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' }));
    if (editor) editor.chain().focus('end').insertContent(nodes).run();
    if (removeInk) {
      const all = inkRef.current[ocr.pageId] ?? [];
      commitInk(ocr.pageId, deleteSelected(all, new Set(ocr.ids)));
    }
    setSelection(null);
    setOcr(null);
    setMode('type'); // show the new text
  };

  const chooseMode = (m: InkMode) => {
    if (m !== 'type') active?.commands.blur();
    setMode(m);
  };

  // Keyboard in a pen mode: Ctrl/Cmd+Z undo, +Shift+Z / +Y redo; in Select: Delete, Ctrl+C / X / V / D.
  useEffect(() => {
    if (mode === 'type') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (mode === 'select' && (k === 'delete' || k === 'backspace')) {
        e.preventDefault();
        return deleteSel();
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoInk();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redoInk();
      } else if (mode === 'select' && k === 'c') {
        e.preventDefault();
        copySel();
      } else if (mode === 'select' && k === 'x') {
        e.preventDefault();
        cutSel();
      } else if (mode === 'select' && k === 'v') {
        e.preventDefault();
        pasteSel();
      } else if (mode === 'select' && k === 'd') {
        e.preventDefault();
        duplicateSel();
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
              select={{
                count: currentSelection()?.ids.size ?? 0,
                canPaste: clipCount > 0,
                notice,
                onAll: selectAll,
                onDelete: deleteSel,
                onCopy: copySel,
                onCut: cutSel,
                onPaste: pasteSel,
                onDuplicate: duplicateSel,
                onColor: recolorSel,
                onWidth: rewidthSel,
                onFront: () => reorderSel('front'),
                onBack: () => reorderSel('back'),
                onNeaten: neatenSel,
                onToText: () => void startOcr(),
              }}
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
            selectedIds={selection?.pageId === p.id ? selection.ids : []}
            onSelect={selectOn}
            onEditor={(pageId, ed) => (editors.current[pageId] = ed)}
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
      {ocr && <InkOcrDialog state={ocr} onText={(v) => setOcr({ ...ocr, text: v })} onInsert={insertOcr} onClose={closeOcr} />}
    </div>
  );
}
