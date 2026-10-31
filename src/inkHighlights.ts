// ============================================================
// inkHighlights.ts — the highlighter PEN's marks, found as regions of a page (pure; tests/ink-highlights.test.mjs).
// The Revision Sheet used to list only highlighted TYPED text (<mark>), so a note studied with the highlighter
// pen showed "no highlights". Strokes of the same colour meaning that touch each other form one region; the
// sheet then shows a picture of that region (renderInkCrop.ts) because a pen mark has no text.
// ============================================================
import type { InkStroke } from './notebookStore';
import { colorKind, type HighlightKind } from './revisionExtract';

export interface InkHighlightRegion {
  pageId: string;
  pageNumber: number;
  kind: HighlightKind;
  /** Colour of the first stroke of the region. */
  color: string;
  /** Page units (page width = 1000). */
  box: { x: number; y: number; w: number; h: number };
}

interface Box { x0: number; y0: number; x1: number; y1: number }

const NEAR = 18; // strokes closer than this (page units) belong to the same region
const PAD = 24; // context around the marks
const MAX_REGIONS_PER_PAGE = 12;

function boxOf(s: InkStroke): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < s.pts.length; i += 3) {
    const x = s.pts[i], y = s.pts[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x0 === Infinity) return null;
  const r = Math.max(1, s.width) * 3; // a highlighter is ~6x the nib width
  return { x0: x0 - r, y0: y0 - r, x1: x1 + r, y1: y1 + r };
}

const touch = (a: Box, b: Box): boolean => a.x0 - NEAR <= b.x1 && b.x0 - NEAR <= a.x1 && a.y0 - NEAR <= b.y1 && b.y0 - NEAR <= a.y1;

export function inkHighlightRegions(pages: { id: string; ink?: InkStroke[] }[]): InkHighlightRegion[] {
  const out: InkHighlightRegion[] = [];
  pages.forEach((page, pageIndex) => {
    const marks = (page.ink ?? []).filter((s) => s.kind === 'highlighter');
    const byKind = new Map<string, { kind: HighlightKind; color: string; boxes: Box[] }>();
    for (const s of marks) {
      const b = boxOf(s);
      if (!b) continue;
      const kind = colorKind(s.color);
      const k = kind === 'other' ? `other${s.color}` : kind;
      const g = byKind.get(k) ?? { kind, color: s.color, boxes: [] };
      g.boxes.push(b);
      byKind.set(k, g);
    }
    const regions: InkHighlightRegion[] = [];
    for (const g of byKind.values()) {
      // merge boxes that touch, repeatedly, until nothing changes
      let boxes = g.boxes;
      for (let changed = true; changed; ) {
        changed = false;
        const next: Box[] = [];
        for (const b of boxes) {
          const hit = next.find((n) => touch(n, b));
          if (hit) {
            hit.x0 = Math.min(hit.x0, b.x0); hit.y0 = Math.min(hit.y0, b.y0); hit.x1 = Math.max(hit.x1, b.x1); hit.y1 = Math.max(hit.y1, b.y1);
            changed = true;
          } else {
            next.push({ ...b });
          }
        }
        boxes = next;
      }
      for (const b of boxes) {
        const x = Math.max(0, b.x0 - PAD);
        const y = Math.max(0, b.y0 - PAD);
        const w = Math.min(1000, b.x1 + PAD) - x;
        regions.push({ pageId: page.id, pageNumber: pageIndex + 1, kind: g.kind, color: g.color, box: { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(b.y1 + PAD - y) } });
      }
    }
    regions.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
    out.push(...regions.slice(0, MAX_REGIONS_PER_PAGE));
  });
  return out;
}
