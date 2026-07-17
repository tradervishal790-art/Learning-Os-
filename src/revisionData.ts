import type { RevisionItem } from './types';

// Moved out of Revision.tsx so Dashboard.tsx can also read real revision
// stats (due-today count, overdue count) instead of hardcoded numbers.
export const revisionData: RevisionItem[] = [
  // Due Today
  { id: '1', topic: 'Why React Exists', category: 'React Fundamentals', day: 3, dueDate: 'Today', status: 'due-today', difficulty: 'Easy', retention: 85 },
  { id: '2', topic: 'Virtual DOM', category: 'React Fundamentals', day: 7, dueDate: 'Today', status: 'due-today', difficulty: 'Medium', retention: 72 },
  { id: '3', topic: 'Component Composition', category: 'React Patterns', day: 1, dueDate: 'Today', status: 'due-today', difficulty: 'Medium', retention: 90 },

  // Overdue
  { id: '4', topic: 'State Management', category: 'React Core', day: 7, dueDate: '2 days ago', status: 'overdue', difficulty: 'Hard', retention: 45 },

  // Upcoming
  { id: '5', topic: 'useState Hook', category: 'React Hooks', day: 3, dueDate: 'Tomorrow', status: 'upcoming', difficulty: 'Medium', retention: 88 },
  { id: '6', topic: 'useEffect Hook', category: 'React Hooks', day: 3, dueDate: 'In 2 days', status: 'upcoming', difficulty: 'Hard', retention: 76 },
  { id: '7', topic: 'Props Drilling', category: 'React Patterns', day: 7, dueDate: 'In 3 days', status: 'upcoming', difficulty: 'Medium', retention: 80 },
  { id: '8', topic: 'Custom Hooks', category: 'React Hooks', day: 15, dueDate: 'In 5 days', status: 'upcoming', difficulty: 'Hard', retention: 68 },
  { id: '9', topic: 'Context API', category: 'React Patterns', day: 15, dueDate: 'In 7 days', status: 'upcoming', difficulty: 'Medium', retention: 82 },

  // Mastered
  { id: '10', topic: 'JSX Syntax', category: 'React Basics', day: 60, dueDate: 'Completed', status: 'mastered', difficulty: 'Easy', retention: 98 },
  { id: '11', topic: 'Component Basics', category: 'React Basics', day: 30, dueDate: 'Completed', status: 'mastered', difficulty: 'Easy', retention: 95 },
];

/** Shared stats so Dashboard cards and the Revision page never drift out of sync. */
export function getRevisionStats(data: RevisionItem[] = revisionData) {
  const dueToday = data.filter((i) => i.status === 'due-today').length;
  const overdue = data.filter((i) => i.status === 'overdue').length;
  const mastered = data.filter((i) => i.status === 'mastered').length;
  const upcoming = data.filter((i) => i.status === 'upcoming').length;
  const nonMastered = data.filter((i) => i.status !== 'mastered');
  const avgRetention = nonMastered.length
    ? Math.round(nonMastered.reduce((sum, i) => sum + i.retention, 0) / nonMastered.length)
    : 0;
  return { dueToday, overdue, mastered, upcoming, avgRetention, total: data.length };
}