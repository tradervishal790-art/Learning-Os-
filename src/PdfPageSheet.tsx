import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { InkStroke } from './notebookStore';
import type { InkMode, InkPrefs } from './inkPrefs';
import type { OpenPdf } from './pdfTools';
import { getPdf } from './attachStore';
import InkLayer from './InkLayer';
import PdfPage from './PdfPage';

// ============================================================
// PdfPageSheet.tsx — one page of an imported PDF with the student's
// handwriting drawn over it. The PDF file stays on this device
// (attachStore); each open PDF is shared by all of its pages.
// ============================================================

const cache = new Map<string, Promise<OpenPdf | null>>();

/** One opened document per file id. null = the file is not on this device. */
export function loadNotePdf(fileId: string): Promise<OpenPdf | null> {
  let p = cache.get(fileId);
  if (!p) {
    p = (async () => {
      const blob = await getPdf(fileId);
      if (!blob) return null;
      const { openPdf } = await import('./pdfTools'); // pdf.js is only downloaded when a PDF page is shown
      return openPdf(await blob.arrayBuffer());
    })();
    cache.set(fileId, p);
    p.catch(() => cache.delete(fileId)); // allow a retry after a failure
  }
  return p;
}

export default function PdfPageSheet({
  fileId,
  pageNumber,
  strokes,
  mode,
  prefs,
  selectedIds,
  onSelect,
  onInk,
  onActivate,
  labels,
}: {
  fileId: string;
  pageNumber: number;
  strokes: InkStroke[];
  mode: InkMode;
  prefs: InkPrefs;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onInk: (next: InkStroke[]) => void;
  onActivate: () => void;
  labels: Record<string, string>;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [ratio, setRatio] = useState(Math.SQRT2);
  const [visible, setVisible] = useState(false);
  const [pdf, setPdf] = useState<OpenPdf | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Only pages near the screen are drawn: a 100-page PDF must not render 100 canvases at once.
    const io = new IntersectionObserver((e) => setVisible(e.some((x) => x.isIntersecting)), { rootMargin: '800px 0px' });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visible || pdf || state === 'missing') return;
    let alive = true;
    loadNotePdf(fileId)
      .then((d) => {
        if (!alive) return;
        if (!d) return setState('missing');
        setPdf(d);
        setState('ready');
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, [visible, fileId, pdf, state]);

  const height = Math.round(w * ratio);
  return (
    <div ref={holder} className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white" style={{ minHeight: height || undefined }}>
      {state === 'missing' || state === 'error' ? (
        <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-xs text-gray-600" style={{ minHeight: height || 200 }}>
          <AlertTriangle size={20} className="text-amber-600" aria-hidden />
          <p>{labels[state === 'missing' ? 'pdfMissing' : 'pdfErrUnknown'] ?? state}</p>
        </div>
      ) : pdf && visible && w > 0 ? (
        <PdfPage pdf={pdf} pageNumber={pageNumber} width={w} onSize={(s) => setRatio(s.height / s.width)}>
          <InkLayer
            strokes={strokes}
            width={w}
            height={height}
            mode={mode}
            prefs={prefs}
            paperDark={false}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onCommit={onInk}
            onActivate={onActivate}
          />
        </PdfPage>
      ) : (
        <div className="animate-pulse bg-gray-100" style={{ height: height || 200 }} aria-hidden />
      )}
    </div>
  );
}
