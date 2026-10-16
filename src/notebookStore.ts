// ============================================================
// notebookStore.ts — Learning OS Notebook, Part 1 (the base).
//
// What lives where:
//   - INDEX (small: folders + one NoteMeta per note + tombstones) ->
//     localStorage, so the library renders instantly and synchronously.
//   - CONTENT (pages of each note; later: ink) -> IndexedDB, one record
//     per note. localStorage (~5 MB) is far too small once handwriting
//     arrives in Part 3.
//   - Cloud (best-effort, same Firestore path as cloudSync.ts):
//       users/{uid}/data/notebookIndex   -> the index
//       users/{uid}/data/note_{id}       -> one document per note
//     One document per note keeps each well under Firestore's 1 MB limit.
//
// Sync rule for now: newest `updatedAt` wins, per note / per folder.
// Real conflict handling (keep both copies) is Part 10.
// ============================================================

import { useSyncExternalStore } from 'react';
import { pullFromCloud, pushToCloudChecked, deleteFromCloud } from './cloudSync';
import { parseLocalDate } from './studyInfo';

// ---------- types ----------

export interface NoteFolder {
  id: string;
  name: string;
  parentId: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteMeta {
  id: string;
  title: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  /** ISO time when moved to trash; null = not in trash. */
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  /** First ~160 chars of page 1, for list cards + instant search. */
  preview: string;
  /** How well the student knows this note (Part 6). Missing = 'not-started'. */
  status?: StudyStatus;
  /** Self-rated confidence 1..5. Missing = not rated. */
  confidence?: number;
  /** Exam date as 'YYYY-MM-DD' (local calendar date). Missing = none. */
  examDate?: string;
}

export type StudyStatus = 'not-started' | 'learning' | 'needs-revision' | 'mastered';

export type InkKind =
  | 'ballpoint' | 'fountain' | 'felt' | 'pencil' | 'brush' | 'calligraphy'
  | 'fineliner' | 'marker' | 'dotted' | 'highlighter';

/** One handwritten stroke. Coordinates are in PAGE UNITS (page width = 1000),
 *  so ink keeps its place on every screen size. */
export interface InkStroke {
  id: string;
  kind: InkKind;
  /** '#rrggbb', or 'auto' = black on light pages / near-white on dark pages. */
  color: string;
  /** Nib width in page units. */
  width: number;
  /** Flat [x, y, pressure, x, y, pressure, ...]; x/y rounded to 0.1, pressure to 0.01. */
  pts: number[];
  /** True when the device gave no real pressure (mouse / finger) so it is simulated. */
  sim: boolean;
  /** Smoothing 0..1 used while drawing. */
  sm: number;
}

/** Parts 4-5 extend this (template). `html` = the rich-text body (Part 2);
 *  `text` is always the plain-text mirror, used for search, preview and counts.
 *  `ink` = handwriting (Part 3). `hasInk` exists only in the cloud copy: there the
 *  strokes live in their own document so one big page can't blow Firestore's 1 MB limit. */
export interface NotePage {
  id: string;
  text: string;
  html?: string;
  ink?: InkStroke[];
  hasInk?: boolean;
  /** Paper pattern (Part 5): 'blank' | 'ruled' | 'dotted' | 'grid' | 'cornell'. Unknown / missing = blank. Kept as a plain string so old and new app versions can share a note. */
  template?: string;
  /** Paper colour id (Part 5). Missing = the theme's default page colour. */
  paper?: string;
  /** Student bookmarked this page (Part 5). */
  bookmarked?: boolean;
}

/** Notes made before the rich editor only have `text` — show it as paragraphs. */
export function pageToHtml(p: NotePage): string {
  if (p.html !== undefined) return p.html;
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return p.text
    .split('\n')
    .map((line) => `<p>${esc(line)}</p>`)
    .join('');
}

export interface NoteContent {
  id: string;
  schemaVersion: 1;
  pages: NotePage[];
  updatedAt: string;
}

export interface NotebookIndex {
  folders: NoteFolder[];
  notes: NoteMeta[];
  /** Permanently deleted ids -> when. Stops another device resurrecting them. */
  deleted: Record<string, string>;
}

export type SaveStatus = 'saved' | 'saving' | 'local' | 'offline' | 'error';

// ---------- constants ----------

const INDEX_KEY = 'learning_os_notebook_index_v1';
const CLOUD_INDEX_KEY = 'notebookIndex';
const cloudNoteKey = (id: string) => `note_${id}`;
const TRASH_DAYS = 30;
const MAX_CLOUD_DOC_CHARS = 900_000; // Firestore limit is 1 MiB per document
export const FOLDER_COLORS = ['#6b7280', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

// ---------- tiny helpers ----------

const nowIso = () => new Date().toISOString();
const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function makePreview(pages: NotePage[]): string {
  return (pages[0]?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

// ---------- IndexedDB (page content) ----------

const DB_NAME = 'learning_os_notebook';
const STORE = 'contents';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(id: string, value: NoteContent): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function idbGet(id: string): Promise<NoteContent | null> {
  const db = await openDb();
  try {
    return await new Promise<NoteContent | null>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as NoteContent | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbDelete(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // best-effort cleanup
  }
}

async function idbAll(): Promise<NoteContent[]> {
  const db = await openDb();
  try {
    return await new Promise<NoteContent[]>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as NoteContent[]);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

// ---------- index (in-memory cache + localStorage + subscribers) ----------

let cache: NotebookIndex | null = null;
const listeners = new Set<() => void>();

function emptyIndex(): NotebookIndex {
  return { folders: [], notes: [], deleted: {} };
}

function readIndex(): NotebookIndex {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return emptyIndex();
    const p = JSON.parse(raw);
    return {
      folders: Array.isArray(p?.folders) ? p.folders : [],
      notes: Array.isArray(p?.notes) ? p.notes : [],
      deleted: p?.deleted && typeof p.deleted === 'object' ? p.deleted : {},
    };
  } catch {
    return emptyIndex();
  }
}

export function getIndex(): NotebookIndex {
  if (!cache) {
    cache = readIndex();
    purgeOldTrash(cache);
  }
  return cache;
}

let indexPushTimer: ReturnType<typeof setTimeout> | undefined;

/** Replace the index: memory -> localStorage -> subscribers -> (debounced) cloud. */
function commitIndex(next: NotebookIndex, opts: { push?: boolean } = {}): void {
  cache = next;
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(next));
  } catch {
    setStatus('error');
  }
  listeners.forEach((l) => l());
  if (opts.push !== false) {
    setStatus('saving');
    clearTimeout(indexPushTimer);
    indexPushTimer = setTimeout(() => void pushIndex(), 1200);
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useNotebookIndex(): NotebookIndex {
  return useSyncExternalStore(subscribe, getIndex, getIndex);
}

/** Notes older than TRASH_DAYS in the trash are removed for good. */
function purgeOldTrash(idx: NotebookIndex): void {
  const cutoff = Date.now() - TRASH_DAYS * 86_400_000;
  const stale = idx.notes.filter((n) => n.trashedAt && new Date(n.trashedAt).getTime() < cutoff);
  if (stale.length === 0) return;
  for (const n of stale) {
    idx.deleted[n.id] = nowIso();
    void idbGet(n.id)
      .catch(() => null)
      .then((c) => {
        c?.pages.forEach((p) => void deleteFromCloud(cloudInkKey(n.id, p.id)));
        void idbDelete(n.id);
      });
    void deleteFromCloud(cloudNoteKey(n.id));
  }
  idx.notes = idx.notes.filter((n) => !stale.includes(n));
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  } catch {
    // ignore
  }
}

// ---------- save status (the "Saving… / Saved" chip) ----------

let status: SaveStatus = 'saved';
const statusListeners = new Set<() => void>();
const pendingContent = new Set<string>();

function setStatus(s: SaveStatus): void {
  if (status === s) return;
  status = s;
  statusListeners.forEach((l) => l());
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    () => status,
    () => status
  );
}

function settleStatus(cloudOk: boolean): void {
  if (pendingContent.size > 0 || indexPushTimer) return; // more work queued
  if (cloudOk) setStatus('saved');
  else setStatus(navigator.onLine ? 'local' : 'offline');
}

// ---------- cloud content (text doc + one ink doc per page) ----------

const cloudInkKey = (noteId: string, pageId: string) => `ink_${noteId}_${pageId}`;
/** Last ink payload (hash) pushed OK per ink doc, so unchanged pages aren't re-uploaded every autosave. */
const inkSigs = new Map<string, string>();

function hashStr(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return `${str.length}:${h}`;
}

/** Push one note to the cloud. Returns true only if EVERYTHING landed. */
async function pushContent(content: NoteContent): Promise<boolean> {
  let ok = true;
  const main: NoteContent = {
    ...content,
    pages: content.pages.map((p) => {
      const { ink, ...rest } = p;
      return ink && ink.length > 0 ? { ...rest, hasInk: true } : rest;
    }),
  };
  if (JSON.stringify(main).length > MAX_CLOUD_DOC_CHARS) return false;
  for (const p of content.pages) {
    const key = cloudInkKey(content.id, p.id);
    if (!p.ink || p.ink.length === 0) {
      if (inkSigs.has(key)) {
        inkSigs.delete(key); // the student cleared this page's ink — drop the cloud copy too
        void deleteFromCloud(key);
      }
      continue;
    }
    const json = JSON.stringify(p.ink);
    if (json.length > MAX_CLOUD_DOC_CHARS) {
      ok = false; // a single page this heavy stays on this device (status shows "not synced")
      continue;
    }
    const sig = hashStr(json);
    if (inkSigs.get(key) === sig) continue;
    if (await pushToCloudChecked(key, { strokes: p.ink })) inkSigs.set(key, sig);
    else ok = false;
  }
  // Main doc last: anyone who sees `hasInk` can already fetch the ink doc.
  if (!(await pushToCloudChecked(cloudNoteKey(content.id), main))) ok = false;
  return ok;
}

/** Pull one note from the cloud, ink included. null = missing OR incomplete (never a half note). */
async function pullContent(id: string): Promise<NoteContent | null> {
  const main = await pullFromCloud<NoteContent>(cloudNoteKey(id));
  if (!main || !Array.isArray(main.pages)) return null;
  const pages: NotePage[] = [];
  for (const p of main.pages) {
    if (!p.hasInk) {
      pages.push(p);
      continue;
    }
    const doc = await pullFromCloud<{ strokes: InkStroke[] }>(cloudInkKey(id, p.id));
    if (!doc || !Array.isArray(doc.strokes)) return null; // ink not reachable right now — don't store a note missing its handwriting
    const { hasInk, ...rest } = p;
    void hasInk;
    pages.push({ ...rest, ink: doc.strokes });
    inkSigs.set(cloudInkKey(id, p.id), hashStr(JSON.stringify(doc.strokes)));
  }
  return { ...main, pages };
}

// ---------- cloud push ----------

async function pushIndex(): Promise<void> {
  indexPushTimer = undefined;
  const ok = await pushToCloudChecked(CLOUD_INDEX_KEY, getIndex());
  settleStatus(ok);
}

const contentTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Page ids each note had the last time we saw it, so a deleted page can be spotted on the next save. */
const knownPageIds = new Map<string, string[]>();
/** Pages removed from a note whose cloud ink document still has to be deleted. */
const removedPages = new Map<string, Set<string>>();

function trackPages(noteId: string, pages: NotePage[], previous: string[] | undefined): void {
  const ids = pages.map((p) => p.id);
  knownPageIds.set(noteId, ids);
  const keep = new Set(ids);
  const gone = (previous ?? []).filter((x) => !keep.has(x));
  const pending = removedPages.get(noteId) ?? new Set<string>();
  gone.forEach((x) => pending.add(x));
  ids.forEach((x) => pending.delete(x)); // a page that came back (undo delete) must not be cleaned up
  if (pending.size > 0) removedPages.set(noteId, pending);
  else removedPages.delete(noteId);
}

/** Delete the cloud ink documents of pages the student removed. Called after a successful push. */
function cleanRemovedPages(noteId: string): void {
  const pending = removedPages.get(noteId);
  if (!pending) return;
  pending.forEach((pageId) => {
    const key = cloudInkKey(noteId, pageId);
    inkSigs.delete(key);
    void deleteFromCloud(key);
  });
  removedPages.delete(noteId);
}

function scheduleContentPush(id: string, content: NoteContent): void {
  pendingContent.add(id);
  clearTimeout(contentTimers.get(id));
  contentTimers.set(
    id,
    setTimeout(async () => {
      contentTimers.delete(id);
      const ok = await pushContent(content);
      if (ok) cleanRemovedPages(id);
      pendingContent.delete(id);
      settleStatus(ok);
    }, 2500)
  );
}

// ---------- notes: create / read / save ----------

export async function createNote(folderId: string | null = null, title = ''): Promise<NoteMeta> {
  const t = nowIso();
  const page: NotePage = { id: newId('pg'), text: '' };
  const meta: NoteMeta = {
    id: newId('note'),
    title,
    folderId,
    tags: [],
    pinned: false,
    favorite: false,
    archived: false,
    trashedAt: null,
    createdAt: t,
    updatedAt: t,
    pageCount: 1,
    preview: '',
  };
  const content: NoteContent = { id: meta.id, schemaVersion: 1, pages: [page], updatedAt: t };
  await idbPut(meta.id, content);
  const idx = getIndex();
  commitIndex({ ...idx, notes: [meta, ...idx.notes] });
  scheduleContentPush(meta.id, content);
  return meta;
}

/** Local first; if this device has never seen the note, try the cloud copy. */
export async function loadNoteContent(id: string): Promise<NoteContent | null> {
  try {
    const local = await idbGet(id);
    if (local) {
      knownPageIds.set(id, local.pages.map((p) => p.id));
      return local;
    }
  } catch {
    // fall through to cloud
  }
  const remote = await pullContent(id);
  if (remote) {
    try {
      await idbPut(id, remote);
    } catch {
      // still usable in memory
    }
  }
  return remote;
}

/** Called by the editor's autosave. Writes content, refreshes the note's meta. */
export async function saveNoteContent(id: string, title: string, pages: NotePage[]): Promise<boolean> {
  const t = nowIso();
  const content: NoteContent = { id, schemaVersion: 1, pages, updatedAt: t };
  setStatus('saving');
  let previous = knownPageIds.get(id);
  if (!previous) previous = (await idbGet(id).catch(() => null))?.pages.map((p) => p.id);
  try {
    await idbPut(id, content);
  } catch {
    setStatus('error'); // device storage refused the write — tell the student honestly
    return false;
  }
  trackPages(id, pages, previous);
  const idx = getIndex();
  commitIndex(
    {
      ...idx,
      notes: idx.notes.map((n) =>
        n.id === id ? { ...n, title, updatedAt: t, pageCount: pages.length, preview: makePreview(pages) } : n
      ),
    },
    { push: false }
  );
  // index push is part of the same debounce chain as content
  clearTimeout(indexPushTimer);
  indexPushTimer = setTimeout(() => void pushIndex(), 2500);
  scheduleContentPush(id, content);
  return true;
}

// ---------- notes: library operations (all synchronous, all undoable by snapshot) ----------

/** Merge a patch into a note; keys patched to `undefined` are REMOVED (Firestore rejects undefined values). */
function applyPatch(n: NoteMeta, patch: Partial<NoteMeta>, t: string): NoteMeta {
  const next: NoteMeta = { ...n, ...patch, updatedAt: t };
  (Object.keys(patch) as (keyof NoteMeta)[]).forEach((k) => {
    if (patch[k] === undefined) delete next[k];
  });
  return next;
}

function patchNote(id: string, patch: Partial<NoteMeta>): void {
  patchNotes([id], patch);
}

function patchNotes(ids: string[], patch: Partial<NoteMeta>): void {
  const set = new Set(ids);
  const idx = getIndex();
  const t = nowIso();
  commitIndex({ ...idx, notes: idx.notes.map((n) => (set.has(n.id) ? applyPatch(n, patch, t) : n)) });
}

export const renameNote = (id: string, title: string) => patchNote(id, { title: title.trim() });
export const setNoteTags = (id: string, tags: string[]) =>
  patchNote(id, { tags: Array.from(new Set(tags.map((x) => x.trim()).filter(Boolean))) });
export const togglePin = (id: string, on: boolean) => patchNote(id, { pinned: on });
export const toggleFavorite = (id: string, on: boolean) => patchNote(id, { favorite: on });
export const setArchived = (ids: string[], on: boolean) => patchNotes(ids, { archived: on });

// ---- study details (Part 6). 'not-started' / no confidence / no date are stored as "absent". ----
export const setStudyStatus = (ids: string[], status: StudyStatus) =>
  patchNotes(ids, { status: status === 'not-started' ? undefined : status });
export const setConfidence = (id: string, confidence: number) =>
  patchNote(id, { confidence: confidence >= 1 && confidence <= 5 ? Math.round(confidence) : undefined });
/** `date` = 'YYYY-MM-DD', or null to clear. Anything that is not a real calendar date clears it. */
export const setExamDate = (id: string, date: string | null) =>
  patchNote(id, { examDate: date && parseLocalDate(date) ? date : undefined });
export const moveNotes = (ids: string[], folderId: string | null) => patchNotes(ids, { folderId });
export const trashNotes = (ids: string[]) => patchNotes(ids, { trashedAt: nowIso(), pinned: false });
export const restoreNotes = (ids: string[]) => patchNotes(ids, { trashedAt: null });

export async function duplicateNote(id: string): Promise<NoteMeta | null> {
  const src = getIndex().notes.find((n) => n.id === id);
  const content = await loadNoteContent(id);
  if (!src || !content) return null;
  const t = nowIso();
  const copy: NoteMeta = {
    ...src,
    id: newId('note'),
    title: src.title ? `${src.title} (copy)` : '',
    pinned: false,
    trashedAt: null,
    createdAt: t,
    updatedAt: t,
  };
  const copyContent: NoteContent = {
    id: copy.id,
    schemaVersion: 1,
    pages: content.pages.map((p) => ({ ...p, id: newId('pg') })),
    updatedAt: t,
  };
  await idbPut(copy.id, copyContent);
  const idx = getIndex();
  commitIndex({ ...idx, notes: [copy, ...idx.notes] });
  scheduleContentPush(copy.id, copyContent);
  return copy;
}

/** Permanent. The UI must confirm first; there is no undo for this one. */
export async function deleteNotesForever(ids: string[]): Promise<void> {
  const set = new Set(ids);
  const idx = getIndex();
  const t = nowIso();
  const deleted = { ...idx.deleted };
  ids.forEach((id) => (deleted[id] = t));
  commitIndex({ ...idx, notes: idx.notes.filter((n) => !set.has(n.id)), deleted });
  for (const id of ids) {
    const c = await idbGet(id).catch(() => null);
    c?.pages.forEach((p) => void deleteFromCloud(cloudInkKey(id, p.id)));
    await idbDelete(id);
    void deleteFromCloud(cloudNoteKey(id));
  }
}

// ---------- folders ----------

export function createFolder(name: string, parentId: string | null): NoteFolder {
  const t = nowIso();
  const folder: NoteFolder = {
    id: newId('fld'),
    name: name.trim() || 'Folder',
    parentId,
    color: FOLDER_COLORS[0],
    createdAt: t,
    updatedAt: t,
  };
  const idx = getIndex();
  commitIndex({ ...idx, folders: [...idx.folders, folder] });
  return folder;
}

function patchFolder(id: string, patch: Partial<NoteFolder>): void {
  const idx = getIndex();
  commitIndex({
    ...idx,
    folders: idx.folders.map((f) => (f.id === id ? { ...f, ...patch, updatedAt: nowIso() } : f)),
  });
}

export const renameFolder = (id: string, name: string) => patchFolder(id, { name: name.trim() || 'Folder' });
export const recolorFolder = (id: string, color: string) => patchFolder(id, { color });

/** Every folder id inside `id` (children, grandchildren…), not including `id`. */
export function descendantFolderIds(id: string, folders = getIndex().folders): Set<string> {
  const out = new Set<string>();
  const walk = (pid: string) =>
    folders.forEach((f) => {
      if (f.parentId === pid && !out.has(f.id)) {
        out.add(f.id);
        walk(f.id);
      }
    });
  walk(id);
  return out;
}

/** Refuses to move a folder into itself or its own subfolder. */
export function moveFolder(id: string, parentId: string | null): boolean {
  if (parentId === id || (parentId && descendantFolderIds(id).has(parentId))) return false;
  patchFolder(id, { parentId });
  return true;
}

/** Deleting a folder never deletes notes: its notes and subfolders move up one level. */
export function deleteFolder(id: string): void {
  const idx = getIndex();
  const folder = idx.folders.find((f) => f.id === id);
  if (!folder) return;
  const t = nowIso();
  commitIndex({
    ...idx,
    folders: idx.folders.filter((f) => f.id !== id).map((f) => (f.parentId === id ? { ...f, parentId: folder.parentId, updatedAt: t } : f)),
    notes: idx.notes.map((n) => (n.folderId === id ? { ...n, folderId: folder.parentId, updatedAt: t } : n)),
    deleted: { ...idx.deleted, [id]: t },
  });
}

// ---------- undo (snapshot of the index) ----------

export function snapshotIndex(): NotebookIndex {
  return JSON.parse(JSON.stringify(getIndex()));
}

export function restoreSnapshot(snap: NotebookIndex): void {
  const t = nowIso();
  // Stamp every row as "just changed" so the undo wins the newest-wins cloud merge.
  commitIndex({
    folders: snap.folders.map((f) => ({ ...f, updatedAt: t })),
    notes: snap.notes.map((n) => ({ ...n, updatedAt: t })),
    deleted: snap.deleted,
  });
}

// ---------- search ----------

/** Ids of notes whose title, tags or page text contain every word of `query`. */
export async function searchNoteIds(query: string): Promise<Set<string>> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  if (words.length === 0) return out;
  const idx = getIndex();
  const bodies = new Map<string, string>();
  try {
    (await idbAll()).forEach((c) => bodies.set(c.id, c.pages.map((p) => p.text).join(' ').toLowerCase()));
  } catch {
    // search titles/tags only if IndexedDB is unavailable
  }
  for (const n of idx.notes) {
    const hay = `${n.title} ${n.tags.join(' ')} ${bodies.get(n.id) ?? n.preview}`.toLowerCase();
    if (words.every((w) => hay.includes(w))) out.add(n.id);
  }
  return out;
}

// ---------- cloud hydration + merge ----------

function newer(a: { updatedAt: string }, b: { updatedAt: string }): boolean {
  return new Date(a.updatedAt).getTime() > new Date(b.updatedAt).getTime();
}

function mergeById<T extends { id: string; updatedAt: string }>(
  local: T[],
  cloud: T[],
  deleted: Record<string, string>
): T[] {
  const map = new Map<string, T>();
  [...local, ...cloud].forEach((row) => {
    if (deleted[row.id]) return;
    const cur = map.get(row.id);
    if (!cur || newer(row, cur)) map.set(row.id, row);
  });
  return Array.from(map.values());
}

let hydrating: Promise<void> | null = null;

/** Call once when the notebook opens. Safe to call repeatedly. Never throws. */
export function hydrateNotebook(): Promise<void> {
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const local = getIndex();
      const cloud = await pullFromCloud<NotebookIndex>(CLOUD_INDEX_KEY);
      if (!cloud) {
        // Nothing in the cloud yet (or offline): push what we have, if anything.
        if (local.notes.length > 0 || local.folders.length > 0) {
          await pushIndex();
          await pushAllContents(local.notes.map((n) => n.id));
        }
        return;
      }
      const deleted = { ...(cloud.deleted ?? {}), ...local.deleted };
      const merged: NotebookIndex = {
        deleted,
        folders: mergeById(local.folders, cloud.folders ?? [], deleted),
        notes: mergeById(local.notes, cloud.notes ?? [], deleted),
      };
      // Anything another device permanently deleted must also leave this device.
      local.notes.filter((n) => deleted[n.id]).forEach((n) => void idbDelete(n.id));
      commitIndex(merged, { push: false });

      const cloudById = new Map((cloud.notes ?? []).map((n) => [n.id, n]));
      const localById = new Map(local.notes.map((n) => [n.id, n]));
      const toPull: string[] = [];
      const toPush: string[] = [];
      for (const n of merged.notes) {
        const c = cloudById.get(n.id);
        const l = localById.get(n.id);
        if (c && (!l || newer(c, l))) toPull.push(n.id); // cloud is newer / new to this device
        else if (l && (!c || newer(l, c))) toPush.push(n.id); // this device is newer
      }
      await runPool(toPull, 4, async (id) => {
        const remote = await pullContent(id);
        if (remote) await idbPut(id, remote).catch(() => undefined);
      });
      if (toPush.length > 0 || merged.notes.length !== cloudById.size) await pushIndex();
      await pushAllContents(toPush);
    } catch {
      // best-effort — the notebook keeps working on local data
    }
  })().finally(() => {
    hydrating = null;
  });
  return hydrating;
}

async function pushAllContents(ids: string[]): Promise<void> {
  let allOk = true;
  await runPool(ids, 4, async (id) => {
    const c = await idbGet(id).catch(() => null);
    if (!c) return;
    if (!(await pushContent(c))) allOk = false;
  });
  settleStatus(allOk);
}

async function runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift() as T).catch(() => undefined);
    })
  );
}

/** Manual "Sync now" / the browser coming back online. */
export function retrySync(): Promise<void> {
  const idx = getIndex();
  setStatus('saving');
  return hydrateNotebook().then(() => pushAllContents(idx.notes.map((n) => n.id)));
}

// Flush + retry hooks: when the device comes back online, retry; when the tab
// is hidden/closed, push the index immediately instead of waiting for the timer.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (status === 'offline' || status === 'local') void retrySync();
  });
  window.addEventListener('offline', () => {
    if (status !== 'saved') setStatus('offline');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && indexPushTimer) {
      clearTimeout(indexPushTimer);
      void pushIndex();
    }
  });
}
