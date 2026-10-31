// ============================================================
// attachStore.ts — device-only storage for notebook attachments
// that are too big for the note document: compressed images and
// imported PDF files. (Audio has its own store: audioStore.ts.)
//
// Blobs live in IndexedDB on this device. The note itself only keeps a small
// reference (id + name), which syncs to the cloud.
// PHOTOS also sync: each one is copied to the account as its own small document
// (`img_<id>`, base64) and fetched on demand when another device opens the note
// (getImage falls back to the cloud). PDFs and voice recordings are too big for a
// Firestore document, so they stay on the device that added them.
// ============================================================
import { deleteFromCloud, pullFromCloud, pushToCloudChecked } from './cloudSync';

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
    let workError: unknown;
    let tx: IDBTransaction;
    try {
      tx = db.transaction(store, mode);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Cannot start the attachment storage transaction.'));
      return;
    }
    tx.oncomplete = () => resolve(result as T);
    tx.onabort = () => {
      const error = workError ?? tx.error;
      reject(error instanceof Error && error.name === 'QuotaExceededError'
        ? new Error('Not enough storage space on this device.')
        : (error instanceof Error ? error : new Error('Attachment storage operation was aborted.')));
    };
    try {
      work(tx.objectStore(store), (v) => {
        result = v;
      });
    } catch (error) {
      workError = error;
      try { tx.abort(); } catch { reject(error instanceof Error ? error : new Error('Attachment storage operation failed.')); }
    }
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
// ---------- photo sync (Firestore, one document per photo) ----------

/** A Firestore document holds 1 MiB; base64 adds a third. Bigger photos stay on the device. */
export const IMAGE_CLOUD_MAX_BYTES = 650_000;
const imageKey = (id: string) => `img_${id}`;
const pushedImages = new Set<string>();
const imageMisses = new Map<string, number>(); // id -> when the cloud last said "not there"
const imageFetches = new Map<string, Promise<Blob | null>>();
const MISS_MS = 60_000;

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function base64ToBlob(data: string, mime: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Copy one photo to the account (once per session). false = it stays on this device only. */
export async function pushImageToCloud(id: string): Promise<boolean> {
  if (pushedImages.has(id)) return true;
  const rec = await get('images', id).catch(() => null);
  if (!rec || rec.blob.size === 0 || rec.blob.size > IMAGE_CLOUD_MAX_BYTES) return false;
  const ok = await pushToCloudChecked(imageKey(id), { mime: rec.blob.type || 'image/jpeg', name: rec.name, data: await blobToBase64(rec.blob) });
  if (ok) pushedImages.add(id);
  return ok;
}

/** Remove a photo's cloud copy (the note was deleted for good). */
export const deleteImageFromCloud = (id: string): Promise<void> => {
  pushedImages.delete(id);
  return deleteFromCloud(imageKey(id));
};

async function fetchImageFromCloud(id: string): Promise<Blob | null> {
  const last = imageMisses.get(id);
  if (last !== undefined && Date.now() - last < MISS_MS) return null;
  const doc = await pullFromCloud<{ mime?: string; name?: string; data?: string }>(imageKey(id));
  if (!doc || typeof doc.data !== 'string' || doc.data === '') {
    imageMisses.set(id, Date.now());
    return null;
  }
  const blob = base64ToBlob(doc.data, doc.mime || 'image/jpeg');
  await put('images', id, blob, doc.name || 'photo').catch(() => undefined); // keep a local copy for next time
  pushedImages.add(id);
  return blob;
}

/** The photo from this device; when it is not here (the note came from another device), from the account. */
export const getImage = async (id: string): Promise<Blob | null> => {
  const local = (await get('images', id))?.blob ?? null;
  if (local) return local;
  let pending = imageFetches.get(id);
  if (!pending) {
    pending = fetchImageFromCloud(id).finally(() => imageFetches.delete(id));
    imageFetches.set(id, pending);
  }
  return pending;
};
export const deleteImage = (id: string) => del('images', id);

export const putPdf = (id: string, blob: Blob, name: string) => put('pdfs', id, blob, name);
export const getPdf = async (id: string): Promise<Blob | null> => (await get('pdfs', id))?.blob ?? null;
export const deletePdf = (id: string) => del('pdfs', id);
