import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface NotesData {
  topic: string;
  summary: string;
  concept: string;
  mentalModel: string;
  analogy: string;
  examples: string[];
  flowchart: string[];
  commonMistakes: string[];
  exercises: string[];
  revisionQuestions: string[];
  keyTakeaways: string[];
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// gemini-1.5-flash is SHUT DOWN (404) as of 2026.
// gemini-flash-latest auto-points to the current stable Flash model (currently gemini-3.5-flash).
const GEMINI_MODEL = 'gemini-flash-latest';

async function generateNotesWithAI(topic: string): Promise<NotesData> {
  const prompt = `Generate structured study notes for "${topic}" in Hinglish (Hindi + English mix). Return JSON with these fields:
{
  "summary": "2-3 line summary",
  "concept": "main concept explanation",
  "mentalModel": "how to think about this",
  "analogy": "real-world analogy",
  "examples": ["example1", "example2", "example3"],
  "flowchart": ["step1", "step2", "step3", "step4", "step5"],
  "commonMistakes": ["mistake1", "mistake2", "mistake3", "mistake4", "mistake5"],
  "exercises": ["exercise1", "exercise2", "exercise3"],
  "revisionQuestions": ["q1", "q2", "q3", "q4", "q5"],
  "keyTakeaways": ["takeaway1", "takeaway2", "takeaway3", "takeaway4", "takeaway5"]
}`;

  // Strict schema forces Gemini to emit exactly this shape — far less
  // likely to produce malformed/truncated JSON than a prompt-only approach.
  const responseSchema = {
    type: 'OBJECT',
    properties: {
      summary: { type: 'STRING' },
      concept: { type: 'STRING' },
      mentalModel: { type: 'STRING' },
      analogy: { type: 'STRING' },
      examples: { type: 'ARRAY', items: { type: 'STRING' } },
      flowchart: { type: 'ARRAY', items: { type: 'STRING' } },
      commonMistakes: { type: 'ARRAY', items: { type: 'STRING' } },
      exercises: { type: 'ARRAY', items: { type: 'STRING' } },
      revisionQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
      keyTakeaways: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: [
      'summary', 'concept', 'mentalModel', 'analogy', 'examples',
      'flowchart', 'commonMistakes', 'exercises', 'revisionQuestions', 'keyTakeaways',
    ],
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          // CRITICAL: this was missing before, so long responses got
          // cut off mid-JSON (the "position 4922" truncation error).
          maxOutputTokens: 4096,
          temperature: 0.7,
        },
      }),
    }
  );

  // CRITICAL: without this check, a 404/403/429 error body silently
  // fails JSON.parse below and gets swallowed as a generic error.
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    console.error('Gemini API error:', response.status, errBody);
    throw new Error(
      `Gemini API error ${response.status}: ${errBody?.error?.message || 'Unknown error'}`
    );
  }

  const data = await response.json();

  // If Gemini stopped early because it ran out of tokens, say so clearly
  // instead of letting JSON.parse fail with a cryptic position error.
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('Response truncated (hit token limit) — try a shorter/simpler topic');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error('No text in Gemini response:', data);
    throw new Error('Gemini returned empty response');
  }

  const parsed = safeJsonParse(text);
  return { topic, ...parsed };
}

// Gemini occasionally wraps JSON in ```json fences even with responseMimeType
// set, or leaves a trailing comma. This cleans the common cases before parsing.
function safeJsonParse(rawText: string): any {
  let cleaned = rawText.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('JSON parse failed, raw text was:', cleaned);
    throw new Error('Gemini returned malformed JSON — please try again');
  }
}

function generateFallbackNotes(topic: string): NotesData {
  return {
    topic,
    summary: `${topic} ek foundational concept hai jo structured thinking sikhata hai.`,
    concept: `${topic} ka core idea hai cheezein organize karna aur relationships samajhna.`,
    mentalModel: `Input → Process → Output — yeh pattern ${topic} mein har jagah dikhai deta hai.`,
    analogy: `${topic} is like a recipe — ingredients (basics), steps (process), taste (testing).`,
    examples: [
      `Real example 1: ${topic} decision-making mein use hota hai`,
      `Real example 2: ${topic} system design mein helpful`,
      `Real example 3: ${topic} problem-solving mein key hai`,
    ],
    flowchart: ['1. Identify problem', '2. Break into parts', '3. Solve each', '4. Combine', '5. Test', '6. Iterate'],
    commonMistakes: ['Basics skip karna', 'Bina practice theory', 'Notes nahi banana', 'Revision nahi karna', 'Compare with others'],
    exercises: [`${topic} ke 3 real examples dhundho`, `Mini project banao`, `Dost ko samjhao`],
    revisionQuestions: [`${topic} ka purpose?`, `Kis problem ko solve karta hai?`, `Alternative kya hai?`, `Real life mein kahan?`, `Na ho to kya hoga?`],
    keyTakeaways: [`${topic} = structured thinking`, `Basics strong karo`, `3 angles: what, why, how`, `Practice > Theory`, `Day 1, 3, 7, 15, 30 revision`],
  };
}

export default function Notes() {
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState<NotesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('summary');

  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem('video_watch_history') || '[]');
      if (history.length > 0 && !topic) setTopic(history[0].title);
    } catch {}
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');

    try {
      if (GEMINI_API_KEY) {
        const aiNotes = await generateNotesWithAI(topic);
        setNotes(aiNotes);
      } else {
        setNotes(generateFallbackNotes(topic));
        setError('VITE_GEMINI_API_KEY nahi mila — template notes dikha raha hoon');
      }
    } catch (err) {
      // Now we actually surface WHY it failed instead of a generic message
      console.error(err);
      setNotes(generateFallbackNotes(topic));
      setError(
        err instanceof Error
          ? `AI fail hua: ${err.message} — fallback notes dikha raha hoon`
          : 'AI fail hua, fallback notes dikha raha hoon'
      );
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { id: 'summary', label: '📋 Summary', key: 'summary' },
    { id: 'concept', label: '💡 Concept', key: 'concept' },
    { id: 'analogy', label: '🌍 Analogy', key: 'analogy' },
    { id: 'examples', label: '📌 Examples', key: 'examples' },
    { id: 'flowchart', label: '🔀 Flowchart', key: 'flowchart' },
    { id: 'mistakes', label: '⚠️ Mistakes', key: 'commonMistakes' },
    { id: 'exercises', label: '✏️ Exercises', key: 'exercises' },
    { id: 'questions', label: '❓ Questions', key: 'revisionQuestions' },
    { id: 'takeaways', label: '⭐ Takeaways', key: 'keyTakeaways' },
  ];

  const renderContent = () => {
    if (!notes) return null;
    const section = sections.find((s) => s.id === activeSection);
    const data = (notes as any)[section!.key];

    if (typeof data === 'string') {
      return <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{data}</p>;
    }
    return (
      <ul className="space-y-3">
        {data.map((item: string, i: number) => (
          <li key={i} className="text-white/80 leading-relaxed whitespace-pre-wrap">
            {item}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold mb-2">📝 AI Notes</h1>
        <p className="text-white/60">{GEMINI_API_KEY ? 'AI-powered notes via Gemini' : 'Template-based notes (add VITE_GEMINI_API_KEY for AI)'}</p>
      </motion.div>

      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="Topic (e.g., React Hooks, Closures)"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 placeholder-white/40 focus:outline-none focus:border-purple-500/50"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl font-semibold transition"
          >
            {loading ? '⏳' : 'Generate'}
          </button>
        </div>
        {error && <p className="text-yellow-400 text-sm mt-2">⚠️ {error}</p>}
      </div>

      {notes && (
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                  activeSection === s.id ? 'bg-white text-black' : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-8"
          >
            <h2 className="text-2xl font-bold mb-4">
              {sections.find((s) => s.id === activeSection)?.label} — {notes.topic}
            </h2>
            {renderContent()}
          </motion.div>
        </div>
      )}

      {!notes && !loading && (
        <div className="max-w-2xl mx-auto text-center py-16 text-white/60">
          <p className="text-lg mb-2">📚 Topic daalo aur notes generate karo</p>
          <p className="text-sm">Example: React Hooks, Closures, API Design</p>
        </div>
      )}
    </div>
  );
}