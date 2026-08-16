import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Reuses the same server proxy Mentor.tsx already calls — no new API
// endpoint needed. We just scope the conversation to one topic and ask
// Gemini to quiz the learner on it.
async function callMentorChat(
  userMessage: string,
  context: string,
  history: { role: 'user' | 'mentor'; content: string }[]
): Promise<string> {
  const response = await fetch('/api/mentor-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userMessage, context, history: history.slice(-6) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Error ${response.status}`);
  if (!data?.text) throw new Error('Empty response');
  return data.text;
}

interface Message {
  id: string;
  role: 'user' | 'mentor';
  content: string;
}

interface ReviewSessionProps {
  topic: string;
  onMarkDone: () => void;
  onClose: () => void;
}

// Self-graded recall check (Anki-style) — after at least one Q&A exchange,
// the learner honestly rates how well they recalled it. "Bhool gaya" does
// NOT mark the checkpoint done, so it stays due/overdue and they can retry.
export default function ReviewSession({ topic, onMarkDone, onClose }: ReviewSessionProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [exchanged, setExchanged] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Kick off the quiz automatically when the panel opens.
  useEffect(() => {
    (async () => {
      try {
        const reply = await callMentorChat('Generate a short quiz (1-2 questions) on this topic to test my recall.', topic, []);
        setMessages([{ id: 'm1', role: 'mentor', content: reply }]);
      } catch (err: any) {
        setMessages([{ id: 'm1', role: 'mentor', content: `Quiz load nahi hua: ${err.message}` }]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);
    setExchanged(true);

    try {
      const reply = await callMentorChat(
        userMsg.content,
        topic,
        updated.map((m) => ({ role: m.role, content: m.content }))
      );
      setMessages((prev) => [...prev, { id: Date.now().toString() + 'm', role: 'mentor', content: reply }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { id: Date.now().toString() + 'm', role: 'mentor', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-4 border-t border-gray-200 dark:border-white/10 pt-4"
    >
      <div className="max-h-72 overflow-y-auto space-y-3 mb-3 pr-1">
        <AnimatePresence>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'bg-gray-100 dark:bg-white/10'
                }`}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="flex gap-1 px-1">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={loading}
          placeholder="Apna jawab yahan likho..."
          className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm font-medium disabled:opacity-40"
        >
          Send
        </button>
      </div>

      {exchanged && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Honestly, kaisa recall hua?</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-red-100 text-red-700 text-xs font-medium"
            >
              Try Again Later
            </button>
            <button
              onClick={onMarkDone}
              className="flex-1 py-2 rounded-lg bg-green-100 text-green-700 text-xs font-medium"
            >
              Mark Done
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}