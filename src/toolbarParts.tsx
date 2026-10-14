import { useState, type ReactNode } from 'react';

// Small building blocks shared by the typing toolbar and the pen toolbar.

export function Sep() {
  return <span className="w-px h-5 mx-1 bg-gray-200 dark:bg-white/15 shrink-0" />;
}
export const selectCls =
  'h-9 px-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-xs text-gray-700 dark:text-white/80';

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
      className={`h-9 min-w-9 px-2 rounded-lg flex items-center justify-center shrink-0 transition-colors disabled:opacity-30 ${
        active
          ? 'bg-black text-white dark:bg-white dark:text-black'
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
          className="w-7 h-7 rounded-full border border-black/10 dark:border-white/20"
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

