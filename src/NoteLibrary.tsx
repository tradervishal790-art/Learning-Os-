import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArchiveRestore, Check, ChevronRight, Copy, FileText, GraduationCap, Folder as FolderIcon, FolderInput,
  FolderPlus, ListChecks, MoreVertical, Pencil, Pin, PinOff, Plus, RotateCcw, Search, Star, Tag, Trash2, X,
} from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import {
  FOLDER_COLORS, createFolder, createNote, deleteFolder, deleteNotesForever, duplicateNote,
  hydrateNotebook, moveNotes, recolorFolder, renameFolder, renameNote, restoreNotes, restoreSnapshot,
  searchNoteIds, setArchived, setConfidence, setExamDate, setNoteTags, setStudyStatus, snapshotIndex, toggleFavorite, togglePin, trashNotes,
  useNotebookIndex, type NoteFolder, type NoteMeta, type NotebookIndex, type StudyStatus,
} from './notebookStore';
import { SaveChip } from './SaveChip';
import StudyDialog from './StudyDialog';
import { STUDY_STATUSES, examChip, examSoon, examSortKey } from './studyInfo';
// The rich-text editor (TipTap) is the heaviest part of the notebook — load it only when a note opens.
const NoteEditor = lazy(() => import('./NoteEditor'));
const RevisionSheet = lazy(() => import('./RevisionSheet'));

// ============================================================
// NoteLibrary.tsx — Notebook Part 1: the library (folders, tags, search,
// pin/favorite/archive/trash, bulk actions, undo). Opens NoteEditor.
// ============================================================

type View = 'all' | 'favorites' | 'archive' | 'trash' | `folder:${string}`;
type Sort = 'recent' | 'created' | 'title' | 'exam';
type StatusFilter = 'all' | 'exam-soon' | StudyStatus;

const btn = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border';
const btnPrimary = `${btn} bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white border-transparent hover:opacity-80`;
const btnGhost = `${btn} card border-transparent text-gray-600 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/10`;

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

function Menu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="p-1.5 rounded-lg text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10"
        aria-label="More"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          {/* clicks here must NOT reach the note card underneath (that would also open the note) */}
          <div
            className="fixed inset-0 z-20"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-lg py-1"
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((it) => (
              <button
                key={it.label}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-white/10 ${
                  it.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-white/80'
                }`}
              >
                {it.icon}
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Folders in tree order with their depth, for indented pickers/lists. */
function flattenFolders(folders: NoteFolder[], parentId: string | null = null, depth = 0): { folder: NoteFolder; depth: number }[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((f) => [{ folder: f, depth }, ...flattenFolders(folders, f.id, depth + 1)]);
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function NoteLibrary() {
  const t = useTranslation().notebook;
  const idx = useNotebookIndex();

  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [view, setView] = useState<View>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [tag, setTag] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [studyNoteId, setStudyNoteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchIds, setSearchIds] = useState<Set<string> | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveIds, setMoveIds] = useState<string[] | null>(null);
  const [showFolders, setShowFolders] = useState(false);
  const [toast, setToast] = useState<{ message: string; snap: NotebookIndex } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Pull the cloud copy once when the notebook opens (safe offline / signed out).
  useEffect(() => {
    void hydrateNotebook();
  }, []);

  // Search (title + tags + page text) — debounced, reads page text from IndexedDB.
  useEffect(() => {
    if (!query.trim()) {
      setSearchIds(null);
      return;
    }
    let alive = true;
    const h = setTimeout(async () => {
      const ids = await searchNoteIds(query);
      if (alive) setSearchIds(ids);
    }, 200);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [query, idx]);

  // If the folder being viewed was deleted (here or on another device), go back to All.
  useEffect(() => {
    if (view.startsWith('folder:') && !idx.folders.some((f) => `folder:${f.id}` === view)) setView('all');
  }, [idx.folders, view]);

  const flatFolders = useMemo(() => flattenFolders(idx.folders), [idx.folders]);
  const folderName = (id: string | null) => idx.folders.find((f) => f.id === id)?.name ?? '';

  const counts = useMemo(() => {
    const live = idx.notes.filter((n) => !n.trashedAt && !n.archived);
    const byFolder = new Map<string, number>();
    live.forEach((n) => n.folderId && byFolder.set(n.folderId, (byFolder.get(n.folderId) ?? 0) + 1));
    return {
      all: live.length,
      favorites: live.filter((n) => n.favorite).length,
      archive: idx.notes.filter((n) => !n.trashedAt && n.archived).length,
      trash: idx.notes.filter((n) => n.trashedAt).length,
      byFolder,
    };
  }, [idx.notes]);

  const allTags = useMemo(
    () => Array.from(new Set(idx.notes.filter((n) => !n.trashedAt).flatMap((n) => n.tags))).sort(),
    [idx.notes]
  );

  const visible = useMemo(() => {
    let list = idx.notes.filter((n) => {
      if (view === 'trash') return !!n.trashedAt;
      if (n.trashedAt) return false;
      if (view === 'archive') return n.archived;
      if (n.archived) return false;
      if (view === 'favorites') return n.favorite;
      if (view.startsWith('folder:')) return n.folderId === view.slice(7);
      return true;
    });
    if (tag) list = list.filter((n) => n.tags.includes(tag));
    if (statusFilter === 'exam-soon') list = list.filter((n) => examSoon(n.examDate));
    else if (statusFilter !== 'all') list = list.filter((n) => (n.status ?? 'not-started') === statusFilter);
    if (searchIds) list = list.filter((n) => searchIds.has(n.id));
    const cmp = (a: NoteMeta, b: NoteMeta) =>
      sort === 'title'
        ? (a.title || t.untitled).localeCompare(b.title || t.untitled)
        : sort === 'created'
          ? b.createdAt.localeCompare(a.createdAt)
          : sort === 'exam'
            ? examSortKey(a.examDate) - examSortKey(b.examDate) || b.updatedAt.localeCompare(a.updatedAt)
            : b.updatedAt.localeCompare(a.updatedAt);
    return [...list].sort((a, b) => (view !== 'trash' && a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : cmp(a, b)));
  }, [idx.notes, view, tag, statusFilter, searchIds, sort, t.untitled]);

  // ---------- helpers ----------

  /** Run a change and offer Undo (restores the whole library snapshot). */
  const withUndo = (message: string, fn: () => void) => {
    const snap = snapshotIndex();
    fn();
    clearTimeout(toastTimer.current);
    setToast({ message, snap });
    toastTimer.current = setTimeout(() => setToast(null), 7000);
  };
  const undo = () => {
    if (!toast) return;
    restoreSnapshot(toast.snap);
    setToast(null);
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  const toggleSelected = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const newNote = async () => {
    const folderId = view.startsWith('folder:') ? view.slice(7) : null;
    const meta = await createNote(folderId);
    setOpenId(meta.id);
  };

  const addFolder = (parentId: string | null) => {
    const name = window.prompt(t.folderNamePrompt);
    if (name === null) return;
    const f = createFolder(name, parentId);
    setView(`folder:${f.id}`);
  };

  const removeFolder = (f: NoteFolder) => {
    const n = idx.notes.filter((x) => x.folderId === f.id).length;
    const msg = n > 0 ? format(t.confirmDeleteFolderWithNotes, n) : t.confirmDeleteFolder;
    if (!window.confirm(msg)) return;
    withUndo(t.toastFolderDeleted, () => deleteFolder(f.id));
  };

  const editTags = (n: NoteMeta) => {
    const v = window.prompt(t.tagsPrompt, n.tags.join(', '));
    if (v !== null) setNoteTags(n.id, v.split(','));
  };

  const rename = (n: NoteMeta) => {
    const v = window.prompt(t.renamePrompt, n.title);
    if (v !== null) renameNote(n.id, v);
  };

  const trashIds = (ids: string[]) => {
    withUndo(t.toastTrashed, () => trashNotes(ids));
    exitSelect();
  };

  const foreverIds = async (ids: string[]) => {
    if (!window.confirm(t.confirmDeleteForever)) return;
    await deleteNotesForever(ids);
    exitSelect();
  };

  const emptyTrash = async () => {
    if (!window.confirm(t.confirmEmptyTrash)) return;
    await deleteNotesForever(idx.notes.filter((n) => n.trashedAt).map((n) => n.id));
  };

  const noteMenu = (n: NoteMeta): MenuItem[] =>
    n.trashedAt
      ? [
          { label: t.restore, icon: <RotateCcw size={14} />, onClick: () => withUndo(t.toastRestored, () => restoreNotes([n.id])) },
          { label: t.deleteForever, icon: <Trash2 size={14} />, danger: true, onClick: () => void foreverIds([n.id]) },
        ]
      : [
          { label: t.rename, icon: <Pencil size={14} />, onClick: () => rename(n) },
          { label: n.pinned ? t.unpin : t.pin, icon: n.pinned ? <PinOff size={14} /> : <Pin size={14} />, onClick: () => togglePin(n.id, !n.pinned) },
          { label: n.favorite ? t.unfavorite : t.favorite, icon: <Star size={14} />, onClick: () => toggleFavorite(n.id, !n.favorite) },
          { label: t.study.details, icon: <GraduationCap size={14} />, onClick: () => setStudyNoteId(n.id) },
          { label: t.rsheet.menu, icon: <ListChecks size={14} />, onClick: () => setSheetId(n.id) },
          { label: t.editTags, icon: <Tag size={14} />, onClick: () => editTags(n) },
          { label: t.move, icon: <FolderInput size={14} />, onClick: () => setMoveIds([n.id]) },
          { label: t.duplicate, icon: <Copy size={14} />, onClick: () => void duplicateNote(n.id).then(() => flashToast(t.toastDuplicated)) },
          n.archived
            ? { label: t.unarchive, icon: <ArchiveRestore size={14} />, onClick: () => withUndo(t.toastUnarchived, () => setArchived([n.id], false)) }
            : { label: t.archive, icon: <Archive size={14} />, onClick: () => withUndo(t.toastArchived, () => setArchived([n.id], true)) },
          { label: t.moveToTrash, icon: <Trash2 size={14} />, danger: true, onClick: () => trashIds([n.id]) },
        ];

  // Message-only toast (nothing to undo).
  const flashToast = (message: string) => {
    clearTimeout(toastTimer.current);
    setToast({ message, snap: snapshotIndex() });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // ---------- editor open ----------

  if (sheetId)
    return (
      <Suspense fallback={null}>
        <RevisionSheet id={sheetId} onBack={() => setSheetId(null)} />
      </Suspense>
    );

  if (openId)
    return (
      <Suspense fallback={null}>
        <NoteEditor id={openId} onBack={() => setOpenId(null)} />
      </Suspense>
    );

  // ---------- views ----------

  const smartItem = (v: View, label: string, count: number, icon: React.ReactNode) => (
    <button
      key={v}
      onClick={() => {
        setView(v);
        setShowFolders(false);
        exitSelect();
      }}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${
        view === v
          ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white'
          : 'text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10'
      }`}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs opacity-60">{count}</span>
    </button>
  );

  const statusLabel: Record<StudyStatus, string> = {
    'not-started': t.study.statusNotStarted,
    learning: t.study.statusLearning,
    'needs-revision': t.study.statusNeedsRevision,
    mastered: t.study.statusMastered,
  };
  const statusTone: Record<StudyStatus, string> = {
    'not-started': '',
    learning: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    'needs-revision': 'bg-amber-500/20 text-amber-800 dark:text-amber-300',
    mastered: 'bg-green-500/20 text-green-800 dark:text-green-300',
  };
  const examText = (date: string | undefined): string | null => {
    const c = examChip(date);
    if (!c) return null;
    return c.kind === 'today' ? t.study.examToday : c.kind === 'tomorrow' ? t.study.examTomorrow : c.kind === 'future' ? format(t.study.examInDays, c.days) : format(t.study.examPast, c.days);
  };

  const emptyMessage =
    query.trim() || tag
      ? t.emptySearch
      : view === 'trash'
        ? t.emptyTrash
        : view === 'archive'
          ? t.emptyArchive
          : view === 'favorites'
            ? t.emptyFavorites
            : view.startsWith('folder:')
              ? t.emptyFolder
              : null;

  const currentFolder = view.startsWith('folder:') ? idx.folders.find((f) => f.id === view.slice(7)) : undefined;

  return (
    <div className="max-w-6xl mx-auto">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl card border-0 bg-white dark:bg-black text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40" aria-label="Clear">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          className={`${btnGhost} !px-0 md:!px-3 w-10 md:w-auto h-10 md:h-auto inline-flex items-center justify-center`}
          onClick={() => addFolder(currentFolder?.id ?? null)}
          aria-label={currentFolder ? t.newSubfolder : t.newFolder}
          title={currentFolder ? t.newSubfolder : t.newFolder}
        >
          <FolderPlus size={16} className="md:mr-1" />
          <span className="hidden md:inline">{currentFolder ? t.newSubfolder : t.newFolder}</span>
        </button>
        <button className={`${btnPrimary} hidden md:inline-block`} onClick={() => void newNote()}>
          <Plus size={14} className="inline mr-1 -mt-0.5" />
          {t.newNote}
        </button>
        <SaveChip />
        {/* Phones: New note is a floating button above the bottom bar */}
        <button
          onClick={() => void newNote()}
          aria-label={t.newNote}
          title={t.newNote}
          className="md:hidden fixed right-4 z-30 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
        >
          <Plus size={26} />
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* sidebar */}
        <aside className="md:w-60 shrink-0">
          <button className={`${btnGhost} md:hidden mb-2`} onClick={() => setShowFolders((s) => !s)}>
            <FolderIcon size={14} className="inline mr-1 -mt-0.5" /> {t.folders}
          </button>
          <div className={`${showFolders ? 'block' : 'hidden'} md:block space-y-1`}>
            {smartItem('all', t.viewAll, counts.all, <FileText size={15} />)}
            {smartItem('favorites', t.viewFavorites, counts.favorites, <Star size={15} />)}
            {smartItem('archive', t.viewArchive, counts.archive, <Archive size={15} />)}
            {smartItem('trash', t.viewTrash, counts.trash, <Trash2 size={15} />)}
            {flatFolders.length > 0 && (
              <div className="pt-3 mt-3 border-t border-gray-200 dark:border-white/10 space-y-0.5">
                <div className="px-3 pb-1 text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/40">{t.folders}</div>
                {flatFolders.map(({ folder: f, depth }) => {
                  const v: View = `folder:${f.id}`;
                  return (
                    <div key={f.id} className="flex items-center" style={{ paddingLeft: depth * 14 }}>
                      <button
                        onClick={() => {
                          setView(v);
                          setShowFolders(false);
                          exitSelect();
                        }}
                        className={`flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${
                          view === v
                            ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white'
                            : 'text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10'
                        }`}
                      >
                        {depth > 0 && <ChevronRight size={12} className="opacity-40 -ml-1" />}
                        <FolderIcon size={15} style={{ color: view === v ? undefined : f.color }} />
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="text-xs opacity-60">{counts.byFolder.get(f.id) ?? 0}</span>
                      </button>
                      <Menu
                        items={[
                          { label: t.newSubfolder, icon: <FolderPlus size={14} />, onClick: () => addFolder(f.id) },
                          {
                            label: t.renameFolder,
                            icon: <Pencil size={14} />,
                            onClick: () => {
                              const v2 = window.prompt(t.renameFolderPrompt, f.name);
                              if (v2 !== null) renameFolder(f.id, v2);
                            },
                          },
                          { label: t.deleteFolder, icon: <Trash2 size={14} />, danger: true, onClick: () => removeFolder(f) },
                        ]}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {currentFolder && (
              <div className="flex gap-1.5 px-3 pt-3">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => recolorFolder(currentFolder.id, c)}
                    className="w-5 h-5 rounded-full border border-black/10 dark:border-white/20 flex items-center justify-center"
                    style={{ background: c }}
                    aria-label={c}
                  >
                    {currentFolder.color === c && <Check size={11} className="text-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* main list */}
        <main className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-xs"
            >
              <option value="recent">{t.sortRecent}</option>
              <option value="created">{t.sortCreated}</option>
              <option value="title">{t.sortTitle}</option>
              <option value="exam">{t.study.sortExam}</option>
            </select>
            <select
              aria-label={t.study.statusLabel}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-xs"
            >
              <option value="all">{t.study.filterAll}</option>
              <option value="exam-soon">{t.study.filterExamSoon}</option>
              {STUDY_STATUSES.map((st) => (
                <option key={st} value={st}>{statusLabel[st]}</option>
              ))}
            </select>
            {allTags.length > 0 && (
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-xs"
              >
                <option value="">{t.allTags}</option>
                {allTags.map((x) => (
                  <option key={x} value={x}>#{x}</option>
                ))}
              </select>
            )}
            <div className="flex-1" />
            {view === 'trash' && counts.trash > 0 && (
              <button className={btnGhost} onClick={() => void emptyTrash()}>{t.emptyTrashBtn}</button>
            )}
            {visible.length > 0 && (
              <button className={btnGhost} onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}>
                {selectMode ? t.cancel : t.select}
              </button>
            )}
          </div>

          {view === 'trash' && <p className="text-xs text-gray-400 dark:text-white/40 mb-3">{t.trashInfo}</p>}

          {selectMode && selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3 p-2 rounded-xl card">
              <span className="text-xs px-2">{format(t.selected, selected.size)}</span>
              {view === 'trash' ? (
                <>
                  <button className={btnGhost} onClick={() => { const ids = [...selected]; withUndo(t.toastRestored, () => restoreNotes(ids)); exitSelect(); }}>{t.restore}</button>
                  <button className={btnGhost} onClick={() => void foreverIds([...selected])}>{t.deleteForever}</button>
                </>
              ) : (
                <>
                  <button className={btnGhost} onClick={() => setMoveIds([...selected])}>{t.move}</button>
                  <button className={btnGhost} onClick={() => { const ids = [...selected]; withUndo(view === 'archive' ? t.toastUnarchived : t.toastArchived, () => setArchived(ids, view !== 'archive')); exitSelect(); }}>
                    {view === 'archive' ? t.unarchive : t.archive}
                  </button>
                  <button className={btnGhost} onClick={() => trashIds([...selected])}>{t.moveToTrash}</button>
                </>
              )}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="py-16 text-center text-gray-400 dark:text-white/60">
              {emptyMessage ? (
                <p className="text-sm">{emptyMessage}</p>
              ) : (
                <>
                  <p className="text-lg mb-2">{t.emptyTitle}</p>
                  <p className="text-sm">{t.emptySubtitle}</p>
                </>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((n) => {
                const isSel = selected.has(n.id);
                return (
                  <li
                    key={n.id}
                    onClick={() => (selectMode ? toggleSelected(n.id) : n.trashedAt ? undefined : setOpenId(n.id))}
                    className={`flex items-start gap-3 p-4 rounded-2xl border card ${
                      n.trashedAt ? '' : 'cursor-pointer hover:shadow-md'
                    } ${isSel ? 'border-indigo-500 dark:border-indigo-400' : 'border-transparent'}`}
                  >
                    {selectMode && (
                      <span
                        className={`mt-1 w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                          isSel ? 'bg-black dark:bg-white border-transparent' : 'border-gray-300 dark:border-white/30'
                        }`}
                      >
                        {isSel && <Check size={11} className="text-white dark:text-black" />}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {n.pinned && <Pin size={13} className="shrink-0 text-gray-500 dark:text-white/60" />}
                        {n.favorite && <Star size={13} className="shrink-0 text-amber-500" fill="currentColor" />}
                        <span className="font-medium truncate">{n.title || t.untitled}</span>
                      </div>
                      {(n.status || n.examDate || n.confidence) && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {n.status && <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusTone[n.status]}`}>{statusLabel[n.status]}</span>}
                          {examText(n.examDate) && (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${examSoon(n.examDate, 3) ? 'bg-red-500/15 text-red-700 dark:text-red-300' : 'bg-gray-200/70 dark:bg-white/10 text-gray-600 dark:text-white/70'}`}>
                              {examText(n.examDate)}
                            </span>
                          )}
                          {n.confidence && <span className="text-[11px] text-gray-500 dark:text-white/60">{format(t.study.confidenceShort, n.confidence)}</span>}
                        </div>
                      )}
                      {n.preview && <p className="text-xs text-gray-500 dark:text-white/60 mt-1 line-clamp-2">{n.preview}</p>}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-400 dark:text-white/40">
                        <span>{t.edited} {shortDate(n.updatedAt)}</span>
                        <span>{n.pageCount} {t.pages}</span>
                        {n.folderId && view === 'all' && <span>{folderName(n.folderId)}</span>}
                        {n.tags.map((x) => (
                          <button
                            key={x}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTag(x);
                            }}
                            className="px-1.5 py-0.5 rounded bg-gray-200/70 dark:bg-white/10 text-gray-600 dark:text-white/70"
                          >
                            #{x}
                          </button>
                        ))}
                      </div>
                    </div>
                    {!selectMode && <Menu items={noteMenu(n)} />}
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>

      {studyNoteId && (() => {
        const sn = idx.notes.find((x) => x.id === studyNoteId);
        return sn ? (
          <StudyDialog
            note={sn}
            onClose={() => setStudyNoteId(null)}
            onSave={(v) => {
              setStudyStatus([sn.id], v.status);
              setConfidence(sn.id, v.confidence);
              setExamDate(sn.id, v.examDate);
              setStudyNoteId(null);
            }}
          />
        ) : null;
      })()}

      {/* move dialog */}
      {moveIds && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setMoveIds(null)}>
          <div
            className="w-full max-w-sm max-h-[70vh] overflow-y-auto rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-medium mb-3">{t.moveTitle}</div>
            {[{ id: null as string | null, name: t.rootFolder, depth: 0 }, ...flatFolders.map((x) => ({ id: x.folder.id as string | null, name: x.folder.name, depth: x.depth + 1 }))].map((o) => (
              <button
                key={o.id ?? 'root'}
                onClick={() => {
                  const ids = moveIds;
                  withUndo(t.toastMoved, () => moveNotes(ids, o.id));
                  setMoveIds(null);
                  exitSelect();
                }}
                style={{ paddingLeft: 12 + o.depth * 14 }}
                className="w-full flex items-center gap-2 py-2 pr-3 rounded-lg text-sm text-left hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <FolderIcon size={14} /> {o.name}
              </button>
            ))}
            <div className="mt-3 text-right">
              <button className={btnGhost} onClick={() => setMoveIds(null)}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {/* undo toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-2.5 rounded-xl bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white text-sm shadow-lg">
          <span>{toast.message}</span>
          <button onClick={undo} className="font-semibold underline">{t.undo}</button>
        </div>
      )}
    </div>
  );
}
