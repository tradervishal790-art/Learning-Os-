export interface AudioMeta { id: string; mime: string; durationSec: number; bookmarks: number[]; createdAt: string; size: number }

const DB_NAME = 'learning_os_audio';
const STORE = 'clips';
const DB_VERSION = 1;

interface ClipRecord { id: string; blob: Blob; meta: AudioMeta }

let dbPromise: Promise<IDBDatabase> | null = null;

function toError(e: unknown, fallback: string): Error {
  if (e instanceof Error) {
    return e.name === 'QuotaExceededError' ? new Error('Not enough storage space to save this audio clip.') : e;
  }
  return new Error(fallback);
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this browser (private mode?). Audio cannot be stored.'));
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      let req: IDBOpenDBRequest;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        reject(toError(e, 'Cannot open the audio database.'));
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        db.onclose = () => { dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => reject(toError(req.error, 'Cannot open the audio database.'));
      req.onblocked = () => reject(new Error('The audio database is blocked by another tab. Close other tabs and retry.'));
    }).catch((err: unknown) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/** Runs one transaction; resolves only on tx.oncomplete, so no transaction is ever left open. */
async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, setResult: (v: T) => void, fail: (e: Error) => void) => void,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    let result: T | undefined;
    let failure: Error | null = null;
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, mode);
    } catch (e) {
      reject(toError(e, 'Cannot start an audio database transaction.'));
      return;
    }
    tx.oncomplete = () => resolve(result as T);
    tx.onabort = () => reject(failure ?? toError(tx.error, 'The audio database operation was aborted.'));
    tx.onerror = () => { /* surfaces through onabort */ };
    const fail = (e: Error): void => {
      failure = e;
      try { tx.abort(); } catch { /* already finished */ }
    };
    try {
      work(tx.objectStore(STORE), (v) => { result = v; }, fail);
    } catch (e) {
      fail(toError(e, 'Audio database error.'));
    }
  });
}

export async function putAudio(
  id: string,
  blob: Blob,
  meta: Omit<AudioMeta, 'id' | 'size' | 'mime'> & { mime?: string },
): Promise<AudioMeta> {
  if (!id) throw new Error('putAudio: id is required');
  const saved: AudioMeta = {
    id,
    mime: meta.mime ?? (blob.type || 'audio/webm'),
    durationSec: Number.isFinite(meta.durationSec) ? meta.durationSec : 0,
    bookmarks: [...meta.bookmarks],
    createdAt: meta.createdAt,
    size: blob.size,
  };
  const record: ClipRecord = { id, blob, meta: saved };
  return withStore<AudioMeta>('readwrite', (store, setResult) => {
    store.put(record);
    setResult(saved);
  });
}

export async function getAudio(id: string): Promise<{ blob: Blob; meta: AudioMeta } | null> {
  return withStore<{ blob: Blob; meta: AudioMeta } | null>('readonly', (store, setResult) => {
    setResult(null);
    const req = store.get(id);
    req.onsuccess = () => {
      const rec = req.result as ClipRecord | undefined;
      setResult(rec && rec.blob instanceof Blob ? { blob: rec.blob, meta: rec.meta } : null);
    };
  });
}

export async function updateBookmarks(id: string, bookmarks: number[]): Promise<void> {
  return withStore<void>('readwrite', (store, _set, fail) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const rec = req.result as ClipRecord | undefined;
      if (!rec) { fail(new Error('Audio clip not found.')); return; }
      store.put({ ...rec, meta: { ...rec.meta, bookmarks: [...bookmarks] } });
    };
  });
}

export async function deleteAudio(id: string): Promise<void> {
  return withStore<void>('readwrite', (store) => { store.delete(id); });
}

export async function listAudioMeta(): Promise<AudioMeta[]> {
  const list = await withStore<AudioMeta[]>('readonly', (store, setResult) => {
    const out: AudioMeta[] = [];
    setResult(out);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        out.push((cursor.value as ClipRecord).meta);
        cursor.continue();
      }
    };
  });
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Returns null when the Storage API is unavailable (it never rejects). */
export async function storageStatus(): Promise<{ usedBytes: number; quotaBytes: number; low: boolean } | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.estimate !== 'function') return null;
    const est = await navigator.storage.estimate();
    const usedBytes = est.usage ?? 0;
    const quotaBytes = est.quota ?? 0;
    if (quotaBytes <= 0) return null;
    const low = quotaBytes - usedBytes < 50 * 1024 * 1024 || usedBytes > quotaBytes * 0.9;
    return { usedBytes, quotaBytes, low };
  } catch {
    return null;
  }
}
