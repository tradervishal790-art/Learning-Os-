import type { InkStroke, NotePage } from './notebookStore';

// ============================================================
// aiExtraText.ts — text the AI tools get from places that are not typed text:
//  • handwriting (read to text on request, after consent — it is sent to an AI service)
//  • scanned PDF pages (no text layer, so the PDF import had nothing to store)
// Text PDFs need nothing here: their text is saved with the page at import.
// Pure helpers; NoteEditor does the (consent-gated) reading and keeps the results.
// ============================================================

export interface PageExtra {
  /** Handwriting read to text, with the signature of the strokes it was read from (stale once the ink changes). */
  hw?: { sig: string; text: string };
  /** Text read from a scanned PDF page. */
  scan?: string;
}

/** Cheap fingerprint of a page's strokes: changes when a stroke is added, removed or extended. */
export function inkSignature(strokes: readonly InkStroke[] | undefined): string {
  if (!strokes || strokes.length === 0) return '';
  let n = 0;
  for (const s of strokes) n += s.pts.length;
  return `${strokes.length}:${n}:${strokes[strokes.length - 1].id}`;
}

/** A PDF page whose import found no text (scanned / image-only). */
export const needsScan = (p: NotePage): boolean => !!p.pdf && !p.text.trim();

export interface PendingRead { pageId: string; hw: boolean; scan: boolean }

/** Which pages still have something the AI cannot read yet. */
export function pendingReads(pages: readonly NotePage[], ink: Record<string, InkStroke[] | undefined>, extras: Record<string, PageExtra | undefined>): PendingRead[] {
  const out: PendingRead[] = [];
  for (const p of pages) {
    const e = extras[p.id];
    const sig = inkSignature(ink[p.id] ?? p.ink);
    const hw = sig !== '' && e?.hw?.sig !== sig;
    const scan = needsScan(p) && e?.scan === undefined;
    if (hw || scan) out.push({ pageId: p.id, hw, scan });
  }
  return out;
}

/** Everything the AI can read on one page: typed text, then scanned-PDF text, then handwriting (only if still current). */
export function pageAiText(p: NotePage, ink: readonly InkStroke[] | undefined, e: PageExtra | undefined): string {
  const parts = [p.text];
  if (e?.scan?.trim()) parts.push(e.scan.trim());
  const sig = inkSignature(ink);
  if (e?.hw && sig !== '' && e.hw.sig === sig && e.hw.text.trim()) parts.push(e.hw.text.trim());
  return parts.filter((s) => s.trim()).join('\n');
}
