import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, GripHorizontal, Highlighter, LassoSelect, PenLine, Pointer, Redo2, Undo2, X } from 'lucide-react';
import type { InkMode } from './inkPrefs';

// ============================================================
// QuickDock.tsx — a slim tool strip on the right edge: pen, highlighter, eraser,
// laser, select and undo / redo are always one tap away (phones, and presentation mode).
// The grip at the top drags it anywhere on screen (it used to be stuck on the right edge, on top of the
// page), and the spot is remembered.
// ============================================================

export default function QuickDock({
  mode, onMode, canUndo, canRedo, onUndo, onRedo, onExit, labels,
}: {
  mode: InkMode;
  onMode: (m: InkMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExit?: () => void;
  labels: { pen: string; highlighter: string; eraser: string; laser: string; select: string; undo: string; redo: string; exit: string; move: string };
}) {
  const { ref, style, grip } = useDraggable();
  const tools: [InkMode, string, React.ReactNode][] = [
    ['pen', labels.pen, <PenLine size={18} key="p" />],
    ['highlighter', labels.highlighter, <Highlighter size={18} key="h" />],
    ['eraser', labels.eraser, <Eraser size={18} key="e" />],
    ['laser', labels.laser, <Pointer size={18} key="l" />],
    ['select', labels.select, <LassoSelect size={18} key="s" />],
  ];
  const cls = (on: boolean, off = false) =>
    `h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-colors disabled:opacity-30 ${
      on ? 'bg-indigo-600 text-white dark:bg-indigo-500' : off ? 'text-gray-400' : 'text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10'
    }`;
  return (
    <div
      ref={ref}
      role="toolbar"
      style={style}
      className={`fixed z-[45] flex flex-col items-center gap-1 p-1 rounded-full border border-gray-200 dark:border-white/15 bg-white/95 dark:bg-neutral-900/95 shadow-lg ${style.left === undefined ? 'right-2 top-1/2 -translate-y-1/2' : ''}`}
    >
      <button type="button" title={labels.move} aria-label={labels.move} {...grip} className="h-7 w-11 shrink-0 rounded-full flex items-center justify-center text-gray-400 dark:text-white/40 cursor-grab active:cursor-grabbing touch-none select-none">
        <GripHorizontal size={16} />
      </button>
      {tools.map(([m, label, icon]) => (
        <button key={m} type="button" title={label} aria-label={label} aria-pressed={mode === m} onClick={() => onMode(m)} className={cls(mode === m)}>
          {icon}
        </button>
      ))}
      <span className="h-px w-6 bg-gray-200 dark:bg-white/15" />
      <button type="button" title={labels.undo} aria-label={labels.undo} disabled={!canUndo} onClick={onUndo} className={cls(false)}><Undo2 size={18} /></button>
      <button type="button" title={labels.redo} aria-label={labels.redo} disabled={!canRedo} onClick={onRedo} className={cls(false)}><Redo2 size={18} /></button>
      {onExit && (
        <>
          <span className="h-px w-6 bg-gray-200 dark:bg-white/15" />
          <button type="button" title={labels.exit} aria-label={labels.exit} onClick={onExit} className={cls(false)}><X size={18} /></button>
        </>
      )}
    </div>
  );
}

const POS_KEY = 'learning_os_quickdock_pos';
const EDGE = 4;

/** Drag by the grip; position is clamped to the screen (also after a resize / rotation) and remembered. */
function useDraggable() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null') as { x?: unknown; y?: unknown } | null;
      return v && typeof v.x === 'number' && typeof v.y === 'number' ? { x: v.x, y: v.y } : null;
    } catch {
      return null;
    }
  });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const clamp = useCallback((x: number, y: number) => {
    const r = ref.current?.getBoundingClientRect();
    const w = r?.width ?? 52;
    const h = r?.height ?? 300;
    return {
      x: Math.round(Math.min(Math.max(EDGE, x), Math.max(EDGE, window.innerWidth - w - EDGE))),
      y: Math.round(Math.min(Math.max(EDGE, y), Math.max(EDGE, window.innerHeight - h - EDGE))),
    };
  }, []);

  // keep it on screen when the window is resized or the phone is rotated
  useEffect(() => {
    if (!pos) return;
    const fix = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    fix();
    window.addEventListener('resize', fix);
    return () => window.removeEventListener('resize', fix);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamp, pos === null]);

  const grip = {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      setPos({ x: r.left, y: r.top }); // leave the CSS default spot and take over with pixels
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = drag.current;
      if (d) setPos(clamp(e.clientX - d.dx, e.clientY - d.dy));
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag.current) return;
      drag.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(p));
          } catch {
            // position just is not remembered
          }
        }
        return p;
      });
    },
    onPointerCancel: () => {
      drag.current = null;
    },
    // keyboard: arrow keys nudge it
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const step = e.shiftKey ? 40 : 12;
      const mv: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const d = mv[e.key];
      const r = ref.current?.getBoundingClientRect();
      if (!d || !r) return;
      e.preventDefault();
      const next = clamp((pos?.x ?? r.left) + d[0], (pos?.y ?? r.top) + d[1]);
      setPos(next);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(next));
      } catch {
        // position just is not remembered
      }
    },
  };

  const style: React.CSSProperties = pos ? { left: pos.x, top: pos.y } : {};
  return { ref, style, grip };
}
