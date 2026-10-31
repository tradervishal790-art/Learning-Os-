import { dedupeQuestions } from './questionDedup';
import { getReadyDailyQuestionCount, loadDaily, saveBank } from './dailyTestStore';
import { blobToPhotoPayload, prepareUpload, extractQuestionsFromPhoto, toBuilderQuestions } from './testImport';
import type { TestQuestion } from './types';

const DB_NAME = 'learning-os-daily-photo-queue';
const STORE_NAME = 'photos';
const META_KEY = 'learning_os_daily_photo_queue_count';
const MAX_FILES = 200;

export interface QueuedPhotoPart {
  name: string;
  type: string;
  blob: Blob;
}

export interface QueuedPhoto {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  /** Ordered, one-page payloads created lazily when a queued PDF is first processed. */
  parts?: QueuedPhotoPart[];
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

export async function enqueueDailyPhotos(files: File[]): Promise<{ count: number; added: number; skipped: number }> {
  // Capacity check and inserts share one read-write transaction. Concurrent uploads
  // therefore cannot both reserve the same remaining slots and exceed MAX_FILES.
  const result = await transact<{ count: number; added: number; skipped: number }>('readwrite', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const existing = request.result as QueuedPhoto[];
      const available = Math.max(0, MAX_FILES - existing.length);
      const selected = files.slice(0, available);
      const addedAt = Date.now();
      selected.forEach((file, index) => store.put({
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `photo_${addedAt}_${index}_${Math.random()}`,
        name: file.name,
        type: file.type,
        blob: file,
        addedAt: addedAt + index / 1000,
      } satisfies QueuedPhoto));
      resolve({ count: existing.length + selected.length, added: selected.length, skipped: files.length - selected.length });
    };
    request.onerror = () => reject(request.error);
  });
  updateCount(result.count);
  return result;
}

export async function clearQueuedDailyPhotos(): Promise<void> {
  await transact<void>('readwrite', (store, resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  updateCount(0);
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

function blobFromPayload(data: string, mimeType: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes.buffer], { type: mimeType });
}

/** Persist remaining pages on the original queue item; page splitting never
 * increases the learner's 200-source-file capacity or changes queue ordering. */
async function saveQueuedPhotoParts(item: QueuedPhoto, parts: QueuedPhotoPart[]): Promise<void> {
  if (parts.length === 0) {
    await removeQueuedPhoto(item.id);
    return;
  }
  const updated: QueuedPhoto = { ...item, blob: parts[0].blob, type: parts[0].type, parts };
  await transact<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(updated);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Extract only enough pages to prepare the requested test. Remaining pages stay
 * attached to their original queue record and are picked up on a later test day. */
export async function processQueuedPhotosForDailyTest(
  targetCount: number,
  onProgress?: (message: string) => void,
): Promise<{ bank: TestQuestion[]; processedFiles: number; processedPages: number; remainingFiles: number; errors: string[] }> {
  let bank = loadDaily().bank;
  let processedFiles = 0;
  let processedPages = 0;
  const errors: string[] = [];
  const queued = await getQueuedPhotos();
  const target = Math.max(1, Math.floor(targetCount) || 1);

  for (let i = 0; i < queued.length && getReadyDailyQuestionCount(bank) < target; i += 1) {
    const item = queued[i];
    onProgress?.(`Preparing ${item.name} (${i + 1} of ${queued.length})`);
    try {
      let parts = item.parts;
      if (!parts?.length) {
        const file = new File([item.blob], item.name, { type: item.type || item.blob.type });
        const payloads = await prepareUpload(file, { pdfPagesPerChunk: 1 });
        if (payloads.length === 0) throw new Error('No readable pages were found in this file.');
        parts = payloads.map((payload, index) => ({
          name: payload.mimeType === 'application/pdf' ? `${item.name} · page ${index + 1}` : item.name,
          type: payload.mimeType,
          blob: blobFromPayload(payload.data, payload.mimeType),
        }));
        // Persist the page list before calling AI so an interrupted tab can resume.
        await saveQueuedPhotoParts(item, parts);
      }

      let fileCompleted = true;
      for (let pageIndex = 0; pageIndex < parts.length; pageIndex += 1) {
        const part = parts[pageIndex];
        onProgress?.(`Reading ${part.name} · page ${pageIndex + 1} of ${parts.length}`);
        try {
          const payload = await blobToPhotoPayload(part.blob, part.type);
          const extracted = await extractQuestionsFromPhoto(payload);
          if (extracted.questions.length === 0) {
            throw new Error('No questions could be read from this page. It is still queued; try a clearer photo or PDF.');
          }
          const converted = toBuilderQuestions(extracted.questions, extracted.answerKey).questions;
          const merged = dedupeQuestions([...bank, ...converted]).questions;
          if (merged.length > bank.length) {
            if (!saveBank(merged)) throw new Error('Could not save extracted questions. Free browser storage and retry.');
            bank = loadDaily().bank;
          }

          const remaining = parts.slice(pageIndex + 1);
          await saveQueuedPhotoParts(item, remaining);
          processedPages += 1;
          if (remaining.length === 0) processedFiles += 1;
          if (getReadyDailyQuestionCount(bank) >= target) {
            fileCompleted = remaining.length === 0;
            break;
          }
        } catch (error) {
          // Keep this page and every later page. Earlier successful pages are already
          // persisted in the bank and removed from the queue, avoiding repeat AI cost.
          try { await saveQueuedPhotoParts(item, parts.slice(pageIndex)); } catch { /* original record remains a safe retry */ }
          errors.push(`${part.name}: ${error instanceof Error ? error.message : 'could not be read'}`);
          fileCompleted = false;
          break;
        }
      }
      if (!fileCompleted || getReadyDailyQuestionCount(bank) >= target) break;
    } catch (error) {
      errors.push(`${item.name}: ${error instanceof Error ? error.message : 'could not be read'}`);
      // A failed split/storage step leaves the original source file queued for retry.
      break;
    }
  }

  return { bank, processedFiles, processedPages, remainingFiles: await getQueuedPhotoCount(), errors };
}
