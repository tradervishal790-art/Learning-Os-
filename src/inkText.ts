// ============================================================
// inkText.ts — handwriting that has been READ (OCR) once, remembered on this device, so "Ask my notes" and the
// other note tools can use it. Ask my notes used to see only typed text: a note written by hand looked empty.
// A page's text is remembered together with a light signature of its ink; when the ink changes the old text is
// ignored until the page is read again. Pure apart from the injected storage (tests/ink-text.test.mjs).
// ============================================================

import type { InkStroke } from './notebookStore';

const KEY = 'learning_os_ink_text_v1';
const MAX_ENTRIES = 300;

interface Entry { sig: string; text: string; at: number }
type Store = Pick<Storage, 'getItem' | 'setItem'>;

const defaultStore = (): Store | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/** Cheap fingerprint (counts and last stroke id): it is asked for on every refresh of the AI panel. */
export function inkSignature(strokes: Pick<InkStroke, 'id' | 'pts'>[] | undefined): string {
  if (!strokes || strokes.length === 0) return '';
  let pts = 0;
  for (const s of strokes) pts += s.pts.length;
  return `${strokes.length}:${pts}:${strokes[strokes.length - 1].id}`;
}

function read(store: Store | null): Record<string, Entry> {
  try {
    const v = JSON.parse(store?.getItem(KEY) ?? '{}') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, Entry>) : {};
  } catch {
    return {};
  }
}

const keyOf = (noteId: string, pageId: string) => `${noteId}/${pageId}`;

export interface InkPage { id: string; ink?: InkStroke[] }

/** The remembered text of one page, or '' when it was never read or the ink has changed since. */
export function getInkText(noteId: string, page: InkPage, store: Store | null = defaultStore()): string {
  const sig = inkSignature(page.ink);
  if (!sig) return '';
  const e = read(store)[keyOf(noteId, page.id)];
  return e && e.sig === sig ? e.text : '';
}

export function setInkText(noteId: string, page: InkPage, text: string, store: Store | null = defaultStore()): void {
  if (!store) return;
  const all = read(store);
  all[keyOf(noteId, page.id)] = { sig: inkSignature(page.ink), text, at: Date.now() };
  const keys = Object.keys(all);
  if (keys.length > MAX_ENTRIES) {
    keys.sort((a, b) => all[a].at - all[b].at).slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete all[k]);
  }
  try {
    store.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage full: the page is simply read again next time
  }
}

/** Pages that have handwriting which has not been read yet (or changed since). */
export function pagesToRead(noteId: string, pages: InkPage[], store: Store | null = defaultStore()): InkPage[] {
  const all = read(store);
  return pages.filter((p) => {
    const sig = inkSignature(p.ink);
    return sig !== '' && all[keyOf(noteId, p.id)]?.sig !== sig;
  });
}

/** All remembered handwriting of a note, page by page, in page order. */
export function handwritingOf(noteId: string, pages: InkPage[], store: Store | null = defaultStore()): string {
  const all = read(store);
  return pages
    .map((p) => {
      const sig = inkSignature(p.ink);
      const e = sig ? all[keyOf(noteId, p.id)] : undefined;
      return e && e.sig === sig ? e.text.trim() : '';
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Read up to `max` unread pages, one after the other. A page that fails is skipped (and tried again next time);
 * a page with no writing is remembered as empty so it is not sent again.
 */
export async function readHandwriting(
  noteId: string,
  pages: InkPage[],
  deps: { render: (strokes: InkStroke[]) => string | null; recognize: (pngBase64: string) => Promise<{ text: string }> },
  opts: { max?: number; store?: Store | null; isCancelled?: () => boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ read: number; failed: number }> {
  const store = opts.store === undefined ? defaultStore() : opts.store;
  const todo = pagesToRead(noteId, pages, store).slice(0, opts.max ?? 10);
  let read = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i++) {
    if (opts.isCancelled?.()) break;
    opts.onProgress?.(i, todo.length);
    const png = deps.render(todo[i].ink ?? []);
    if (!png) {
      setInkText(noteId, todo[i], '', store); // nothing drawn in black ink (e.g. only highlighter)
      continue;
    }
    try {
      const r = await deps.recognize(png);
      setInkText(noteId, todo[i], r.text, store);
      read++;
    } catch {
      failed++;
    }
  }
  opts.onProgress?.(todo.length, todo.length);
  return { read, failed };
}
