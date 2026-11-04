export type NextBestStepAction = 'profile' | 'goal' | 'revision' | 'mentor' | 'test' | 'videos' | 'roadmap';

export type MissionStageId = 'know' | 'plan' | 'learn' | 'retain' | 'prove';

export interface NextBestStepInput {
  hasLearningProfile: boolean;
  activeGoals: number;
  revisionDue: number;
  revisionOverdue: number;
  currentTopic: string | null;
  currentTopicMastery?: number | null;
  currentTopicHasMeasuredWeakness?: boolean;
  currentTopicSessions?: number;
  weakTopic?: string | null;
  weakTopicMastery?: number | null;
  testAttempts?: number;
  roadmapTopicCount?: number;
  completedTopicCount?: number;
}

export interface NextBestStepRecommendation {
  action: NextBestStepAction;
  stageId: MissionStageId;
  title: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Selects one useful next action from existing learner signals.
 *
 * Priority is intentionally conservative:
 * 1. Complete essential setup before suggesting downstream work.
 * 2. Clear overdue/due retention work before starting more content.
 * 3. Address measured weak understanding with Mentor support.
 * 4. Continue the active topic, or prove mastery after the roadmap is done.
 *
 * Missing evidence is never treated as a poor score. This function is pure,
 * deterministic, and does not write to or create another learner-data store.
 */
export function getNextBestStepRecommendation(input: NextBestStepInput): NextBestStepRecommendation {
  const due = Math.max(0, Number.isFinite(input.revisionDue) ? input.revisionDue : 0);
  const overdue = Math.max(0, Number.isFinite(input.revisionOverdue) ? input.revisionOverdue : 0);
  const activeGoals = Math.max(0, Number.isFinite(input.activeGoals) ? input.activeGoals : 0);
  const topicCount = Math.max(0, typeof input.roadmapTopicCount === 'number' && Number.isFinite(input.roadmapTopicCount) ? input.roadmapTopicCount : 0);
  const completedCount = Math.max(0, typeof input.completedTopicCount === 'number' && Number.isFinite(input.completedTopicCount) ? input.completedTopicCount : 0);
  const currentMastery = typeof input.currentTopicMastery === 'number' && Number.isFinite(input.currentTopicMastery)
    ? Math.max(0, Math.min(100, input.currentTopicMastery))
    : null;
  const weakMastery = typeof input.weakTopicMastery === 'number' && Number.isFinite(input.weakTopicMastery)
    ? Math.max(0, Math.min(100, input.weakTopicMastery))
    : null;

  if (!input.hasLearningProfile) {
    return { action: 'profile', stageId: 'know', title: 'Understand how you learn', reason: 'A short learning profile helps tailor your learning path.', confidence: 'high' };
  }
  if (activeGoals === 0) {
    return { action: 'goal', stageId: 'plan', title: 'Choose a learning goal', reason: 'Add a goal to create a clear, manageable learning path.', confidence: 'high' };
  }
  if (overdue > 0) {
    return {
      action: 'revision',
      stageId: 'retain',
      title: `Review ${overdue} overdue topic${overdue === 1 ? '' : 's'}`,
      reason: 'Overdue recall is the most time-sensitive learning task.',
      confidence: 'high',
    };
  }
  if (due > 0) {
    return {
      action: 'revision',
      stageId: 'retain',
      title: `Review ${due} topic${due === 1 ? '' : 's'} today`,
      reason: 'A scheduled recall check helps keep recently learned ideas accessible.',
      confidence: 'high',
    };
  }

  const hasMeasuredWeakness = Boolean(input.weakTopic) && weakMastery !== null && weakMastery < 60;
  // The roadmap's default 'learning' baseline is 40, not measured weakness.
  // Only explicit recall/test evidence or negative learner feedback may trigger help.
  const currentTopicNeedsHelp = Boolean(input.currentTopic)
    && input.currentTopicHasMeasuredWeakness === true
    && currentMastery !== null
    && currentMastery < 60;
  if (hasMeasuredWeakness || currentTopicNeedsHelp) {
    const topic = hasMeasuredWeakness ? input.weakTopic : input.currentTopic;
    return {
      action: 'mentor',
      stageId: 'learn',
      title: `Strengthen ${topic}`,
      reason: 'Your existing recall, test, or learning signals suggest this topic could use another explanation.',
      confidence: hasMeasuredWeakness && (input.testAttempts ?? 0) > 0 ? 'medium' : 'low',
    };
  }

  if (topicCount > 0 && completedCount >= topicCount && !input.currentTopic) {
    return {
      action: 'test',
      stageId: 'prove',
      title: 'Check what you can do',
      reason: 'Your active roadmap topics are complete. A short test can check what has stuck.',
      confidence: 'medium',
    };
  }
  if (input.currentTopic) {
    return {
      action: 'videos',
      stageId: 'learn',
      title: `Continue ${input.currentTopic}`,
      reason: (input.currentTopicSessions ?? 0) > 0
        ? 'Pick up your active topic and build on the work already started.'
        : 'Start the next topic in your learning path.',
      confidence: 'medium',
    };
  }
  if (topicCount === 0) {
    return { action: 'roadmap', stageId: 'plan', title: 'Build your learning roadmap', reason: 'Turn your goal into a sequence of small, focused topics.', confidence: 'high' };
  }
  return {
    action: 'roadmap',
    stageId: 'plan',
    title: 'Choose your next roadmap topic',
    reason: 'Your learning path is ready when you are.',
    confidence: 'low',
  };
}

export type ContinueLearningTarget = 'videos' | 'roadmap';

export function getContinueLearningTarget(hasCurrentTopic: boolean): ContinueLearningTarget {
  return hasCurrentTopic ? 'videos' : 'roadmap';
}
