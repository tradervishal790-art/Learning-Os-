// ============================================================
// recordingSpool.ts — keeps a LONG voice recording out of memory while it is being recorded.
// MediaRecorder hands over a chunk every second; the recorder used to keep every chunk in one array until
// Stop, so an hour-long lecture sat in RAM (and a phone could kill the tab). Now the chunks are grouped and,
// every few MB, written to IndexedDB (the browser stores big blobs on disk) and dropped from memory.
// A short recording never reaches the threshold, so it behaves exactly as before.
// If the browser refuses a write (storage full / private mode) that group simply stays in memory:
// audio is never lost to save memory.
// ============================================================

export interface SpoolStore {
  put(id: string, seq: number, blob: Blob): Promise<void>;
  readAll(id: string): Promise<{ seq: number; blob: Blob }[]>;
  /** Remove one recording's groups, or (no id) everything left over from earlier recordings. */
  clear(id?: string): Promise<void>;
}

const DB_NAME = 'learning_os_audio_spool';
const STORE = 'chunks';

interface Row { key: string; id: string; seq: number; blob: Blob }

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is not available'));
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        db.onclose = () => { dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => reject(req.error ?? new Error('Cannot open the recording spool'));
      req.onblocked = () => reject(new Error('The recording spool is blocked by another tab'));
    }).catch((e: unknown) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore, done: (v: T) => void) => void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    let result: T;
    const t = db.transaction(STORE, mode);
    work(t.objectStore(STORE), (v) => { result = v; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error ?? new Error('Spool transaction failed'));
    t.onabort = () => reject(t.error ?? new Error('Spool transaction aborted'));
  });
}

const keyOf = (id: string, seq: number) => `${id}/${String(seq).padStart(6, '0')}`;

export const idbSpool: SpoolStore = {
  put: (id, seq, blob) =>
    tx<void>('readwrite', (s, done) => {
      s.put({ key: keyOf(id, seq), id, seq, blob } satisfies Row);
      done();
    }),
  readAll: (id) =>
    tx<{ seq: number; blob: Blob }[]>('readonly', (s, done) => {
      const req = s.getAll(IDBKeyRange.bound(`${id}/`, `${id}/\uffff`));
      req.onsuccess = () => done((req.result as Row[]).map((r) => ({ seq: r.seq, blob: r.blob })));
    }),
  clear: (id) =>
    tx<void>('readwrite', (s, done) => {
      if (id) s.delete(IDBKeyRange.bound(`${id}/`, `${id}/\uffff`));
      else s.clear();
      done();
    }),
};

export const SPILL_BYTES = 4 * 1024 * 1024;

export class ChunkBuffer {
  private mem: Blob[] = [];
  private memBytes = 0;
  private seq = 0;
  private chain: Promise<void> = Promise.resolve();
  private readonly failed = new Map<number, Blob>();

  readonly id: string;
  private readonly store: SpoolStore;
  private readonly spillBytes: number;

  constructor(id: string, store: SpoolStore = idbSpool, spillBytes = SPILL_BYTES) {
    this.id = id;
    this.store = store;
    this.spillBytes = spillBytes;
  }

  /** True once any group has been sent to the store. */
  get spilled(): boolean {
    return this.seq > 0;
  }

  add(blob: Blob): void {
    if (blob.size === 0) return;
    this.mem.push(blob);
    this.memBytes += blob.size;
    if (this.memBytes >= this.spillBytes) this.spill();
  }

  private spill(): void {
    const merged = new Blob(this.mem, { type: this.mem[0]?.type });
    this.mem = [];
    this.memBytes = 0;
    const n = this.seq++;
    this.chain = this.chain
      .then(() => this.store.put(this.id, n, merged))
      .catch(() => {
        this.failed.set(n, merged); // the store refused it: keep it in memory instead of losing it
      });
  }

  /** Everything recorded so far, in order. Waits for pending writes. */
  async collect(): Promise<Blob[]> {
    await this.chain;
    const stored = new Map<number, Blob>();
    if (this.seq > this.failed.size) for (const r of await this.store.readAll(this.id)) stored.set(r.seq, r.blob);
    const parts: Blob[] = [];
    for (let n = 0; n < this.seq; n++) {
      const b = stored.get(n) ?? this.failed.get(n);
      if (b) parts.push(b);
    }
    return [...parts, ...this.mem];
  }

  /** Short recordings (nothing spilled): the chunks, synchronously. */
  collectInMemory(): Blob[] {
    return [...this.mem];
  }

  /** Forget everything, in memory and in the store. */
  async dispose(): Promise<void> {
    this.mem = [];
    this.memBytes = 0;
    this.failed.clear();
    const had = this.seq > 0;
    this.seq = 0;
    await this.chain;
    if (had) await this.store.clear(this.id).catch(() => undefined);
  }
}
