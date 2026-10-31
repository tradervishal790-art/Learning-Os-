import {
  LineCapStyle, LineJoinStyle, PDFDocument, PDFName, PDFRef, appendBezierCurve, closePath, fill, lineTo, moveTo, popGraphicsState, pushGraphicsState,
  rgb, setDashPattern, setFillingColor, setGraphicsState, setLineCap, setLineJoin, setLineWidth, setStrokingColor, stroke as strokePath,
} from 'pdf-lib';
import type { PDFOperator, PDFPage } from 'pdf-lib';
import { getStroke } from 'perfect-freehand';
import { KINDS } from './inkEngine';
import type { InkKind, InkStroke } from './notebookStore';

export type PageRotation = 0 | 90 | 180 | 270;

export function normalizeRotation(deg: number): PageRotation {
  if (!Number.isFinite(deg)) return 0;
  return ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as PageRotation;
}

/**
 * Page units -> PDF user space (origin bottom-left, y up, relative to the page box origin).
 * pageW/pageH: UNROTATED page size in points (what pdf-lib reports).
 * Strokes live in the DISPLAYED orientation, whose width is 1000 units, so
 * scale = displayedWidth / 1000 with displayedWidth = pageW for 0/180 and pageH for 90/270.
 */
export function strokeToPdfPoints(stroke: InkStroke, pageW: number, pageH: number, rotate: PageRotation): { x: number; y: number }[] {
  const scale = (rotate === 90 || rotate === 270 ? pageH : pageW) / 1000;
  const out: { x: number; y: number }[] = [];
  const n = Math.floor(stroke.pts.length / 3);
  for (let i = 0; i < n; i++) {
    const px = stroke.pts[i * 3];
    const py = stroke.pts[i * 3 + 1];
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    const dx = px * scale; // displayed coords, y down
    const dy = py * scale;
    switch (rotate) {
      case 90: out.push({ x: dy, y: dx }); break;
      case 180: out.push({ x: pageW - dx, y: dy }); break;
      case 270: out.push({ x: pageW - dy, y: pageH - dx }); break;
      default: out.push({ x: dx, y: pageH - dy });
    }
  }
  return out;
}

function parseColor(color: string) {
  let hex = /^#?([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) {
    const short = /^#?([0-9a-f]{3})$/i.exec(color)?.[1];
    if (short) hex = short.split('').map((c) => c + c).join('');
  }
  if (!hex) return rgb(0, 0, 0); // 'auto' and anything unparseable -> black
  return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
}

/** One page-unit point -> PDF space (same mapping as strokeToPdfPoints, for any x/y). */
function mapXY(px: number, py: number, pageW: number, pageH: number, rotate: PageRotation): { x: number; y: number } {
  const scale = (rotate === 90 || rotate === 270 ? pageH : pageW) / 1000;
  const dx = px * scale;
  const dy = py * scale;
  switch (rotate) {
    case 90: return { x: dy, y: dx };
    case 180: return { x: pageW - dx, y: dy };
    case 270: return { x: pageW - dy, y: pageH - dx };
    default: return { x: dx, y: pageH - dy };
  }
}

/** Opacity used on screen; the textured brushes are drawn as translucent solid strokes here. */
function opacityOf(kind: InkKind): number {
  if (kind === 'watercolor' || kind === 'airbrush') return 0.45;
  return KINDS[kind]?.opacity ?? 1;
}

/**
 * Draws a stroke the way the page shows it: the SAME perfect-freehand outline (so pen pressure, thinning and
 * tapered ends carry over) at the pen's real size (a marker is 3x a ballpoint, a highlighter 6x), filled
 * with the pen's opacity. The old export drew every pen as a constant-width line, so pressure and pen style
 * were lost and highlighters / markers came out hair-thin.
 */
function drawStroke(page: PDFPage, s: InkStroke, ox: number, oy: number, pageW: number, pageH: number, rot: PageRotation, gs: PDFName | null): void {
  const n = Math.floor(s.pts.length / 3);
  if (n < 1) return;
  const cfg = KINDS[s.kind];
  if (!cfg) return;
  const scale = (rot === 90 || rot === 270 ? pageH : pageW) / 1000;
  const at = (px: number, py: number) => {
    const m = mapXY(px, py, pageW, pageH, rot);
    return { x: m.x + ox, y: m.y + oy };
  };
  const ops: PDFOperator[] = [pushGraphicsState()];
  if (gs) ops.push(setGraphicsState(gs));
  const color = parseColor(s.color);

  if (s.kind === 'dotted') {
    // dots: zero-length dashes with round caps, like the page
    const w = Math.max(0.1, s.width * 1.4 * scale);
    ops.push(setStrokingColor(color), setLineWidth(w), setLineCap(LineCapStyle.Round), setLineJoin(LineJoinStyle.Round));
    if (n > 1) ops.push(setDashPattern([0, w * 1.8], 0));
    const p0 = at(s.pts[0], s.pts[1]);
    ops.push(moveTo(p0.x, p0.y));
    if (n === 1) ops.push(lineTo(p0.x + 0.01, p0.y));
    for (let i = 1; i < n; i++) {
      const p = at(s.pts[i * 3], s.pts[i * 3 + 1]);
      ops.push(lineTo(p.x, p.y));
    }
    ops.push(strokePath(), popGraphicsState());
    page.pushOperators(...ops);
    return;
  }

  ops.push(setFillingColor(color));
  if (s.kind === 'calligraphy') {
    // flat nib held at 45 degrees: one parallelogram per segment, filled once
    const half = (s.width * 3.2) / 2;
    const dx = Math.cos(-Math.PI / 4) * half;
    const dy = Math.sin(-Math.PI / 4) * half;
    if (n === 1) {
      const a = at(s.pts[0] - dx, s.pts[1] - dy);
      const b = at(s.pts[0] + dx, s.pts[1] + dy);
      ops.push(setStrokingColor(color), setLineWidth(Math.max(0.1, s.width * 0.6 * scale)), setLineCap(LineCapStyle.Round), moveTo(a.x, a.y), lineTo(b.x, b.y), strokePath());
    }
    for (let i = 1; i < n; i++) {
      const ax = s.pts[(i - 1) * 3], ay = s.pts[(i - 1) * 3 + 1], bx = s.pts[i * 3], by = s.pts[i * 3 + 1];
      const q = [at(ax + dx, ay + dy), at(bx + dx, by + dy), at(bx - dx, by - dy), at(ax - dx, ay - dy)];
      ops.push(moveTo(q[0].x, q[0].y), lineTo(q[1].x, q[1].y), lineTo(q[2].x, q[2].y), lineTo(q[3].x, q[3].y), closePath());
    }
    if (n > 1) ops.push(fill());
    ops.push(popGraphicsState());
    page.pushOperators(...ops);
    return;
  }

  const pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    const x = s.pts[i * 3], y = s.pts[i * 3 + 1];
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y, s.pts[i * 3 + 2]]);
  }
  if (pts.length === 0) return;
  const size = s.width * cfg.size;
  const outline = getStroke(pts, {
    size,
    thinning: cfg.thinning,
    smoothing: 0.5 + s.sm * 0.3,
    streamline: s.sm,
    simulatePressure: s.sim,
    last: true,
    start: cfg.taper ? { taper: size * 1.5, cap: true } : { cap: true },
    end: cfg.taper ? { taper: size * 3, cap: true } : { cap: true },
  });
  if (outline.length < 2) return;
  // the page smooths the outline with quadratic curves through the midpoints; PDF only has cubic ones
  const P = outline.map(([x, y]) => at(x, y));
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let cur = P[0];
  ops.push(moveTo(cur.x, cur.y));
  for (let i = 0; i < P.length; i++) {
    const q = P[i];
    const end = mid(q, P[(i + 1) % P.length]);
    ops.push(appendBezierCurve(
      cur.x + (2 / 3) * (q.x - cur.x), cur.y + (2 / 3) * (q.y - cur.y),
      end.x + (2 / 3) * (q.x - end.x), end.y + (2 / 3) * (q.y - end.y),
      end.x, end.y,
    ));
    cur = end;
  }
  ops.push(closePath(), fill(), popGraphicsState());
  page.pushOperators(...ops);
}

export async function exportAnnotatedPdf(
  original: ArrayBuffer,
  pages: { pageNumber: number; strokes: InkStroke[] }[],
  opts?: { includeAnnotations?: boolean },
): Promise<Uint8Array> {
  const copyOfOriginal = (): Uint8Array => new Uint8Array(original.slice(0));
  if (opts?.includeAnnotations === false) return copyOfOriginal();
  if (!pages.some((p) => p.strokes.length > 0)) return copyOfOriginal();

  const doc = await PDFDocument.load(original.slice(0), { updateMetadata: false }); // a COPY: the input buffer is never touched
  const pdfPages = doc.getPages();
  const gsRefs = new Map<number, PDFRef>(); // one ExtGState per opacity used

  for (const entry of pages) {
    const page = pdfPages[entry.pageNumber - 1];
    if (!page || entry.strokes.length === 0) continue;
    const box = page.getCropBox();
    const rot = normalizeRotation(page.getRotation().angle);
    const gsNames = new Map<number, PDFName>();
    const gsFor = (kind: InkKind): PDFName | null => {
      const o = Math.round(opacityOf(kind) * 100) / 100;
      if (o >= 1) return null;
      let name = gsNames.get(o);
      if (!name) {
        let ref = gsRefs.get(o);
        if (!ref) {
          ref = doc.context.register(doc.context.obj({ Type: 'ExtGState', CA: o, ca: o }));
          gsRefs.set(o, ref);
        }
        name = page.node.newExtGState('GS', ref);
        gsNames.set(o, name);
      }
      return name;
    };
    // highlighter underneath, pens on top (as on the page)
    const ordered = [...entry.strokes.filter((s) => s.kind === 'highlighter'), ...entry.strokes.filter((s) => s.kind !== 'highlighter')];
    for (const s of ordered) drawStroke(page, s, box.x, box.y, box.width, box.height, rot, KINDS[s.kind] ? gsFor(s.kind) : null);
  }
  return doc.save();
}
