// ============================================================
// inkParts.ts — a page with a LOT of handwriting used to stay "not synced": its ink document went over
// Firestore's 1 MiB limit and the app simply gave up on it. Now such a page is split into several documents
// (stroke by stroke, in order) and put back together when it is pulled. Normal pages are unchanged: one doc.
// ============================================================

/** Each part stays well under the 1 MiB document limit. */
export const INK_PART_CHARS = 700_000;
/** ~14 MB of ink on a single page; beyond that something is wrong and the page stays on this device. */
export const MAX_INK_PARTS = 20;

/** Greedy, order-preserving split so that every part's JSON is at most `maxChars` (one huge stroke goes alone). */
export function splitStrokes<T>(strokes: T[], maxChars = INK_PART_CHARS): T[][] {
  const parts: T[][] = [];
  let cur: T[] = [];
  let size = 2; // "[]"
  for (const s of strokes) {
    const len = JSON.stringify(s).length + 1; // + comma
    if (cur.length > 0 && size + len > maxChars) {
      parts.push(cur);
      cur = [];
      size = 2;
    }
    cur.push(s);
    size += len;
  }
  if (cur.length > 0) parts.push(cur);
  return parts;
}

/** Cloud key of part `i` (i >= 1); part 0 lives at the page's normal ink key. */
export const inkPartKey = (key: string, i: number): string => `${key}_p${i}`;
