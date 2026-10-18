import {
  House, Route, MessageCircle, ChartNoAxesColumn, LayoutGrid, RotateCcw,
  NotebookPen, ClipboardCheck, Film, Search, BookOpen, Newspaper,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** One icon per page id — shared by the bottom bar and the Home quick row. */
export const NAV_ICONS: Record<string, LucideIcon> = {
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

export const FALLBACK_NAV_ICON: LucideIcon = LayoutGrid;

/** Soft tile colour per page (icon tile backgrounds on Home and in the More sheet). */
export const NAV_TONES: Record<string, string> = {
  revision: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  notes: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  test: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  videos: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  research: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300',
  dictionary: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  'current-affairs': 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300',
};
