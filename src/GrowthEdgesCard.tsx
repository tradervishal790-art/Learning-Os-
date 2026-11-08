import type { GrowthEdge } from './growthEdges';
import { TRAIT_LABELS } from './PersonalityResult';
import { useTranslation } from './i18n/LanguageContext';

// Shared card: "Your growth edges" — used under Test results and in Settings.
export default function GrowthEdgesCard({ edges, hasPersonality, className = '' }: { edges: GrowthEdge[]; hasPersonality: boolean; className?: string }) {
  const t = useTranslation().growthEdgesCard;
  return (
    <div className={className}>
      <h3 className="font-semibold mb-1">{t.title}</h3>
      {!hasPersonality ? (
        <p className="text-sm text-gray-500 dark:text-white/50">
          {t.needPersonality}
        </p>
      ) : edges.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-white/50">
          {t.none}
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-400 dark:text-white/40 mb-3">{t.intro}</p>
          <div className="space-y-3">
            {edges.map((e) => (
              <div key={e.trait + e.title} className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-purple-500 mb-0.5">{TRAIT_LABELS[e.trait]}</p>
                <p className="text-sm font-semibold">{e.title}</p>
                <p className="text-xs text-gray-500 dark:text-white/50 mt-1">{e.cause}</p>
                <p className="text-xs text-gray-400 dark:text-white/40 mt-1">{e.source === 'activity' ? t.evidenceActivity : t.evidenceTests}: {e.evidence}</p>
                <p className="text-sm text-gray-700 dark:text-white/80 mt-2">
                  <span className="font-medium">{t.tryLabel}</span> {e.action}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
