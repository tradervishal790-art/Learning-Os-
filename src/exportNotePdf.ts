import { PAGE_RATIO, PAGE_UNITS, drawLayer, inkExtentY } from './inkEngine';
import { getImage } from './attachStore';
import { loadNotePdf } from './PdfPageSheet';
import { pageToHtml, type NotePage } from './notebookStore';
import { layoutText } from './pageLayout';
import { buildPdfFromJpegs } from './pdfAssemble';

// ============================================================
// exportNotePdf.ts — "Download PDF": a real .pdf file, no print window.
// Every page is DRAWN on a canvas (the browser shapes the text, so Hindi / Arabic / Tamil are correct),
// with its PDF page, photos, typed text and handwriting where they are on the page, then packed into an A4 PDF.
// Trade-off, by design: pages are pictures, so the text in this PDF cannot be selected or searched.
// (The "Printable page" export is still there for a text PDF.)
// ============================================================

const PX_W = 1240; // 150 dpi across A4
const K = PX_W / PAGE_UNITS;
const SLICE_PX = Math.round(PX_W * 1.4142); // one A4 page tall
const MAX_UNITS_H = 9000;
const FONT = "system-ui, -apple-system, 'Segoe UI', 'Noto Sans', 'Noto Sans Devanagari', sans-serif";

const toJpeg = (c: HTMLCanvasElement): Promise<Uint8Array> =>
  new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? void b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.88),
  );

async function drawPhotos(ctx: CanvasRenderingContext2D, page: NotePage, behind: boolean): Promise<void> {
  for (const a of page.attachments ?? []) {
    if (a.kind !== 'image' || a.x === undefined || a.y === undefined || !a.w) continue;
    if (!!a.behind !== behind) continue;
    try {
      const blob = await getImage(a.id);
      if (!blob) continue;
      const bmp = await createImageBitmap(blob);
      ctx.drawImage(bmp, a.x * K, a.y * K, a.w * K, a.w * (bmp.height / bmp.width) * K);
      bmp.close();
    } catch {
      // a photo that cannot be read is left out, the page still exports
    }
  }
}

/** One note page -> one tall canvas (A4 wide). */
async function renderPage(p: NotePage, withInk: boolean): Promise<HTMLCanvasElement | null> {
  const measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return null;
  const measure = (text: string, size: number, bold: boolean) => {
    measureCtx.font = `${bold ? 'bold ' : ''}${size * K}px ${FONT}`;
    return measureCtx.measureText(text).width / K;
  };
  const layout = p.pdf ? { lines: [], height: 0 } : layoutText(pageToHtml(p), measure);
  const ink = withInk ? p.ink ?? [] : [];
  const photoBottom = Math.max(0, ...(p.attachments ?? []).filter((a) => a.kind === 'image').map((a) => (a.y ?? 0) + (a.w ?? 0) * (a.ar ?? 0.75)));
  const units = Math.min(MAX_UNITS_H, Math.max(PAGE_UNITS * PAGE_RATIO, layout.height, inkExtentY(ink) + 30, photoBottom + 30));

  const canvas = document.createElement('canvas');
  canvas.width = PX_W;
  canvas.height = Math.round(units * K);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (p.pdf) {
    try {
      const doc = await loadNotePdf(p.pdf.fileId);
      if (doc && p.pdf.pageNumber <= doc.numPages) {
        const tmp = document.createElement('canvas');
        await doc.renderPage(p.pdf.pageNumber, tmp, 1000);
        ctx.drawImage(tmp, 0, 0, PX_W, (tmp.height / tmp.width) * PX_W);
      }
    } catch {
      // the PDF is not on this device: the handwriting still exports
    }
  }
  await drawPhotos(ctx, p, true);
  ctx.fillStyle = '#111111';
  ctx.textBaseline = 'top';
  for (const l of layout.lines) {
    ctx.font = `${l.bold ? 'bold ' : ''}${l.size * K}px ${FONT}`;
    ctx.fillText(l.text, l.x * K, l.y * K);
  }
  await drawPhotos(ctx, p, false);
  if (ink.length > 0) {
    ctx.setTransform(K, 0, 0, K, 0, 0);
    drawLayer(ctx, ink, 'hl', false);
    drawLayer(ctx, ink, 'ink', false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  return canvas;
}

const hasContent = (p: NotePage, withInk: boolean): boolean =>
  !!p.pdf || p.text.trim().length > 0 || (withInk && (p.ink?.length ?? 0) > 0) || (p.attachments ?? []).some((a) => a.kind === 'image' && a.w);

/** Throws when there is nothing to export. */
export async function exportNotePdf(title: string, pages: NotePage[], opts: { includeInk: boolean; onProgress?: (done: number, total: number) => void }): Promise<Uint8Array> {
  const todo = pages.filter((p) => hasContent(p, opts.includeInk));
  if (todo.length === 0) throw new Error('empty');
  const jpegs: { bytes: Uint8Array; heightRatio: number }[] = [];
  for (let i = 0; i < todo.length; i++) {
    opts.onProgress?.(i, todo.length);
    const page = await renderPage(todo[i], opts.includeInk);
    if (!page) throw new Error('canvas');
    // taller than one A4 page: cut it into A4 pages
    for (let y = 0; y < page.height; y += SLICE_PX) {
      const h = Math.min(SLICE_PX, page.height - y);
      const slice = document.createElement('canvas');
      slice.width = PX_W;
      slice.height = h;
      slice.getContext('2d')?.drawImage(page, 0, y, PX_W, h, 0, 0, PX_W, h);
      jpegs.push({ bytes: await toJpeg(slice), heightRatio: h / PX_W });
      slice.width = 0; // release the pixels
    }
    page.width = 0;
  }
  opts.onProgress?.(todo.length, todo.length);
  return buildPdfFromJpegs(jpegs, title);
}
