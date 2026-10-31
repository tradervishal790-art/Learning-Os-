// ============================================================
// renderInkCrop.ts — a picture of one region of a page: the PDF page underneath (when the page is a PDF page),
// then the handwriting and highlighter on top. Browser only (needs a canvas). Never throws: null = no picture.
// ============================================================
import { drawLayer } from './inkEngine';
import { loadNotePdf } from './PdfPageSheet';
import type { InkStroke } from './notebookStore';

const MAX_W = 640;
const MAX_H = 520;

export async function renderInkCrop(opts: {
  ink: InkStroke[];
  box: { x: number; y: number; w: number; h: number };
  pdf?: { fileId: string; pageNumber: number };
}): Promise<string | null> {
  try {
    const { box } = opts;
    const k = Math.min(2, MAX_W / box.w, MAX_H / box.h);
    const w = Math.max(1, Math.round(box.w * k));
    const h = Math.max(1, Math.round(box.h * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    if (opts.pdf) {
      const doc = await loadNotePdf(opts.pdf.fileId);
      if (doc && opts.pdf.pageNumber <= doc.numPages) {
        const full = document.createElement('canvas');
        await doc.renderPage(opts.pdf.pageNumber, full, 1000);
        const f = full.width / 1000; // canvas pixels per page unit
        ctx.drawImage(full, box.x * f, box.y * f, box.w * f, box.h * f, 0, 0, w, h);
      }
    }

    ctx.setTransform(k, 0, 0, k, -box.x * k, -box.y * k);
    drawLayer(ctx, opts.ink, 'hl', false);
    drawLayer(ctx, opts.ink, 'ink', false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}
