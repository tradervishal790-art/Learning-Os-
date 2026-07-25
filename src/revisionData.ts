import type { RevisionItem } from './types';

// NOTE: This file was reconstructed after its original content was
// accidentally overwritten. The shape/types match what Revision.tsx and
// Dashboard.tsx expect, but the specific items/dates below are placeholders —
// replace with your real spaced-repetition data if you have a backup.

export const revisionData: RevisionItem[] = [
  {
    id: 'rev-why-react',
    topic: 'Why React Exists',
    category: 'Foundations',
    day: 1,
    dueDate: 'Today',
    status: 'due-today',
    difficulty: 'Easy',
    retention: 85,
  },
  {
    id: 'rev-virtual-dom',
    topic: 'Virtual DOM and Reconciliation',
    category: 'Foundations',
    day: 3,
    dueDate: 'Today',
    status: 'due-today',
    difficulty: 'Medium',
    retention: 72,
  },
  {
    id: 'rev-component-thinking',
    topic: 'Component Thinking',
    category: 'Core Concepts',
    day: 7,
    dueDate: 'Yesterday',
    status: 'overdue',
    difficulty: 'Easy',
    retention: 60,
  },
  {
    id: 'rev-state',
    topic: 'State Management',
    category: 'Core Concepts',
    day: 7,
    dueDate: '2 days ago',
    status: 'overdue',
    difficulty: 'Medium',
    retention: 55,
  },
  {
    id: 'rev-hooks',
    topic: 'Hooks Deep Dive',
    category: 'Core Concepts',
    day: 15,
    dueDate: 'In 3 days',
    status: 'upcoming',
    difficulty: 'Medium',
    retention: 90,
  },
  {
    id: 'rev-performance',
    topic: 'Performance Optimization',
    category: 'Advanced',
    day: 30,
    dueDate: 'In 10 days',
    status: 'upcoming',
    difficulty: 'Hard',
    retention: 95,
  },
  {
    id: 'rev-architecture',
    topic: 'App Architecture',
    category: 'Advanced',
    day: 60,
    dueDate: 'In 25 days',
    status: 'upcoming',
    difficulty: 'Hard',
    retention: 98,
  },
  {
    id: 'rev-real-projects',
    topic: 'Real Projects',
    category: 'Advanced',
    day: 60,
    dueDate: 'Completed',
    status: 'mastered',
    difficulty: 'Hard',
    retention: 100,
  },
];

/** Aggregate stats for the Revision dashboard — counts + average retention. */
export function getRevisionStats(items: RevisionItem[] = revisionData) {
  const total = items.length;
  const dueToday = items.filter((i) => i.status === 'due-today').length;
  const overdue = items.filter((i) => i.status === 'overdue').length;
  const upcoming = items.filter((i) => i.status === 'upcoming').length;
  const mastered = items.filter((i) => i.status === 'mastered').length;
  const avgRetention =
    total === 0 ? 0 : Math.round(items.reduce((sum, i) => sum + i.retention, 0) / total);

  return { total, dueToday, overdue, upcoming, mastered, avgRetention };
}