// ============================================================
// noteVersions.ts — version history of a note (Part 10).
// Snapshots live on THIS device (IndexedDB); the last 20 per note are kept.
// ============================================================

import type { NotePage, NoteVideo } from './notebookStore';

export type VersionKind = 'auto' | 'manual' | 'before-restore';

export interface VersionMeta {
  key: string;
  noteId: string;
  /** ISO time. */
  at: string;
  kind: VersionKind;
  title: string;
  pages: number;
  chars: number;
  hash: string;
}

export interface VersionData {
  title: string;
  pages: NotePage[];
  video?: NoteVideo;
}

export const KEEP_VERSIONS = 20;

const DB = 'learning_os_versions';
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('no-storage'));
  if (!dbp) {
    dbp = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const meta = db.createObjectStore('meta', { keyPath: 'key' });
        meta.createIndex('noteId', 'noteId');
        db.createObjectStore('data', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        req.result.onclose = () => (dbp = null);
        resolve(req.result);
      };
      req.onerror = () => reject(req.error ?? new Error('open-failed'));
    }).catch((e: unknown) => {
      dbp = null;
      throw e;
    });
  }
  return dbp;
}

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Small, stable fingerprint so an unchanged note is not saved twice. */
function hashOf(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

export async function listVersions(noteId: string): Promise<VersionMeta[]> {
  const db = await open();
  const all = await done(db.transaction('meta').objectStore('meta').index('noteId').getAll(IDBKeyRange.only(noteId)) as IDBRequest<VersionMeta[]>);
  return all.sort((a, b) => b.at.localeCompare(a.at));
}

/** Returns the saved version, or null when an automatic snapshot duplicates the latest version. IndexedDB decides whether the device has room; do not silently discard snapshots at an arbitrary 4 MB cutoff. */
export async function saveVersion(noteId: string, snap: VersionData, kind: VersionKind, now = new Date()): Promise<VersionMeta | null> {
  const data = JSON.stringify(snap);
  const hash = hashOf(data);
  const existing = await listVersions(noteId);
  if (existing[0]?.hash === hash && kind === 'auto') return null;
  const at = now.toISOString();
  const meta: VersionMeta = {
    // Include a unique suffix: multiple manual snapshots can legitimately be created in one millisecond.
    key: `${noteId}:${at}:${Math.random().toString(36).slice(2, 9)}`,
    noteId,
    at,
    kind,
    title: snap.title,
    pages: snap.pages.length,
    chars: snap.pages.reduce((n, p) => n + p.text.length, 0),
    hash,
  };
  const db = await open();
  const write = (drop: VersionMeta[]) =>
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['meta', 'data'], 'readwrite');
      tx.objectStore('meta').put(meta);
      tx.objectStore('data').put({ key: meta.key, data });
      for (const d of drop) {
        tx.objectStore('meta').delete(d.key);
        tx.objectStore('data').delete(d.key);
      }
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('save-failed'));
    });
  // keep only the newest KEEP_VERSIONS of this note
  const drop = [meta, ...existing].slice(KEEP_VERSIONS);
  try {
    await write(drop);
  } catch (e) {
    if ((e as { name?: string } | null)?.name !== 'QuotaExceededError') throw e;
    // The device is nearly full: free the OLDEST half of this note's history (the newest two are never touched) and try once more.
    const older = existing.slice(2);
    const free = older.slice(Math.ceil(older.length / 2));
    if (free.length === 0) throw e;
    await write([...drop, ...free.filter((f) => !drop.some((d) => d.key === f.key))]);
  }
  return meta;
}

export async function getVersion(key: string): Promise<VersionData | null> {
  const db = await open();
  const rec = await done(db.transaction('data').objectStore('data').get(key) as IDBRequest<{ key: string; data: string } | undefined>);
  if (!rec) return null;
  try {
    return JSON.parse(rec.data) as VersionData;
  } catch {
    return null;
  }
}

/** Remove every version of a note (used when the note is deleted forever). */
export async function deleteVersions(noteId: string): Promise<void> {
  const db = await open();
  const keys = (await listVersions(noteId)).map((v) => v.key);
  if (keys.length === 0) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['meta', 'data'], 'readwrite');
    for (const k of keys) {
      tx.objectStore('meta').delete(k);
      tx.objectStore('data').delete(k);
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('delete-failed'));
  });
}
