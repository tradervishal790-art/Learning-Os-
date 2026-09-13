import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LearningProfile, QuizAnswer, QuizAnswerValue } from './types';
import HintBubble from './HintBubble';
import { computeLearningProfile } from './learningProfileScoring.ts';
import { useTranslation } from './i18n/LanguageContext';

// ============================================================
// LearningQuiz.tsx — v3
//
// 4 options per question. Option position (A/B/C/D) does NOT
// correlate with score — see QUESTION_SCORE_MAP in
// learningProfileScoring.ts. This forces the user to actually read
// each option instead of pattern-matching a position or letter.
//
// Usage:
//   <LearningQuiz onComplete={(profile) => { ...save it... }} />
// ============================================================

// Per-question scoring metadata only — the *displayed* prompt/options
// text lives in translations.ts (t.learningQuiz.questions[i], same
// order/ids) and is merged in at render time in the component below.
// `id` + `section` (and the A/B/C/D option ORDER) drive scoring via
// QUESTION_SCORE_MAP in learningProfileScoring.ts, so those stay fixed
// here regardless of which locale is displayed — translating the
// *displayed* text is 100% safe since scoring only ever looks at the
// selected option's KEY, never its text.
interface QuizQuestionMeta {
  id: string;
  section: 'core' | 'consistency';
}

const QUESTION_META: QuizQuestionMeta[] = [
  { id: 'q1_pace', section: 'core' },
  { id: 'q2_theory_practical', section: 'core' },
  { id: 'q3_structure', section: 'core' },
  { id: 'q4_language', section: 'core' },
  { id: 'q5_repetition', section: 'core' },
  { id: 'q6_depth', section: 'core' },
  { id: 'q7_storytelling', section: 'core' },
  { id: 'q8_prior_knowledge', section: 'core' },
  { id: 'q9_pace_check', section: 'consistency' },
  { id: 'q10_repetition_check', section: 'consistency' },
  { id: 'q11_language_check', section: 'consistency' },
];

const TOTAL_STEPS = QUESTION_META.length + 1;

export default function LearningQuiz({ onComplete }: { onComplete: (profile: LearningProfile) => void }) {
  const t = useTranslation();
  const QUESTIONS = QUESTION_META.map((meta, i) => ({
    ...meta,
    prompt: t.learningQuiz.questions[i].prompt,
    options: t.learningQuiz.questions[i].options as { key: QuizAnswerValue; text: string }[],
  }));
  const HONESTY_QUESTION = {
    id: 'q12_honesty' as const,
    prompt: t.learningQuiz.honestyQuestion.prompt,
    options: t.learningQuiz.honestyQuestion.options as { value: 'A' | 'B' | 'C' | 'D'; label: string }[],
  };
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const isHonestyStep = step === QUESTIONS.length;
  const currentQuestion = isHonestyStep ? null : QUESTIONS[step];

  const handleAnswer = (value: QuizAnswerValue) => {
    if (!currentQuestion) return;
    const next = [...answers.filter((a) => a.questionId !== currentQuestion.id), { questionId: currentQuestion.id, value }];
    setAnswers(next);
    setStep((s) => s + 1);
  };

  const handleHonestyAnswer = (value: 'A' | 'B' | 'C' | 'D') => {
    const profile = computeLearningProfile(answers, value);
    onComplete(profile);
  };

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);
  const optionColors = [
    'hover:bg-purple-600/20 hover:border-purple-500/50',
    'hover:bg-blue-600/20 hover:border-blue-500/50',
    'hover:bg-cyan-600/20 hover:border-cyan-500/50',
    'hover:bg-pink-600/20 hover:border-pink-500/50',
  ];

  return (
    <div className="min-h-screen bg-[#030303] text-white flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <HintBubble id="test" text={t.learningQuiz.hintText} />
        <div className="mb-8">
          <div className="flex justify-between text-xs text-white/50 mb-2">
            <span>{t.learningQuiz.assessmentLabel}</span>
            <span>
              {Math.min(step + 1, TOTAL_STEPS)} / {TOTAL_STEPS}
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 via-blue-400 to-pink-500 rounded-full"
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!isHonestyStep && currentQuestion && (
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8"
            >
              {currentQuestion.section === 'consistency' && (
                <span className="inline-block mb-3 text-xs font-medium tracking-wide uppercase text-purple-300/70 bg-purple-500/10 border border-purple-500/20 rounded-full px-3 py-1">
                  {t.learningQuiz.quickCheckBadge}
                </span>
              )}
              <h2 className="text-xl md:text-2xl font-semibold mb-6 leading-snug">{currentQuestion.prompt}</h2>

              <div className="space-y-3">
                {currentQuestion.options.map((opt, i) => (
                  <motion.button
                    key={opt.key}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + i * 0.16, duration: 0.35, ease: 'easeOut' }}
                    onClick={() => handleAnswer(opt.key)}
                    className={`w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 transition ${optionColors[i]}`}
                  >
                    <span className="text-sm text-white/90">{opt.text}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {isHonestyStep && (
            <motion.div
              key="honesty"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8"
            >
              <span className="inline-block mb-3 text-xs font-medium tracking-wide uppercase text-pink-300/70 bg-pink-500/10 border border-pink-500/20 rounded-full px-3 py-1">
                {t.learningQuiz.lastOneBadge}
              </span>
              <h2 className="text-xl md:text-2xl font-semibold mb-2 leading-snug">{HONESTY_QUESTION.prompt}</h2>
              <p className="text-sm text-white/50 mb-6">{t.learningQuiz.honestNote}</p>

              <div className="space-y-3">
                {HONESTY_QUESTION.options.map((opt, i) => (
                  <motion.button
                    key={opt.value}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + i * 0.16, duration: 0.35, ease: 'easeOut' }}
                    onClick={() => handleHonestyAnswer(opt.value)}
                    className={`w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 transition ${optionColors[i]}`}
                  >
                    <span className="text-sm text-white/90">{opt.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}