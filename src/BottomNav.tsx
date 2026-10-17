import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  House,
  Route,
  MessageCircle,
  ChartNoAxesColumn,
  LayoutGrid,
  RotateCcw,
  NotebookPen,
  ClipboardCheck,
  Film,
  Search,
  BookOpen,
  Newspaper,
  Lock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Mobile-only bottom navigation, Instagram-style: icons only, no visible
 * text. Labels exist as aria-label/title for screen readers + long-press.
 * Five slots: four primary pages + a "More" slot that opens a sheet with the
 * remaining pages as an icon grid. Desktop (md+) keeps the sidebar.
 */

export interface NavEntry {
  id: string;
  label: string;
  locked: boolean;
}

const ICONS: Record<string, LucideIcon> = {
  dashboard: House,
  roadmap: Route,
  mentor: MessageCircle,
  progress: ChartNoAxesColumn,
  revision: RotateCcw,
  notes: NotebookPen,
  test: ClipboardCheck,
  videos: Film,
  research: Search,
  dictionary: BookOpen,
  'current-affairs': Newspaper,
};

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
}

export default function BottomNav({ items, activeId, onSelect }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = PRIMARY_IDS.map((id) => items.find((i) => i.id === id)).filter(
    (i): i is NavEntry => Boolean(i),
  );
  const more = items.filter((i) => !PRIMARY_IDS.includes(i.id));
  const moreActive = more.some((i) => i.id === activeId);

  const pick = (id: string) => {
    setMoreOpen(false);
    onSelect(id);
  };

  const tone = (active: boolean, locked: boolean) =>
    active
      ? 'text-black dark:text-white'
      : locked
      ? 'text-gray-300 dark:text-white/25'
      : 'text-gray-500 dark:text-white/50';

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
              className="absolute inset-x-3 rounded-3xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-3 grid grid-cols-4 gap-1"
              style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom) + 0.5rem)' }}
            >
              {more.map((item) => {
                const Icon = ICONS[item.id] ?? LayoutGrid;
                const active = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    id={`onborda-bnav-${item.id}`}
                    onClick={() => pick(item.id)}
                    aria-label={item.label}
                    title={item.label}
                    className={`relative h-16 rounded-2xl flex items-center justify-center transition-colors active:bg-gray-100 dark:active:bg-white/10 ${tone(active, item.locked)} ${
                      active ? 'bg-gray-100 dark:bg-white/10' : ''
                    }`}
                  >
                    <span className="relative">
                      <Icon className="w-[26px] h-[26px]" strokeWidth={active ? 2.4 : 1.75} />
                      {item.locked && <LockBadge />}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        aria-label="Main"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-black/95 backdrop-blur border-t border-gray-200 dark:border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="h-14 flex items-center justify-around">
          {primary.map((item) => {
            const Icon = ICONS[item.id] ?? LayoutGrid;
            const active = item.id === activeId && !moreOpen;
            return (
              <button
                key={item.id}
                id={`onborda-bnav-${item.id}`}
                onClick={() => pick(item.id)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                title={item.label}
                className={`relative w-14 h-14 flex items-center justify-center transition-colors ${tone(active, item.locked)}`}
              >
                <span className="relative">
                  <Icon
                    className="w-[26px] h-[26px]"
                    strokeWidth={active ? 2.4 : 1.75}
                    fill={active && item.id === 'dashboard' ? 'currentColor' : 'none'}
                  />
                  {item.locked && <LockBadge />}
                </span>
              </button>
            );
          })}
          <button
            id="onborda-bnav-more"
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="More"
            aria-expanded={moreOpen}
            title="More"
            className={`relative w-14 h-14 flex items-center justify-center transition-colors ${tone(moreOpen || moreActive, false)}`}
          >
            <LayoutGrid className="w-[26px] h-[26px]" strokeWidth={moreOpen || moreActive ? 2.4 : 1.75} />
          </button>
        </div>
      </nav>
    </div>
  );
}
