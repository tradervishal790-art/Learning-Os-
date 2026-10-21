// ============================================================
// inkSvg.ts — handwriting as SVG paths (shared by print/PDF and Word export). Pure.
// Uses the same perfect-freehand outlines as the drawing layer.
// ============================================================
import { getStroke } from 'perfect-freehand';
import type { InkKind, InkStroke } from './notebookStore';

function clampNum(v: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

export interface InkShape {
  d: string;
  color: string;
  opacity: number;
  dots?: { width: number; gap: number };
}
export type InkLayer = 'ink' | 'hl' | 'both';

const HEX6 = /^#[0-9a-fA-F]{6}$/;

const INK_STYLE: Record<InkKind, { thinning: number; widthMul: number; opacity: number }> = {
  ballpoint: { thinning: 0.2, widthMul: 1, opacity: 1 },
  fountain: { thinning: 0.6, widthMul: 1.15, opacity: 1 },
  felt: { thinning: 0.1, widthMul: 1.2, opacity: 1 },
  pencil: { thinning: 0.35, widthMul: 0.9, opacity: 0.85 },
  brush: { thinning: 0.75, widthMul: 1.6, opacity: 1 },
  calligraphy: { thinning: 0.85, widthMul: 1.4, opacity: 1 },
  fineliner: { thinning: 0, widthMul: 0.8, opacity: 1 },
  marker: { thinning: 0.05, widthMul: 2, opacity: 0.9 },
  dotted: { thinning: 0, widthMul: 1, opacity: 1 },
  highlighter: { thinning: 0, widthMul: 1, opacity: 0.4 },
  // textured brushes: print / Word export keeps their colour, width and see-through feel as a solid line
  calligraphyBrush: { thinning: 0.8, widthMul: 1.6, opacity: 1 },
  airbrush: { thinning: 0, widthMul: 3, opacity: 0.35 },
  oil: { thinning: 0.1, widthMul: 3.5, opacity: 0.9 },
  crayon: { thinning: 0, widthMul: 2, opacity: 0.8 },
  natural: { thinning: 0.3, widthMul: 1.2, opacity: 0.75 },
  watercolor: { thinning: 0, widthMul: 3.6, opacity: 0.3 },
};

function fmt(v: number): string {
  return String(Math.round(v * 10) / 10);
}

function resolveInkColor(color: string, dark: boolean): string {
  if (HEX6.test(color)) return color.toLowerCase();
  return dark ? '#f3f4f6' : '#111827'; // 'auto' (and anything invalid)
}

function strokePoints(s: InkStroke): number[][] {
  const out: number[][] = [];
  const a = s.pts;
  for (let i = 0; i + 1 < a.length; i += 3) {
    const x = a[i];
    const y = a[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const p = a[i + 2];
    out.push([x, y, Number.isFinite(p) ? clampNum(p, 0, 1, 0.5) : 0.5]);
  }
  return out;
}

function outlinePath(pts: number[][]): string {
  if (pts.length < 3) return '';
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}Q`;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    d += `${fmt(x0)} ${fmt(y0)} ${fmt((x0 + x1) / 2)} ${fmt((y0 + y1) / 2)} `;
  }
  return `${d.trimEnd()}Z`;
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M${fmt(cx - r)} ${fmt(cy)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(2 * r)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-2 * r)} 0Z`;
}

function shapeOf(s: InkStroke, dark: boolean): InkShape | null {
  const pts = strokePoints(s);
  if (pts.length === 0) return null;
  const st = Object.prototype.hasOwnProperty.call(INK_STYLE, s.kind) ? INK_STYLE[s.kind] : INK_STYLE.ballpoint;
  const size = Math.max(0.5, (Number.isFinite(s.width) ? s.width : 2) * st.widthMul);
  const color = resolveInkColor(s.color, dark);
  if (pts.length === 1) return { d: circlePath(pts[0][0], pts[0][1], size / 2), color, opacity: st.opacity };
  if (s.kind === 'dotted') {
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p[0])} ${fmt(p[1])}`).join('');
    return { d, color, opacity: st.opacity, dots: { width: size, gap: size * 2.2 } };
  }
  const outline = getStroke(pts, {
    size,
    thinning: st.thinning,
    smoothing: 0.5,
    streamline: clampNum(s.sm, 0, 1, 0.5),
    simulatePressure: s.sim,
    last: true,
  });
  const d = outlinePath(outline);
  return d ? { d, color, opacity: st.opacity } : null;
}

/** Page height in page units: at least the A4 ratio (1414), more when strokes go lower. */
export function inkPageHeight(strokes: readonly InkStroke[]): number {
  let maxY = 0;
  for (const s of strokes) {
    for (let i = 1; i < s.pts.length; i += 3) {
      const y = s.pts[i];
      if (Number.isFinite(y) && y > maxY) maxY = y;
    }
  }
  return Math.max(1414, Math.ceil(maxY));
}

export function renderInk(strokes: readonly InkStroke[], dark: boolean, layer: InkLayer): { shapes: InkShape[]; height: number } {
  const hl = strokes.filter((s) => s.kind === 'highlighter');
  const pen = strokes.filter((s) => s.kind !== 'highlighter');
  const ordered = [...(layer === 'ink' ? [] : hl), ...(layer === 'hl' ? [] : pen)]; // highlighter FIRST
  const shapes: InkShape[] = [];
  for (const s of ordered) {
    const sh = shapeOf(s, dark);
    if (sh) shapes.push(sh);
  }
  return { shapes, height: inkPageHeight(strokes) };
}

export function shapeToSvg(s: InkShape): string {
  const op = s.opacity < 1 ? ` opacity="${s.opacity}"` : '';
  if (s.dots) {
    return `<path d="${s.d}" fill="none" stroke="${s.color}" stroke-width="${fmt(s.dots.width)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0 ${fmt(s.dots.gap)}"${op}/>`;
  }
  return `<path d="${s.d}" fill="${s.color}"${op}/>`;
}

/** SVG markup, viewBox "0 0 1000 H". Highlighters first (opacity .4), 'auto' colour -> #111827 (#f3f4f6 when dark). */
export function inkToSvg(strokes: InkStroke[], opts: { dark?: boolean; layer?: InkLayer }): string {
  const r = renderInk(strokes, opts.dark === true, opts.layer ?? 'both');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${r.height}" width="1000" height="${r.height}">${r.shapes.map(shapeToSvg).join('')}</svg>`;
}
