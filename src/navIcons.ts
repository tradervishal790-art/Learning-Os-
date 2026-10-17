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
