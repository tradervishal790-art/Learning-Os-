import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LearningProfile } from './types';
import { BLUEPRINT_QUESTIONS } from './blueprintQuestions';
import BlueprintRadar, { DIMENSION_ORDER } from './BlueprintRadar';
import { getGrade, getVerdict } from './blueprintGrading';

// ============================================================
// BlueprintInterview.tsx — v2
//
// Replaces LearningQuiz.tsx's static form AND the old live-Gemini-per-
// question version. Now: questions come from a fixed local bank
// (blueprintQuestions.ts), answered entirely client-side with zero
// network calls, then ONE single call to api/blueprint-interview at the
// very end with all 11 answers bundled together — Gemini cross-analyzes
// them in one shot and returns the written report + 8 LearningProfile
// dimensions. Big token/cost saving vs one-call-per-question, same
// output shape as before so nothing downstream changes.
// ============================================================

interface AnswerRecord {
  questionId: string;
  question: string;
  selectedOption: string;
}

type Phase = 'answering' | 'analyzing' | 'done' | 'error';

async function callAnalysisApi(answers: AnswerRecord[]): Promise<any> {
  const response = await fetch('/api/blueprint-interview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Analysis error ${response.status}`);
  return data;
}

export default function BlueprintInterview({
  onComplete,
  onClose,
}: {
  onComplete: (profile: LearningProfile) => void;
  onClose?: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [phase, setPhase] = useState<Phase>('answering');
  const [errorMsg, setErrorMsg] = useState('');
  const [report, setReport] = useState('');
  const [resultProfile, setResultProfile] = useState<LearningProfile | null>(null);
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentQuestion = BLUEPRINT_QUESTIONS[currentIndex];
  const totalQuestions = BLUEPRINT_QUESTIONS.length;

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentIndex]);

  const handleSelect = async (optionText: string) => {
    const newAnswer: AnswerRecord = {
      questionId: currentQuestion.id,
      question: currentQuestion.text,
      selectedOption: optionText,
    };
    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1);
      return;
    }

    // Last question answered — fire the single analysis call.
    setPhase('analyzing');
    try {
      const data = await callAnalysisApi(updatedAnswers);
      const profile: LearningProfile = {
        pace: data.dimensions.pace,
        theoryVsPractical: data.dimensions.theoryVsPractical,
        structureNeed: data.dimensions.structureNeed,
        depth: data.dimensions.depth,
        languageComplexity: data.dimensions.languageComplexity,
        storytelling: data.dimensions.storytelling,
        repetitionNeed: data.dimensions.repetitionNeed,
        priorKnowledgeComfort: data.dimensions.priorKnowledgeComfort,
        reliabilityScore: data.reliabilityScore,
        selfReportedHonesty: data.selfReportedHonesty,
        completedAt: new Date().toISOString(),
        blueprintReport: data.report,
      };
      setResultProfile(profile);
      setReport(data.report);
      setPhase('done');
      onComplete(profile);
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(err.message || 'Analysis fail ho gaya.');
    }
  };

  const handleRetryAnalysis = async () => {
    setPhase('analyzing');
    setErrorMsg('');
    try {
      const data = await callAnalysisApi(answers);
      const profile: LearningProfile = {
        pace: data.dimensions.pace,
        theoryVsPractical: data.dimensions.theoryVsPractical,
        structureNeed: data.dimensions.structureNeed,
        depth: data.dimensions.depth,
        languageComplexity: data.dimensions.languageComplexity,
        storytelling: data.dimensions.storytelling,
        repetitionNeed: data.dimensions.repetitionNeed,
        priorKnowledgeComfort: data.dimensions.priorKnowledgeComfort,
        reliabilityScore: data.reliabilityScore,
        selfReportedHonesty: data.selfReportedHonesty,
        completedAt: new Date().toISOString(),
        blueprintReport: data.report,
      };
      setResultProfile(profile);
      setReport(data.report);
      setPhase('done');
      onComplete(profile);
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(err.message || 'Analysis fail ho gaya.');
    }
  };

  const handleBack = () => {
    if (currentIndex === 0) return;
    setAnswers((prev) => prev.slice(0, -1));
    setCurrentIndex((i) => i - 1);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-3xl max-w-lg w-full text-black dark:text-white max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex-1">
            <h2 className="text-base font-semibold">🧭 AI Blueprint Interview</h2>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
              {phase === 'done'
                ? 'Complete!'
                : phase === 'analyzing'
                ? 'Analyzing your answers...'
                : `Sawaal ${currentIndex + 1} / ${totalQuestions}`}
            </p>
            {phase === 'answering' && (
              <div className="mt-2 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                />
              </div>
            )}
          </div>
          {onClose && phase !== 'done' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition text-sm flex-shrink-0 ml-3"
            >
              ✕
            </button>
          )}
        </div>

        <div ref={containerRef} className="flex-1 overflow-y-auto p-5 md:p-6">
          {phase === 'answering' && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-sm font-medium leading-relaxed mb-4">{currentQuestion.text}</p>
                <div className="space-y-2">
                  {currentQuestion.options.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => handleSelect(opt.text)}
                      className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition text-sm leading-relaxed"
                    >
                      <span className="font-semibold text-purple-500 mr-2">{opt.key}.</span>
                      {opt.text}
                    </button>
                  ))}
                </div>
                {currentIndex > 0 && (
                  <button
                    onClick={handleBack}
                    className="mt-4 text-xs text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 transition"
                  >
                    ← Pichla sawaal
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {phase === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="flex gap-1">
                <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-xs text-gray-400 dark:text-white/40">Tumhare jawabon ko deeply analyze kar rahe hain...</p>
            </div>
          )}

          <AnimatePresence>
            {phase === 'done' && resultProfile && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Mind score ring + radar */}
                <div className="p-4 rounded-xl border border-purple-300/30 dark:border-purple-500/20 bg-purple-50/50 dark:bg-purple-500/5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">🔮 Your Mind Map</p>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wide">Mind Score</p>
                      <p className="text-lg font-bold text-purple-600 dark:text-purple-300">
                        {Math.round(
                          (DIMENSION_ORDER.reduce((sum, d) => sum + (resultProfile[d.key] as number), 0) /
                            DIMENSION_ORDER.length) *
                            10
                        )}
                        <span className="text-xs font-normal text-gray-400 dark:text-white/40">/100</span>
                      </p>
                    </div>
                  </div>
                  <BlueprintRadar profile={resultProfile} />
                </div>

                {/* Expandable dimension rows */}
                <div className="space-y-1.5">
                  {DIMENSION_ORDER.map((d) => {
                    const score = resultProfile[d.key] as number;
                    const grade = getGrade(score);
                    const isOpen = expandedDim === d.key;
                    return (
                      <div
                        key={d.key}
                        onClick={() => setExpandedDim(isOpen ? null : d.key)}
                        className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2.5 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-medium w-28 flex-shrink-0 text-gray-700 dark:text-white/70">
                            {d.label}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-purple-500 transition-all duration-500"
                              style={{ width: `${score * 10}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-white/40 w-6 text-right">{score}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border min-w-[22px] text-center ${grade.colorClass}`}
                          >
                            {grade.letter}
                          </span>
                        </div>
                        {isOpen && (
                          <p className="text-xs text-gray-500 dark:text-white/50 leading-relaxed mt-2 pt-2 border-t border-gray-200 dark:border-white/10">
                            {getVerdict(d.key, score)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Written report */}
                <div className="p-4 rounded-xl border border-purple-300/30 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/5">
                  <h3 className="text-sm font-semibold mb-2 text-purple-700 dark:text-purple-300">
                    📋 Tera Learning Blueprint
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-white/80 leading-relaxed whitespace-pre-wrap">
                    {report}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === 'error' && (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-red-500 dark:text-red-400">{errorMsg}</p>
              <button
                onClick={handleRetryAnalysis}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                🔄 Phir try karein
              </button>
            </div>
          )}
        </div>

        {phase === 'done' && (
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