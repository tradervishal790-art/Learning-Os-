import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LearningProfile, QuizAnswer, QuizAnswerValue } from './types';
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
    prompt: 'Ek hi ghante mein ek naya topic seekhna hai exam ke liye. Kaunsa video choose karoge?',
    options: [
      { key: 'A', text: 'Medium-length video jo thoda context deta hai, phir core points' },
      { key: 'B', text: 'Detailed 45-min video — sab kuch samjhata hai, lekin poora dekhne ka time na mile' },
      { key: 'C', text: 'Fast 15-min video — seedha core points, doubt aaya toh clarity nahi milegi' },
      { key: 'D', text: 'Video ke bajaye ek chhota written summary padhna, jaldi khatam' },
    ],
  },
  {
    id: 'q2_theory_practical',
    section: 'core',
    prompt: 'Naya concept seekhne ke liye kaunsa teacher choose karoge?',
    options: [
      { key: 'A', text: 'Thoda theory, phir seedha ek example — dono ka mix' },
      { key: 'B', text: 'Seedha formula/method deta hai — turant kaam shuru, "kyun" khud figure out karna hoga' },
      { key: 'C', text: 'Pehle poora "kyun" explain karta hai — confidence milega, shuru hone mein der lagegi' },
      { key: 'D', text: 'Sirf practice problems deta hai, koi explanation nahi — trial and error se seekho' },
    ],
  },
  {
    id: 'q3_structure',
    section: 'core',
    prompt: 'Group study ke liye content choose karna hai.',
    options: [
      { key: 'A', text: 'Fixed-order playlist — sabko same sequence follow karna hoga, koi flexibility nahi' },
      { key: 'B', text: 'Ek loose roadmap hai, topics ka order thoda flexible' },
      { key: 'C', text: 'Sirf ek playlist — jo interesting lage wahi pehle dekho, koi fixed order nahi' },
      { key: 'D', text: 'Kuch bhi organized nahi hai — jahan curiosity le jaaye' },
    ],
  },
  {
    id: 'q4_language',
    section: 'core',
    prompt: 'Do teachers available hain same topic ke liye.',
    options: [
      { key: 'A', text: 'Bilkul simple everyday language — koi technical term nahi' },
      { key: 'B', text: 'Technical/precise language — exact hai, extra effort lagta hai samajhne mein' },
      { key: 'C', text: 'Simple language, lekin kabhi-kabhi ek technical term aata hai (explain karke)' },
      { key: 'D', text: 'Jargon-heavy, professional/industry language, kam explanation ke saath' },
    ],
  },
  {
    id: 'q5_repetition',
    section: 'core',
    prompt: 'Exam se pehle revision strategy choose karni hai.',
    options: [
      { key: 'A', text: 'Ek baar dekha hua topic dobara nahi chhuna, jab tak koi specific doubt na ho' },
      { key: 'B', text: 'Kam naye topics, jo dekha hai usse 2-3 baar revise karo pakka karne ke liye' },
      { key: 'C', text: 'Naye topics zyada cover karo — repeat mat karo jo ek baar dekh liya' },
      { key: 'D', text: 'Har topic ko kai baar dohrana, chahe naye topics chhoot jaayein' },
    ],
  },
  {
    id: 'q6_depth',
    section: 'core',
    prompt: 'Concept samajh aa gaya "kya" karna hai. Teacher pooch raha hai — aage badhein ya "kyun" wale part mein jaayein?',
    options: [
      { key: 'A', text: 'Thoda "kyun" dekh lo, phir aage badho' },
      { key: 'B', text: 'Aage badho — kaam ho raha hai, "kyun" baad mein dekh lenge' },
      { key: 'C', text: 'Jab tak root cause samajh na aaye, aage badhna hi nahi chahta/chahti' },
      { key: 'D', text: '"Kyun" mein interest nahi, bas result chahiye jaldi' },
    ],
  },
  {
    id: 'q7_storytelling',
    section: 'core',
    prompt: 'Ek concept do tarike se explain ho sakta hai.',
    options: [
      { key: 'A', text: 'Ek kahani/case-study ke through — concept dheere-dheere reveal hota hai' },
      { key: 'B', text: 'Chhota real-life example ke saath, seedha point pe' },
      { key: 'C', text: 'Ek analogy/story ke saath, jisme emotional connect bhi ho' },
      { key: 'D', text: 'Seedha definition aur formula — direct, koi extra baatein nahi' },
    ],
  },
  {
    id: 'q8_prior_knowledge',
    section: 'core',
    prompt: 'Bilkul naya subject start kar rahe ho jiske baare mein kuch nahi pata.',
    options: [
      { key: 'A', text: 'Thodi basic background pehle chahiye hoti hai — poori zero se nahi' },
      { key: 'B', text: 'Generally kuch na kuch related pehle se pata hota hai jisse connect kar leta/leti hoon' },
      { key: 'C', text: 'Zero se start karna comfortable lagta hai — koi jaldi nahi' },
      { key: 'D', text: 'Zyadatar naye subjects mein bhi kuch overlap mil hi jaata hai purane knowledge se' },
    ],
  },
  {
    id: 'q9_pace_check',
    section: 'consistency',
    prompt: '2 online courses milte hain same topic ke — dono se same result milega.',
    options: [
      { key: 'A', text: 'Course B — 2 mahine ka, thorough — thorough hona zyada important hai' },
      { key: 'B', text: 'Course A — 2 hafte ka, fast — jaldi khatam karna hai' },
      { key: 'C', text: 'Beech ka koi option chahiye — na bahut fast, na bahut slow' },
      { key: 'D', text: 'Koi bhi chalega, jab tak content achha ho' },
    ],
  },
  {
    id: 'q10_repetition_check',
    section: 'consistency',
    prompt: 'Quiz mein galat answer aaya kisi concept pe jo "samajh mein aa gaya" laga tha.',
    options: [
      { key: 'A', text: 'Ruk ke wapas se poora concept dekhna padega' },
      { key: 'B', text: 'Bas ek galti thi, aage badhta/badhti hoon' },
      { key: 'C', text: 'Sirf wahi specific part dobara dekh lunga/lungi, poora nahi' },
      { key: 'D', text: 'Kisi se puchh lunga/lungi, khud dobara nahi dekhunga/dekhungi' },
    ],
  },
  {
    id: 'q11_language_check',
    section: 'consistency',
    prompt: 'Article padhte waqt ek naya technical term aata hai jiska matlab context se guess ho sakta hai.',
    options: [
      { key: 'A', text: 'Thoda soch ke guess karta/karti hoon, phir confirm karne ki koshish karta/karti hoon' },
      { key: 'B', text: 'Guess karke aage badh jaata/jaati hoon — flow important hai' },
      { key: 'C', text: 'Ruk ke exact meaning dhoondta/dhoondti hoon pehle' },
      { key: 'D', text: 'Us article ko chhod deta/deti hoon, koi aur source dhoondता/dhoondती hoon' },
    ],
  },
];

const HONESTY_QUESTION = {
  id: 'q12_honesty' as const,
  prompt: 'Is quiz ko bharte waqt kya socha: "kaunsa answer mujhe zyada serious/advanced learner dikhayega"?',
  options: [
    { value: 'A' as const, label: 'Nahi, jo actually feel hua wahi choose kiya' },
    { value: 'B' as const, label: 'Thoda socha, lekin zyada tar honest raha' },
    { value: 'C' as const, label: 'Haan, thoda dhyaan mein tha' },
    { value: 'D' as const, label: 'Answer nahi dena chahta/chahti' },
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
              <p className="text-sm text-white/50 mb-6">Koi bhi answer galat nahi hai — bas honest raho.</p>

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