import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Lock } from 'lucide-react';
import { NAV_ICONS, NAV_TONES } from './navIcons';
import { useImmersive } from './immersive';

/**
 * Mobile bottom navigation: four primary destinations plus a labelled More
 * destination. Visible labels make the app discoverable without relying on
 * icon recognition; the desktop sidebar remains unchanged.
 */

export interface NavEntry {
  id: string;
  label: string;
  locked: boolean;
}

const PRIMARY_IDS = ['dashboard', 'roadmap', 'mentor', 'progress'];

function LockBadge() {
  return (
    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-white dark:bg-black flex items-center justify-center">
      <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
    </span>
  );
}

interface Props {
  items: NavEntry[];
  activeId: string;
  onSelect: (id: string) => void;
  darkMode?: boolean;
}

export default function BottomNav({ items, activeId, onSelect, darkMode = false }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const immersive = useImmersive();

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [moreOpen]);

  useEffect(() => {
    setMoreOpen(false);
  }, [activeId]);

  const primary = PRIMARY_IDS.map((id) => items.find((i) => i.id === id)).filter(
    (i): i is NavEntry => Boolean(i),
  );
  const more = items.filter((i) => !PRIMARY_IDS.includes(i.id));
  const moreActive = more.some((i) => i.id === activeId);

  const pick = (id: string) => {
    setMoreOpen(false);
    onSelect(id);
  };

  if (immersive) return null;

  const tone = (active: boolean, locked: boolean) => darkMode
    ? active ? 'text-cyan-300' : locked ? 'text-white/20' : 'text-white/55'
    : active ? 'text-indigo-600 dark:text-indigo-400' : locked ? 'text-gray-300 dark:text-white/25' : 'text-gray-500 dark:text-white/50';

  return (
    <div className="md:hidden">
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            key="more-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              id="mobile-more-menu"
              role="group"
              aria-label="More navigation"
              className={`mobile-more-menu absolute inset-x-3 rounded-3xl border p-3 grid grid-cols-4 gap-1 ${darkMode ? "bg-[#101a2b] border-white/10" : "bg-white dark:bg-neutral-900 border-gray-200 dark:border-white/10"}`}
              style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 0.5rem)' }}
            >
              {more.map((item) => {
                const Icon = NAV_ICONS[item.id] ?? LayoutGrid;
                const active = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    id={`onborda-bnav-${item.id}`}
                    onClick={() => pick(item.id)}
                    aria-label={item.label}
                    title={item.label}
                    className={`relative min-h-16 rounded-2xl flex flex-col items-center justify-center gap-1 py-2 transition active:scale-95 ${item.locked ? 'opacity-50' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className={`relative w-10 h-10 rounded-xl flex items-center justify-center ${NAV_TONES[item.id] ?? NAV_TONES.revision} ${active ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''}`}>
                      <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.75} />
                      {item.locked && <LockBadge />}
                    </span>
                    <span className="max-w-full px-1 text-center text-[11px] font-medium leading-tight text-gray-600 dark:text-white/65 break-words">{item.label}</span>
                  </button>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        aria-label="Main"
        className={`fixed bottom-0 inset-x-0 z-40 backdrop-blur border-t ${darkMode ? "bg-[#080d19]/95 border-white/10" : "bg-white/95 dark:bg-black/95 border-gray-200 dark:border-white/10"}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid min-h-16 grid-cols-5 items-stretch">
          {primary.map((item) => {
            const Icon = NAV_ICONS[item.id] ?? LayoutGrid;
            const active = item.id === activeId && !moreOpen;
            return (
              <button
                key={item.id}
                id={`onborda-bnav-${item.id}`}
                onClick={() => pick(item.id)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                title={item.label}
                className={`relative flex min-w-0 min-h-16 flex-col items-center justify-center gap-1 px-0.5 transition-colors ${tone(active, item.locked)} ${item.locked ? 'opacity-60' : ''}`}
              >
                <span className="relative">
                  <Icon
                    className="h-[21px] w-[21px] shrink-0"
                    strokeWidth={active ? 2.4 : 1.75}
                    fill={active && item.id === 'dashboard' ? 'currentColor' : 'none'}
                  />
                  {item.locked && <LockBadge />}
                </span>
                <span className="max-w-full truncate text-[9px] font-medium leading-none">{({ dashboard: 'Home', roadmap: 'Roadmap', mentor: 'Mentor', progress: 'Progress' } as Record<string, string>)[item.id] ?? item.label}</span>
              </button>
            );
          })}
          <button
            id="onborda-bnav-more"
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="More"
            aria-expanded={moreOpen}
            aria-controls="mobile-more-menu"
            title="More"
            className={`relative flex min-w-0 min-h-16 flex-col items-center justify-center gap-1 px-0.5 transition-colors ${tone(moreOpen || moreActive, false)}`}
          >
            <LayoutGrid className="h-[21px] w-[21px] shrink-0" strokeWidth={moreOpen || moreActive ? 2.4 : 1.75} />
            <span className="text-[9px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
