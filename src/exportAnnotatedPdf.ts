import {
  LineCapStyle, LineJoinStyle, PDFDocument, PDFName, PDFRef, lineTo, moveTo, popGraphicsState, pushGraphicsState,
  rgb, setDashPattern, setGraphicsState, setLineCap, setLineJoin, setLineWidth, setStrokingColor, stroke as strokePath,
} from 'pdf-lib';
import type { PDFOperator, PDFPage } from 'pdf-lib';
import type { InkStroke } from './notebookStore';

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

function drawStroke(page: PDFPage, s: InkStroke, ox: number, oy: number, pageW: number, pageH: number, rot: PageRotation, gs: PDFName | null): void {
  const pts = strokeToPdfPoints(s, pageW, pageH, rot);
  if (pts.length < 1) return;
  const scale = (rot === 90 || rot === 270 ? pageH : pageW) / 1000;
  const width = Math.max(0.1, s.width * scale);
  const ops: PDFOperator[] = [pushGraphicsState()];
  if (gs) ops.push(setGraphicsState(gs));
  ops.push(setStrokingColor(parseColor(s.color)), setLineWidth(width), setLineCap(LineCapStyle.Round), setLineJoin(LineJoinStyle.Round));
  if (s.kind === 'dotted' && pts.length > 1) ops.push(setDashPattern([Math.max(0.1, width * 0.1), width * 2.2], 0));
  ops.push(moveTo(pts[0].x + ox, pts[0].y + oy));
  if (pts.length === 1) {
    ops.push(lineTo(pts[0].x + ox + 0.01, pts[0].y + oy)); // zero-length round-capped segment = a dot
  } else {
    for (let i = 1; i < pts.length; i++) ops.push(lineTo(pts[i].x + ox, pts[i].y + oy));
  }
  ops.push(strokePath(), popGraphicsState());
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
  const highlighterGs: PDFRef = doc.context.register(doc.context.obj({ Type: 'ExtGState', CA: 0.4, ca: 0.4 }));
  const pdfPages = doc.getPages();

  for (const entry of pages) {
    const page = pdfPages[entry.pageNumber - 1];
    if (!page || entry.strokes.length === 0) continue;
    const box = page.getCropBox();
    const rot = normalizeRotation(page.getRotation().angle);
    const gsName = page.node.newExtGState('GS', highlighterGs);
    const highlighters = entry.strokes.filter((s) => s.kind === 'highlighter');
    const others = entry.strokes.filter((s) => s.kind !== 'highlighter');
    for (const s of highlighters) drawStroke(page, s, box.x, box.y, box.width, box.height, rot, gsName);
    for (const s of others) drawStroke(page, s, box.x, box.y, box.width, box.height, rot, null);
  }
  return doc.save();
}
