import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { OpenPdf } from './pdfTools';

interface Props {
  pdf: OpenPdf;
  pageNumber: number;
  width: number; // css px
  onSize?(size: { width: number; height: number }): void; // natural page size in PDF points (rotation applied)
  labels?: { renderFail?: string; retry?: string }; // `renderFail` has {0} = the page number
  children?: ReactNode; // overlay, expected to be `absolute inset-0`
}

export default function PdfPage({ pdf, pageNumber, width, onSize, labels, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onSizeRef = useRef(onSize);
  const [ratio, setRatio] = useState(Math.SQRT2); // A4 until the real size is known
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { onSizeRef.current = onSize; });

  useEffect(() => {
    let cancelled = false;
    pdf.getPageSize(pageNumber)
      .then((size) => {
        if (cancelled || !(size.width > 0)) return;
        setRatio(size.height / size.width);
        onSizeRef.current?.(size);
      })
      .catch(() => { /* the render effect reports the failure */ });
    return () => { cancelled = true; };
  }, [pdf, pageNumber]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !(width > 0)) return;
    let cancelled = false;
    setStatus('loading');
    pdf.renderPage(pageNumber, canvas, width)
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [pdf, pageNumber, width, attempt]);

  return (
    <div className="relative overflow-hidden bg-white shadow-sm" style={{ width, height: width * ratio }} aria-busy={status === 'loading'}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      {status === 'loading' && <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-300" aria-hidden />}
      {status === 'error' && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-100 p-4 text-center text-sm text-slate-700">
          <AlertTriangle className="h-8 w-8 text-amber-600" aria-hidden />
          <span>{(labels?.renderFail ?? 'Could not render page {0}.').replace('{0}', String(pageNumber))}</span>
          <button type="button" className="min-h-[44px] rounded-full bg-indigo-600 px-5 font-medium text-white active:scale-95" onClick={() => setAttempt((a) => a + 1)}>
            {labels?.retry ?? 'Retry'}
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
