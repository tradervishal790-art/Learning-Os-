import { Lock } from 'lucide-react';
import { NAV_ICONS, FALLBACK_NAV_ICON, NAV_TONES } from './navIcons';

/** Compact, thumb-friendly shortcuts for the mobile dashboard. */
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
    <nav
      aria-label="Quick access"
      className="md:hidden grid grid-cols-4 gap-2 rounded-3xl border border-gray-200/80 bg-white/80 p-3 shadow-[0_8px_30px_rgba(32,48,90,0.06)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#101014]/90 dark:shadow-none"
    >
      {items.map((item) => {
        const Icon = NAV_ICONS[item.id] ?? FALLBACK_NAV_ICON;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-label={item.locked ? `${item.label}, sign-in or setup required` : item.label}
            aria-disabled={item.locked}
            className={`group flex min-w-0 flex-col items-center justify-start gap-2 rounded-2xl px-1 py-2.5 text-center transition duration-200 hover:bg-gray-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.97] dark:hover:bg-white/[0.06] ${item.locked ? 'opacity-55' : ''}`}
          >
            <span className={`relative flex h-11 w-11 items-center justify-center rounded-[15px] shadow-sm ring-1 ring-black/[0.03] transition-transform duration-200 group-hover:-translate-y-0.5 dark:ring-white/[0.06] ${NAV_TONES[item.id] ?? NAV_TONES.revision}`}>
              <Icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
              {item.highlight && (
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-rose-500 ring-[3px] ring-white dark:ring-[#101014]" />
              )}
              {item.locked && (
                <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white text-gray-600 shadow-sm ring-1 ring-black/5 dark:bg-neutral-800 dark:text-white/70 dark:ring-white/10">
                  <Lock className="h-2.5 w-2.5" strokeWidth={2.4} />
                </span>
              )}
            </span>
            <span className="w-full break-words text-[11px] font-medium leading-[1.25] text-gray-600 dark:text-white/65">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
