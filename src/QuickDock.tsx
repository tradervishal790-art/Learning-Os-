import { Eraser, Highlighter, LassoSelect, PenLine, Pointer, Redo2, Undo2, X } from 'lucide-react';
import type { InkMode } from './inkPrefs';

// ============================================================
// QuickDock.tsx — a slim tool strip on the right edge: pen, highlighter, eraser,
// laser, select and undo / redo are always one tap away (phones, and presentation mode).
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
  labels: { pen: string; highlighter: string; eraser: string; laser: string; select: string; undo: string; redo: string; exit: string };
}) {
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
      role="toolbar"
      className="fixed right-2 top-1/2 -translate-y-1/2 z-[45] flex flex-col items-center gap-1 p-1 rounded-full border border-gray-200 dark:border-white/15 bg-white/95 dark:bg-neutral-900/95 shadow-lg"
    >
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
