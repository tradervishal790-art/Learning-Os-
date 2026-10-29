// Renders nothing. While the learner is on Home it warms the NEXT lecture in the
// background (see lectureBuilder.ts for the cost guards), so Start opens instantly.
// Lives in its own component so it only mounts on the home page — no hook-order issues
// with the dashboard's early-return quiz screens.
import { useEffect } from 'react';
import type { Topic, UserOnboardingData } from './types';

interface Props {
  topic: Topic;
  userData: UserOnboardingData | null;
  goalTitle?: string;
  goalId: string | null;
}

export default function LecturePrefetch({ topic, userData, goalTitle, goalId }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import('./lectureBuilder')
        .then((m) => m.prefetchNextLecture({ topic, userData, goalTitle, goalId }))
        .catch(() => {});
    }, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic.id, goalId]);
  return null;
}
