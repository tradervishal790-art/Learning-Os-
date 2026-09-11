import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LearningProfile, QuizAnswer, QuizAnswerValue } from './types';
import HintBubble from './HintBubble';
import { computeLearningProfile } from './learningProfileScoring.ts';

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

interface QuizQuestion {
  id: string;
  section: 'core' | 'consistency';
  prompt: string;
  options: { key: QuizAnswerValue; text: string }[];
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1_pace',
    section: 'core',
    prompt: "You have just one hour to learn a new topic for an exam. Which video would you choose?",
    options: [
      { key: 'A', text: "A medium-length video that gives a bit of context, then the core points" },
      { key: 'B', text: "A detailed 45-min video — explains everything, but you might not have time to finish it" },
      { key: 'C', text: "A fast 15-min video — straight to the core points, but no clarity if you have a doubt" },
      { key: 'D', text: "A short written summary instead of a video — quick to finish" },
    ],
  },
  {
    id: 'q2_theory_practical',
    section: 'core',
    prompt: "Which teacher would you choose to learn a new concept?",
    options: [
      { key: 'A', text: "A bit of theory, then straight into an example — a mix of both" },
      { key: 'B', text: "Gives you the formula/method directly — you start working right away and figure out the \"why\" yourself" },
      { key: 'C', text: "Explains the full \"why\" first — you'll feel confident, but it'll take longer to get started" },
      { key: 'D', text: "Only gives practice problems, no explanation — learn by trial and error" },
    ],
  },
  {
    id: 'q3_structure',
    section: 'core',
    prompt: "You need to pick content for a group study session.",
    options: [
      { key: 'A', text: "A fixed-order playlist — everyone follows the same sequence, no flexibility" },
      { key: 'B', text: "A loose roadmap — the order of topics is somewhat flexible" },
      { key: 'C', text: "Just a playlist — watch whatever seems interesting first, no fixed order" },
      { key: 'D', text: "Nothing organized at all — wherever curiosity takes you" },
    ],
  },
  {
    id: 'q4_language',
    section: 'core',
    prompt: "Two teachers are available for the same topic.",
    options: [
      { key: 'A', text: "Completely simple, everyday language — no technical terms" },
      { key: 'B', text: "Technical/precise language — exact, but takes extra effort to understand" },
      { key: 'C', text: "Simple language, but occasionally a technical term comes up (explained)" },
      { key: 'D', text: "Jargon-heavy, professional/industry language, with little explanation" },
    ],
  },
  {
    id: 'q5_repetition',
    section: 'core',
    prompt: "You need to choose a revision strategy before an exam.",
    options: [
      { key: 'A', text: "Never touch a topic again once you've seen it, unless there's a specific doubt" },
      { key: 'B', text: "Cover fewer new topics — revise what you've already seen 2-3 times to lock it in" },
      { key: 'C', text: "Cover more new topics — don't repeat what you've already seen once" },
      { key: 'D', text: "Go over every topic multiple times, even if it means missing new topics" },
    ],
  },
  {
    id: 'q6_depth',
    section: 'core',
    prompt: "You've understood \"what\" to do for a concept. The teacher asks — move on, or go into the \"why\" part?",
    options: [
      { key: 'A', text: "Look at the \"why\" a little, then move on" },
      { key: 'B', text: "Move on — it's working, we'll look at the \"why\" later" },
      { key: 'C', text: "I don't want to move on until I understand the root cause" },
      { key: 'D', text: "Not interested in the \"why\" — I just want quick results" },
    ],
  },
  {
    id: 'q7_storytelling',
    section: 'core',
    prompt: "A concept can be explained in two ways.",
    options: [
      { key: 'A', text: "Through a story/case-study — the concept reveals itself gradually" },
      { key: 'B', text: "With a short real-life example, straight to the point" },
      { key: 'C', text: "With an analogy/story that also has an emotional connection" },
      { key: 'D', text: "Straight definition and formula — direct, no extra talk" },
    ],
  },
  {
    id: 'q8_prior_knowledge',
    section: 'core',
    prompt: "You're starting a completely new subject you know nothing about.",
    options: [
      { key: 'A', text: "I like having a bit of basic background first — not starting completely from zero" },
      { key: 'B', text: "I usually already know something related that I can connect it to" },
      { key: 'C', text: "Starting from zero feels comfortable — no rush" },
      { key: 'D', text: "Even in most new subjects, I find some overlap with what I already know" },
    ],
  },
  {
    id: 'q9_pace_check',
    section: 'consistency',
    prompt: "Two online courses are available for the same topic — both will get you the same result.",
    options: [
      { key: 'A', text: "Course B — 2 months, thorough — being thorough matters more" },
      { key: 'B', text: "Course A — 2 weeks, fast — I want to finish quickly" },
      { key: 'C', text: "I'd want something in between — not too fast, not too slow" },
      { key: 'D', text: "Either works, as long as the content is good" },
    ],
  },
  {
    id: 'q10_repetition_check',
    section: 'consistency',
    prompt: "You got a quiz question wrong on a concept you thought you'd \"understood\".",
    options: [
      { key: 'A', text: "I'll need to stop and go over the whole concept again" },
      { key: 'B', text: "It was just one mistake, I'll move on" },
      { key: 'C', text: "I'll just revisit that specific part again, not the whole thing" },
      { key: 'D', text: "I'll ask someone rather than go back and review it myself" },
    ],
  },
  {
    id: 'q11_language_check',
    section: 'consistency',
    prompt: "While reading an article, you come across a new technical term whose meaning you can guess from context.",
    options: [
      { key: 'A', text: "I think about it and guess, then try to confirm it" },
      { key: 'B', text: "I guess and move on — keeping the flow going matters" },
      { key: 'C', text: "I stop and look up the exact meaning first" },
      { key: 'D', text: "I drop that article and look for another source" },
    ],
  },
];

const HONESTY_QUESTION = {
  id: 'q12_honesty' as const,
  prompt: 'While answering this quiz, did you ever think: "which answer makes me look like a more serious/advanced learner"?',
  options: [
    { value: 'A' as const, label: "No, I chose whatever actually felt true" },
    { value: 'B' as const, label: "Thought about it a little, but was mostly honest" },
    { value: 'C' as const, label: "Yes, it was a bit on my mind" },
    { value: 'D' as const, label: "I'd rather not answer" },
  ],
};

const TOTAL_STEPS = QUESTIONS.length + 1;

export default function LearningQuiz({ onComplete }: { onComplete: (profile: LearningProfile) => void }) {
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
        <HintBubble id="test" text="Answer honestly — this shapes which videos we pick for you." />
        <div className="mb-8">
          <div className="flex justify-between text-xs text-white/50 mb-2">
            <span>Learning Style Assessment</span>
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
                  Quick check
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
                Last one
              </span>
              <h2 className="text-xl md:text-2xl font-semibold mb-2 leading-snug">{HONESTY_QUESTION.prompt}</h2>
              <p className="text-sm text-white/50 mb-6">There's no wrong answer here — just be honest.</p>

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