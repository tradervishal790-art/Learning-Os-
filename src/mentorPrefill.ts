// One-time navigation hand-off from learning screens into Mentor.
// This is transient session state, not a learner database or chat history.
export const MENTOR_PREFILL_KEY = 'learning_os_mentor_prefill';
export const MENTOR_LEARNING_CONTEXT_KEY = 'learning_os_mentor_learning_context';

export interface MentorLearningContext {
  topicTitle: string;
  goalTitle?: string;
  difficulty?: string;
  source?: 'videos' | 'roadmap' | 'revision' | 'test' | 'notes';
}

export function saveMentorLearningContext(context: MentorLearningContext): void {
  try {
    const topicTitle = context.topicTitle.trim().slice(0, 160);
    if (!topicTitle) return;
    sessionStorage.setItem(MENTOR_LEARNING_CONTEXT_KEY, JSON.stringify({
      topicTitle,
      ...(context.goalTitle?.trim() ? { goalTitle: context.goalTitle.trim().slice(0, 120) } : {}),
      ...(context.difficulty?.trim() ? { difficulty: context.difficulty.trim().slice(0, 40) } : {}),
      ...(context.source ? { source: context.source } : {}),
    } satisfies MentorLearningContext));
  } catch {
    // Mentor remains usable when session storage is unavailable.
  }
}

export function consumeMentorLearningContext(): MentorLearningContext | null {
  try {
    const raw = sessionStorage.getItem(MENTOR_LEARNING_CONTEXT_KEY);
    sessionStorage.removeItem(MENTOR_LEARNING_CONTEXT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const context = value as Partial<MentorLearningContext>;
    if (typeof context.topicTitle !== 'string' || !context.topicTitle.trim()) return null;
    return {
      topicTitle: context.topicTitle.slice(0, 160),
      ...(typeof context.goalTitle === 'string' ? { goalTitle: context.goalTitle.slice(0, 120) } : {}),
      ...(typeof context.difficulty === 'string' ? { difficulty: context.difficulty.slice(0, 40) } : {}),
      ...(context.source === 'videos' || context.source === 'roadmap' || context.source === 'revision' || context.source === 'test' || context.source === 'notes'
        ? { source: context.source }
        : {}),
    };
  } catch {
    return null;
  }
}
