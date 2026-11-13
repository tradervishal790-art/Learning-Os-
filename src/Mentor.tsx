import { useState, useRef, useEffect } from 'react';
import { MENTOR_PREFILL_KEY } from './mentorPrefill';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, BookOpenText, Link2, ListChecks, Hammer, SendHorizontal, History, Trash2, X, CircleHelp, BrainCircuit, Sparkles, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { setImmersive } from './immersive';
import { useTranslation, useLanguage } from './i18n/LanguageContext';
import { format } from './i18n/format';
import type { TranslationShape } from './i18n/translations';
import { buildMentorStudentContext } from './mentorContext';
import { authFetch } from './apiFetch';
import {
  appendToChat,
  deleteChat,
  getActiveChatId,
  listChats,
  loadChat,
  newChatId,
  saveChat,
  setActiveChatId,
  type MentorChatSummary,
} from './mentorChatStore';
import ConfirmDialog from './ConfirmDialog';
import MentorText from './MentorText';
import { Renderer, createParser } from '@openuidev/react-lang';
import { mentorUiLibrary } from './mentorUiLibrary';

const WELCOME_ID = 'welcome';

interface Message {
  id: string;
  role: 'user' | 'mentor';
  content: string;
  timestamp: Date;
  /** Reply is OpenUI Lang (interactive components), not plain text. */
  ui?: boolean;
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
// Parser for interactive (OpenUI) replies — created once, parsers memoize by identity.
const uiParser = createParser(mentorUiLibrary.toJSONSchema(), mentorUiLibrary.root);

/** Models sometimes wrap code in ``` fences despite the prompt; strip them. */
const stripFences = (t: string) => t.replace(/^\s*```[a-z-]*\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();

async function generateMentorResponse(
  userMessage: string,
  context: string,
  history: Message[],
  mentorErrors: TranslationShape['mentor']['errors'],
  locale: string,
  ui: boolean
): Promise<{ text: string; ui: boolean }> {
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
        ui,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Mentor chat API error:', response.status, data);
      return { text: data?.error || format(mentorErrors.generic, response.status), ui: false };
    }

    if (!data?.text) {
      return { text: mentorErrors.noResponse, ui: false };
    }

    if (ui) {
      // Show components only if the reply really parses into some; otherwise fall back to plain text
      // so a malformed model answer never leaves the student with a blank bubble.
      const code = stripFences(data.text);
      try {
        if (uiParser.parse(code).root) return { text: code, ui: true };
      } catch {
        // fall through to plain text
      }
    }

    // Let the user know explicitly if a response still got cut off,
    // instead of silently showing an incomplete sentence.
    if (data.finishReason === 'MAX_TOKENS') {
      return { text: data.text + mentorErrors.truncatedSuffix, ui: false };
    }

    return { text: data.text, ui: false };
  } catch (error) {
    console.error('Mentor chat fetch failed:', error);
    return { text: mentorErrors.network, ui: false };
  }
}

// Quick-prompt icons by position (the translation data still carries emoji; the UI uses these instead).
const PROMPT_ICONS: LucideIcon[] = [Lightbulb, BookOpenText, Link2, ListChecks, Hammer, CircleHelp];
// Same positions: which quick prompts get an interactive (OpenUI) answer. "Quiz me" -> clickable quiz.
const PROMPT_UI = [false, false, false, true, false, false];

/** Strips a leading emoji from a translated label ("👤 You" -> "You"). */
const stripEmoji = (label: string) => label.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '');

export default function Mentor() {
  const t = useTranslation();
  const { locale } = useLanguage();
  const welcome = (): Message => ({
    id: WELCOME_ID,
    role: 'mentor',
    content: t.mentor.welcomeMessage,
    timestamp: new Date(),
  });
  const withWelcome = (id: string): Message[] => [
    welcome(),
    ...loadChat(id).map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
  ];

  // Reopen the chat the student was last in; otherwise start a fresh one.
  const [chatId, setChatId] = useState<string>(() => getActiveChatId() ?? newChatId());
  const chatIdRef = useRef(chatId);
  const [messages, setMessages] = useState<Message[]>(() => withWelcome(chatId));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chats, setChats] = useState<MentorChatSummary[]>(() => listChats());
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // Chats with a reply still on the way (the student may switch chats meanwhile).
  const [pending, setPending] = useState<string[]>([]);
  const [input, setInput] = useState(() => {
    try {
      const pre = sessionStorage.getItem(MENTOR_PREFILL_KEY);
      if (pre) sessionStorage.removeItem(MENTOR_PREFILL_KEY);
      return pre ?? '';
    } catch {
      return '';
    }
  });
  const loading = pending.includes(chatId);
  const [contextTopic, setContextTopic] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // While the keyboard is up the bottom bar steps aside so the input gets the room.
  useEffect(() => () => setImmersive(false), []);

  useEffect(() => {
    // Only follow the conversation once it has started — scrolling on the lone welcome
    // message pushed the page header off-screen when Mentor opened.
    if (messages.length > 1) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Persist everything except the localized welcome (rebuilt on every open).
    // An empty chat is not stored, so "New chat" never leaves blank history entries.
    saveChat(
      chatId,
      messages
        .filter((m) => m.id !== WELCOME_ID)
        .map((m) => ({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp.toISOString(), ui: m.ui }))
    );
    setChats(listChats());
  }, [messages, chatId]);

  // Watch history se context nikaal lo — used internally to give Gemini
  // relevant context, NOT shown in the UI (keeps the header clean).
  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem('video_watch_history') || '[]');
      if (Array.isArray(history) && typeof history[0]?.title === 'string') {
        setContextTopic(history[0].title.slice(0, 120));
      }
    } catch {}
  }, []);

  const sendMessage = async (text: string, ui = false) => {
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
    const originId = chatId;
    setMessages([...messages, userMsg]);
    setInput('');
    setPending((p) => [...p, originId]);

    const reply = await generateMentorResponse(text, contextTopic, priorHistory, t.mentor.errors, locale, ui);

    const mentorMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'mentor',
      content: reply.text,
      timestamp: new Date(),
      ui: reply.ui || undefined,
    };
    if (chatIdRef.current === originId) {
      setMessages((prev) => [...prev, mentorMsg]);
    } else {
      // The student moved to another chat while this reply was loading — file it where it belongs.
      appendToChat(originId, { ...mentorMsg, timestamp: mentorMsg.timestamp.toISOString() });
    }
    setPending((p) => {
      const i = p.indexOf(originId);
      return i === -1 ? p : [...p.slice(0, i), ...p.slice(i + 1)];
    });
  };

  const switchTo = (id: string, isNew: boolean) => {
    chatIdRef.current = id;
    setChatId(id);
    setMessages(isNew ? [welcome()] : withWelcome(id));
    setActiveChatId(isNew ? null : id);
    setInput('');
    setHistoryOpen(false);
  };

  // A chat with no question yet is already "new" — don't stack empty ones.
  const isFresh = messages.every((m) => m.id === WELCOME_ID);
  const showWelcome = messages.length === 1 && messages[0]?.id === WELCOME_ID;
  const startNewChat = () => {
    if (!isFresh) switchTo(newChatId(), true);
    setHistoryOpen(false);
  };

  const openHistory = () => {
    setChats(listChats());
    setHistoryOpen(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete;
    deleteChat(id);
    setPendingDelete(null);
    setChats(listChats());
    if (id === chatIdRef.current) switchTo(newChatId(), true);
    setHistoryOpen(true);
  };

  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
      ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  return (
    <div className="dark">
      <div className="relative isolate flex h-[calc(100dvh-4rem)] min-h-[520px] w-full overflow-hidden bg-transparent md:bg-[#080d19] text-slate-100">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
          <div className="hidden md:block absolute -left-40 -top-40 h-[460px] w-[460px] rounded-full bg-violet-600/[0.15] blur-[130px]" />
          <div className="hidden md:block absolute right-[-10%] top-[35%] h-[420px] w-[420px] rounded-full bg-cyan-500/[0.09] blur-[130px]" />
          <div className="hidden md:block absolute bottom-[-35%] left-[30%] h-[460px] w-[460px] rounded-full bg-fuchsia-600/[0.08] blur-[130px]" />
        </div>

        <main className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/[0.06] px-4 md:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                <BrainCircuit className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-white md:text-base">AI Mentor</h1>
                <p className="hidden truncate text-[11px] text-slate-500 sm:block">Your personal learning assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={openHistory} aria-label={t.mentor.history} title={t.mentor.history} className="flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-xs text-slate-300 transition hover:bg-white/5">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">{t.mentor.history}</span>
              </button>
              <button onClick={startNewChat} aria-label={t.mentor.newChat} title={t.mentor.newChat} className="flex h-9 items-center gap-2 rounded-full bg-violet-600 px-3 text-xs font-semibold text-white shadow-[0_0_18px_rgba(139,92,246,.3)] transition hover:bg-violet-500">
                <span>+</span>{t.mentor.newChat}
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            {showWelcome ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-start overflow-y-auto px-4 pb-4 pt-5 text-center sm:justify-center sm:pb-5 sm:pt-8 md:px-8">
                <motion.div initial={{ opacity: 0, scale: 0.8, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.55, ease: 'easeOut' }} className="mb-4 flex h-14 w-14 shrink-0 sm:mb-6 sm:h-[76px] sm:w-[76px] items-center justify-center rounded-full border border-violet-200/20 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,.95),rgba(196,181,253,.9)_12%,rgba(139,92,246,.8)_34%,rgba(49,46,129,.9)_68%,rgba(8,13,25,1)_100%)] shadow-[0_0_35px_rgba(139,92,246,.4),inset_0_0_18px_rgba(255,255,255,.18)]">
                  <Sparkles className="h-7 w-7 text-white drop-shadow-[0_0_8px_rgba(255,255,255,.8)]" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.45 }} className="max-w-2xl shrink-0">
                  <p className="mb-3 hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-300/80 sm:block">LEARNING OS · AI MENTOR</p>
                  <h2 className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-[38px]">What would you like to learn today?</h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400 md:text-[15px]">{t.mentor.header.subtitle}</p>
                </motion.div>

                <div className="mt-5 grid w-full max-w-[850px] shrink-0 grid-cols-1 gap-2.5 sm:mt-8 sm:grid-cols-3 sm:gap-3">
                  {t.mentor.suggestedPrompts.slice(0, 3).map((p, i) => {
                    const PromptIcon = PROMPT_ICONS[i] ?? Lightbulb;
                    return (
                      <motion.button
                        key={p.label}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.18 + i * 0.08, duration: 0.35 }}
                        onClick={() => sendMessage(p.prompt, PROMPT_UI[i] === true)}
                        disabled={loading}
                        className="group flex min-h-14 items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.045] p-3 text-left transition sm:block sm:min-h-[112px] sm:p-4 hover:-translate-y-1 hover:border-violet-300/30 hover:bg-violet-500/[0.09] hover:shadow-[0_16px_38px_rgba(0,0,0,.2)] disabled:opacity-40"
                      >
                        <div className="contents sm:mb-3 sm:flex sm:items-center sm:justify-between">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 sm:h-8 sm:w-8"><PromptIcon className="h-4 w-4" /></span>
                          <ChevronRight className="order-3 h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-1 group-hover:text-violet-200 sm:order-none" />
                        </div>
                        <span className="min-w-0 flex-1 sm:block">
                          <span className="block text-sm font-semibold text-slate-100">{p.label}</span>
                          <span className="mt-0.5 block line-clamp-1 text-xs leading-relaxed text-slate-400 sm:mt-1 sm:line-clamp-2">{p.prompt}</span>
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 md:px-8 md:py-7">
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                  <AnimatePresence>
                    {messages.filter((msg) => msg.id !== WELCOME_ID).map((msg) => (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[92%] rounded-2xl px-4 py-3 md:max-w-[78%] md:px-5 md:py-4 ${msg.role === 'user' ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-[0_10px_30px_rgba(91,33,182,.2)]' : 'border border-white/[0.08] bg-[#111827]/90 text-slate-100'}`}>
                          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider opacity-55">{stripEmoji(msg.role === 'user' ? t.mentor.youLabel : t.mentor.mentorLabel)}</div>
                          {msg.role === 'mentor' && msg.ui ? <Renderer response={msg.content} library={mentorUiLibrary} isStreaming={false} /> : msg.role === 'mentor' ? <MentorText text={msg.content} /> : <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>}
                        </div>
                      </motion.div>
                    ))}
                    {loading && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                          <div className="flex gap-1">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-violet-300/80 motion-reduce:animate-none" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-violet-300/80 motion-reduce:animate-none" style={{ animationDelay: '150ms' }} />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-violet-300/80 motion-reduce:animate-none" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}

            <div className="shrink-0 border-t border-white/[0.06] bg-[#080d19]/80 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:px-8 md:pb-5">
              {showWelcome && (
                <div className="mx-auto mb-3 flex max-w-4xl flex-wrap justify-center gap-2">
                  {t.mentor.suggestedPrompts.slice(3).map((p, i) => {
                    const PromptIcon = PROMPT_ICONS[i + 3] ?? CircleHelp;
                    return (
                      <button key={p.label} onClick={() => sendMessage(p.prompt, PROMPT_UI[i + 3] === true)} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 text-[11px] text-slate-400 transition hover:border-violet-300/30 hover:text-violet-200 disabled:opacity-40">
                        <PromptIcon className="h-3.5 w-3.5" />{p.label}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-white/[0.11] bg-[#171c2a] p-2 shadow-[0_14px_45px_rgba(0,0,0,.28)] transition focus-within:border-violet-400/40 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,.08),0_14px_45px_rgba(0,0,0,.28)]">
                <textarea
                  rows={2}
                  maxLength={4000}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  onFocus={() => setImmersive(true)}
                  onBlur={() => setImmersive(false)}
                  placeholder={t.mentor.inputPlaceholder}
                  disabled={loading}
                  className="max-h-36 min-h-[48px] flex-1 resize-none bg-transparent px-3 py-3 text-base text-slate-100 outline-none md:text-sm placeholder:text-slate-500 disabled:opacity-50"
                />
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => sendMessage(input)} disabled={loading || !input.trim()} aria-label={t.mentor.sendCta} title={t.mentor.sendCta} className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_0_18px_rgba(139,92,246,.32)] transition hover:brightness-110 disabled:opacity-35 disabled:shadow-none">
                  <SendHorizontal className="h-4 w-4" />
                </button>
              </div>
              <p className="mx-auto mt-2 max-w-4xl text-center text-[10px] text-slate-600">Your mentor uses your learning context to make explanations more relevant.</p>
            </div>
          </div>
        </main>

        <AnimatePresence>
          {historyOpen && (
            <motion.div key="mentor-history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[45] flex items-end bg-black/55 backdrop-blur-sm md:items-stretch md:justify-end" onClick={() => setHistoryOpen(false)}>
              <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} role="dialog" aria-label={t.mentor.history} onClick={(e) => e.stopPropagation()} className="flex max-h-[82dvh] w-full flex-col rounded-t-2xl border-t border-white/10 bg-[#0b1221] md:max-h-none md:w-96 md:rounded-none md:border-l md:border-t-0">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <h2 className="font-semibold text-white">{t.mentor.history}</h2>
                  <button onClick={() => setHistoryOpen(false)} aria-label={t.mentor.closeCta} title={t.mentor.closeCta} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                  {chats.length === 0 ? <p className="p-4 text-sm text-slate-500">{t.mentor.historyEmpty}</p> : chats.map((chat) => (
                    <div key={chat.id} className={`flex items-center gap-1 rounded-xl ${chat.id === chatId ? 'bg-violet-500/15' : 'hover:bg-white/5'}`}>
                      <button onClick={() => chat.id !== chatId ? switchTo(chat.id, false) : setHistoryOpen(false)} className="min-w-0 flex-1 px-3 py-3 text-left">
                        <div className="truncate text-sm text-slate-100">{chat.title || t.mentor.newChat}</div>
                        <div className="text-xs text-slate-500">{formatWhen(chat.updatedAt)}</div>
                      </button>
                      <button onClick={() => setPendingDelete(chat.id)} aria-label={t.mentor.deleteChat} title={t.mentor.deleteChat} className="mr-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-white/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {pendingDelete && <ConfirmDialog danger message={t.mentor.deleteConfirm} confirmLabel={t.mentor.deleteCta} cancelLabel={t.mentor.cancelCta} onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />}
      </div>
    </div>
  );
}
