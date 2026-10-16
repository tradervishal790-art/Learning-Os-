import { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Minimize2, Plus, Star, Trash2 } from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { loadNoteContent, saveNoteContent, getIndex, type InkStroke, type NotePage } from './notebookStore';
import { useInkPrefs, type InkMode } from './inkPrefs';
import InkToolbar, { ModeSwitch } from './InkToolbar';
import InkOcrDialog, { type OcrState } from './InkOcrDialog';
import ConfirmDialog from './ConfirmDialog';
import { addPageAfter, blankPage, deletePage, duplicatePage, inkOf, movePage, patchPage, restorePage } from './pageOps';
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletedPage, setDeletedPage] = useState<{ page: NotePage; ink: InkStroke[]; index: number } | null>(null);
  const deletedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  // ---------- pages: add / duplicate / delete / reorder / bookmark ----------
  // Always addressed by page id. `latest.current.pages` holds the freshest text + ink, so every
  // change starts from it and then refreshes the rendered list.

  const setAllPages = (next: NotePage[]) => {
    commit(latest.current.title, next);
    setPages(next);
  };

  const scrollToPage = (id: string) =>
    requestAnimationFrame(() => document.querySelector(`[data-page-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

  const addPageAt = (afterId: string | null, template?: string) => {
    const page = blankPage({ template });
    inkRef.current = { ...inkRef.current, [page.id]: [] };
    setInk(inkRef.current);
    setAllPages(addPageAfter(latest.current.pages, afterId, page).pages);
    setFocusNew(page.id);
    scrollToPage(page.id);
  };

  const duplicatePageById = (id: string) => {
    const r = duplicatePage(latest.current.pages, id);
    if (!r) return;
    inkRef.current = { ...inkRef.current, [r.copy.id]: inkOf(r.copy) };
    setInk(inkRef.current);
    setAllPages(r.pages);
    scrollToPage(r.copy.id);
  };

  const askDeletePage = (id: string) => {
    if (latest.current.pages.length <= 1) return flash(t.pageOps.needOnePage);
    setConfirmDeleteId(id);
  };

  const deletePageById = (id: string) => {
    setConfirmDeleteId(null);
    const r = deletePage(latest.current.pages, id);
    if (!r) return;
    const { [id]: gone, ...restInk } = inkRef.current;
    inkRef.current = restInk;
    setInk(restInk);
    delete hist.current[id];
    delete editors.current[id];
    if (selection?.pageId === id) setSelection(null);
    if (activePage === id) {
      const nextActive = r.pages[Math.min(r.index, r.pages.length - 1)];
      setActivePage(nextActive.id);
      setActive(editors.current[nextActive.id] ?? null);
    }
    setAllPages(r.pages);
    // keep it for a moment so Undo can bring it back (text, handwriting and position)
    clearTimeout(deletedTimer.current);
    setDeletedPage({ page: r.removed, ink: gone ?? [], index: r.index });
    deletedTimer.current = setTimeout(() => setDeletedPage(null), 8000);
  };

  const undoDeletePage = () => {
    if (!deletedPage) return;
    const { page, ink: strokes, index } = deletedPage;
    clearTimeout(deletedTimer.current);
    setDeletedPage(null);
    inkRef.current = { ...inkRef.current, [page.id]: strokes };
    setInk(inkRef.current);
    setAllPages(restorePage(latest.current.pages, { ...page, ink: strokes }, index));
    scrollToPage(page.id);
  };

  const movePageById = (id: string, toIndex: number) => setAllPages(movePage(latest.current.pages, id, toIndex));
  const setPageTemplate = (id: string, template: string) => setAllPages(patchPage(latest.current.pages, id, { template }));
  const setPagePaper = (id: string, paper: string) => setAllPages(patchPage(latest.current.pages, id, { paper }));
  const toggleBookmark = (id: string) => {
    const cur = latest.current.pages.find((p) => p.id === id);
    if (cur) setAllPages(patchPage(latest.current.pages, id, { bookmarked: !cur.bookmarked }));
  };

  // Open the note where the student left off (this device only).
  const lastPageKey = `learning_os_note_lastpage_${id}`;
  useEffect(() => {
    if (!ready) return;
    const saved = localStorage.getItem(lastPageKey);
    if (saved && saved !== pages[0]?.id && pages.some((p) => p.id === saved)) setTimeout(() => scrollToPage(saved), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => {
    if (!ready || !activePage) return;
    try {
      localStorage.setItem(lastPageKey, activePage);
    } catch {
      // not critical
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, ready]);

  /** Everything the page-list panel (thumbnails) needs. */
  const pageActions = {
    add: addPageAt,
    duplicate: duplicatePageById,
    remove: askDeletePage,
    move: movePageById,
    setTemplate: setPageTemplate,
    setPaper: setPagePaper,
    toggleBookmark,
    goTo: scrollToPage,
  };
  void pageActions; // wired to the thumbnail panel in the next step

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
                notice: '',
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
        <div key={p.id} data-page-id={p.id} className="mb-4 scroll-mt-40">
          <div className="flex items-center justify-between mb-1 text-xs text-gray-400 dark:text-white/40">
            <span>{format(t.pageOps.pageOf, i + 1, pages.length)}</span>
            <span className="flex items-center gap-0.5">
              <PageBtn label={p.bookmarked ? t.pageOps.removeBookmark : t.pageOps.bookmark} active={!!p.bookmarked} onClick={() => toggleBookmark(p.id)}>
                <Star size={14} fill={p.bookmarked ? 'currentColor' : 'none'} />
              </PageBtn>
              <PageBtn label={t.pageOps.moveUp} disabled={i === 0} onClick={() => movePageById(p.id, i - 1)}><ChevronUp size={14} /></PageBtn>
              <PageBtn label={t.pageOps.moveDown} disabled={i === pages.length - 1} onClick={() => movePageById(p.id, i + 1)}><ChevronDown size={14} /></PageBtn>
              <PageBtn label={t.pageOps.duplicatePage} onClick={() => duplicatePageById(p.id)}><Copy size={14} /></PageBtn>
              <PageBtn label={t.pageOps.deleteBtn} onClick={() => askDeletePage(p.id)}><Trash2 size={14} /></PageBtn>
            </span>
          </div>
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
          onClick={() => addPageAt(pages[pages.length - 1]?.id ?? null)}
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
      {confirmDeleteId && (
        <ConfirmDialog
          danger
          message={format(t.pageOps.deleteConfirm, pages.findIndex((p) => p.id === confirmDeleteId) + 1)}
          confirmLabel={t.pageOps.deleteBtn}
          cancelLabel={t.cancel}
          onConfirm={() => deletePageById(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {notice && (
        // sits above the Undo toast so both can be visible at once
        <div className={`fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm shadow-lg ${deletedPage ? 'bottom-20' : 'bottom-6'}`}>
          {notice}
        </div>
      )}
      {deletedPage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm shadow-lg">
          <span>{t.pageOps.toastDeleted}</span>
          <button onClick={undoDeletePage} className="font-semibold underline">{t.undo}</button>
        </div>
      )}
      {ocr && <InkOcrDialog state={ocr} onText={(v) => setOcr({ ...ocr, text: v })} onInsert={insertOcr} onClose={closeOcr} />}
    </div>
  );
}

/** Tiny icon button for the per-page controls. */
function PageBtn({ label, onClick, active, disabled, children }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`h-9 w-9 rounded-lg flex items-center justify-center disabled:opacity-25 hover:bg-gray-100 dark:hover:bg-white/10 ${
        active ? 'text-amber-500' : 'text-gray-500 dark:text-white/60'
      }`}
    >
      {children}
    </button>
  );
}
