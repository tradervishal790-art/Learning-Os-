// src/personalityReportApi.ts
// The AI call for the Personality Check report. Runs only when the learner presses
// the button. Sends zones + the answers they chose (no name, no account info), plus
// the growth edges their tests already confirmed (if any).
import { authFetch } from './apiFetch';
import { PERSONALITY_QUESTIONS, TRAITS } from './personalityQuestions';
import type { PersonalityProfile, PersonalityReport } from './personalityScoring';
import { TRAIT_LABELS } from './PersonalityResult';
import { computeGrowthEdges } from './growthEdges';
import { analyzeAttempt, analyzeHistory } from './testAnalytics';
import { getTestAttempts } from './testStore';
import { PROBE_BANK } from './personalityProbe';
import { bucketOf } from './personalityScoring';

function buildInput(profile: PersonalityProfile) {
  const attempts = getTestAttempts();
  let edges: { habit: string; why: string; seenInTests: string }[] = [];
  if (attempts.length > 0) {
    const latest = [...attempts].sort((x, y) => (x.completedAt < y.completedAt ? 1 : -1))[0];
    edges = computeGrowthEdges(profile, analyzeAttempt(latest), analyzeHistory(latest, attempts)).map((e) => ({
      habit: e.title,
      why: e.cause,
      seenInTests: e.evidence,
    }));
  }
  // Cross-check: Part 1 vs Part 2 for the traits that were double-checked, plus the Part 2 answers.
  const second = profile.second;
  const crossCheck = second
    ? {
        checkedAreas: second.probedTraits.map((t) => ({
          key: t,
          area: TRAIT_LABELS[t],
          part1Level: bucketOf(second.part1[t]),
          part2Level: bucketOf(second.part2[t]),
          result: second.agreement[t], // 'agree' or 'mixed'
        })),
        notDoubleChecked: TRAITS.filter((t) => !second.probedTraits.includes(t)).map((t) => TRAIT_LABELS[t]),
        part2Answers: Object.entries(second.answers).flatMap(([id, score]) => {
          const q = PROBE_BANK.find((x) => x.id === id);
          return q ? [{ area: TRAIT_LABELS[q.trait], question: q.stem, chosen: q.options[score - 1] }] : [];
        }),
      }
    : undefined;
  return {
    ageGroup: profile.version,
    traits: TRAITS.map((t) => ({
      key: t, // lets the server pick this area's pre-analysed type files
      area: TRAIT_LABELS[t],
      zone: profile.traits[t].zone,
      level: profile.traits[t].bucket,
      unsure: profile.traits[t].unsure,
    })),
    answers: PERSONALITY_QUESTIONS.map((q) => {
      const key = profile.answers[q.id];
      return { area: TRAIT_LABELS[q.trait], question: q.stems[profile.version], chosen: q.options.find((o) => o.key === key)?.text[profile.version] ?? '' };
    }),
    growthEdges: edges,
    ...(crossCheck ? { crossCheck } : {}),
  };
}

export async function fetchPersonalityReport(profile: PersonalityProfile, locale: string): Promise<PersonalityReport> {
  const response = await authFetch('/api/extract-questions?op=personality', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: buildInput(profile), locale }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Could not get the report (${response.status})`);
  return data.report as PersonalityReport;
}
