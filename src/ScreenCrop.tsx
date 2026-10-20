import { useEffect, useRef, useState } from 'react';

// ============================================================
// ScreenCrop.tsx — "Smart Select" for the notebook (desktop browsers).
// The student picks a screen / window / tab to share, ONE frame is grabbed
// (sharing stops straight away), they drag a box over the part they want,
// and that part is added to the page as a picture. Nothing leaves the device.
// ============================================================

export const canCaptureScreen = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function';

type Box = { x: number; y: number; w: number; h: number };

async function grabFrame(): Promise<HTMLCanvasElement> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // one frame after the picture is really there
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext('2d')!.drawImage(video, 0, 0);
    return c;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export default function ScreenCrop({
  onDone, onCancel, labels,
}: {
  onDone: (png: Blob) => void;
  onCancel: () => void;
  labels: Record<string, string>;
}) {
  const t = (k: string) => labels[k] ?? k;
  const [frame, setFrame] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState('');
  const [box, setBox] = useState<Box | null>(null);
  const imgRef = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let alive = true;
    grabFrame()
      .then((c) => alive && setFrame(c))
      .catch((e: unknown) => {
        if (!alive) return;
        // the student pressed Cancel in the browser's picker: just close quietly
        if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')) onCancel();
        else setError(t('cropError'));
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const c = imgRef.current;
    if (!c || !frame) return;
    c.width = frame.width;
    c.height = frame.height;
    c.getContext('2d')!.drawImage(frame, 0, 0);
  }, [frame]);

  // pointer position in the picture's own pixels
  const pos = (e: React.PointerEvent): { x: number; y: number } => {
    const r = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(frame!.width, Math.max(0, ((e.clientX - r.left) / r.width) * frame!.width)),
      y: Math.min(frame!.height, Math.max(0, ((e.clientY - r.top) / r.height) * frame!.height)),
    };
  };
  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = pos(e);
    setBox(null);
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const p = pos(e);
    setBox({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const onUp = () => { start.current = null; };

  const use = (whole: boolean) => {
    if (!frame) return;
    const b = !whole && box && box.w > 8 && box.h > 8 ? box : { x: 0, y: 0, w: frame.width, h: frame.height };
    const out = document.createElement('canvas');
    out.width = Math.round(b.w);
    out.height = Math.round(b.h);
    out.getContext('2d')!.drawImage(frame, b.x, b.y, b.w, b.h, 0, 0, out.width, out.height);
    out.toBlob((blob) => (blob ? onDone(blob) : setError(t('cropError'))), 'image/png');
  };

  const btn = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10';
  const primary = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white dark:bg-indigo-500 hover:opacity-80 disabled:opacity-30';

  // while the browser's own "choose what to share" window is open there is nothing to show yet
  if (!frame && !error) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-label={t('cropTitle')}>
      <div className="w-full max-w-4xl max-h-full flex flex-col rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-4">
        <div className="font-semibold mb-1">{t('cropTitle')}</div>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400 py-4">{error}</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 dark:text-white/60 mb-2">{t('cropHint')}</p>
            <div className="relative min-h-0 overflow-auto rounded-lg border border-gray-200 dark:border-white/10 bg-black/5 select-none">
              <div className="relative inline-block max-w-full" style={{ touchAction: 'none' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                <canvas ref={imgRef} className="block max-w-full h-auto cursor-crosshair" />
                {box && frame && (
                  <div
                    className="absolute border-2 border-indigo-500 bg-indigo-500/10 pointer-events-none"
                    style={{
                      left: `${(box.x / frame.width) * 100}%`,
                      top: `${(box.y / frame.height) * 100}%`,
                      width: `${(box.w / frame.width) * 100}%`,
                      height: `${(box.h / frame.height) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )}
        <div className="flex flex-wrap justify-end gap-2 mt-3">
          <button className={btn} onClick={onCancel}>{t('cropCancel')}</button>
          {!error && <button className={btn} onClick={() => use(true)}>{t('cropWhole')}</button>}
          {!error && <button className={primary} disabled={!box || box.w < 8 || box.h < 8} onClick={() => use(false)}>{t('cropUse')}</button>}
        </div>
      </div>
    </div>
  );
}
