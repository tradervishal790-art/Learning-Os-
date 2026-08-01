import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEEP_DIVE_QUESTIONS, buildExtractionPrompt, parseDeepDiveResponse } from './deepDiveScoring';
import { getLearningProfile, mergeLearningProfile } from './learningProfileStore';
import type { LearningProfile } from './types';

const GEMINI_MODEL = 'gemini-flash-latest';

async function callGemini(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key missing');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.4 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini error ${response.status}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  return text;
}

interface DeepDiveChatProps {
  onComplete: (updatedProfile: LearningProfile) => void;
  onClose: () => void;
}

type Phase = 'asking' | 'processing' | 'error';

export default function DeepDiveChat({ onComplete, onClose }: DeepDiveChatProps) {
  const [step, setStep] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('asking');
  const [errorMsg, setErrorMsg] = useState('');

  const isLastStep = step === DEEP_DIVE_QUESTIONS.length - 1;

  const handleNext = async () => {
    if (!currentAnswer.trim()) return;
    const updatedAnswers = [...answers, currentAnswer.trim()];
    setAnswers(updatedAnswers);
    setCurrentAnswer('');

    if (!isLastStep) {
      setStep((s) => s + 1);
      return;
    }

    // Last answer submitted — extract dimensions and merge.
    setPhase('processing');
    try {
      const qaPairs = DEEP_DIVE_QUESTIONS.map((q, i) => ({ question: q, answer: updatedAnswers[i] }));
      const prompt = buildExtractionPrompt(qaPairs);
      const rawResponse = await callGemini(prompt);
      const signals = parseDeepDiveResponse(rawResponse);

      if (!signals) {
        setPhase('error');
        setErrorMsg('Response samajh nahi aaya, phir se try karo ya skip karo.');
        return;
      }

      const existingProfile = getLearningProfile();
      if (!existingProfile) {
        setPhase('error');
        setErrorMsg('Pehle quiz complete karo.');
        return;
      }

      const merged = mergeLearningProfile(existingProfile, signals);
      onComplete(merged);
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(err.message || 'Kuch gadbad ho gayi.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-3xl max-w-lg w-full p-5 md:p-6 text-black dark:text-white max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-white/40">
            Deep Dive · Optional
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition text-sm flex-shrink-0"
          >
            ✕
          </button>
        </div>

        <AnimatePresence mode="wait">
          {phase === 'asking' && (
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="text-xs text-gray-400 dark:text-white/40 mb-2">
                Sawaal {step + 1} / {DEEP_DIVE_QUESTIONS.length}
              </div>
              <h3 className="text-base md:text-lg font-semibold mb-4 leading-snug">{DEEP_DIVE_QUESTIONS[step]}</h3>
              <textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                rows={4}
                placeholder="Apna jawab yahan likho..."
                autoFocus={false}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-base md:text-sm placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-purple-500/50 mb-4 resize-none"
              />
              <button
                onClick={handleNext}
                disabled={!currentAnswer.trim()}
                className="w-full px-4 py-3.5 md:py-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black disabled:opacity-40 text-sm font-semibold transition active:scale-[0.98]"
              >
                {isLastStep ? 'Submit' : 'Next'}
              </button>
            </motion.div>
          )}

          {phase === 'processing' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-center">
              <div className="flex justify-center gap-1 mb-3">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-sm text-gray-500 dark:text-white/50">Profile update ho raha hai...</p>
            </motion.div>
          )}

          {phase === 'error' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4 text-center">
              <p className="text-sm text-red-500 dark:text-red-400 mb-4">{errorMsg}</p>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-sm hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                Close
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}