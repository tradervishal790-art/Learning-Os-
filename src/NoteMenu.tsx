import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

// The "More" menu of the note screen: rare actions live here so the writing area keeps the space.

export interface MenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  /** Draw a thin line above this item. */
  divider?: boolean;
}

export default function NoteMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full mt-1 z-40 w-64 max-h-[70dvh] overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-lg py-1"
        >
          {items.map((it) => (
            <div key={it.key}>
              {it.divider && <div className="my-1 h-px bg-gray-100 dark:bg-white/10" />}
              <button
                type="button"
                role="menuitem"
                disabled={it.disabled}
                aria-pressed={it.active}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={`w-full h-11 px-3 flex items-center gap-3 text-sm text-left disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 ${
                  it.active ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-800 dark:text-white/90'
                }`}
              >
                <span className="shrink-0">{it.icon}</span>
                <span className="truncate">{it.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
