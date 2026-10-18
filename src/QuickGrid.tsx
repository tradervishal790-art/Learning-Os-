import { Lock } from 'lucide-react';
import { NAV_ICONS, FALLBACK_NAV_ICON, NAV_TONES } from './navIcons';

/**
 * "Quick Access" grid for Home on phones (Learning OS look): rounded tiles,
 * each page with its own soft colour, name underneath. A red dot marks a page
 * with something waiting (e.g. revision due); a lock marks a page that is
 * not open yet.
 */
export interface QuickItem {
  id: string;
  label: string;
  locked: boolean;
  highlight: boolean;
}

interface Props {
  items: QuickItem[];
  onSelect: (id: string) => void;
}

export default function QuickGrid({ items, onSelect }: Props) {
  return (
    <div className="md:hidden card rounded-2xl p-3 grid grid-cols-4 gap-x-1 gap-y-3">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.id] ?? FALLBACK_NAV_ICON;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex flex-col items-center gap-1.5 active:scale-95 transition-transform ${item.locked ? 'opacity-50' : ''}`}
          >
            <span className={`relative w-12 h-12 rounded-2xl flex items-center justify-center ${NAV_TONES[item.id] ?? NAV_TONES.revision}`}>
              <Icon className="w-6 h-6" strokeWidth={1.75} />
              {item.highlight && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-black" />}
              {item.locked && (
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-neutral-900 shadow flex items-center justify-center text-gray-600 dark:text-white/70">
                  <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
                </span>
              )}
            </span>
            <span className="text-[11px] leading-tight text-center text-gray-600 dark:text-white/60 line-clamp-2 w-full">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
