import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ArrowLeft, ChevronDown, FileDown, History, Keyboard, ChevronUp, Copy, Download, Eye, EyeOff, FilePlus, HelpCircle, LayoutGrid, Maximize2, MoveHorizontal, Minimize2, Plus, RotateCcw, Sparkles, Star, Trash2, Video, VideoOff, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage, useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { loadNoteContent, saveNoteContent, getIndex, type InkStroke, type NotePage, type NoteVideo, type PageAttachment } from './notebookStore';
import { useInkPrefs, type InkMode } from './inkPrefs';
import InkToolbar, { ModeSwitch } from './InkToolbar';
import InkOcrDialog, { type OcrState } from './InkOcrDialog';
import ConfirmDialog from './ConfirmDialog';
import PageThumbnails from './PageThumbnails';
import ZoomControls from './ZoomControls';
import { isTemplateId } from './pageTemplates';
import { useZoom } from './useZoom';
import { useAppDark } from './useAppDark';
import { useElementSize, useFillHeight } from './useLayoutSize';
import { setImmersive, setNoteOpen } from './immersive';
import { useMediaQuery } from './useMediaQuery';
import { addPageAfter, blankPage, deletePage, duplicatePage, inkOf, movePage, newPageId, patchPage, restorePage } from './pageOps';
import { recognizeHandwriting } from './inkOcrApi';
import { getClipboard, nextPasteOffset, setClipboard, useClipboardCount } from './inkClipboard';
import {
  cloneStrokes, deleteSelected, neatenSelected, pickStrokes, recolorSelected, renderStrokesPng, reorderSelected, rewidthSelected,
} from './inkEdit';
import { SaveChip } from './SaveChip';
import PageEditor from './PageEditor';
import EditorToolbar from './EditorToolbar';
import PhoneRibbon from './PhoneRibbon';
import type { NoteTabId } from './noteTabs';
import { Btn } from './toolbarParts';
import NoteAiPanel from './NoteAiPanel';
import NoteMenu, { type MenuItem } from './NoteMenu';
import { ExportDialog, ShortcutsDialog, VersionsDialog } from './NoteTools';
import { listVersions, saveVersion, type VersionData } from './noteVersions';
import PdfPageSheet from './PdfPageSheet';
import VideoNotesPane, { type VideoPlayerApi } from './VideoNotesPane';
import MomentList from './MomentList';
import { newMomentId, parseYouTubeUrl, timestampUrl, type MomentKind } from './videoTime';
import { cloneAttachment } from './attachClone';
import { getPdf, newAttachId, putPdf } from './attachStore';

// ============================================================
// NoteEditor.tsx — title + pages (rich text from Part 2, handwriting from
// Part 3) with autosave. Ink history (undo/redo) lives here, per page.
// ============================================================

const AUTOSAVE_MS = 700;
const OCR_OK_KEY = 'learning_os_ink_ocr_ok';
const NO_STROKES: InkStroke[] = []; // one shared empty array keeps the memo'd thumbnails from re-rendering
const COLUMN_MAX = 768; // page width at 100% zoom (px)
const MAX_PDF_PAGES = 150; // one PDF becomes at most this many note pages

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
  const [video, setVideo] = useState<NoteVideo | null>(null);
  const videoRef = useRef<NoteVideo | null>(null);
  const playerRef = useRef<VideoPlayerApi | null>(null);
  const [recall, setRecall] = useState(false);
  const [dialog, setDialog] = useState<'export' | 'versions' | 'shortcuts' | null>(null);
  const [restoreKey, setRestoreKey] = useState(0); // bumped after a restore so every page editor starts fresh
  const lastAutoVersion = useRef(0);
  const { locale } = useLanguage();
  const [linking, setLinking] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState(false);
  const [deletedPage, setDeletedPage] = useState<{ page: NotePage; ink: InkStroke[]; index: number } | null>(null);
  const deletedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Latest values for the unmount / pagehide flush (state would be stale there).
  const latest = useRef<{ title: string; pages: NotePage[]; video?: NoteVideo }>({ title: '', pages: [] });
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
      latest.current = { title: meta.title, pages: content.pages, video: content.video };
      videoRef.current = content.video ?? null;
      setVideo(content.video ?? null);
      const initial: Record<string, InkStroke[]> = {};
      content.pages.forEach((p) => (initial[p.id] = p.ink ?? []));
      inkRef.current = initial;
      setInk(initial);
      setActivePage(content.pages[0]?.id ?? null);
      setTitle(meta.title);
      setPages(content.pages);
      setReady(true);
      // the note as it was before this editing session
      void listVersions(id)
        .then((l) => {
          const last = l[0] ? Date.parse(l[0].at) : 0;
          if (Date.now() - last > 10 * 60_000) {
            lastAutoVersion.current = Date.now();
            return saveVersion(id, { title: meta.title, pages: content.pages, ...(content.video ? { video: content.video } : {}) }, 'auto');
          }
          lastAutoVersion.current = last;
          return null;
        })
        .catch(() => undefined);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const flush = () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    void saveNoteContent(id, latest.current.title, latest.current.pages, latest.current.video);
    // Version history: at most one automatic snapshot every 10 minutes (and never when nothing changed).
    if (Date.now() - lastAutoVersion.current > 10 * 60_000) {
      lastAutoVersion.current = Date.now();
      void saveVersion(id, currentSnapshot(), 'auto').catch(() => undefined);
    }
  };

  const currentSnapshot = (): VersionData => ({ title: latest.current.title, pages: latest.current.pages, ...(latest.current.video ? { video: latest.current.video } : {}) });

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
    latest.current = { ...latest.current, title: nextTitle, pages: nextPages };
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

  // ---------- version restore, save now, tool shortcuts (Part 10) ----------

  const restoreVersion = (v: VersionData) => {
    const ink2: Record<string, InkStroke[]> = {};
    v.pages.forEach((p) => (ink2[p.id] = p.ink ?? []));
    inkRef.current = ink2;
    setInk(ink2);
    hist.current = {};
    editors.current = {};
    setSelection(null);
    latest.current = { title: v.title, pages: v.pages, video: v.video };
    videoRef.current = v.video ?? null;
    setVideo(v.video ?? null);
    setTitle(v.title);
    setPages(v.pages);
    setActivePage(v.pages[0]?.id ?? null);
    setRestoreKey((k) => k + 1);
    dirty.current = true;
    flush();
  };

  // T / P / H / E / S switch tools, Ctrl+S saves now, ? lists the shortcuts. Never while typing in a field or the text.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (dialog) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 's') {
        e.preventDefault();
        dirty.current = true;
        flush();
        return flash(t.polish.saved);
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '?') {
        e.preventDefault();
        return setDialog('shortcuts');
      }
      const tool: Record<string, InkMode> = { t: 'type', p: 'pen', h: 'highlighter', e: 'eraser', s: 'select' };
      if (tool[k]) {
        e.preventDefault();
        chooseMode(tool[k]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- recall mode (Part 6) ----------
  // Highlights cover their own text; a tap shows one. Only a class on the element: nothing is saved in the note.
  const toggleRecall = () => {
    document.querySelectorAll('.note-prose mark.revealed').forEach((m) => m.classList.remove('revealed'));
    setRecall((r) => !r);
    flash(recall ? t.rsheet.recallOff : t.rsheet.recallOn);
  };
  const onPagesClick = (e: React.MouseEvent) => {
    if (!recall) return;
    const mark = (e.target as Element).closest('mark');
    if (mark) mark.classList.toggle('revealed');
  };

  // ---------- lecture video beside the note (Part 7) ----------

  /** Link / change / unlink the video (null = unlink). Saved with the note, so it follows the student across devices. */
  const updateVideo = (next: NoteVideo | null) => {
    latest.current = { ...latest.current, video: next ?? undefined };
    videoRef.current = next;
    setVideo(next);
    commit(latest.current.title, latest.current.pages);
  };

  const submitLink = () => {
    const info = parseYouTubeUrl(linkUrl);
    if (!info) return setLinkError(true);
    const same = videoRef.current?.videoId === info.videoId;
    updateVideo({ videoId: info.videoId, startAt: info.startSeconds || undefined, moments: same ? (videoRef.current?.moments ?? []) : [] });
    setLinking(false);
    setLinkUrl('');
    setLinkError(false);
  };

  const unlinkVideo = () => {
    if (!window.confirm(t.video.unlinkConfirm)) return;
    updateVideo(null);
  };

  /** A time chip in the text was clicked: jump the linked video there, or open another video at that time on YouTube. */
  const seekFromChip = useRef((seconds: number, videoId: string | null) => {
    const cur = videoRef.current;
    const player = playerRef.current;
    if (cur && player && (videoId === null || videoId === cur.videoId)) {
      player.seekTo(seconds);
      player.play();
    } else if (videoId) {
      window.open(timestampUrl(videoId, seconds), '_blank', 'noopener,noreferrer');
    }
  }).current;

  /** "Add time": puts a chip with the video's current time into the page the student is writing on. */
  const captureTime = (seconds: number) => {
    const cur = videoRef.current;
    const ed = active ?? editors.current[latest.current.pages.find((p) => !p.pdf)?.id ?? ''];
    if (!cur || !ed) return;
    const insert = () => ed.commands.insertTimestamp({ seconds, videoId: cur.videoId });
    if (mode !== 'type') {
      setMode('type'); // a pen tool makes the text read-only
      setTimeout(insert, 0);
    } else insert();
  };

  // ---------- photos, audio and PDFs (Part 9) ----------

  const setAttachments = (pageId: string, next: PageAttachment[]) => setAllPages(patchPage(latest.current.pages, pageId, { attachments: next }));

  const pdfInput = useRef<HTMLInputElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  /** Each PDF page becomes a note page; the file stays on this device, handwriting goes on top. */
  const importPdf = async (file: File | undefined) => {
    if (!file) return;
    setPdfBusy(true);
    flash(t.attach.pdfOpening);
    try {
      const { openPdf, PdfError } = await import('./pdfTools');
      let doc: Awaited<ReturnType<typeof openPdf>>;
      try {
        doc = await openPdf(file);
      } catch (e) {
        const code = e instanceof PdfError ? e.code : 'unknown';
        return flash(t.attach[{ password: 'pdfErrPassword', invalid: 'pdfErrInvalid', 'too-large': 'pdfErrTooLarge', unknown: 'pdfErrUnknown' }[code]]);
      }
      const total = doc.numPages;
      const count = Math.min(total, MAX_PDF_PAGES);
      const fileId = newAttachId('pd');
      const added: NotePage[] = [];
      for (let n = 1; n <= count; n++) {
        let text = '';
        try {
          text = (await doc.getText(n)).slice(0, 20000); // so search and the AI tools can read the PDF too
        } catch {
          // a page without readable text is still a fine page
        }
        added.push({ id: newPageId(), text, html: '<p></p>', ink: [], pdf: { fileId, pageNumber: n, name: file.name } });
      }
      doc.destroy();
      await putPdf(fileId, file, file.name);
      const cur = latest.current.pages;
      const onlyEmpty = cur.length === 1 && !cur[0].text.trim() && !(inkRef.current[cur[0].id]?.length) && !(cur[0].attachments?.length) && !cur[0].pdf;
      const base = onlyEmpty ? [] : cur;
      const ink2 = { ...inkRef.current };
      added.forEach((p) => (ink2[p.id] = []));
      inkRef.current = ink2;
      setInk(ink2);
      setAllPages([...base, ...added]);
      scrollToPage(added[0].id);
      flash(total > count ? format(t.attach.pdfTooMany, total, count) : format(t.attach.pdfAdded, count));
    } catch {
      flash(t.attach.errStorage);
    } finally {
      setPdfBusy(false);
    }
  };

  const hasPdf = pages.some((p) => p.pdf);

  /** Save a copy of every imported PDF with the handwriting drawn into it (the original file is untouched). */
  const exportPdfs = async () => {
    flash(t.attach.pdfExporting);
    try {
      const { exportAnnotatedPdf } = await import('./exportAnnotatedPdf');
      const groups = new Map<string, { name: string; pages: { pageNumber: number; strokes: InkStroke[] }[] }>();
      for (const p of latest.current.pages) {
        if (!p.pdf) continue;
        const g = groups.get(p.pdf.fileId) ?? { name: p.pdf.name, pages: [] };
        g.pages.push({ pageNumber: p.pdf.pageNumber, strokes: inkRef.current[p.id] ?? [] });
        groups.set(p.pdf.fileId, g);
      }
      for (const [fileId, g] of groups) {
        const blob = await getPdf(fileId);
        if (!blob) {
          flash(t.attach.pdfMissing);
          continue;
        }
        const bytes = await exportAnnotatedPdf(await blob.arrayBuffer(), g.pages);
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${g.name.replace(/\.pdf$/i, '') || 'note'}-annotated.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
      flash(t.attach.pdfExportDone);
    } catch {
      flash(t.attach.pdfExportFail);
    }
  };

  // ---------- AI tools (Part 8) ----------
  // The panel works on text only. The student chooses the scope; nothing is sent before they agree (see NoteAiPanel).

  const [aiOpen, setAiOpen] = useState(false);
  const otherNotes = useRef<{ id: string; title: string; text: string }[]>([]);

  // Other notes are only read (and only on this device's copy when possible) while the panel is open, for "Ask my notes".
  useEffect(() => {
    if (!aiOpen) return;
    let alive = true;
    const metas = getIndex()
      .notes.filter((n) => n.id !== id && !n.trashedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 20);
    void Promise.allSettled(
      metas.map(async (m) => {
        const c = await loadNoteContent(m.id);
        return c ? { id: m.id, title: m.title || t.untitled, text: c.pages.map((p) => p.text).join('\n').slice(0, 6000) } : null;
      })
    ).then((rs) => {
      if (!alive) return;
      otherNotes.current = rs.flatMap((r) => (r.status === 'fulfilled' && r.value && r.value.text.trim() ? [r.value] : []));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiOpen, id]);

  const getAiSource = () => {
    const sel = active ? active.state.doc.textBetween(active.state.selection.from, active.state.selection.to, '\n') : '';
    const pageText = latest.current.pages.find((p) => p.id === activePage)?.text ?? '';
    const noteText = latest.current.pages.map((p) => p.text).join('\n');
    return { selectedText: sel, pageText, noteText };
  };

  const textToNodes = (text: string) =>
    text.split('\n').map((line) => (line.trim() ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' }));

  /** "Add to note": at the end of the page the student is on. */
  const aiInsert = (text: string) => {
    const ed = (activePage && editors.current[activePage]) || active || editors.current[latest.current.pages[0]?.id ?? ''];
    if (!ed || !text.trim()) return;
    ed.chain().focus('end').insertContent(textToNodes(text)).run();
    setMode('type');
  };

  /** "Replace selection" and its Undo: the new text stays selected, so Undo can replace it again. */
  const aiReplace = (text: string) => {
    const ed = active;
    if (!ed) return;
    const { from, to } = ed.state.selection;
    if (from === to) return flash(t.ai.noTextHint);
    const content = text.includes('\n') ? textToNodes(text) : text ? { type: 'text', text } : null;
    if (!content) return;
    ed.chain().focus().insertContentAt({ from, to }, content).run();
    ed.commands.setTextSelection({ from, to: ed.state.selection.to });
  };

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
    // The copy gets its own photo / recording files, so removing one never deletes the original's.
    const copyId = r.copy.id;
    if (r.copy.attachments?.length) {
      void Promise.all(r.copy.attachments.map((a) => cloneAttachment(a))).then((cloned) => {
        const own = cloned.filter((a): a is PageAttachment => a !== null);
        if (latest.current.pages.some((p) => p.id === copyId)) setAllPages(patchPage(latest.current.pages, copyId, { attachments: own }));
      });
    }
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

  // Word/character counts across all pages, kept in a cheap side map.
  const [stats, setStats] = useState<Record<string, string>>({});
  const totals = useMemo(() => {
    const text = pages.map((p) => stats[p.id] ?? p.text).join('\n');
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { words, chars: text.replace(/\s/g, '').length, minutes: Math.max(1, Math.ceil(words / 200)) };
  }, [pages, stats]);

  // ---------- layout: pages panel, zoom, scrolling area ----------

  const appDark = useAppDark();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollerEl, setScrollerEl] = useState<HTMLDivElement | null>(null);
  const setScroller = useCallback((el: HTMLDivElement | null) => {
    scrollerRef.current = el;
    setScrollerEl(el);
  }, []);
  const { zoom, fitWidth, zoomIn, zoomOut } = useZoom(scrollerRef);
  const scroller = useElementSize(scrollerEl);
  const [ribbonTab, setRibbonTab] = useState<NoteTabId>('home');
  const [ribbonOpen, setRibbonOpen] = useState(true);
  const [ribbonH, setRibbonH] = useState(0);
  // desktop: page fills the screen above the app's bottom edge; phone: above the ribbon
  useFillHeight(scrollerEl, isDesktop ? (focusMode ? 8 : 64) : ribbonH + 6);

  // While a note is open the greeting + notes tabs hide; fullscreen also hides the bottom bar. Esc exits fullscreen.
  useEffect(() => {
    setNoteOpen(true);
    return () => setNoteOpen(false);
  }, []);
  useEffect(() => {
    setImmersive(focusMode || !isDesktop);
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFocusMode(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      setImmersive(false);
    };
  }, [focusMode, isDesktop]);
  useEffect(() => () => setImmersive(false), []);
  // fullscreen on a phone folds the tool row away (tap a tab to bring it back)
  useEffect(() => {
    if (focusMode) setRibbonOpen(false);
  }, [focusMode]);
  const [viewPage, setViewPage] = useState<string | null>(null);

  // Which page is on screen (for the thumbnail highlight). Separate from `activePage`, which is where
  // the student last wrote and which Undo applies to.
  useEffect(() => {
    if (!scrollerEl) return;
    let raf = 0;
    const spy = () => {
      raf = 0;
      const top = scrollerEl.getBoundingClientRect().top + 120;
      const els = Array.from(scrollerEl.querySelectorAll<HTMLElement>('[data-page-id]'));
      const hit = els.find((el) => el.getBoundingClientRect().bottom > top) ?? els[els.length - 1];
      const pid = hit?.getAttribute('data-page-id') ?? null;
      setViewPage((cur) => (cur === pid ? cur : pid));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(spy);
    };
    scrollerEl.addEventListener('scroll', onScroll, { passive: true });
    spy();
    return () => {
      scrollerEl.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [scrollerEl, pages.length]);

  const thumbPages = useMemo(
    () =>
      pages.map((p) => ({
        id: p.id,
        strokes: ink[p.id] ?? NO_STROKES,
        template: isTemplateId(p.template) ? p.template : undefined,
        paper: p.paper,
        preview: p.text.slice(0, 80),
        bookmarked: !!p.bookmarked,
      })),
    [pages, ink]
  );
  const thumbLabels = useMemo(
    () => ({
      title: t.pageOps.panelTitle, page: t.editor.pageLabel, add: t.pageOps.panelAdd, duplicate: t.pageOps.duplicatePage,
      delete: t.pageOps.deleteBtn, moveUp: t.pageOps.moveUp, moveDown: t.pageOps.moveDown, bookmark: t.pageOps.bookmark,
      removeBookmark: t.pageOps.removeBookmark, template: t.pageOps.template, paper: t.pageOps.paper,
      templates: { blank: t.pageOps.tplBlank, ruled: t.pageOps.tplRuled, dotted: t.pageOps.tplDotted, grid: t.pageOps.tplGrid, cornell: t.pageOps.tplCornell },
      collapse: t.pageOps.collapsePanel, expand: t.pageOps.expandPanel,
    }),
    [t]
  );

  const columnW = Math.round(Math.min(Math.max(scroller.w - 24, 200), COLUMN_MAX) * zoom);

  const thumbs = (
    <PageThumbnails
      pages={thumbPages}
      activeId={viewPage ?? activePage}
      dark={appDark}
      labels={thumbLabels}
      onSelect={(pid) => {
        setViewPage(pid);
        setActivePage(pid);
        scrollToPage(pid);
        setDrawerOpen(false);
      }}
      onAdd={(afterId, template) => addPageAt(afterId, template)}
      onDuplicate={duplicatePageById}
      onDelete={askDeletePage}
      onMove={movePageById}
      onSetTemplate={setPageTemplate}
      onSetPaper={setPagePaper}
      onToggleBookmark={toggleBookmark}
    />
  );

  if (failed) {
    return (
      <div className="py-10 text-center text-sm text-gray-500 dark:text-white/60">
        <p className="mb-3">{t.editor.loadError}</p>
        <button onClick={onBack} className="underline">{t.editor.back}</button>
      </div>
    );
  }
  if (!ready) return null;

  const menuItems: MenuItem[] = [
    { key: 'recall', label: recall ? t.rsheet.recallOn : t.rsheet.recall, icon: recall ? <EyeOff size={16} /> : <Eye size={16} />, onClick: toggleRecall, active: recall },
    { key: 'video', label: video ? t.video.unlinkVideo : t.video.linkVideo, icon: video ? <VideoOff size={16} /> : <Video size={16} />, onClick: () => (video ? unlinkVideo() : setLinking((v) => !v)) },
    { key: 'pdf', label: t.attach.addPdf, icon: <FilePlus size={16} />, onClick: () => pdfInput.current?.click(), disabled: pdfBusy },
    ...(hasPdf ? [{ key: 'pdfx', label: t.attach.pdfExport, icon: <Download size={16} />, onClick: () => void exportPdfs() }] : []),
    ...(!isDesktop
      ? [
          { key: 'zin', label: t.pageOps.zoomIn, icon: <Plus size={16} />, onClick: zoomIn, divider: true },
          { key: 'zout', label: t.pageOps.zoomOut, icon: <Minimize2 size={16} />, onClick: zoomOut },
          { key: 'zfit', label: t.pageOps.zoomFit, icon: <LayoutGrid size={16} />, onClick: fitWidth },
        ]
      : []),
    { key: 'export', label: t.polish.menuExport, icon: <FileDown size={16} />, onClick: () => setDialog('export'), divider: true },
    { key: 'versions', label: t.polish.menuVersions, icon: <History size={16} />, onClick: () => setDialog('versions') },
    { key: 'focus', label: t.editor.focusMode, icon: <Maximize2 size={16} />, onClick: () => setFocusMode(true), divider: true },
    { key: 'keys', label: t.polish.menuShortcuts, icon: <Keyboard size={16} />, onClick: () => setDialog('shortcuts') },
  ];

  const videoLabels = {
    addTimestamp: t.video.addTimestamp,
    speed: t.video.speed,
    collapse: t.video.collapse,
    expand: t.video.expand,
    retry: t.video.retry,
    resizeHandle: t.video.resizeHandle,
    errors: { 'not-embeddable': t.video.errNotEmbeddable, 'not-found': t.video.errNotFound, network: t.video.errNetwork, unknown: t.video.errUnknown },
  };

  const pagesArea = (
      <div className={`flex gap-3 ${recall ? 'recall-on' : ''}`} onClick={onPagesClick}>
        {isDesktop && !focusMode && (
          <div className="shrink-0" style={{ height: scroller.h || undefined }}>
            {thumbs}
          </div>
        )}

        {/* The pages scroll inside their own box, so zooming (and scrolling sideways when zoomed in) never moves the toolbar. */}
        <div
          ref={setScroller}
          className="flex-1 min-w-0 overflow-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]"
          style={{ touchAction: 'pan-x pan-y' }}
        >
          <div className="py-3" style={{ width: Math.max(scroller.w, columnW + 24) }}>
            <div style={{ width: columnW, margin: '0 auto' }}>
              {pages.map((p, i) => (
                <div key={`${p.id}:${restoreKey}`} data-page-id={p.id} className="mb-4 scroll-mt-2">
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
                  {p.pdf ? (
                    <PdfPageSheet
                      fileId={p.pdf.fileId}
                      pageNumber={p.pdf.pageNumber}
                      strokes={ink[p.id] ?? NO_STROKES}
                      mode={mode}
                      prefs={prefs}
                      selectedIds={selection?.pageId === p.id ? selection.ids : []}
                      onSelect={(ids) => selectOn(p.id, ids)}
                      onInk={(next) => commitInk(p.id, next)}
                      onActivate={() => setActivePage(p.id)}
                      labels={t.attach}
                    />
                  ) : (
                  <PageEditor
                    page={p}
                    strokes={ink[p.id] ?? NO_STROKES}
                    placeholder={i === 0 ? t.editor.bodyPlaceholder : ''}
                    autoFocus={focusNew === p.id}
                    primary={i === 0}
                    mode={mode}
                    prefs={prefs}
                    zoom={zoom}
                    selectedIds={selection?.pageId === p.id ? selection.ids : []}
                    onSelect={selectOn}
                    onEditor={(pageId, ed) => (editors.current[pageId] = ed)}
                    onChange={changePage}
                    onActive={(ed, pageId) => {
                      setActive(ed);
                      setActivePage(pageId);
                    }}
                    onInk={commitInk}
                    onAttachments={setAttachments}
                    attachLabels={t.attach}
                    onSeekVideo={seekFromChip}
                    recall={recall}
                  />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
  );

  const inkBar = (
    <InkToolbar
      mode={mode === 'type' ? 'pen' : mode}
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
  );

  const pickTab = (id: NoteTabId) => {
    if (id === 'ai') {
      setAiOpen(true);
      return;
    }
    if (id === phoneTab) {
      setRibbonOpen((o) => !o);
      return;
    }
    setRibbonTab(id);
    setRibbonOpen(true);
    if (id === 'draw' && mode === 'type') chooseMode('pen');
    if ((id === 'home' || id === 'insert') && mode !== 'type') chooseMode('type');
  };

  const viewTools = (
    <>
      <Btn label={t.pageOps.zoomOut} onClick={zoomOut}><ZoomOut size={16} /></Btn>
      <Btn label={t.pageOps.zoomIn} onClick={zoomIn}><ZoomIn size={16} /></Btn>
      <Btn label={t.pageOps.zoomFit} onClick={fitWidth}><MoveHorizontal size={16} /></Btn>
      <Btn label={t.pageOps.pagesButton} onClick={() => setDrawerOpen(true)}><LayoutGrid size={16} /></Btn>
      <Btn label={recall ? t.rsheet.recallOn : t.rsheet.recall} active={recall} onClick={toggleRecall}>{recall ? <EyeOff size={16} /> : <Eye size={16} />}</Btn>
    </>
  );
  const insertTools = (
    <>
      <Btn label={t.attach.addPdf} disabled={pdfBusy} onClick={() => pdfInput.current?.click()}><FilePlus size={16} /></Btn>
      <Btn label={video ? t.video.unlinkVideo : t.video.linkVideo} active={!!video} onClick={() => (video ? unlinkVideo() : setLinking((v) => !v))}>
        {video ? <VideoOff size={16} /> : <Video size={16} />}
      </Btn>
    </>
  );

  // Phone: leaving/entering a pen mode (shortcut, finger, ModeSwitch) keeps the ribbon tab in step.
  const phoneTab: NoteTabId = !isDesktop && mode !== 'type' && ribbonTab !== 'view' ? 'draw' : !isDesktop && mode === 'type' && ribbonTab === 'draw' ? 'home' : ribbonTab;

  return (
    <div className="max-w-6xl mx-auto">
      {focusMode ? (
        <div className="flex items-center gap-2 mb-2">
          <input
            value={title}
            onChange={(e) => changeTitle(e.target.value)}
            placeholder={t.editor.titlePlaceholder}
            aria-label={t.editor.titlePlaceholder}
            className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-gray-300 dark:placeholder:text-white/30"
          />
          <button
            onClick={() => setFocusMode(false)}
            className="h-10 sm:h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10 shrink-0"
          >
            <Minimize2 size={14} /> {t.editor.exitFocus}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 mb-1.5">
          <button
            onClick={onBack}
            aria-label={t.editor.back}
            title={t.editor.back}
            className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-lg flex items-center justify-center text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <ArrowLeft size={18} />
          </button>
          <input
            value={title}
            onChange={(e) => changeTitle(e.target.value)}
            placeholder={t.editor.titlePlaceholder}
            aria-label={t.editor.titlePlaceholder}
            className="min-w-0 flex-1 bg-transparent text-lg sm:text-xl font-bold outline-none placeholder:text-gray-300 dark:placeholder:text-white/30"
          />
          {isDesktop && <button
            onClick={() => setAiOpen(true)}
            aria-label={t.ai.panelTitle}
            title={t.ai.panelTitle}
            className="h-10 w-10 sm:h-9 sm:w-auto sm:px-3 shrink-0 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <Sparkles size={16} /> <span className="hidden sm:inline">{t.ai.openButton}</span>
          </button>}
          {isDesktop && (
            <ZoomControls
              zoom={zoom}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onFit={fitWidth}
              labels={{ zoomIn: t.pageOps.zoomIn, zoomOut: t.pageOps.zoomOut, fit: t.pageOps.zoomFit }}
            />
          )}
          {isDesktop && <button
            onClick={() => setFocusMode(true)}
            aria-label={t.editor.focusMode}
            title={t.editor.focusMode}
            className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-lg flex items-center justify-center text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10"
          >
            <Maximize2 size={18} />
          </button>}
          <NoteMenu label={t.polish.menuTitle} items={menuItems} />
          <SaveChip />
        </div>
      )}

      {!focusMode && isDesktop && (
        <div className="pb-1.5 border-b border-gray-200 dark:border-white/10 mb-2">
          <ModeSwitch mode={mode} onMode={chooseMode} />
          {mode === 'type' ? (
            <EditorToolbar editor={active} onFocusMode={() => setFocusMode(true)} />
          ) : (
            inkBar
          )}
        </div>
      )}

      {linking && !video && !focusMode && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => {
              setLinkUrl(e.target.value);
              setLinkError(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submitLink()}
            placeholder={t.video.linkPlaceholder}
            aria-invalid={linkError}
            className="h-9 min-w-[200px] flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent px-3 text-sm outline-none"
          />
          <button onClick={submitLink} className="h-9 px-3 rounded-lg bg-black text-white dark:bg-white dark:text-black text-xs font-medium">
            {t.video.linkConfirm}
          </button>
          <button onClick={() => setLinking(false)} className="h-9 px-3 rounded-lg border border-gray-200 dark:border-white/10 text-xs">
            {t.video.linkCancel}
          </button>
          {linkError && <span role="alert" className="w-full text-xs text-red-600 dark:text-red-400">{t.video.linkInvalid}</span>}
        </div>
      )}

      {video ? (
        <VideoNotesPane
          videoId={video.videoId}
          startAt={video.startAt}
          playerRef={playerRef}
          onCapture={captureTime}
          notes={pagesArea}
          labels={videoLabels}
        />
      ) : (
        pagesArea
      )}
      {video && (
        <MomentsPanel
          video={video}
          playerRef={playerRef}
          onChange={(moments) => updateVideo({ ...video, moments })}
          labels={t.video}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
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

      {!isDesktop && drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="h-full bg-white dark:bg-black">{thumbs}</div>
          <button aria-label={t.pageOps.closePanel} className="flex-1 bg-black/40 flex items-start justify-end p-3" onClick={() => setDrawerOpen(false)}>
            <X size={20} className="text-white" />
          </button>
        </div>
      )}
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
      {dialog === 'export' && (
        <ExportDialog title={latest.current.title} pages={latest.current.pages} video={latest.current.video} labels={t.polish} onClose={() => setDialog(null)} onMessage={flash} />
      )}
      {dialog === 'versions' && (
        <VersionsDialog
          noteId={id}
          getCurrent={currentSnapshot}
          labels={t.polish}
          locale={locale === 'hi' ? 'hi-IN' : 'en-IN'}
          onClose={() => setDialog(null)}
          onRestore={restoreVersion}
          onMessage={flash}
        />
      )}
      {dialog === 'shortcuts' && <ShortcutsDialog labels={t.polish} onClose={() => setDialog(null)} />}
      {notice && (
        // sits above the Undo toast so both can be visible at once
        <div role="status" aria-live="polite" className={`fixed left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white text-sm shadow-lg ${deletedPage ? 'bottom-20' : 'bottom-6'}`}>
          {notice}
        </div>
      )}
      {deletedPage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-2.5 rounded-xl bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white text-sm shadow-lg">
          <span>{t.pageOps.toastDeleted}</span>
          <button onClick={undoDeletePage} className="font-semibold underline">{t.undo}</button>
        </div>
      )}
      {!isDesktop && (
        <PhoneRibbon tab={phoneTab} open={ribbonOpen} aiOpen={aiOpen} onTab={pickTab} onHeight={setRibbonH}>
          {phoneTab === 'home' && <EditorToolbar editor={active} section="home" onFocusMode={() => setFocusMode(true)} />}
          {phoneTab === 'insert' && <EditorToolbar editor={active} section="insert" extra={insertTools} onFocusMode={() => setFocusMode(true)} />}
          {phoneTab === 'view' && <EditorToolbar editor={active} section="view" lead={viewTools} onFocusMode={() => setFocusMode(true)} />}
          {phoneTab === 'draw' && (
            <>
              <ModeSwitch mode={mode} onMode={chooseMode} />
              {inkBar}
            </>
          )}
        </PhoneRibbon>
      )}
      <input ref={pdfInput} type="file" accept="application/pdf" hidden onChange={(e) => { void importPdf(e.target.files?.[0]); e.target.value = ''; }} />
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button aria-label={t.ai.closePanel} className="hidden sm:block flex-1 bg-black/30" onClick={() => setAiOpen(false)} />
          <div className="h-full w-full sm:w-[440px] overflow-y-auto bg-white dark:bg-black border-l border-gray-200 dark:border-white/10 p-3">
            <div className="flex items-center justify-end mb-2">
              <button
                onClick={() => setAiOpen(false)}
                aria-label={t.ai.closePanel}
                title={t.ai.closePanel}
                className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <NoteAiPanel
              getSource={getAiSource}
              getOtherNotes={() => otherNotes.current}
              onInsertText={aiInsert}
              onReplaceSelection={aiReplace}
              labels={t.ai}
            />
          </div>
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

const MARK_ICON: Record<MomentKind, React.ComponentType<{ size?: number }>> = { confusing: HelpCircle, important: Star, revisit: RotateCcw };

/** Buttons to mark the current video moment + the list of marked moments (Part 7). */
function MomentsPanel({
  video,
  playerRef,
  onChange,
  labels,
}: {
  video: NoteVideo;
  playerRef: React.MutableRefObject<VideoPlayerApi | null>;
  onChange: (moments: NoteVideo['moments']) => void;
  labels: Record<string, string>;
}) {
  const [now, setNow] = useState(0);
  // The list highlights the moment being played; a 1-second tick is plenty and keeps the editor out of it.
  useEffect(() => {
    const timerId = setInterval(() => {
      const sec = playerRef.current?.getTime();
      if (typeof sec === 'number' && Number.isFinite(sec)) setNow(Math.floor(sec));
    }, 1000);
    return () => clearInterval(timerId);
  }, [playerRef]);

  const mark = (kind: MomentKind) => {
    const sec = playerRef.current?.getTime();
    if (typeof sec !== 'number' || !Number.isFinite(sec)) return;
    onChange([...video.moments, { id: newMomentId(), seconds: Math.floor(sec), kind, note: '', createdAt: new Date().toISOString() }]);
  };
  const kindLabel: Record<MomentKind, string> = { confusing: labels.kindConfusing, important: labels.kindImportant, revisit: labels.kindRevisit };

  return (
    <div className="mt-3 rounded-2xl border border-gray-200 dark:border-white/10 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-white/60">{labels.markHint}</span>
        {(['confusing', 'important', 'revisit'] as MomentKind[]).map((k) => {
          const Icon = MARK_ICON[k];
          return (
            <button
              key={k}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => mark(k)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 px-3 text-xs"
            >
              <Icon size={14} /> {kindLabel[k]}
            </button>
          );
        })}
      </div>
      <MomentList
        moments={video.moments}
        currentSeconds={now}
        labels={{
          title: labels.momentsTitle,
          empty: labels.momentsEmpty,
          all: labels.momentsAll,
          kinds: kindLabel,
          editNote: labels.editNote,
          saveNote: labels.saveNote,
          cancel: labels.cancel,
          remove: labels.remove,
          notePlaceholder: labels.notePlaceholder,
        }}
        onSeek={(sec) => {
          playerRef.current?.seekTo(sec);
          playerRef.current?.play();
        }}
        onDelete={(mid) => onChange(video.moments.filter((m) => m.id !== mid))}
        onEditNote={(mid, note) => onChange(video.moments.map((m) => (m.id === mid ? { ...m, note } : m)))}
      />
    </div>
  );
}
