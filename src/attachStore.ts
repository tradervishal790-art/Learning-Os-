// ============================================================
// attachStore.ts — device-only storage for notebook attachments
// that are too big for the note document: compressed images and
// imported PDF files. (Audio has its own store: audioStore.ts.)
//
// Blobs live in IndexedDB on THIS device only. The note itself only
// keeps a small reference (id + name), which does sync to the cloud —
// on another device the attachment shows a "not on this device" card.
// ============================================================

const DB_NAME = 'learning_os_attach';
const DB_VERSION = 1;

type StoreName = 'images' | 'pdfs';

interface Rec {
  id: string;
  blob: Blob;
  name: string;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Storage is not available in this browser (private mode?).'));
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ['images', 'pdfs'] as StoreName[]) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error ?? new Error('Cannot open the attachment database.'));
      req.onblocked = () => reject(new Error('The attachment database is blocked by another tab.'));
    }).catch((e: unknown) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, work: (s: IDBObjectStore, set: (v: T) => void) => void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    let result: T | undefined;
    const tx = db.transaction(store, mode);
    tx.oncomplete = () => resolve(result as T);
    tx.onabort = () =>
      reject(tx.error?.name === 'QuotaExceededError' ? new Error('Not enough storage space on this device.') : (tx.error ?? new Error('Storage error.')));
    work(tx.objectStore(store), (v) => {
      result = v;
    });
  });
}

const put = (store: StoreName, id: string, blob: Blob, name: string) =>
  run<void>(store, 'readwrite', (s) => {
    const rec: Rec = { id, blob, name, createdAt: new Date().toISOString() };
    s.put(rec);
  });

const get = (store: StoreName, id: string) =>
  run<Rec | null>(store, 'readonly', (s, set) => {
    set(null);
    const req = s.get(id);
    req.onsuccess = () => set((req.result as Rec | undefined) ?? null);
  });

const del = (store: StoreName, id: string) => run<void>(store, 'readwrite', (s) => void s.delete(id));

export const newAttachId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const putImage = (id: string, blob: Blob, name: string) => put('images', id, blob, name);
export const getImage = async (id: string): Promise<Blob | null> => (await get('images', id))?.blob ?? null;
export const deleteImage = (id: string) => del('images', id);

export const putPdf = (id: string, blob: Blob, name: string) => put('pdfs', id, blob, name);
export const getPdf = async (id: string): Promise<Blob | null> => (await get('pdfs', id))?.blob ?? null;
export const deletePdf = (id: string) => del('pdfs', id);
