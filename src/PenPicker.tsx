import { useEffect, useRef, useState } from 'react';
import { useDarkTheme } from './useDarkTheme';
import { ChevronDown } from 'lucide-react';
import { drawStroke, PEN_KINDS } from './inkEngine';
import type { InkKind, InkStroke } from './notebookStore';

// ============================================================
// PenPicker.tsx — the pen / brush list, like Paint's: every row shows the NAME and a sample stroke
// drawn by the real ink engine, so you see what the line will look like before you pick it.
// ============================================================

/** A gentle S-curve, lighter at both ends (so pressure-sensitive brushes show their shape). */
function sampleStroke(kind: InkKind, color: string, width: number, w: number, h: number): InkStroke {
  const pts: number[] = [];
  const n = 48;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = 8 + t * (w - 16);
    const y = h / 2 + Math.sin(t * Math.PI * 2) * (h * 0.28);
    const p = 0.25 + 0.75 * Math.pow(Math.sin(t * Math.PI), 0.6);
    pts.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(p * 100) / 100);
  }
  return { id: `preview_${kind}`, kind, color, width, pts, sim: false, sm: 0.5 };
}

export function StrokeSample({
  kind, color, width = 3, w = 120, h = 28,
}: { kind: InkKind; color: string; width?: number; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dark = useDarkTheme();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawStroke(ctx, sampleStroke(kind, color, width, w, h), dark);
  }, [kind, color, width, w, h, dark]);
  return <canvas ref={ref} style={{ width: w, height: h }} aria-hidden="true" />;
}

export default function PenPicker({
  kind, color, labels, onPick, title,
}: {
  kind: InkKind;
  color: string;
  labels: Record<InkKind, string>;
  onPick: (k: InkKind) => void;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const btn = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 296)), top: r.bottom + 4 });
    setOpen((o) => !o);
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        title={title}
        aria-label={`${title}: ${labels[kind]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-10 sm:h-9 pl-1 pr-2 rounded-lg flex items-center gap-1 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
      >
        <StrokeSample kind={kind} color={color} width={2.5} w={64} h={24} />
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            aria-label={title}
            className="fixed z-50 w-[288px] max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-xl py-1"
            style={{ left: pos.left, top: pos.top }}
          >
            {PEN_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="option"
                aria-selected={k === kind}
                onClick={() => {
                  onPick(k);
                  setOpen(false);
                }}
                className={`relative w-full flex items-center justify-between gap-3 pl-4 pr-3 h-12 text-sm text-left hover:bg-gray-100 dark:hover:bg-white/10 ${k === kind ? 'bg-gray-100 dark:bg-white/10' : ''}`}
              >
                {k === kind && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-indigo-500" />}
                <span className="min-w-0 truncate text-gray-800 dark:text-white/90">{labels[k]}</span>
                <StrokeSample kind={k} color={color} width={3} w={120} h={30} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
