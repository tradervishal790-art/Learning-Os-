// "Learning style" test, opened from Settings. A short, optional test that says HOW the
// learner likes to work with new material (Felder-Silverman). The result is saved on the
// personality profile and sent to the AI report as supporting knowledge. Local scoring, zero AI calls.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PersonalityProfile } from './personalityScoring';
import { FELDER_QUESTIONS, scoreFelder, type FelderPole } from './felderTest';

interface Item { id: string; stem: string; options: { value: string; text: string }[] }
interface TestDef {
  id: 'felder';
  title: string;
  blurb: string;
  items: () => Item[];
  finish: (answers: Record<string, string>) => Partial<PersonalityProfile>;
  done: (p: PersonalityProfile) => boolean;
}

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

const TESTS: TestDef[] = [
  {
    id: 'felder',
    title: 'How do you work with new material?',
    blurb: '12 two-choice questions, about 1.5 minutes: examples or ideas, pictures or words, trying or thinking, steps or big picture.',
    items: () =>
      FELDER_QUESTIONS.map((q) => ({
        id: q.id,
        stem: q.stem,
        options: shuffle(q.options.map((o) => ({ value: o.pole, text: o.text }))),
      })),
    finish: (a) => ({ felder: scoreFelder(a as Record<string, FelderPole>) }),
    done: (p) => !!p.felder,
  },
];

export default function LearningStyleTests({
  profile,
  onSave,
  onClose,
}: {
  profile: PersonalityProfile;
  onSave: (updated: PersonalityProfile) => void;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState<{ test: TestDef; items: Item[] } | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [latest, setLatest] = useState(profile);

  const start = (test: TestDef) => {
    setCurrent({ test, items: test.items() });
    setIndex(0);
    setAnswers({});
  };

  const pick = (value: string) => {
    if (!current) return;
    const next = { ...answers, [current.items[index].id]: value };
    setAnswers(next);
    if (index + 1 < current.items.length) {
      setIndex(index + 1);
    } else {
      const updated = { ...latest, ...current.test.finish(next) };
      setLatest(updated);
      onSave(updated);
      setCurrent(null);
    }
  };

  const item = current?.items[index];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-3xl max-w-lg w-full text-black dark:text-white max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex-1">
            <h2 className="text-base font-semibold">Learning style</h2>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
              {current ? `${current.test.title} · ${index + 1} / ${current.items.length}` : 'Optional. Pick any of the three.'}
            </p>
            {current && (
              <div className="mt-2 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${((index + 1) / current.items.length) * 100}%` }} />
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {!current && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-white/50 mb-3">
                These say how you like to study. They only shape the study tips in your personality report. After a test, tap
                &quot;Write a new report&quot; to include it.
              </p>
              {TESTS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => start(t)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition"
                >
                  <span className="text-sm font-medium">
                    {t.title} {t.done(latest) && <span className="text-green-600 dark:text-green-400">✓ done</span>}
                  </span>
                  <span className="block text-xs text-gray-400 dark:text-white/40 mt-0.5">
                    {t.done(latest) ? 'Tap to retake. ' : ''}
                    {t.blurb}
                  </span>
                </button>
              ))}
            </div>
          )}

          {current && item && (
            <AnimatePresence mode="wait">
              <motion.div key={`${current.test.id}-${item.id}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <p className="text-sm font-medium leading-relaxed mb-4">{item.stem}</p>
                <div className="space-y-2">
                  {item.options.map((o, shown) => (
                    <button
                      key={o.value}
                      onClick={() => pick(o.value)}
                      className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 text-sm transition"
                    >
                      <span className="font-semibold text-purple-500 mr-2">{'ABCD'[shown]}.</span>
                      {o.text}
                    </button>
                  ))}
                </div>
                <button onClick={() => setCurrent(null)} className="mt-4 text-xs text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 transition">
                  ← Back to the list
                </button>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}
