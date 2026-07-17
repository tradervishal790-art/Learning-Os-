import type { Topic } from './types';

// Re-export Topic so existing `import { roadmapData, type Topic } from './roadmapData'`
// statements elsewhere in the app keep working without changes.
export type { Topic };

export const roadmapData: Topic = {
  id: 'react-mastery',
  title: 'React Mastery Path',
  description: 'From zero to building production-grade React applications',
  status: 'learning',
  estimatedTime: '8-12 weeks',
  difficulty: 'Beginner',
  why: {
    learn:
      "React powers 40%+ of modern web apps. Learning it opens doors to high-paying frontend roles and gives you a mental model for component-based thinking.",
    connect:
      'Every concept here connects to the next: Components use Props, Props enable State, State triggers Re-renders, and Re-renders power the entire UI.',
    system:
      'This belongs to the larger Frontend Engineering system, which sits inside Web Development, inside Software Engineering.',
    risk:
      'Without React, you can only build static sites. You will miss out on the dominant frontend framework and the high-paying React developer market.',
  },
  children: [
    {
      id: 'why-react',
      title: 'Why React Exists',
      description: 'The problem React solves and the paradigm shift it introduced',
      status: 'completed',
      estimatedTime: '2 hours',
      difficulty: 'Beginner',
      why: {
        learn:
          "Understanding WHY React exists helps you understand modern frontend development itself. Every framework since has borrowed from React's ideas.",
        connect: 'This is the foundation. Everything else exists because of the problem React solves.',
        system: 'Part of Frontend Paradigms — a sub-system of web development history.',
        risk: 'Without this foundation, you will use React as a library but never understand it as a paradigm.',
      },
    },
    {
      id: 'virtual-dom',
      title: 'Virtual DOM and Reconciliation',
      description: 'How React updates the UI efficiently',
      status: 'completed',
      estimatedTime: '3 hours',
      difficulty: 'Intermediate',
      why: {
        learn: "The Virtual DOM is React's core innovation. Understanding it explains why React feels magical.",
        connect: 'Connects to Components, State, and Performance optimization.',
        system: "Part of React's internal architecture.",
        risk: 'Without this, you will write code with performance issues without knowing why.',
      },
    },
    {
      id: 'component-thinking',
      title: 'Component Thinking',
      description: 'Breaking UIs into reusable, composable pieces',
      status: 'learning',
      estimatedTime: '4 hours',
      difficulty: 'Beginner',
      why: {
        learn: 'Component thinking is the number one skill that separates senior developers from juniors.',
        connect: 'Components use Props, hold State, render JSX. Every pattern builds on this.',
        system: 'Part of Software Design Patterns — applies to Vue, Svelte, and backend systems.',
        risk: 'Without component thinking, you will build monolithic UIs that are impossible to maintain.',
      },
    },
    {
      id: 'state',
      title: 'State Management',
      description: 'The source of truth for dynamic UIs',
      status: 'learning',
      estimatedTime: '5 hours',
      difficulty: 'Intermediate',
      why: {
        learn:
          'State is what makes apps interactive. Mastering state management is the difference between toy apps and production apps.',
        connect: 'State flows down through Props, triggers Re-renders, and is updated by Event Handlers.',
        system: 'Part of Reactive Programming — the same paradigm used in Vue, Svelte, and MobX.',
        risk: 'Poor state management leads to bugs, inconsistent UI, and code that is impossible to debug.',
      },
    },
    {
      id: 'hooks',
      title: 'Hooks Deep Dive',
      description: 'useState, useEffect, useMemo, useCallback, custom hooks',
      status: 'locked',
      estimatedTime: '6 hours',
      difficulty: 'Intermediate',
      why: {
        learn: 'Hooks are how modern React works. They let you reuse stateful logic between components.',
        connect: "Hooks ARE React's state and lifecycle system. useState gives you state, useEffect gives you lifecycle.",
        system: 'Part of Functional Programming patterns in UI.',
        risk: 'Without hooks, you are stuck with outdated class component patterns.',
      },
    },
    {
      id: 'performance',
      title: 'Performance Optimization',
      description: 'memo, useMemo, useCallback, lazy loading, code splitting',
      status: 'locked',
      estimatedTime: '4 hours',
      difficulty: 'Advanced',
      why: {
        learn: 'Performance is what makes the difference between an app that feels premium and one that feels janky.',
        connect: 'Performance builds on State, Props, and Re-renders.',
        system: 'Part of Web Performance — applies to all web frameworks.',
        risk: 'Without performance knowledge, your apps will work but feel slow. Users leave slow apps in 3 seconds.',
      },
    },
    {
      id: 'architecture',
      title: 'App Architecture',
      description: 'Folder structure, state management libraries, patterns',
      status: 'locked',
      estimatedTime: '8 hours',
      difficulty: 'Advanced',
      why: {
        learn: 'Architecture is what makes teams move fast.',
        connect: 'Architecture combines everything — Components, State, Hooks, Performance.',
        system: 'Part of Software Architecture — same principles used in backend and mobile.',
        risk: 'Without architecture skills, you will build apps that work at 100 lines but collapse at 10,000.',
      },
    },
    {
      id: 'real-projects',
      title: 'Real Projects',
      description: 'Build production-grade apps: SaaS, dashboards, e-commerce',
      status: 'locked',
      estimatedTime: '40+ hours',
      difficulty: 'Advanced',
      why: {
        learn: 'Projects are where theory becomes skill. You do not truly know React until you have shipped a real app.',
        connect: 'Projects integrate everything — Components, State, Hooks, Performance, Architecture.',
        system: 'Part of Portfolio Development — your ticket to senior roles.',
        risk: 'Without shipped projects, your React knowledge is theoretical. Employers want builders.',
      },
    },
  ],
};

/**
 * Recursively find a topic by id anywhere in the roadmap tree.
 * Lets other components (e.g. Revision, VideoIntel) look up a
 * topic's metadata without duplicating traversal logic.
 */
export function findTopicById(id: string, node: Topic = roadmapData): Topic | undefined {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findTopicById(id, child);
    if (found) return found;
  }
  return undefined;
}

/** The topic the user is currently working through — powers Dashboard's "Today's Goal" card. */
export function getCurrentTopic(roadmap: Topic = roadmapData): Topic | undefined {
  return roadmap.children?.find((t) => t.status === 'learning');
}

/** Aggregate progress stats for the top-level roadmap topics. */
export function getRoadmapProgress(roadmap: Topic = roadmapData) {
  const topics = roadmap.children ?? [];
  const total = topics.length;
  const completed = topics.filter((t) => t.status === 'completed' || t.status === 'mastered').length;
  const learning = topics.filter((t) => t.status === 'learning').length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, learning, percent };
}