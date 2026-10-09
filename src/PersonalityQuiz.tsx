import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PERSONALITY_QUESTIONS, type AgeVersion, type OptionKey } from './personalityQuestions';
import { scorePersonality, type PersonalityProfile } from './personalityScoring';
import { PersonalityResultRows } from './PersonalityResult';

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
      setResult(profile);
      onComplete(profile);
    }
  };

  const handleBack = () => {
    if (index > 0) setIndex(index - 1);
  };

  const subtitle = result ? 'Complete!' : version ? `Question ${index + 1} / ${total}` : 'Choose your age group';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-3xl max-w-lg w-full text-black dark:text-white max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex-1">
            <h2 className="text-base font-semibold">Personality Check</h2>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">{subtitle}</p>
            {version && !result && (
              <div className="mt-2 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${((index + 1) / total) * 100}%` }} />
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
                20 quick questions, about 5 minutes. There is no right or wrong answer. Pick what you really do, not what you think you should do.
              </p>
              {VERSIONS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVersion(v.id)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition"
                >
                  <span className="text-sm font-medium">{v.title}</span>
                  <span className="block text-xs text-gray-400 dark:text-white/40 mt-0.5">{v.hint}</span>
                </button>
              ))}
              <p className="text-[11px] text-gray-400 dark:text-white/40 pt-1">If you are exactly 15 or 20, pick whichever feels closer to your life.</p>
            </div>
          )}

          {version && !result && (
            <AnimatePresence mode="wait">
              <motion.div key={question.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <p className="text-sm font-medium leading-relaxed mb-4">{question.stems[version]}</p>
                <div className="space-y-2">
                  {question.options.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => handleSelect(opt.key)}
                      className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition text-sm leading-relaxed"
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

          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <PersonalityResultRows profile={result} />
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
              className="w-full px-4 py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-semibold transition active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
