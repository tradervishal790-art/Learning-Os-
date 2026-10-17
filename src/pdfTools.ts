import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export type PdfErrorCode = 'password' | 'invalid' | 'too-large' | 'unknown';

export class PdfError extends Error {
  readonly code: PdfErrorCode;
  constructor(code: PdfErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'PdfError';
    this.code = code;
    Object.setPrototypeOf(this, PdfError.prototype);
  }
}

export interface OpenPdf {
  numPages: number;
  getPageSize(n: number): Promise<{ width: number; height: number }>;
  renderPage(n: number, canvas: HTMLCanvasElement, cssWidth: number): Promise<void>;
  getText(n: number): Promise<string>;
  destroy(): void;
}

const MAX_BYTES = 60 * 1024 * 1024;
let workerReady = false;

function ensureWorker(): void {
  if (!workerReady) {
    GlobalWorkerOptions.workerSrc = workerUrl;
    workerReady = true;
  }
}

const errName = (e: unknown): string =>
  typeof e === 'object' && e !== null && 'name' in e ? String((e as { name: unknown }).name) : '';

function mapError(e: unknown): PdfError {
  if (e instanceof PdfError) return e;
  const name = errName(e);
  if (name === 'PasswordException') return new PdfError('password', 'This PDF is password protected');
  if (name === 'InvalidPDFException' || name === 'FormatError' || name === 'MissingPDFException') {
    return new PdfError('invalid', 'This file is not a valid PDF');
  }
  return new PdfError('unknown', e instanceof Error ? e.message : 'Could not open the PDF');
}

export async function openPdf(source: File | ArrayBuffer, onProgress?: (fraction: number) => void): Promise<OpenPdf> {
  ensureWorker();
  const size = source instanceof ArrayBuffer ? source.byteLength : source.size;
  if (size > MAX_BYTES) throw new PdfError('too-large', 'PDF is larger than 60 MB');
  if (size === 0) throw new PdfError('invalid', 'The file is empty');

  const buffer = source instanceof ArrayBuffer ? source : await source.arrayBuffer();
  // pdf.js TRANSFERS the buffer to its worker (detaching it). Give it a copy so the caller's buffer stays usable for export.
  const data = new Uint8Array(buffer.slice(0));

  onProgress?.(0);
  const task = getDocument({ data });
  task.onProgress = (p: { loaded: number; total: number }) => {
    if (p.total > 0) onProgress?.(Math.min(1, p.loaded / p.total));
  };

  let doc: PDFDocumentProxy;
  try {
    doc = await task.promise;
  } catch (e) {
    void task.destroy();
    throw mapError(e);
  }
  onProgress?.(1);

  let destroyed = false;
  const pages = new Map<number, Promise<PDFPageProxy>>();
  const renders = new WeakMap<HTMLCanvasElement, RenderTask>();
  const live = new Set<RenderTask>();

  const guard = (n: number): void => {
    if (destroyed) throw new PdfError('unknown', 'The PDF has been closed');
    if (!Number.isInteger(n) || n < 1 || n > doc.numPages) throw new RangeError(`Page ${n} is out of range (1..${doc.numPages})`);
  };
  const getPage = (n: number): Promise<PDFPageProxy> => {
    let p = pages.get(n);
    if (!p) {
      p = doc.getPage(n);
      pages.set(n, p);
    }
    return p;
  };

  return {
    numPages: doc.numPages,

    async getPageSize(n) {
      guard(n);
      const page = await getPage(n);
      const vp = page.getViewport({ scale: 1 }); // honours /Rotate
      return { width: vp.width, height: vp.height };
    },

    async renderPage(n, canvas, cssWidth) {
      guard(n);
      if (!(cssWidth > 0)) return;
      const previous = renders.get(canvas);
      if (previous) {
        previous.cancel();
        await previous.promise.catch(() => undefined); // wait until it let go of the canvas
      }
      const page = await getPage(n);
      if (destroyed) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new PdfError('unknown', 'Canvas 2D is not available');
      // `canvasContext` is read by pdf.js 4.x, `canvas` by 5.x; passing both works on either
      const params = { canvasContext: ctx, canvas, viewport };
      const task = page.render(params);
      renders.set(canvas, task);
      live.add(task);
      try {
        await task.promise;
      } catch (e) {
        if (errName(e) === 'RenderingCancelledException') return; // superseded by a newer render
        throw e;
      } finally {
        live.delete(task);
        if (renders.get(canvas) === task) renders.delete(canvas);
      }
    },

    async getText(n) {
      guard(n);
      const page = await getPage(n);
      const content = await page.getTextContent();
      let out = '';
      for (const item of content.items) {
        if ('str' in item) out += item.str + (item.hasEOL ? '\n' : ' ');
      }
      return out.replace(/[ \t]+\n/g, '\n').trim();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      live.forEach((t) => t.cancel());
      live.clear();
      pages.clear();
      void task.destroy(); // frees the document and the worker
    },
  };
}
