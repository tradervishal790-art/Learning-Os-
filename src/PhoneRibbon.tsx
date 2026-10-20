import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Home, PenLine, Plus, Sparkles } from 'lucide-react';
import { NOTE_TABS, type NoteTabId } from './noteTabs';

// Phone notebook ribbon: tool row on top, tab names at the bottom (thumb reach).
// Tap a tab to open it; tap the open tab again to fold the tool row away for more writing room.

const ICONS: Record<NoteTabId, ReactNode> = {
  home: <Home size={18} />,
  insert: <Plus size={18} />,
  draw: <PenLine size={18} />,
  view: <Eye size={18} />,
  ai: <Sparkles size={18} />,
};

/** Pixels the on-screen keyboard covers, so the ribbon can sit just above it. */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

export default function PhoneRibbon({
  tab, open, aiOpen, onTab, onHeight, children,
}: {
  tab: NoteTabId;
  open: boolean;
  aiOpen: boolean;
  onTab: (id: NoteTabId) => void;
  /** Reports the ribbon's height so the page above can fill exactly the space that is left. */
  onHeight: (px: number) => void;
  children: ReactNode;
}) {
  const inset = useKeyboardInset();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onHeight(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => {
      ro.disconnect();
      onHeight(0);
    };
  }, [onHeight]);

  return createPortal(
    <div
      ref={ref}
      className="fixed left-0 right-0 z-30 bg-white dark:bg-neutral-950 border-t border-gray-200 dark:border-white/10"
      style={{ bottom: inset, paddingBottom: inset ? 0 : 'env(safe-area-inset-bottom)' }}
    >
      {open && <div className="px-2 pt-1.5 max-h-[45vh] overflow-y-auto">{children}</div>}
      <div role="tablist" className="flex">
        {NOTE_TABS.map((t) => {
          const on = t.id === 'ai' ? aiOpen : t.id === tab && open;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onTab(t.id)}
              className={`flex-1 h-12 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                on ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-white/60'
              }`}
            >
              {ICONS[t.id]}
              {t.label}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
