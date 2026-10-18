import { useState, useRef, useEffect } from 'react';
import { MENTOR_PREFILL_KEY } from './mentorPrefill';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, BookOpenText, Link2, ListChecks, Hammer, Bug, SendHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { setImmersive, useImmersive } from './immersive';
import { useTranslation, useLanguage } from './i18n/LanguageContext';
import { format } from './i18n/format';
import type { TranslationShape } from './i18n/translations';
import { buildMentorStudentContext } from './mentorContext';
import { authFetch } from './apiFetch';
import { loadMentorChat, saveMentorChat } from './mentorChatStore';

const WELCOME_ID = 'welcome';

interface Message {
  id: string;
  role: 'user' | 'mentor';
  content: string;
  timestamp: Date;
}

// ============================================
// MENTOR RESPONSE — now routed through /api/mentor-chat
// ============================================
// The Gemini key used to be called directly from the browser with
// `import.meta.env.VITE_GEMINI_API_KEY` in the URL, which gets baked
// into the client bundle and is readable by anyone. The system prompt
// + actual Gemini call now live server-side in api/mentor-chat.ts —
// this function just sends the conversation and gets text back.
//
// `mentorErrors` is passed in (rather than called via useTranslation)
// since this is a plain async helper, not a component.
async function generateMentorResponse(
  userMessage: string,
  context: string,
  history: Message[],
  mentorErrors: TranslationShape['mentor']['errors'],
  locale: string
): Promise<string> {
  try {
    const response = await authFetch('/api/mentor-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage,
        context,
        history: history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        locale,
        studentContext: buildMentorStudentContext(),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Mentor chat API error:', response.status, data);
      return data?.error || format(mentorErrors.generic, response.status);
    }

    if (!data?.text) {
      return mentorErrors.noResponse;
    }

    // Let the user know explicitly if a response still got cut off,
    // instead of silently showing an incomplete sentence.
    if (data.finishReason === 'MAX_TOKENS') {
      return data.text + mentorErrors.truncatedSuffix;
    }

    return data.text;
  } catch (error) {
    console.error('Mentor chat fetch failed:', error);
    return mentorErrors.network;
  }
}

// Quick-prompt icons by position (the translation data still carries emoji; the UI uses these instead).
const PROMPT_ICONS: LucideIcon[] = [Lightbulb, BookOpenText, Link2, ListChecks, Hammer, Bug];

/** Strips a leading emoji from a translated label ("👤 You" -> "You"). */
const stripEmoji = (label: string) => label.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '');

export default function Mentor() {
  const t = useTranslation();
  const { locale } = useLanguage();
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: WELCOME_ID,
      role: 'mentor',
      content: t.mentor.welcomeMessage,
      timestamp: new Date(),
    },
    // Restore this user's earlier conversation from the device.
    ...loadMentorChat().map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
  ]);
  const [input, setInput] = useState(() => {
    try {
      const pre = sessionStorage.getItem(MENTOR_PREFILL_KEY);
      if (pre) sessionStorage.removeItem(MENTOR_PREFILL_KEY);
      return pre ?? '';
    } catch {
      return '';
    }
  });
  const [loading, setLoading] = useState(false);
  const [contextTopic, setContextTopic] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // While the keyboard is up the bottom bar steps aside so the input gets the room.
  const typing = useImmersive();
  useEffect(() => () => setImmersive(false), []);

  useEffect(() => {
    // Only follow the conversation once it has started — scrolling on the lone welcome
    // message pushed the page header off-screen when Mentor opened.
    if (messages.length > 1) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Persist everything except the localized welcome (rebuilt on every open).
    saveMentorChat(
      messages
        .filter((m) => m.id !== WELCOME_ID)
        .map((m) => ({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp.toISOString() }))
    );
  }, [messages]);

  // Watch history se context nikaal lo — used internally to give Gemini
  // relevant context, NOT shown in the UI (keeps the header clean).
  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem('video_watch_history') || '[]');
      if (history.length > 0) {
        setContextTopic(history[0].title || '');
      }
    } catch {}
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    // History sent to the API = everything BEFORE this message, minus the
    // canned welcome. The new message travels separately as `userMessage`.
    const priorHistory = messages.filter((m) => m.id !== WELCOME_ID);
    setMessages([...messages, userMsg]);
    setInput('');
    setLoading(true);

    const reply = await generateMentorResponse(text, contextTopic, priorHistory, t.mentor.errors, locale);

    const mentorMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'mentor',
      content: reply,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, mentorMsg]);
    setLoading(false);
  };

  return (
    <div className="min-h-dvh text-black dark:text-white flex flex-col p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">{t.mentor.header.title}</h1>
        {t.mentor.header.subtitle && <p className="hidden md:block text-gray-500 dark:text-white/60">{t.mentor.header.subtitle}</p>}
      </motion.div>

      {/* Chat area */}
      <div className="flex-1 max-w-4xl mx-auto w-full md:bg-gray-50 md:dark:bg-white/5 md:border md:border-gray-200 md:dark:border-white/10 md:rounded-2xl flex flex-col md:overflow-hidden">
        <div className="flex-1 md:overflow-y-auto md:p-6 space-y-3 md:space-y-4 md:max-h-[60vh]">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[80%] px-4 py-3 md:p-4 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white'
                      : 'card text-black dark:text-white'
                  }`}
                >
                  <div className="hidden md:block text-xs opacity-60 mb-1">
                    {stripEmoji(msg.role === 'user' ? t.mentor.youLabel : t.mentor.mentorLabel)}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                </div>
              </motion.div>
            ))}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 p-4 rounded-2xl">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 dark:bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 dark:bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 dark:bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="h-44 md:hidden" aria-hidden="true" />
          <div ref={messagesEndRef} />
        </div>

        {/* Prompts + input — pinned above the bottom bar on phones (Instagram DM style) */}
        <div
          className={`fixed inset-x-0 z-30 md:static bg-white/95 dark:bg-black/95 backdrop-blur md:backdrop-blur-none md:bg-transparent border-t border-gray-200 dark:border-white/10 md:border-white/5 ${
            typing ? 'bottom-[env(safe-area-inset-bottom)]' : 'bottom-[calc(3.5rem+env(safe-area-inset-bottom))]'
          } md:bottom-auto`}
        >
          <div className="px-4 md:px-6 py-2 md:py-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {t.mentor.suggestedPrompts.map((p, i) => {
              const PromptIcon = PROMPT_ICONS[i] ?? Lightbulb;
              return (
                <button
                  key={p.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => sendMessage(p.prompt)}
                  disabled={loading}
                  className="flex-shrink-0 h-9 px-3 inline-flex items-center gap-1.5 card rounded-full text-xs hover:bg-gray-100 dark:hover:bg-white/10 transition disabled:opacity-40"
                >
                  <PromptIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="px-4 pb-3 md:p-4 md:border-t md:border-gray-200 md:dark:border-white/10 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              onFocus={() => setImmersive(true)}
              onBlur={() => setImmersive(false)}
              placeholder={t.mentor.inputPlaceholder}
              disabled={loading}
              className="flex-1 min-w-0 h-11 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full md:rounded-xl px-4 placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              aria-label={t.mentor.sendCta}
              title={t.mentor.sendCta}
              className="flex-shrink-0 w-11 h-11 md:w-auto md:px-5 flex items-center justify-center bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white disabled:opacity-40 rounded-full md:rounded-xl font-semibold transition"
            >
              <SendHorizontal className="w-5 h-5 md:hidden" strokeWidth={1.75} />
              <span className="hidden md:inline">{t.mentor.sendCta}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
