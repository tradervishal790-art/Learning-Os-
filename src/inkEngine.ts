import { getStroke } from 'perfect-freehand';
import type { InkKind, InkStroke } from './notebookStore';

// ============================================================
// inkEngine.ts — everything about handwriting that is NOT React:
// pen definitions, drawing a stroke to a canvas, hit-testing and erasing.
// Page units: a page is PAGE_UNITS wide; strokes are stored in those units.
// ============================================================

export const PAGE_UNITS = 1000;
export const PAGE_RATIO = 1.414; // A4 height / width

export type Layer = 'ink' | 'hl';

interface KindCfg {
  /** Multiplier on the chosen thickness. */
  size: number;
  thinning: number;
  opacity: number;
  layer: Layer;
  taper?: boolean;
}

export const KINDS: Record<InkKind, KindCfg> = {
  ballpoint: { size: 1, thinning: 0.1, opacity: 1, layer: 'ink' },
  fountain: { size: 1.4, thinning: 0.7, opacity: 1, layer: 'ink', taper: true },
  felt: { size: 2, thinning: 0, opacity: 0.92, layer: 'ink' },
  pencil: { size: 1, thinning: 0.35, opacity: 0.78, layer: 'ink' },
  brush: { size: 2.6, thinning: 0.85, opacity: 1, layer: 'ink', taper: true },
  calligraphy: { size: 1, thinning: 0, opacity: 1, layer: 'ink' },
  fineliner: { size: 0.55, thinning: 0, opacity: 1, layer: 'ink' },
  marker: { size: 3.2, thinning: 0, opacity: 0.9, layer: 'ink' },
  dotted: { size: 1, thinning: 0, opacity: 1, layer: 'ink' },
  highlighter: { size: 6, thinning: 0, opacity: 0.4, layer: 'hl' },
  calligraphyBrush: { size: 1.6, thinning: 0, opacity: 1, layer: 'ink' },
  airbrush: { size: 4, thinning: 0, opacity: 1, layer: 'ink' },
  oil: { size: 4.2, thinning: 0, opacity: 1, layer: 'ink' },
  crayon: { size: 2.2, thinning: 0, opacity: 1, layer: 'ink' },
  natural: { size: 1.8, thinning: 0, opacity: 1, layer: 'ink' },
  watercolor: { size: 3.6, thinning: 0, opacity: 1, layer: 'ink' },
};

/** Brush list in the same order as Paint's, then the everyday pens. */
export const PEN_KINDS: InkKind[] = [
  'brush', 'calligraphyBrush', 'calligraphy', 'airbrush', 'oil', 'crayon', 'marker', 'natural', 'watercolor',
  'ballpoint', 'fountain', 'felt', 'pencil', 'fineliner', 'dotted',
];

/** 12 colours that stay readable on light and dark pages. 'auto' = black / near-white by theme. */
export const INK_COLORS = [
  'auto', '#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f97316',
  '#a16207', '#14b8a6', '#ec4899', '#9ca3af', '#1d4ed8', '#eab308',
];
/** Highlighter meaning-colours (Part 6 filters by these): important, understood, doubt, example. */
export const HL_COLORS = ['#fde047', '#86efac', '#f9a8d4', '#93c5fd'];
export const WIDTH_PRESETS = [1, 2, 3, 5, 8];

export const layerOf = (s: InkStroke): Layer => KINDS[s.kind].layer;

export function resolveColor(color: string, dark: boolean): string {
  return color === 'auto' ? (dark ? '#f3f4f6' : '#111827') : color;
}

export const newStrokeId = () => `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ---------- recording points ----------

/** Append a point unless it is basically on top of the previous one. Returns true if added. */
export function pushPoint(pts: number[], x: number, y: number, p: number, minDist = 0.7): boolean {
  const n = pts.length;
  if (n >= 3) {
    const dx = x - pts[n - 3];
    const dy = y - pts[n - 2];
    if (dx * dx + dy * dy < minDist * minDist) return false;
  }
  pts.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(p * 100) / 100);
  return true;
}

function toPoints(pts: number[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i + 2 < pts.length; i += 3) out.push([pts[i], pts[i + 1], pts[i + 2]]);
  return out;
}

// ---------- drawing ----------

function outlinePath(outline: number[][]): Path2D {
  const path = new Path2D();
  if (outline.length < 2) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

// ---------- textured brushes (airbrush, oil, crayon, natural pencil, watercolour, calligraphy brush) ----------
// Everything is deterministic: the same stroke always draws the same grain (random numbers come from the stroke id).

function seeded(id: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0..1 pressure per point; a mouse / finger has none, so speed stands in (slow = heavy). */
function pressures(pts: number[][], sim: boolean): number[] {
  if (!sim) return pts.map((p) => (p[2] > 0 ? p[2] : 0.5));
  const out: number[] = [];
  let f = 0.7;
  for (let i = 0; i < pts.length; i++) {
    const d = i ? Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) : 0;
    f += (Math.min(1, Math.max(0.4, 1.1 - d / 10)) - f) * 0.25;
    out.push(f);
  }
  return out;
}

function tracePath(ctx: CanvasRenderingContext2D, pts: number[][], dx = 0, dy = 0): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
  if (pts.length === 1) ctx.lineTo(pts[0][0] + dx + 0.01, pts[0][1] + dy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + dx, pts[i][1] + dy);
}

/** Points every `gap` units along the path (for sprinkling grain evenly). */
function along(pts: number[][], gap: number): [number, number][] {
  const out: [number, number][] = [[pts[0][0], pts[0][1]]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    let at = gap - carry;
    while (at <= len) {
      out.push([ax + ((bx - ax) * at) / len, ay + ((by - ay) * at) / len]);
      at += gap;
    }
    carry = len - (at - gap);
  }
  return out;
}

/** Returns true when it drew the stroke itself. */
function drawBrush(ctx: CanvasRenderingContext2D, s: InkStroke, pts: number[][], complete: boolean): boolean {
  const k = s.kind;
  if (k !== 'calligraphyBrush' && k !== 'airbrush' && k !== 'oil' && k !== 'crayon' && k !== 'natural' && k !== 'watercolor') return false;
  const size = s.width * KINDS[k].size; // overall brush width
  const rnd = seeded(s.id);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], Math.max(0.6, size / 2), 0, Math.PI * 2);
    ctx.globalAlpha = k === 'watercolor' || k === 'airbrush' ? 0.35 : 1;
    ctx.fill();
    return true;
  }

  if (k === 'calligraphyBrush') {
    // flat nib at 45° whose width follows pressure and tapers at both ends
    const pr = pressures(pts, s.sim);
    const n = pts.length;
    const nib = new Path2D();
    for (let i = 1; i < n; i++) {
      const t = i / (n - 1);
      const taper = Math.max(0.15, Math.min(1, t / 0.12, complete ? (1 - t) / 0.2 : 1));
      const half = (size * 1.9 * taper * (0.35 + 0.65 * pr[i])) / 2;
      const dx = Math.cos(-Math.PI / 4) * half;
      const dy = Math.sin(-Math.PI / 4) * half;
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      nib.moveTo(ax + dx, ay + dy);
      nib.lineTo(bx + dx, by + dy);
      nib.lineTo(bx - dx, by - dy);
      nib.lineTo(ax - dx, ay - dy);
      nib.closePath();
    }
    ctx.fill(nib, 'nonzero');
    return true;
  }

  if (k === 'airbrush') {
    // a soft cloud (wide + faint passes build up to a dense core) and fine spray dots around it
    for (const f of [1, 0.78, 0.58, 0.4, 0.24, 0.12]) {
      ctx.globalAlpha = 0.11;
      ctx.lineWidth = size * f;
      tracePath(ctx, pts);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.6;
    for (const [x, y] of along(pts, Math.max(1, size * 0.12))) {
      for (let j = 0; j < 4; j++) {
        const a = rnd() * Math.PI * 2;
        const r = size * 0.62 * Math.sqrt(rnd());
        ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.8, 0.8);
      }
    }
    return true;
  }

  if (k === 'watercolor') {
    // see-through washes that overlap, with a slightly darker edge where the paint pooled
    const wash = (w: number, jitter: number) => {
      const out = getStroke(pts, { size: w, thinning: 0, smoothing: 0.6, streamline: 0.5, simulatePressure: false, last: complete });
      ctx.save();
      ctx.translate(jitter, jitter * 0.6);
      ctx.fill(outlinePath(out));
      ctx.restore();
      return out;
    };
    ctx.globalAlpha = 0.2;
    const outer = wash(size, 0);
    ctx.globalAlpha = 0.17;
    wash(size * 0.72, size * 0.06);
    ctx.globalAlpha = 0.14;
    wash(size * 0.45, -size * 0.05);
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = Math.max(0.6, size * 0.05);
    ctx.stroke(outlinePath(outer));
    return true;
  }

  // the bristle / grain brushes need the direction of travel
  const norm: [number, number][] = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 2)];
    const b = pts[Math.min(pts.length - 1, i + 2)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  });

  if (k === 'oil') {
    // a thick body of paint, then dense bristle streaks of different strength on top (with the odd dry gap)
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = size * 0.92;
    tracePath(ctx, pts);
    ctx.stroke();
    const n = Math.max(8, Math.min(18, Math.round(size / 0.8)));
    const bw = (size / n) * 1.5;
    for (let b = 0; b < n; b++) {
      const off = (b / (n - 1) - 0.5) * (size - bw);
      ctx.lineWidth = bw;
      let run: [number, number][] = [];
      const flush = () => {
        if (run.length > 1) {
          ctx.globalAlpha = 0.3 + rnd() * 0.7;
          ctx.beginPath();
          ctx.moveTo(run[0][0], run[0][1]);
          for (let i = 1; i < run.length; i++) ctx.lineTo(run[i][0], run[i][1]);
          ctx.stroke();
        }
        run = [];
      };
      for (let i = 0; i < pts.length; i++) {
        run.push([pts[i][0] + norm[i][0] * off, pts[i][1] + norm[i][1] * off]);
        if (run.length > 5 && rnd() < 0.07) flush();
      }
      flush();
    }
    return true;
  }

  if (k === 'crayon') {
    // a faint waxy body, then rough grain dots all through it
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = size * 0.8;
    tracePath(ctx, pts);
    ctx.stroke();
    const R = size / 2;
    for (const [x, y] of along(pts, 1.1)) {
      for (let j = 0; j < 5; j++) {
        const a = rnd() * Math.PI * 2;
        const r = R * Math.sqrt(rnd());
        ctx.globalAlpha = 0.55 + rnd() * 0.45;
        const d = 0.8 + rnd() * 1.1;
        ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, d, d);
      }
    }
    return true;
  }

  // natural pencil: a light graphite line plus fine grain and a wobbling thin core
  const R = size / 2;
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = Math.max(0.8, size * 0.7);
  tracePath(ctx, pts);
  ctx.stroke();
  for (const [x, y] of along(pts, 0.8)) {
    for (let j = 0; j < 4; j++) {
      const a = rnd() * Math.PI * 2;
      const r = R * 0.9 * Math.sqrt(rnd());
      ctx.globalAlpha = 0.45 + rnd() * 0.5;
      ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.7, 0.7);
    }
  }
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = Math.max(0.5, size * 0.28);
  tracePath(ctx, pts, (rnd() - 0.5) * size * 0.3, (rnd() - 0.5) * size * 0.3);
  ctx.stroke();
  return true;
}

/** Draw one stroke. `complete=false` while the pen is still down. */
export function drawStroke(ctx: CanvasRenderingContext2D, s: InkStroke, dark: boolean, complete = true): void {
  const cfg = KINDS[s.kind];
  const color = resolveColor(s.color, dark);
  const pts = toPoints(s.pts);
  if (pts.length === 0) return;
  ctx.save();
  ctx.globalAlpha = cfg.opacity;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  if (drawBrush(ctx, s, pts, complete)) {
    ctx.restore();
    return;
  }

  if (s.kind === 'dotted') {
    const w = s.width * 1.4;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([0, w * 1.8]);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  } else if (s.kind === 'calligraphy') {
    // Flat nib held at 45°: thick on one diagonal, thin on the other.
    const half = (s.width * 3.2) / 2;
    const dx = Math.cos(-Math.PI / 4) * half;
    const dy = Math.sin(-Math.PI / 4) * half;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0] - dx, pts[0][1] - dy);
      ctx.lineTo(pts[0][0] + dx, pts[0][1] + dy);
      ctx.lineWidth = s.width * 0.6;
      ctx.stroke();
    }
    // one combined path, filled once: no hairline seams between the pieces
    const nib = new Path2D();
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      nib.moveTo(ax + dx, ay + dy);
      nib.lineTo(bx + dx, by + dy);
      nib.lineTo(bx - dx, by - dy);
      nib.lineTo(ax - dx, ay - dy);
      nib.closePath();
    }
    ctx.fill(nib, 'nonzero');
  } else {
    const size = s.width * cfg.size;
    const outline = getStroke(pts, {
      size,
      thinning: cfg.thinning,
      smoothing: 0.5 + s.sm * 0.3,
      streamline: s.sm,
      simulatePressure: s.sim,
      last: complete,
      start: cfg.taper ? { taper: size * 1.5, cap: true } : { cap: true },
      end: cfg.taper ? { taper: size * 3, cap: true } : { cap: true },
    });
    ctx.fill(outlinePath(outline));
  }
  ctx.restore();
}

export function drawLayer(ctx: CanvasRenderingContext2D, strokes: InkStroke[], layer: Layer, dark: boolean): void {
  for (const s of strokes) if (layerOf(s) === layer) drawStroke(ctx, s, dark);
}

// ---------- geometry ----------

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

interface Box { x0: number; y0: number; x1: number; y1: number }
const boxes = new WeakMap<InkStroke, Box>();
function boxOf(s: InkStroke): Box {
  let b = boxes.get(s);
  if (!b) {
    b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (let i = 0; i + 1 < s.pts.length; i += 3) {
      b.x0 = Math.min(b.x0, s.pts[i]);
      b.x1 = Math.max(b.x1, s.pts[i]);
      b.y0 = Math.min(b.y0, s.pts[i + 1]);
      b.y1 = Math.max(b.y1, s.pts[i + 1]);
    }
    boxes.set(s, b);
  }
  return b;
}

const pad = (s: InkStroke) => s.width * KINDS[s.kind].size * 1.5;

/** Does a circle at (x, y) with radius r touch this stroke? */
export function strokeHit(s: InkStroke, x: number, y: number, r: number): boolean {
  const b = boxOf(s);
  const m = r + pad(s);
  if (x < b.x0 - m || x > b.x1 + m || y < b.y0 - m || y > b.y1 + m) return false;
  const p = s.pts;
  if (p.length === 3) return Math.hypot(x - p[0], y - p[1]) <= m;
  for (let i = 0; i + 4 < p.length; i += 3) {
    if (distToSegment(x, y, p[i], p[i + 1], p[i + 3], p[i + 4]) <= m) return true;
  }
  return false;
}

export const inLayers = (s: InkStroke, target: 'all' | 'ink' | 'hl'): boolean =>
  target === 'all' || layerOf(s) === target;

/** Stroke eraser: drop every targeted stroke the circle touches. Same array if nothing was hit. */
export function eraseStrokes(strokes: InkStroke[], x: number, y: number, r: number, target: 'all' | 'ink' | 'hl'): InkStroke[] {
  const next = strokes.filter((s) => !(inLayers(s, target) && strokeHit(s, x, y, r)));
  return next.length === strokes.length ? strokes : next;
}

/** Area eraser: cut away only the part of each stroke inside the circle, splitting strokes in two. */
export function eraseArea(strokes: InkStroke[], x: number, y: number, r: number, target: 'all' | 'ink' | 'hl'): InkStroke[] {
  let changed = false;
  const out: InkStroke[] = [];
  for (const s of strokes) {
    if (!inLayers(s, target) || !strokeHit(s, x, y, r)) {
      out.push(s);
      continue;
    }
    const p = s.pts;
    const n = p.length / 3;
    const runs: number[][] = [];
    let run: number[] = [];
    const flush = () => {
      if (run.length >= 6) runs.push(run); // need at least 2 points
      run = [];
    };
    let touched = false;
    for (let i = 0; i < n; i++) {
      const inside = Math.hypot(p[i * 3] - x, p[i * 3 + 1] - y) <= r;
      if (inside) {
        touched = true;
        flush();
        continue;
      }
      // a segment that crosses the circle between two outside points is cut too
      if (i > 0 && run.length > 0) {
        const j = i - 1;
        if (distToSegment(x, y, p[j * 3], p[j * 3 + 1], p[i * 3], p[i * 3 + 1]) <= r) {
          touched = true;
          flush();
        }
      }
      run.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    }
    flush();
    if (!touched) {
      out.push(s);
      continue;
    }
    changed = true;
    runs.forEach((pts, k) => out.push({ ...s, id: `${s.id}_${k}${Math.random().toString(36).slice(2, 5)}`, pts }));
  }
  return changed ? out : strokes;
}

/** Lowest y of any stroke (page units) — the page grows to fit the handwriting. */
export function inkExtentY(strokes: InkStroke[]): number {
  let m = 0;
  for (const s of strokes) m = Math.max(m, boxOf(s).y1);
  return m;
}
