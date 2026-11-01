export type NextBestStepAction = 'profile' | 'revision' | 'roadmap';

export function getNextBestStepAction(input: {
  hasLearningProfile: boolean;
  revisionDue: number;
  revisionOverdue: number;
}): NextBestStepAction {
  if (!input.hasLearningProfile) return 'profile';
  if (input.revisionDue + input.revisionOverdue > 0) return 'revision';
  return 'roadmap';
}

export type ContinueLearningTarget = 'videos' | 'roadmap';

export function getContinueLearningTarget(hasCurrentTopic: boolean): ContinueLearningTarget {
  return hasCurrentTopic ? 'videos' : 'roadmap';
}
