/// <reference types="vite/client" />
import { useState } from 'react';
import { motion } from 'framer-motion';
interface DeepNotesData {
  topic: string;
  summary: string;
  concept: string;
  prerequisites: string;
  mentalModel: string;
  analogy: string;
  deepExamples: string[];
  stepByStep: string[];
  misconceptions: string[];
  criticalThinking: string[];
  realWorldApps: string[];
  advancedConcepts: string[];
  exercises: string[];
  deepQuestions: string[];
  learningPath: string[];
  keyInsights: string[];
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-flash-latest';

async function generateDeepNotes(topic: string, videoContext?: string): Promise<DeepNotesData> {
  // Enhanced prompt for DEEP learning
  const prompt = `Generate DEEP, comprehensive study notes for "${topic}" in Hinglish (Hindi + English mix).
${videoContext ? `Video context: ${videoContext}` : ''}

Focus on:
1. WHY this concept exists (history, problem it solved)
2. DEEP understanding (not surface knowledge)
3. Prerequisites that must be known first
4. Mental models experts use
5. Common misconceptions and why people get confused
6. Real-world applications with specific contexts
7. Critical thinking questions
8. Learning path for mastery (days 1,3,7,15,30)

Return ONLY this JSON structure:
{
  "summary": "1-2 line essence of the topic",
  "concept": "Detailed explanation - why invented, evolution, core principles",
  "prerequisites": "What must be known first - foundational concepts",
  "mentalModel": "How experts think about this - psychological framework",
  "analogy": "Powerful analogy that makes it click",
  "deepExamples": [
    "Example 1 with detailed context and WHY it illustrates the concept",
    "Example 2 showing edge case or complexity",
    "Example 3 with counterexample or when it fails"
  ],
  "stepByStep": [
    "Step 1: Core principle explanation",
    "Step 2: Mechanism and how it works",
    "Step 3: Apply to different contexts",
    "Step 4: Recognize patterns and relationships",
    "Step 5: Build intuition and mental shortcuts"
  ],
  "misconceptions": [
    "Common misconception 1 + WHY people think this + correct understanding",
    "Misconception 2 + root cause of confusion + how to avoid",
    "Misconception 3 + expert perspective"
  ],
  "criticalThinking": [
    "Why is this important? What real problems does it solve?",
    "What breaks or fails when this concept doesn't apply?",
    "How does this connect to related concepts?",
    "What would happen if this didn't exist?"
  ],
  "realWorldApps": [
    "Application 1: Industry/context + exact use case + impact",
    "Application 2: Different field + how it solves problems there",
    "Application 3: Edge case or emerging application"
  ],
  "advancedConcepts": [
    "Advanced concept 1 + how it builds on basics",
    "Related concept 2 + connections",
    "Research frontier 3 + future directions"
  ],
  "exercises": [
    "Exercise 1: Apply concept to new, unseen problem",
    "Exercise 2: Find counterexample or breaking case",
    "Exercise 3: Explain to 10-year-old child",
    "Exercise 4: Compare and contrast with related concept"
  ],
  "deepQuestions": [
    "Why was this concept invented? What specific problem?",
    "What core assumptions does this make?",
    "Can you find situations where this breaks or fails?",
    "How would you explain this to expert in completely different field?",
    "What's the non-obvious insight most people miss?"
  ],
  "learningPath": [
    "Day 1: Deep read - understand WHY (not just WHAT)",
    "Day 3: Apply to 3-4 different real contexts",
    "Day 7: Teach concept to someone else in detail",
    "Day 15: Find advanced applications + edge cases",
    "Day 30: Connect to 5+ related concepts, see the patterns"
  ],
  "keyInsights": [
    "Critical insight 1: The thing that changes how you see everything",
    "Insight 2: The pattern connecting all these ideas",
    "Insight 3: The mindset shift needed for mastery"
  ]
}`;

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      summary: { type: 'STRING' },
      concept: { type: 'STRING' },
      prerequisites: { type: 'STRING' },
      mentalModel: { type: 'STRING' },
      analogy: { type: 'STRING' },
      deepExamples: { type: 'ARRAY', items: { type: 'STRING' } },
      stepByStep: { type: 'ARRAY', items: { type: 'STRING' } },
      misconceptions: { type: 'ARRAY', items: { type: 'STRING' } },
      criticalThinking: { type: 'ARRAY', items: { type: 'STRING' } },
      realWorldApps: { type: 'ARRAY', items: { type: 'STRING' } },
      advancedConcepts: { type: 'ARRAY', items: { type: 'STRING' } },
      exercises: { type: 'ARRAY', items: { type: 'STRING' } },
      deepQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
      learningPath: { type: 'ARRAY', items: { type: 'STRING' } },
      keyInsights: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: [
      'summary', 'concept', 'prerequisites', 'mentalModel', 'analogy',
      'deepExamples', 'stepByStep', 'misconceptions', 'criticalThinking',
      'realWorldApps', 'advancedConcepts', 'exercises', 'deepQuestions',
      'learningPath', 'keyInsights',
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
          maxOutputTokens: 8000, // Increased for deep content
          temperature: 0.8, // Slightly higher for more nuanced thinking
        },
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    console.error('Gemini API error:', response.status, errBody);
    throw new Error(`Gemini API error ${response.status}`);
  }

  const data = await response.json();
  const finishReason = data?.candidates?.[0]?.finishReason;
  
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('Response too long — try simpler topic');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');

  const parsed = JSON.parse(text.trim());
  return { topic, ...parsed };
}

export default function DeepNotes({ videoTitle, videoDescription }: { videoTitle?: string; videoDescription?: string }) {
  const [topic, setTopic] = useState(videoTitle || '');
  const [notes, setNotes] = useState<DeepNotesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('summary');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');

    try {
      const context = videoDescription ? `Title: ${videoTitle}\nDescription: ${videoDescription}` : '';
      const deepNotes = await generateDeepNotes(topic, context);
      setNotes(deepNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generating notes');
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { id: 'summary', label: '📋 Summary', key: 'summary' },
    { id: 'concept', label: '💡 Concept', key: 'concept' },
    { id: 'prereq', label: '🎓 Prerequisites', key: 'prerequisites' },
    { id: 'mental', label: '🧠 Mental Model', key: 'mentalModel' },
    { id: 'analogy', label: '🌍 Analogy', key: 'analogy' },
    { id: 'examples', label: '📌 Deep Examples', key: 'deepExamples' },
    { id: 'steps', label: '🔀 Step-by-Step', key: 'stepByStep' },
    { id: 'misconceptions', label: '⚠️ Misconceptions', key: 'misconceptions' },
    { id: 'thinking', label: '❓ Critical Thinking', key: 'criticalThinking' },
    { id: 'realworld', label: '🌐 Real-World Apps', key: 'realWorldApps' },
    { id: 'advanced', label: '🚀 Advanced', key: 'advancedConcepts' },
    { id: 'exercises', label: '✏️ Exercises', key: 'exercises' },
    { id: 'questions', label: '❔ Deep Questions', key: 'deepQuestions' },
    { id: 'path', label: '📅 Learning Path', key: 'learningPath' },
    { id: 'insights', label: '⭐ Key Insights', key: 'keyInsights' },
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
          <li key={i} className="text-white/80 leading-relaxed">
            • {item}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold mb-2">📚 Deep Learning Notes</h1>
        <p className="text-white/60">Detailed, comprehensive notes for true mastery</p>
      </motion.div>

      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="Topic for deep learning..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 placeholder-white/40 focus:outline-none focus:border-purple-500/50"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl font-semibold transition"
          >
            {loading ? '⏳' : 'Deep Dive'}
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
          <p className="text-lg mb-2">Enter a topic for comprehensive, deep learning notes</p>
          <p className="text-sm">Goes beyond basics - covers WHY, HOW, and WHERE</p>
        </div>
      )}
    </div>
  );
}