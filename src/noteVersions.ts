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
const MAX_BYTES = 4_000_000; // a note with a lot of handwriting can be big: skip rather than fill the device

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

/** Returns the saved version, or null when nothing changed since the last one (or the note is too big). */
export async function saveVersion(noteId: string, snap: VersionData, kind: VersionKind, now = new Date()): Promise<VersionMeta | null> {
  const data = JSON.stringify(snap);
  if (data.length > MAX_BYTES) return null;
  const hash = hashOf(data);
  const existing = await listVersions(noteId);
  if (existing[0]?.hash === hash && kind === 'auto') return null;
  const at = now.toISOString();
  const meta: VersionMeta = {
    key: `${noteId}:${at}`,
    noteId,
    at,
    kind,
    title: snap.title,
    pages: snap.pages.length,
    chars: snap.pages.reduce((n, p) => n + p.text.length, 0),
    hash,
  };
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['meta', 'data'], 'readwrite');
    tx.objectStore('meta').put(meta);
    tx.objectStore('data').put({ key: meta.key, data });
    // keep only the newest KEEP_VERSIONS of this note
    const drop = [meta, ...existing].slice(KEEP_VERSIONS);
    for (const d of drop) {
      tx.objectStore('meta').delete(d.key);
      tx.objectStore('data').delete(d.key);
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('save-failed'));
  });
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
