import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PERSONALITY_QUESTIONS, type AgeVersion, type OptionKey } from './personalityQuestions';
import { scorePersonality, type PersonalityProfile } from './personalityScoring';
import PersonalityReportCard from './PersonalityReportCard';
import { pickProbeQuestions, applySecondTest, type ProbeQuestion } from './personalityProbe';

// ============================================================
// PersonalityQuiz.tsx
//
// Separate, optional 20-question personality check — opened from Settings
// only. Does NOT touch the Blueprint Interview or the learning-style
// profile. Fully local (zero AI calls). English only for now.
// ============================================================

const VERSIONS: { id: AgeVersion; title: string; hint: string }[] = [
  { id: 'A', title: 'Up to 15 years', hint: 'School life' },
  { id: 'B', title: '16 to 20 years', hint: 'Senior school, college, exam prep' },
  { id: 'C', title: '21 to 30 years', hint: 'Work, career, skills' },
];

export default function PersonalityQuiz({
  onComplete,
  onClose,
}: {
  onComplete: (profile: PersonalityProfile) => void;
  onClose: () => void;
}) {
  const [version, setVersion] = useState<AgeVersion | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [result, setResult] = useState<PersonalityProfile | null>(null);
  // Part 1 finished -> offer Part 2 (situation questions on the traits that stood out).
  const [partOne, setPartOne] = useState<PersonalityProfile | null>(null);
  const [probe, setProbe] = useState<{ q: ProbeQuestion; order: number[] }[] | null>(null);
  const [probeIndex, setProbeIndex] = useState(0);
  const [probeAnswers, setProbeAnswers] = useState<Record<string, number>>({});

  const total = PERSONALITY_QUESTIONS.length;
  const question = PERSONALITY_QUESTIONS[index];

  const handleSelect = (key: OptionKey) => {
    if (!version) return;
    const next = { ...answers, [question.id]: key };
    setAnswers(next);
    if (index + 1 < total) {
      setIndex(index + 1);
    } else {
      const profile = scorePersonality(version, next);
      setPartOne(profile);
      onComplete(profile); // Part 1 is saved right away, so nothing is lost if they stop here

    }
  };

  const handleBack = () => {
    if (index > 0) setIndex(index - 1);
  };

  const startProbe = () => {
    if (!partOne) return;
    const qs = pickProbeQuestions(partOne);
    // shuffle the options on screen so the best-looking answer is not always in the same place
    setProbe(qs.map((q) => ({ q, order: [0, 1, 2, 3].sort(() => Math.random() - 0.5) })));
    setProbeIndex(0);
    setProbeAnswers({});
  };

  const handleProbeSelect = (optionIndex: number) => {
    if (!probe || !partOne) return;
    const next = { ...probeAnswers, [probe[probeIndex].q.id]: optionIndex + 1 };
    setProbeAnswers(next);
    if (probeIndex + 1 < probe.length) {
      setProbeIndex(probeIndex + 1);
    } else {
      const merged = applySecondTest(partOne, probe.map((x) => x.q), next);
      setResult(merged);
      onComplete(merged);
    }
  };

  const inBridge = !!partOne && !probe && !result;
  const inProbe = !!probe && !result;
  const inPart1 = !!version && !partOne && !result;
  const subtitle = result
    ? 'Complete!'
    : inProbe
      ? `Part 2 · Question ${probeIndex + 1} / ${probe!.length}`
      : inBridge
        ? 'Part 1 done'
        : version
          ? `Question ${index + 1} / ${total}`
          : 'Choose your age group';
  const progress = inProbe ? ((probeIndex + 1) / probe!.length) * 100 : ((index + 1) / total) * 100;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-3xl max-w-lg w-full text-black dark:text-white max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex-1">
            <h2 className="text-base font-semibold">Personality Check</h2>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">{subtitle}</p>
            {(inPart1 || inProbe) && (
              <div className="mt-2 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
          {!result && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition text-sm flex-shrink-0 ml-3"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {!version && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-white/50 mb-3">
                20 quick questions, about 5 minutes. There is no right or wrong answer. Pick what you really do, not what you think you should do. At the end, your answers are sent to AI to write your personal report.
              </p>
              {VERSIONS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVersion(v.id)}
                  className="los-choice"
                >
                  <span className="text-sm font-medium">{v.title}</span>
                  <span className="block text-xs text-gray-400 dark:text-white/40 mt-0.5">{v.hint}</span>
                </button>
              ))}
              <p className="text-[11px] text-gray-400 dark:text-white/40 pt-1">If you are exactly 15 or 20, pick whichever feels closer to your life.</p>
            </div>
          )}

          {inPart1 && (
            <AnimatePresence mode="wait">
              <motion.div key={question.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <p className="text-sm font-medium leading-relaxed mb-4">{question.stems[version]}</p>
                <div className="space-y-2">
                  {question.options.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => handleSelect(opt.key)}
                      className="los-choice"
                    >
                      <span className="font-semibold text-purple-500 mr-2">{opt.key}.</span>
                      {opt.text[version]}
                    </button>
                  ))}
                </div>
                {index > 0 && (
                  <button onClick={handleBack} className="mt-4 text-xs text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 transition">
                    ← Previous question
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {inBridge && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <p className="text-sm font-semibold">Part 1 is saved.</p>
              <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed">
                Now 15 short real-life questions about the areas that stood out in your answers. They look at the same
                habits from a different angle, so your final result is double-checked. About 4 minutes.
              </p>
              <button
                onClick={startProbe}
                className="los-btn los-btn-primary w-full"
              >
                Start Part 2
              </button>
              <button
                onClick={() => setResult(partOne)}
                className="w-full text-xs text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 transition"
              >
                Skip for now (result from Part 1 only)
              </button>
            </motion.div>
          )}

          {inProbe && (
            <AnimatePresence mode="wait">
              <motion.div key={probe![probeIndex].q.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <p className="text-sm font-medium leading-relaxed mb-4">{probe![probeIndex].q.stem}</p>
                <div className="space-y-2">
                  {probe![probeIndex].order.map((optIdx, shown) => (
                    <button
                      key={optIdx}
                      onClick={() => handleProbeSelect(optIdx)}
                      className="los-choice"
                    >
                      <span className="font-semibold text-purple-500 mr-2">{'ABCD'[shown]}.</span>
                      {probe![probeIndex].q.options[optIdx]}
                    </button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <PersonalityReportCard
                profile={result}
                autoGenerate
                onReport={(report) => {
                  const updated = { ...result, report };
                  setResult(updated);
                  onComplete(updated);
                }}
              />
              {result.retakeSuggested && (
                <p className="text-xs text-gray-500 dark:text-white/50">
                  Several of your answers pointed in different directions. Try this again on another day for a clearer picture.
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-white/40">
                These are tendencies, not labels. Your real study habits will keep updating this picture.
              </p>
            </motion.div>
          )}
        </div>

        {result && (
          <div className="p-4 border-t border-gray-200 dark:border-white/10">
            <button
              onClick={onClose}
              className="los-btn los-btn-primary w-full"
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
