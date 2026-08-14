import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LearningProfile } from './types';

// ============================================================
// BlueprintInterview.tsx
//
// Replaces LearningQuiz.tsx's static 12-question form with a live,
// adaptive interview: Gemini asks one question at a time (see
// api/blueprint-interview.ts), follows up based on prior answers, and
// closes itself when it has enough signal (10-15 questions). Ends with
// a written report + the same 8 LearningProfile dimensions the old quiz
// produced, so nothing downstream (Roadmap.tsx, PlaylistBuilder.ts,
// queryExpander.ts) needs to change — they all just read LearningProfile.
//
// onComplete signature intentionally mirrors LearningQuiz's
// onComplete(profile) so Dashboard.tsx can swap one for the other with
// a one-line change.
// ============================================================

interface HistoryMessage {
  role: 'user' | 'model';
  content: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'mentor';
  content: string;
}

type Phase = 'loading' | 'asking' | 'finishing' | 'done' | 'error';

async function callInterviewApi(history: HistoryMessage[]): Promise<any> {
  const response = await fetch('/api/blueprint-interview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Interview error ${response.status}`);
  return data;
}

export default function BlueprintInterview({
  onComplete,
  onClose,
}: {
  onComplete: (profile: LearningProfile) => void;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [report, setReport] = useState('');
  const [lastFailedHistory, setLastFailedHistory] = useState<HistoryMessage[] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, phase]);

  // Kick off the interview on mount — empty history tells the backend
  // to generate the first question.
  useEffect(() => {
    (async () => {
      try {
        const data = await callInterviewApi([]);
        handleApiResult(data, []);
      } catch (err: any) {
        setPhase('error');
        setErrorMsg(err.message || 'Interview start nahi ho paaya.');
        setLastFailedHistory([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApiResult(data: any, historySoFar: HistoryMessage[]) {
    if (data.type === 'question') {
      setQuestionCount((c) => c + 1);
      setMessages((prev) => [...prev, { id: `q-${Date.now()}`, role: 'mentor', content: data.text }]);
      setHistory([...historySoFar, { role: 'model', content: JSON.stringify({ type: 'question', text: data.text }) }]);
      setPhase('asking');
      return;
    }

    if (data.type === 'complete') {
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
      setReport(data.report);
      setPhase('done');
      onComplete(profile);
      return;
    }

    setPhase('error');
    setErrorMsg('Response samajh nahi aaya, phir se try karo.');
  }

  const handleSend = async () => {
    if (!input.trim() || phase !== 'asking') return;
    const answer = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'user', content: answer }]);

    const updatedHistory: HistoryMessage[] = [...history, { role: 'user', content: answer }];
    setHistory(updatedHistory);
    setPhase('finishing');

    try {
      const data = await callInterviewApi(updatedHistory);
      handleApiResult(data, updatedHistory);
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(err.message || 'Kuch gadbad ho gayi.');
      setLastFailedHistory(updatedHistory);
    }
  };

  const handleRetry = async () => {
    if (lastFailedHistory === null) return;
    setPhase(lastFailedHistory.length === 0 ? 'loading' : 'finishing');
    setErrorMsg('');
    try {
      const data = await callInterviewApi(lastFailedHistory);
      handleApiResult(data, lastFailedHistory);
      setLastFailedHistory(null);
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(err.message || 'Kuch gadbad ho gayi.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-3xl max-w-lg w-full text-black dark:text-white max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-semibold">🧭 AI Blueprint Interview</h2>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
              {phase === 'done' ? 'Complete!' : questionCount > 0 ? `Sawaal ${questionCount}` : 'Shuru ho raha hai...'}
            </p>
          </div>
          {onClose && phase !== 'done' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition text-sm flex-shrink-0"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {(phase === 'loading' || phase === 'finishing') && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-2xl">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <AnimatePresence>
            {phase === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl border border-purple-300/30 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/5"
              >
                <h3 className="text-sm font-semibold mb-2 text-purple-700 dark:text-purple-300">
                  📋 Tera Learning Blueprint
                </h3>
                <p className="text-sm text-gray-700 dark:text-white/80 leading-relaxed whitespace-pre-wrap">
                  {report}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === 'error' && (
            <div className="text-center py-2 space-y-3">
              <p className="text-sm text-red-500 dark:text-red-400">{errorMsg}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                🔄 Phir try karein
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {phase !== 'done' && (
          <div className="p-4 border-t border-gray-200 dark:border-white/10 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Apna jawab yahan likho..."
              disabled={phase !== 'asking'}
              className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={phase !== 'asking' || !input.trim()}
              className="px-5 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-40 text-sm font-semibold transition active:scale-[0.98]"
            >
              Send
            </button>
          </div>
        )}

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