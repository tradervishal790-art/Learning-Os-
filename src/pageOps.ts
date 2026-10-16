import type { InkStroke, NotePage } from './notebookStore';
import { cloneStrokes } from './inkEdit';

// ============================================================
// pageOps.ts — page-level edits as PURE functions on the pages array
// (add, duplicate, delete, move, patch). Always addressed by page id,
// never by index, so reordering can't confuse ink, undo history or editors.
// ============================================================

export const newPageId = () => `pg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function blankPage(opts: { template?: string; paper?: string } = {}): NotePage {
  const page: NotePage = { id: newPageId(), text: '', html: '<p></p>', ink: [] };
  if (opts.template && opts.template !== 'blank') page.template = opts.template;
  if (opts.paper) page.paper = opts.paper;
  return page;
}

/** Insert `page` after the page `afterId` (null / unknown = at the end). */
export function addPageAfter(pages: NotePage[], afterId: string | null, page: NotePage): { pages: NotePage[]; index: number } {
  const at = afterId === null ? -1 : pages.findIndex((p) => p.id === afterId);
  const index = at === -1 ? pages.length : at + 1;
  return { pages: [...pages.slice(0, index), page, ...pages.slice(index)], index };
}

/** A copy of the page (new id, new stroke ids) right after the original. */
export function duplicatePage(pages: NotePage[], id: string): { pages: NotePage[]; copy: NotePage } | null {
  const at = pages.findIndex((p) => p.id === id);
  if (at === -1) return null;
  const src = pages[at];
  const copy: NotePage = { ...src, id: newPageId(), ink: cloneStrokes(src.ink ?? []) };
  delete copy.hasInk;
  return { pages: [...pages.slice(0, at + 1), copy, ...pages.slice(at + 1)], copy };
}

/** Remove a page. A note always keeps at least one page, so deleting the only page does nothing (returns null). */
export function deletePage(pages: NotePage[], id: string): { pages: NotePage[]; removed: NotePage; index: number } | null {
  const index = pages.findIndex((p) => p.id === id);
  if (index === -1 || pages.length <= 1) return null;
  return { pages: pages.filter((p) => p.id !== id), removed: pages[index], index };
}

/** Put a page back where it was (used by Undo after a delete). */
export function restorePage(pages: NotePage[], page: NotePage, index: number): NotePage[] {
  if (pages.some((p) => p.id === page.id)) return pages;
  const at = Math.max(0, Math.min(index, pages.length));
  return [...pages.slice(0, at), page, ...pages.slice(at)];
}

/** Move a page so that it ends up at `toIndex` (its index in the NEW order). Out-of-range is clamped. */
export function movePage(pages: NotePage[], id: string, toIndex: number): NotePage[] {
  const from = pages.findIndex((p) => p.id === id);
  if (from === -1) return pages;
  const to = Math.max(0, Math.min(toIndex, pages.length - 1));
  if (to === from) return pages;
  const next = pages.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function patchPage(pages: NotePage[], id: string, patch: Partial<NotePage>): NotePage[] {
  return pages.map((p) => {
    if (p.id !== id) return p;
    const next = { ...p, ...patch };
    // keep saved data small: a blank template / default paper / no bookmark are stored as "absent"
    if (next.template === 'blank' || next.template === undefined) delete next.template;
    if (!next.paper) delete next.paper;
    if (!next.bookmarked) delete next.bookmarked;
    return next;
  });
}

/** Ink to put in the per-page map when a page is restored / duplicated. */
export const inkOf = (page: NotePage): InkStroke[] => page.ink ?? [];
