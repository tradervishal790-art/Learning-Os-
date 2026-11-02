import type { InkStroke } from './notebookStore';
import { boundsOf, type Box } from './inkEdit';
import { renderInk, shapeToSvg } from './inkSvg';
import { colorKind, type HighlightKind } from './revisionExtract';

// ============================================================
// penHighlights.ts — marks made with the HIGHLIGHTER PEN, for the Revision Sheet.
// The sheet reads typed highlights from the page text; a pen mark is only a stroke (position + colour), so the
// words under it are not known. What IS known: where it is, its colour (= its meaning) and any handwriting under it.
// Each cluster of nearby strokes of one colour becomes a card with a picture of that spot.
// Pure (no DOM), so it is easy to test.
// ============================================================

export interface PenHighlight {
  key: string;
  kind: HighlightKind;
  color: string;
  pageId: string;
  pageNumber: number;
  box: Box;
  /** SVG picture of the marked spot (the mark + handwriting under it), on a transparent background. */
  svg: string;
}

const GAP = 30; // page units: strokes closer than this belong to one mark
const PAD = 14;
const MAX_CARDS = 80;

const grow = (b: Box, g: number): Box => ({ x0: b.x0 - g, y0: b.y0 - g, x1: b.x1 + g, y1: b.y1 + g });
const touches = (a: Box, b: Box): boolean => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

/** Groups of strokes whose (slightly grown) boxes overlap, directly or through a chain. */
function clusters(strokes: InkStroke[]): InkStroke[][] {
  const boxes = strokes.map((s) => grow(boundsOf([s]) as Box, GAP / 2));
  const parent = strokes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < strokes.length; i++) for (let j = i + 1; j < strokes.length; j++) if (touches(boxes[i], boxes[j])) parent[find(j)] = find(i);
  const groups = new Map<number, InkStroke[]>();
  strokes.forEach((s, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), s]));
  return [...groups.values()];
}

function pictureOf(box: Box, marks: InkStroke[], under: InkStroke[]): string {
  const r = renderInk([...marks, ...under], false, 'both');
  const w = Math.max(40, box.x1 - box.x0);
  const h = Math.max(24, box.y1 - box.y0);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${Math.round(box.x0)} ${Math.round(box.y0)} ${Math.round(w)} ${Math.round(h)}" width="100%" preserveAspectRatio="xMinYMin meet" role="img">${r.shapes.map(shapeToSvg).join('')}</svg>`;
}

/** Pen highlights of a note, in reading order (page, then top to bottom). */
export function extractPenHighlights(pages: readonly { id: string; ink?: InkStroke[] }[]): PenHighlight[] {
  const out: PenHighlight[] = [];
  pages.forEach((page, pi) => {
    const ink = page.ink ?? [];
    const marks = ink.filter((s) => s.kind === 'highlighter' && s.pts.length >= 3);
    if (marks.length === 0) return;
    const pens = ink.filter((s) => s.kind !== 'highlighter');
    const byKind = new Map<HighlightKind, InkStroke[]>();
    for (const m of marks) {
      const k = colorKind(m.color);
      byKind.set(k, [...(byKind.get(k) ?? []), m]);
    }
    const pageCards: PenHighlight[] = [];
    for (const [kind, strokes] of byKind) {
      for (const group of clusters(strokes)) {
        const box = grow(boundsOf(group) as Box, PAD);
        const under = pens.filter((s) => touches(box, boundsOf([s]) as Box));
        const all = boundsOf([...group, ...under]) as Box;
        const crop = grow({ x0: Math.min(box.x0, all.x0), y0: Math.min(box.y0, all.y0), x1: Math.max(box.x1, all.x1), y1: Math.max(box.y1, all.y1) }, 0);
        pageCards.push({ key: '', kind, color: group[0].color, pageId: page.id, pageNumber: pi + 1, box: crop, svg: pictureOf(crop, group, under) });
      }
    }
    pageCards.sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0);
    pageCards.forEach((c, i) => out.push({ ...c, key: `pen:${page.id}:${i}` }));
  });
  return out.slice(0, MAX_CARDS);
}
