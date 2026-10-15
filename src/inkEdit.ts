import type { InkStroke } from './notebookStore';
import { layerOf, newStrokeId, drawStroke } from './inkEngine';
import { recognizeShape } from './inkShapes';

// ============================================================
// inkEdit.ts — selecting and editing handwriting (pure functions on
// stroke arrays; the UI decides when to call them). Every function
// returns NEW stroke objects, never mutates, so undo is just "keep
// the old array".
// ============================================================

type P = [number, number];
export interface Box { x0: number; y0: number; x1: number; y1: number }

export function strokePoints(s: InkStroke): P[] {
  const out: P[] = [];
  for (let i = 0; i + 1 < s.pts.length; i += 3) out.push([s.pts[i], s.pts[i + 1]]);
  return out;
}

/** Bounding box of some strokes, grown by half the nib so the box wraps the visible ink. */
export function boundsOf(strokes: InkStroke[]): Box | null {
  if (strokes.length === 0) return null;
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const s of strokes) {
    const pad = s.width * (s.kind === 'highlighter' ? 3 : 1);
    for (const [x, y] of strokePoints(s)) {
      b.x0 = Math.min(b.x0, x - pad);
      b.x1 = Math.max(b.x1, x + pad);
      b.y0 = Math.min(b.y0, y - pad);
      b.y1 = Math.max(b.y1, y + pad);
    }
  }
  return b;
}

// ---------- selecting ----------

function inPolygon(x: number, y: number, poly: P[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A stroke is selected when most of it (60%) is inside the lasso. */
export function selectInPolygon(strokes: InkStroke[], poly: P[]): string[] {
  if (poly.length < 3) return [];
  return strokes
    .filter((s) => {
      const pts = strokePoints(s);
      const inside = pts.filter(([x, y]) => inPolygon(x, y, poly)).length;
      return pts.length > 0 && inside / pts.length >= 0.6;
    })
    .map((s) => s.id);
}

export function selectInRect(strokes: InkStroke[], a: P, b: P): string[] {
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  return selectInPolygon(strokes, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
}

// ---------- transform (move / resize / rotate) ----------

export interface Xform {
  dx: number;
  dy: number;
  /** Uniform scale around the pivot. */
  s: number;
  /** Rotation in radians around the pivot. */
  rot: number;
  px: number;
  py: number;
}

export const IDENTITY: Xform = { dx: 0, dy: 0, s: 1, rot: 0, px: 0, py: 0 };

export function applyXform(stroke: InkStroke, x: Xform): InkStroke {
  const cos = Math.cos(x.rot);
  const sin = Math.sin(x.rot);
  const pts = stroke.pts.slice();
  for (let i = 0; i + 1 < pts.length; i += 3) {
    const vx = (pts[i] - x.px) * x.s;
    const vy = (pts[i + 1] - x.py) * x.s;
    pts[i] = Math.round((x.px + vx * cos - vy * sin + x.dx) * 10) / 10;
    pts[i + 1] = Math.round((x.py + vx * sin + vy * cos + x.dy) * 10) / 10;
  }
  // Resizing handwriting must not turn the line into a fat marker: width grows with the square root of the scale.
  return { ...stroke, pts, width: Math.max(0.5, Math.round(stroke.width * Math.sqrt(x.s) * 10) / 10) };
}

/** New array where the selected strokes were transformed in place (z-order kept). */
export function transformSelected(strokes: InkStroke[], ids: Set<string>, x: Xform): InkStroke[] {
  return strokes.map((s) => (ids.has(s.id) ? applyXform(s, x) : s));
}

// ---------- editing selected strokes ----------

export const recolorSelected = (strokes: InkStroke[], ids: Set<string>, color: string): InkStroke[] =>
  strokes.map((s) => (ids.has(s.id) ? { ...s, color } : s));

export const rewidthSelected = (strokes: InkStroke[], ids: Set<string>, width: number): InkStroke[] =>
  strokes.map((s) => (ids.has(s.id) ? { ...s, width } : s));

export const deleteSelected = (strokes: InkStroke[], ids: Set<string>): InkStroke[] => strokes.filter((s) => !ids.has(s.id));

/** Bring to front / send to back (within the page's stroke order). */
export function reorderSelected(strokes: InkStroke[], ids: Set<string>, where: 'front' | 'back'): InkStroke[] {
  const sel = strokes.filter((s) => ids.has(s.id));
  const rest = strokes.filter((s) => !ids.has(s.id));
  return where === 'front' ? [...rest, ...sel] : [...sel, ...rest];
}

/** Fresh copies (new ids), shifted by (dx, dy). */
export function cloneStrokes(strokes: InkStroke[], dx = 0, dy = 0): InkStroke[] {
  return strokes.map((s) => {
    const pts = s.pts.slice();
    for (let i = 0; i + 1 < pts.length; i += 3) {
      pts[i] = Math.round((pts[i] + dx) * 10) / 10;
      pts[i + 1] = Math.round((pts[i + 1] + dy) * 10) / 10;
    }
    return { ...s, id: newStrokeId(), pts };
  });
}

export const pickStrokes = (strokes: InkStroke[], ids: Set<string>): InkStroke[] => strokes.filter((s) => ids.has(s.id));

/** Replace each selected stroke that looks like a line / circle / triangle / rectangle by the neat version. */
export function neatenSelected(strokes: InkStroke[], ids: Set<string>): { strokes: InkStroke[]; changed: number } {
  let changed = 0;
  const next = strokes.map((s) => {
    if (!ids.has(s.id)) return s;
    const shape = recognizeShape(strokePoints(s));
    if (!shape) return s;
    changed++;
    const pts: number[] = [];
    shape.pts.forEach(([x, y]) => pts.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, 0.5));
    return { ...s, pts, sim: true };
  });
  return { strokes: changed ? next : strokes, changed };
}

// ---------- picture of some strokes (for handwriting -> text) ----------

/** Black-on-white PNG (base64, no prefix) of the given strokes. Highlights are left out: they are not text. */
export function renderStrokesPng(strokes: InkStroke[]): { data: string; width: number; height: number } | null {
  const ink = strokes.filter((s) => layerOf(s) === 'ink');
  const b = boundsOf(ink);
  if (!b) return null;
  const pad = 24;
  const w = b.x1 - b.x0 + pad * 2;
  const h = b.y1 - b.y0 + pad * 2;
  const k = Math.min(2, 1600 / Math.max(w, h)); // bigger is clearer for the reader, but keep the upload small
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, (-b.x0 + pad) * k, (-b.y0 + pad) * k);
  // colours would only confuse the reader: draw everything solid black
  ink.forEach((s) => drawStroke(ctx, { ...s, color: '#000000' }, false));
  return { data: canvas.toDataURL('image/png').split(',')[1] ?? '', width: canvas.width, height: canvas.height };
}
