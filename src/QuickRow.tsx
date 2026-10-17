import { Lock } from 'lucide-react';
import { NAV_ICONS, FALLBACK_NAV_ICON } from './navIcons';

/**
 * Instagram-stories-style row of round icon buttons for Home (phones only).
 * Icon only — the label is just aria-label/title. A coloured ring means
 * "something is waiting here" (e.g. revision due); otherwise a hairline ring.
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

export default function QuickRow({ items, onSelect }: Props) {
  return (
    <div className="md:hidden -mx-4 px-4 flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.id] ?? FALLBACK_NAV_ICON;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            aria-label={item.label}
            title={item.label}
            className="relative flex-shrink-0 w-16 h-16 active:scale-95 transition-transform"
          >
            <span
              className={`block w-full h-full rounded-full p-[2.5px] ${
                item.highlight
                  ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600'
                  : 'bg-gray-200 dark:bg-white/15'
              }`}
            >
              <span
                className={`w-full h-full rounded-full border-2 border-white dark:border-black bg-white dark:bg-black flex items-center justify-center ${
                  item.locked ? 'text-gray-300 dark:text-white/25' : 'text-black dark:text-white'
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={1.75} />
              </span>
            </span>
            {item.locked && (
              <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-white dark:bg-black border border-gray-200 dark:border-white/15 flex items-center justify-center">
                <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
