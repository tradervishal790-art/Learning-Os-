import type { GrowthEdge } from './growthEdges';
import { TRAIT_LABELS } from './PersonalityResult';

// Shared card: "Your growth edges" — used under Test results and in Settings.
export default function GrowthEdgesCard({ edges, hasPersonality, className = '' }: { edges: GrowthEdge[]; hasPersonality: boolean; className?: string }) {
  return (
    <div className={className}>
      <h3 className="font-semibold mb-1">Your growth edges</h3>
      {!hasPersonality ? (
        <p className="text-sm text-gray-500 dark:text-white/50">
          Take the Personality Check in Settings to see which of your habits show up in your tests.
        </p>
      ) : edges.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-white/50">
          Nothing in your tests points to a growth edge yet. This updates as you take more tests.
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-400 dark:text-white/40 mb-3">Habits from your personality that your tests also show. Small things to try next.</p>
          <div className="space-y-3">
            {edges.map((e) => (
              <div key={e.trait + e.title} className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-purple-500 mb-0.5">{TRAIT_LABELS[e.trait]}</p>
                <p className="text-sm font-semibold">{e.title}</p>
                <p className="text-xs text-gray-500 dark:text-white/50 mt-1">{e.cause}</p>
                <p className="text-xs text-gray-400 dark:text-white/40 mt-1">In your tests: {e.evidence}</p>
                <p className="text-sm text-gray-700 dark:text-white/80 mt-2">
                  <span className="font-medium">Try:</span> {e.action}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
