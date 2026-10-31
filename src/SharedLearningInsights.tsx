import { useEffect, useState } from 'react';
import { getSharedPatternSummary, type SharedPatternSummary } from './sharedLearningPatterns';

type Props = { kind: 'revision' | 'questions' };

const REVISION_DAYS = [1, 3, 7, 15, 30, 60] as const;

export default function SharedLearningInsights({ kind }: Props) {
  const [summaries, setSummaries] = useState<Array<{ id: string; label: string; summary: SharedPatternSummary }>>([]);

  useEffect(() => {
    let active = true;
    const ids = kind === 'revision'
      ? REVISION_DAYS.map((day) => ({ id: `revision_day_${day}`, label: `Day ${day}` }))
      : [
          { id: 'question_mcq', label: 'Multiple-choice' },
          { id: 'question_subjective', label: 'Written answers' },
        ];
    void Promise.all(ids.map(async ({ id, label }) => ({
      id, label, summary: await getSharedPatternSummary(id),
    }))).then((results) => {
      if (active) setSummaries(results.filter((item): item is typeof item & { summary: SharedPatternSummary } => item.summary !== null));
    });
    return () => { active = false; };
  }, [kind]);

  if (summaries.length === 0) return null;

  return (
    <section className="rounded-2xl card border border-indigo-200/60 dark:border-indigo-400/20 p-4 mb-5 md:mb-6" aria-label="Community learning patterns">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-sm font-semibold">Community learning patterns</h2>
        <span className="text-[10px] text-gray-400 dark:text-white/40">10+ accounts per signal</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {summaries.map(({ id, label, summary }) => (
          <div key={id} className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
            <p className="text-xs font-medium mb-1">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{summary.highRate}%</p>
            <p className="text-[10px] text-gray-500 dark:text-white/45">
              {kind === 'revision' ? 'Strong recall' : 'High accuracy'} · {summary.sampleCount} accounts
            </p>
            <p className="text-[10px] text-gray-400 dark:text-white/35 mt-1">
              {summary.lowRate}% low · {summary.mediumRate}% medium
            </p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 dark:text-white/35 mt-2">
        Group-level trends only. They are guidance, not a judgement of any individual learner.
      </p>
    </section>
  );
}
