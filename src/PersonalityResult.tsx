import { TRAITS, type Trait } from './personalityQuestions';
import type { PersonalityProfile, Zone } from './personalityScoring';

// Small shared view used by the quiz result screen AND the Settings section
// (kept out of PersonalityQuiz.tsx so that file can stay lazy-loaded).

export const TRAIT_LABELS: Record<Trait, string> = {
  openness: 'Curiosity',
  conscientiousness: 'Planning',
  extraversion: 'Social energy',
  agreeableness: 'Teamwork',
  neuroticism: 'Pressure sensitivity',
};

export const ZONE_TEXT: Record<Trait, Record<Zone, string>> = {
  openness: { lower: 'Practical and step-by-step', middle: 'Balanced between new and familiar', higher: 'Curious and exploratory' },
  conscientiousness: { lower: 'Flexible, works best near deadlines', middle: 'A balanced planner', higher: 'Planned and systematic' },
  extraversion: { lower: 'Quiet, solo focus', middle: 'Comfortable alone or with people', higher: 'Social, learns by discussing' },
  agreeableness: { lower: 'Independent and competitive', middle: 'Balanced', higher: 'Cooperative and group-minded' },
  neuroticism: { lower: 'Steady under pressure', middle: 'Sometimes affected by pressure', higher: 'More affected by pressure' },
};

const ZONES: Zone[] = ['lower', 'middle', 'higher'];

/** 3-segment bar with the learner's zone highlighted. */
export function ZoneBar({ zone, unsure }: { zone: Zone; unsure?: boolean }) {
  return (
    <div className="flex gap-1 flex-1">
      {ZONES.map((z) => (
        <div
          key={z}
          className={`h-1.5 flex-1 rounded-full ${
            z === zone ? (unsure ? 'bg-gray-400 dark:bg-white/40' : 'bg-purple-500') : 'bg-gray-200 dark:bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

export function PersonalityResultRows({ profile }: { profile: PersonalityProfile }) {
  return (
    <div className="space-y-1.5">
      {TRAITS.map((trait) => {
        const r = profile.traits[trait];
        return (
          <div key={trait} className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-medium w-32 flex-shrink-0 text-gray-700 dark:text-white/70">{TRAIT_LABELS[trait]}</span>
              <ZoneBar zone={r.zone} unsure={r.unsure} />
            </div>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-1.5">
              {r.unsure ? 'Not clear yet. Your tests and practice will show this one.' : ZONE_TEXT[trait][r.zone]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

