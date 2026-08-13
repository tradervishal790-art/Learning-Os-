import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  role: 'user' | 'mentor';
  content: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  { icon: '💡', label: 'Explain simply', prompt: 'Explain this concept simply' },
  { icon: '🧠', label: 'Deep dive', prompt: 'Explain this in depth with examples' },
  { icon: '🎯', label: 'Real analogy', prompt: 'Give me a real-world analogy' },
  { icon: '📝', label: 'Quiz me', prompt: 'Generate a quiz on this topic' },
  { icon: '🛠️', label: 'Project idea', prompt: 'Suggest a mini project' },
  { icon: '🐛', label: 'Find mistake', prompt: 'What are common mistakes?' },
];

// ============================================
// MENTOR RESPONSE — now routed through /api/mentor-chat
// ============================================
// The Gemini key used to be called directly from the browser with
// `import.meta.env.VITE_GEMINI_API_KEY` in the URL, which gets baked
// into the client bundle and is readable by anyone. The system prompt
// + actual Gemini call now live server-side in api/mentor-chat.ts —
// this function just sends the conversation and gets text back.
async function generateMentorResponse(
  userMessage: string,
  context: string,
  history: Message[]
): Promise<string> {
  try {
    const response = await fetch('/api/mentor-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage,
        context,
        history: history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Mentor chat API error:', response.status, data);
      return data?.error || `Kuch gadbad ho gayi (${response.status}). Thodi der mein phir try karein. 🔄`;
    }

    if (!data?.text) {
      return 'Response nahi mil paaya, phir se try karein. 🔄';
    }

    // Let the user know explicitly if a response still got cut off,
    // instead of silently showing an incomplete sentence.
    if (data.finishReason === 'MAX_TOKENS') {
      return data.text + '\n\n_(⚠️ Response lambi thi aur beech mein kat gayi — "Deep dive" ki jagah chhota sawaal poochhein)_';
    }

    return data.text;
  } catch (error) {
    console.error('Mentor chat fetch failed:', error);
    return 'Network error aaya. Internet check karein aur phir try karein. 🔄';
  }
}

export default function Mentor() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'mentor',
      content:
        'Namaste! Main aapka AI Mentor hoon. 🙏\n\nAap mujhse kuch bhi poochh sakte hain:\n• Concepts explain karwana\n• Real-world analogies\n• Quiz lena\n• Project ideas\n• Common mistakes\n\nNeeche suggestions try karein, ya apna question type karein!',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextTopic, setContextTopic] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setLoading(true);

    const reply = await generateMentorResponse(text, contextTopic, updatedHistory);

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
    <div className="min-h-screen bg-[#030303] text-white flex flex-col p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-4xl font-bold mb-2">🤖 AI Mentor</h1>
        <p className="text-white/60">Ask anything, get structured guidance</p>
      </motion.div>

      {/* Chat area */}
      <div className="flex-1 max-w-4xl mx-auto w-full bg-white/5 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ maxHeight: '60vh' }}>
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 border border-white/10 text-white'
                  }`}
                >
                  <div className="text-xs opacity-60 mb-1">
                    {msg.role === 'user' ? '👤 You' : '🤖 Mentor'}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                </div>
              </motion.div>
            ))}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-white/10 border border-white/10 p-4 rounded-2xl">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts */}
        <div className="px-6 py-3 border-t border-white/5 flex gap-2 overflow-x-auto">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => sendMessage(p.prompt)}
              disabled={loading}
              className="flex-shrink-0 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs hover:bg-white/10 transition disabled:opacity-50"
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask anything..."
            disabled={loading}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 placeholder-white/40 focus:outline-none focus:border-purple-500/50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl font-semibold transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}