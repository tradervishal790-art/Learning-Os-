import { useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';

// Small building blocks shared by the typing toolbar and the pen toolbar.

export function Sep() {
  return <span className="w-px h-5 mx-1 bg-gray-200 dark:bg-white/15 shrink-0" />;
}
export const selectCls =
  'h-10 sm:h-9 px-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-xs text-gray-700 dark:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500';

export function Btn({
  label, onClick, active, disabled, children,
}: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // keep the text selection inside the editor while a toolbar button is pressed
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-10 min-w-10 sm:h-9 sm:min-w-9 px-2 rounded-lg flex items-center justify-center shrink-0 transition-colors disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${
        active
          ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white'
          : 'text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

export function Pop({ trigger, children }: { trigger: (toggle: () => void, open: boolean) => ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      {trigger(() => setOpen((o) => !o), open)}
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1 z-30 p-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-lg min-w-max"
            onClick={() => setOpen(false)}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

export function Swatches({ colors, onPick }: { colors: string[]; onPick: (c: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap max-w-[200px]">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(c)}
          aria-label={c}
          className="w-8 h-8 sm:w-7 sm:h-7 rounded-full border border-black/10 dark:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          style={{ background: c }}
        />
      ))}
    </div>
  );
}


// hair-thin on the left, thick on the right
const WEDGE = 'polygon(0 42%, 100% 0, 100% 100%, 0 58%)';

/**
 * Value strip for pen size, eraser size, fade time and the like: a wedge that is thin at one end and
 * slowly gets thicker toward the other. Drag anywhere on it. No numbers on screen (the value is in the tooltip).
 * `onCommit` fires once when the finger / key is released (for actions that should not run on every step).
 */
export function TaperStrip({
  value, min, max, step = 1, onChange, onCommit, label, className = 'w-24',
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  label: string;
  className?: string;
}) {
  // onCommit only after the value really moved (a plain tap or a Tab key-up must not fire it)
  const dirty = useRef(false);
  const commit = (v: number) => {
    if (!dirty.current) return;
    dirty.current = false;
    onCommit?.(v);
  };
  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  return (
    <div
      className={`relative h-10 sm:h-8 shrink-0 rounded-lg has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo-500 ${className}`}
      title={`${label} ${value}`}
      // inside a popup: dragging must not count as "click outside"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-x-[7px] top-1/2 h-4 -translate-y-1/2 pointer-events-none" style={{ clipPath: WEDGE }}>
        <div className="absolute inset-0 bg-gray-200 dark:bg-white/15" />
        <div className="absolute inset-y-0 left-0 bg-indigo-600 dark:bg-indigo-500" style={{ width: `${pct}%` }} />
      </div>
      <span
        aria-hidden
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-indigo-600 bg-white shadow pointer-events-none dark:border-indigo-400"
        style={{ left: `calc(7px + (100% - 14px) * ${pct / 100})` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => {
          dirty.current = true;
          onChange(Number(e.target.value));
        }}
        onPointerUp={(e) => commit(Number(e.currentTarget.value))}
        onKeyUp={(e) => commit(Number(e.currentTarget.value))}
        className="absolute inset-0 h-full w-full cursor-pointer touch-none appearance-none bg-transparent opacity-0 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:border-0"
      />
    </div>
  );
}

/** Round colour choice: coloured ring, soft tint inside, a check mark + halo when picked. */
export function RingSwatch({ color, selected, onClick, label }: { color: string; selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="h-8 w-8 sm:h-7 sm:w-7 shrink-0 rounded-full flex items-center justify-center transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
      style={{
        border: `2px solid ${color}`,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        boxShadow: selected ? `0 0 0 3px color-mix(in srgb, ${color} 28%, transparent)` : 'none',
        color,
      }}
    >
      {selected && <Check size={14} strokeWidth={3.5} aria-hidden />}
    </button>
  );
}
