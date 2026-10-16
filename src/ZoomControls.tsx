import { Minus, Plus } from 'lucide-react';
import { ZOOM_MAX, ZOOM_MIN } from './useZoom';

/** [-] [125%] [+] [Fit] */
export default function ZoomControls({
  zoom, onZoomIn, onZoomOut, onFit, labels,
}: {
  zoom: number;
  onZoomIn(): void;
  onZoomOut(): void;
  onFit(): void;
  labels: { zoomIn: string; zoomOut: string; fit: string };
}) {
  const btn =
    'h-9 min-w-9 px-2 flex items-center justify-center text-xs text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden shrink-0">
      <button type="button" aria-label={labels.zoomOut} title={labels.zoomOut} disabled={zoom <= ZOOM_MIN} onClick={onZoomOut} className={btn}>
        <Minus size={14} />
      </button>
      <span className="px-1 min-w-[3.25rem] text-center text-xs tabular-nums text-gray-600 dark:text-white/70" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" aria-label={labels.zoomIn} title={labels.zoomIn} disabled={zoom >= ZOOM_MAX} onClick={onZoomIn} className={btn}>
        <Plus size={14} />
      </button>
      <button type="button" onClick={onFit} className={`${btn} border-l border-gray-200 dark:border-white/10`}>
        {labels.fit}
      </button>
    </div>
  );
}
