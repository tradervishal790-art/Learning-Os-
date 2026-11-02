// ============================================================
// inkText.ts — which words a highlighter-PEN stroke was drawn over.
// The typed-text highlighter leaves <mark>s that Revision can read; the highlighter pen only leaves a shape. When a pen
// highlight is finished, the words under it are read from the editor (it has the real layout) and kept on the stroke
// (`txt`), so "study only my doubts" can use them like any other highlight.
// ============================================================
import type { Editor } from '@tiptap/core';
import type { InkStroke } from './notebookStore';

export const MAX_HIGHLIGHT_TEXT = 300;

const isSpace = (c: string | undefined): boolean => c === undefined || /\s/.test(c);

/**
 * Snap the START of a highlight to a word: inside a word -> back to its first letter; on the gap before a word ->
 * forward to that word. (A small overshoot into the space does not pull in the neighbouring word.)
 */
export function snapStart(text: string, at: number): number {
  let i = Math.max(0, Math.min(at, text.length));
  if (isSpace(text[i]) && i < text.length) {
    while (i < text.length && isSpace(text[i])) i += 1;
    return i;
  }
  while (i > 0 && !isSpace(text[i - 1])) i -= 1;
  return i;
}

/** Snap the END of a highlight to a word: inside a word -> on to its last letter; just after a gap -> back to the previous word. */
export function snapEnd(text: string, at: number): number {
  let i = Math.max(0, Math.min(at, text.length));
  if (i > 0 && isSpace(text[i - 1])) {
    while (i > 0 && isSpace(text[i - 1])) i -= 1;
    return i;
  }
  while (i < text.length && !isSpace(text[i])) i += 1;
  return i;
}

/**
 * The words under a highlighter stroke. `sheet` is the page's box on screen (the stroke is in page units, 1000 wide).
 * Returns '' when nothing readable is under it (e.g. it was drawn on empty paper).
 */
export function textUnderHighlight(
  editor: Pick<Editor, 'view' | 'state'>,
  sheet: { left: number; top: number; width: number },
  stroke: Pick<InkStroke, 'pts'>
): string {
  const k = sheet.width / 1000;
  if (!(k > 0)) return '';
  const positions: number[] = [];
  const sample = (x: number, y: number) => {
    const hit = editor.view.posAtCoords({ left: sheet.left + x * k, top: sheet.top + y * k });
    if (hit) positions.push(hit.pos);
  };
  const p = stroke.pts;
  for (let i = 0; i + 2 < p.length; i += 3) {
    sample(p[i], p[i + 1]);
    if (i + 5 < p.length) {
      // between two recorded points, so a fast straight sweep is still read all along its way
      const steps = Math.min(40, Math.floor(Math.hypot(p[i + 3] - p[i], p[i + 4] - p[i + 1]) / 12));
      for (let s = 1; s <= steps; s++) sample(p[i] + ((p[i + 3] - p[i]) * s) / (steps + 1), p[i + 1] + ((p[i + 4] - p[i + 1]) * s) / (steps + 1));
    }
  }
  if (positions.length === 0) return '';
  const doc = editor.state.doc;
  let from = Math.min(...positions);
  let to = Math.max(...positions);
  // widen both ends to whole words, inside their own paragraph
  const widen = (pos: number, which: 'start' | 'end'): number => {
    const $p = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
    const parent = $p.parent;
    if (!parent.isTextblock || parent.childCount === 0) return pos;
    if (!parent.children.every((c) => c.isText)) return pos; // an inline chip inside: offsets would not match, keep as is
    const text = parent.textContent;
    const off = $p.parentOffset;
    return $p.start() + (which === 'start' ? snapStart(text, off) : snapEnd(text, off));
  };
  from = widen(from, 'start');
  to = widen(to, 'end');
  if (to - from > 4 * MAX_HIGHLIGHT_TEXT) to = from + 4 * MAX_HIGHLIGHT_TEXT;
  const text = doc.textBetween(from, to, ' ', ' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, MAX_HIGHLIGHT_TEXT);
}

/**
 * The strokes with the words of every NEW highlighter-pen stroke filled in. Strokes that already had their words (or are
 * not highlighter strokes) are returned as they are. `known` = ids of the strokes that were there before this change.
 */
export function withHighlightText(
  strokes: InkStroke[],
  known: ReadonlySet<string>,
  read: (stroke: InkStroke) => string
): InkStroke[] {
  let changed = false;
  const out = strokes.map((st) => {
    if (st.kind !== 'highlighter' || st.txt !== undefined || known.has(st.id)) return st;
    const txt = read(st);
    changed = true;
    return { ...st, txt };
  });
  return changed ? out : strokes;
}
