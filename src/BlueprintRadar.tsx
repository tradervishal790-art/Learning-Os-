import type { LearningProfile } from './types';
import type { TranslationShape } from './i18n/translations';

// ============================================================
// BlueprintRadar.tsx
//
// Pure-SVG radar/spider chart for the 8 LearningProfile dimensions —
// visually inspired by LifeQuest's Mind Map radar, but themed to
// Learning-OS's actual palette (white/black base + purple-500 accent,
// full dark-mode support via Tailwind `dark:` classes) instead of
// LifeQuest's dark neon purple/blue theme. No chart.js dependency —
// built with trig + <polygon>, so it's ~100 lines and adds nothing to
// the bundle.
// ============================================================

export type DimensionOrderEntry = { key: keyof LearningProfile; label: string };

/** `key` order/identity never changes across locale, only the displayed
 *  `label` does — pulled from t.blueprintInterview.dimensionLabels.
 *  BlueprintRadar has no hook access (profile is passed as a prop, not
 *  read via context), so the caller supplies the translated labels. */
export function getDimensionOrder(labels: TranslationShape['blueprintInterview']['dimensionLabels']): DimensionOrderEntry[] {
  return [
    { key: 'pace', label: labels.pace },
    { key: 'theoryVsPractical', label: labels.practical },
    { key: 'structureNeed', label: labels.structure },
    { key: 'depth', label: labels.depth },
    { key: 'languageComplexity', label: labels.language },
    { key: 'storytelling', label: labels.storytelling },
    { key: 'repetitionNeed', label: labels.repetition },
    { key: 'priorKnowledgeComfort', label: labels.priorKnowledge },
  ];
}

function polarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(angleRad), y: cy + radius * Math.sin(angleRad) };
}

export default function BlueprintRadar({ profile, labels, size = 260 }: { profile: LearningProfile; labels: TranslationShape['blueprintInterview']['dimensionLabels']; size?: number }) {
  const DIMENSION_ORDER = getDimensionOrder(labels);
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - 32; // leave room for axis labels
  const axisCount = DIMENSION_ORDER.length;
  const angleStep = 360 / axisCount;

  // Grid rings at 25/50/75/100%
  const gridLevels = [0.25, 0.5, 0.75, 1];

  const dataPoints = DIMENSION_ORDER.map((d, i) => {
    const value = (profile[d.key] as number) / 10; // normalize 1-10 -> 0-1
    const angle = i * angleStep;
    return polarPoint(cx, cy, maxRadius * value, angle);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: 'block', margin: '0 auto' }}>
      {/* Grid rings */}
      {gridLevels.map((level, gi) => {
        const points = DIMENSION_ORDER.map((_, i) => {
          const p = polarPoint(cx, cy, maxRadius * level, i * angleStep);
          return `${p.x},${p.y}`;
        }).join(' ');
        return (
          <polygon
            key={gi}
            points={points}
            fill="none"
            className="stroke-gray-200 dark:stroke-white/10"
            strokeWidth={1}
          />
        );
      })}

      {/* Axis lines */}
      {DIMENSION_ORDER.map((_, i) => {
        const p = polarPoint(cx, cy, maxRadius, i * angleStep);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            className="stroke-gray-200 dark:stroke-white/10"
            strokeWidth={1}
          />
        );
      })}

      {/* Data area */}
      <polygon points={dataPolygon} fill="rgb(168 85 247 / 0.18)" stroke="rgb(168 85 247)" strokeWidth={2} />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="rgb(168 85 247)" />
      ))}

      {/* Axis labels */}
      {DIMENSION_ORDER.map((d, i) => {
        const labelPos = polarPoint(cx, cy, maxRadius + 18, i * angleStep);
        const anchor = labelPos.x > cx + 4 ? 'start' : labelPos.x < cx - 4 ? 'end' : 'middle';
        return (
          <text
            key={d.key}
            x={labelPos.x}
            y={labelPos.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize="9"
            className="fill-gray-500 dark:fill-white/50"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}