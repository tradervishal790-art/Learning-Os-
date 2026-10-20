import { dedupeQuestions } from './questionDedup';
import { loadDaily, saveBank } from './dailyTestStore';
import { prepareUpload, extractQuestionsFromPhoto, toBuilderQuestions } from './testImport';
import type { TestQuestion } from './types';

const DB_NAME = 'learning-os-daily-photo-queue';
const STORE_NAME = 'photos';
const META_KEY = 'learning_os_daily_photo_queue_count';
const MAX_FILES = 200;

export interface QueuedPhoto {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  addedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open photo storage.'));
  });
}

async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    let result: T;
    let hasResult = false;
    run(tx.objectStore(STORE_NAME), (value) => { result = value; hasResult = true; }, reject);
    tx.oncomplete = () => {
      db.close();
      resolve(hasResult ? result! : undefined as T);
    };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Photo storage failed.')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Photo storage was interrupted.')); };
  });
}

function updateCount(count: number): void {
  try { localStorage.setItem(META_KEY, String(count)); } catch { /* IndexedDB remains the source of truth. */ }
}

export async function getQueuedPhotoCount(): Promise<number> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).count();
      request.onsuccess = () => { updateCount(request.result); resolve(request.result); };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    try { return Math.max(0, Number(localStorage.getItem(META_KEY)) || 0); } catch { return 0; }
  }
}

export async function enqueueDailyPhotos(files: File[]): Promise<number> {
  const db = await openDb();
  const existing = await new Promise<QueuedPhoto[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as QueuedPhoto[]);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
  const available = Math.max(0, MAX_FILES - existing.length);
  const selected = files.slice(0, available);
  if (!selected.length) return existing.length;
  await transact<void>('readwrite', (store, resolve, reject) => {
    selected.forEach((file) => store.put({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `photo_${Date.now()}_${Math.random()}`,
      name: file.name,
      type: file.type,
      blob: file,
      addedAt: Date.now(),
    } satisfies QueuedPhoto));
    resolve();
  });
  updateCount(existing.length + selected.length);
  return existing.length + selected.length;
}

export async function removeQueuedPhoto(id: string): Promise<void> {
  await transact<void>('readwrite', (store, resolve) => { store.delete(id); resolve(); });
  updateCount(await getQueuedPhotoCount());
}

async function getQueuedPhotos(): Promise<QueuedPhoto[]> {
  return transact<QueuedPhoto[]>('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as QueuedPhoto[]).sort((a, b) => a.addedAt - b.addedAt));
    request.onerror = () => reject(request.error);
  });
}

/** Analyze queued files only when a Daily Test is requested. Each successful file is removed
 * from IndexedDB after its extracted questions are saved, so a retry never reprocesses it. */
export async function processQueuedPhotosForDailyTest(targetCount: number, onProgress?: (message: string) => void): Promise<{ bank: TestQuestion[]; processedFiles: number; remainingFiles: number; errors: string[] }> {
  let bank = loadDaily().bank;
  let processedFiles = 0;
  const errors: string[] = [];
  const queued = await getQueuedPhotos();
  for (let i = 0; i < queued.length && bank.length < targetCount; i++) {
    const item = queued[i];
    onProgress?.(`Reading queued file ${i + 1} of ${queued.length}: ${item.name}`);
    try {
      const file = new File([item.blob], item.name, { type: item.type || item.blob.type });
      const extracted = [];
      const keys = [];
      for (const payload of await prepareUpload(file)) {
        const result = await extractQuestionsFromPhoto(payload);
        extracted.push(...result.questions);
        keys.push(...result.answerKey);
      }
      const converted = toBuilderQuestions(extracted, keys).questions;
      const merged = dedupeQuestions([...bank, ...converted]).questions;
      if (merged.length > bank.length) {
        if (!saveBank(merged)) throw new Error('Could not save extracted questions. Free browser storage and retry.');
        bank = loadDaily().bank;
      }
      await removeQueuedPhoto(item.id);
      processedFiles++;
    } catch (error) {
      errors.push(`${item.name}: ${error instanceof Error ? error.message : 'could not be read'}`);
      // Keep failed and later files queued for a later retry; do not spend more tokens this session.
      break;
    }
  }
  return { bank, processedFiles, remainingFiles: await getQueuedPhotoCount(), errors };
}
