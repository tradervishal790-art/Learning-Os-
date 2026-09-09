/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import HintBubble from './HintBubble';
import { getUserLanguage } from './languagePreference';

// Lightweight markdown renderer for myNotes (## headings, - bullets,
// **bold**, blank-line paragraph breaks) — no react-markdown dependency
// needed for this small a subset. Renders **bold** inline within any line.
function renderInlineBold(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

function renderMyNotesMarkdown(raw: string) {
  // Defense-in-depth: if the model ever emits the literal two characters
  // "\" + "n" as visible text instead of an actual newline (the exact bug
  // seen in production), normalize it here rather than trusting the prompt
  // instruction alone. Doesn't touch real newline characters — only the
  // literal backslash-n sequence.
  const normalized = raw.replace(/\\n/g, '\n');
  const lines = normalized.split('\n');
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} style={{ height: '0.6em' }} />;
    // Defense-in-depth: the prompt tells the model never to use markdown
    // headers, but if one slips through anyway, render it as a bold
    // heading instead of showing raw "###" characters to the user.
    const headingMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      return (
        <div key={i} style={{ fontWeight: 700, fontSize: '1.15em', marginTop: '0.5em' }}>
          {renderInlineBold(headingMatch[1], `h${i}`)}
        </div>
      );
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <div key={i} style={{ marginLeft: '1.2em' }}>
          • {renderInlineBold(trimmed.slice(2), `b${i}`)}
        </div>
      );
    }
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      return (
        <div key={i} style={{ marginLeft: '1.2em' }}>
          {numberedMatch[1]}. {renderInlineBold(numberedMatch[2], `n${i}`)}
        </div>
      );
    }
    if (/^(Q:|Note:)/.test(trimmed)) {
      return (
        <div key={i} style={{ fontStyle: 'italic', opacity: 0.85 }}>
          {renderInlineBold(trimmed, `n${i}`)}
        </div>
      );
    }
    return <div key={i}>{renderInlineBold(trimmed, `p${i}`)}</div>;
  });
}

// Standalone "Notes" tab session (Dashboard renders <Notes /> with no
// videoTitle) — persisted to localStorage so it survives switching tabs
// AND closing/reopening the site, not just staying on the page.
// v2: schema/tabs changed (myNotes replaced prerequisites, Learning Path
// tab removed) — bumped so a stale pre-fix session (old notes shape and/or
// an activeSection id that no longer exists) doesn't get restored and
// crash the app again. Old `learning_os_notes_state` is simply orphaned.
const NOTES_STATE_STORAGE_KEY = 'learning_os_notes_state_v2';

// Per-topic cache for topic-based "Deep Dive" generations, same idea as
// the existing per-video `deepnotes_v3_${videoId}` cache below — keyed by
// topic text so re-visiting the same topic (or the same video's title,
// when embedded inside VideoIntel) loads instantly instead of re-generating.
//
// v2: schema went from 15 fields to 10 (merged concept/mentalModel/analogy
// into coreConcept, and exercises/criticalThinking/deepQuestions into
// practice) — bumped so old v1-shaped cached notes don't get loaded into
// the new UI and render broken/missing sections. Old `deepnotes_topic_*` /
// `deepnotes_v3_${videoId}` entries are simply orphaned, not migrated.
// v3: dropped `prerequisites`, added `myNotes` (transcript-grounded
// handwritten-style notes) — bumped again so old v2-shaped cached notes
// (missing myNotes) don't get loaded into the new UI and crash on render.
// Old `deepnotes_v2_*` entries are simply orphaned, not migrated.
function topicCacheKey(topic: string): string {
  return `deepnotes_v3_topic_${topic.trim().toLowerCase()}`;
}

interface DeepNotesData {
  topic: string;
  notesSource?: 'transcript' | 'metadata' | 'topic-only';
  summary: string;
  // Human-style handwritten-feel notes generated straight from the video
  // transcript (see api/generate-notes.ts) — the actual "notes on what
  // this video said", not an AI-style summary.
  myNotes: string;
  coreConcept: string;
  workedExamples: string[];
  misconceptions: string[];
  realWorldApps: string[];
  advancedConcepts: string[];
  practice: string[];
  // Still generated server-side and cached here — no longer shown as its
  // own tab, Revision.tsx now pulls the matching day's line straight from
  // this cache (see revisionData.ts's getTaskForTopic).
  learningPath: string[];
  keyInsights: string[];
}

// Deep Notes generation now happens server-side (api/generate-notes.ts) —
// the full prompt, schema, AND the Gemini key used to live here in the
// browser with `import.meta.env.VITE_GEMINI_API_KEY` in the fetch URL,
// exposed in the shipped bundle. Client now just sends topic +
// videoContext (+ videoId, when known, so the server can ground notes in
// the real transcript instead of generic title-based generation) and
// gets the parsed notes object back.
async function generateDeepNotes(topic: string, videoContext?: string, videoId?: string): Promise<DeepNotesData> {
  const response = await fetch('/api/generate-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, videoContext, videoId, language: getUserLanguage() }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('Generate notes API error:', response.status, data);
    throw new Error(data?.error || `Notes generation failed (${response.status})`);
  }

  return data as DeepNotesData;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchVideoMeta(videoId: string): Promise<{ title: string; description: string }> {
  const res = await fetch(`/api/youtube-video?id=${encodeURIComponent(videoId)}`);
  if (!res.ok) throw new Error('YouTube meta fetch failed');
  const data = await res.json();
  if (!data?.title) throw new Error('Video not found');
  return { title: data.title, description: data.description || '' };
}

export default function Notes({ videoTitle, videoDescription, videoId }: { videoTitle?: string; videoDescription?: string; videoId?: string }) {
  const [topic, setTopic] = useState(videoTitle || '');
  const [notes, setNotes] = useState<DeepNotesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('summary');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);

  // Restore on mount. Two modes:
  // - Embedded with a videoTitle (called from VideoIntel's "Deep Notes"):
  //   only load that specific topic's cache, so we never show a different
  //   video's notes here.
  // - Standalone (Dashboard's "Notes" tab, no videoTitle): restore the
  //   last full session — topic, notes, active section, video link — so
  //   it's still there after switching tabs or closing the site.
  useEffect(() => {
    try {
      if (videoTitle) {
        const cached = localStorage.getItem(topicCacheKey(videoTitle));
        if (cached) setNotes(JSON.parse(cached));
        return;
      }
      const saved = localStorage.getItem(NOTES_STATE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          topic: string;
          notes: DeepNotesData | null;
          activeSection: string;
          youtubeUrl: string;
          currentVideoId: string | null;
        };
        if (parsed.topic) setTopic(parsed.topic);
        if (parsed.notes) setNotes(parsed.notes);
        if (parsed.activeSection) setActiveSection(parsed.activeSection);
        if (parsed.youtubeUrl) setYoutubeUrl(parsed.youtubeUrl);
        if (parsed.currentVideoId) setCurrentVideoId(parsed.currentVideoId);
      }
    } catch {
      // Corrupted storage — ignore and start fresh.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the standalone session synced to localStorage so it survives
  // tab switches and closing the site. Skipped in embedded (videoTitle)
  // mode, which caches per-topic instead — see handleGenerate/handleGenerateFromVideo.
  useEffect(() => {
    if (videoTitle) return;
    if (!topic && !notes) return;
    try {
      localStorage.setItem(
        NOTES_STATE_STORAGE_KEY,
        JSON.stringify({ topic, notes, activeSection, youtubeUrl, currentVideoId })
      );
    } catch {
      // Storage full/unavailable — non-critical, just won't persist.
    }
  }, [videoTitle, topic, notes, activeSection, youtubeUrl, currentVideoId]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');

    try {
      const cacheKey = topicCacheKey(topic);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setNotes(JSON.parse(cached));
        setLoading(false);
        return;
      }

      const context = videoDescription ? `Title: ${videoTitle}\nDescription: ${videoDescription}` : '';
      const deepNotes = await generateDeepNotes(topic, context, videoId);
      if (videoId) setCurrentVideoId(videoId);
      localStorage.setItem(cacheKey, JSON.stringify(deepNotes));
      setNotes(deepNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generating notes');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromVideo = async () => {
    const videoId = extractVideoId(youtubeUrl.trim());
    if (!videoId) {
      setError('Invalid YouTube URL');
      return;
    }

    setLoading(true);
    setError('');
    setCurrentVideoId(videoId);

    try {
      const cached = localStorage.getItem(`deepnotes_v3_${videoId}`);
      if (cached) {
        setNotes(JSON.parse(cached));
        setLoading(false);
        return;
      }

      const meta = await fetchVideoMeta(videoId);
      const context = `Title: ${meta.title}\nDescription: ${meta.description.slice(0, 500)}`;
      const deepNotes = await generateDeepNotes(meta.title, context, videoId);

      localStorage.setItem(`deepnotes_v3_${videoId}`, JSON.stringify(deepNotes));
      setNotes(deepNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generating notes from video');
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { id: 'summary', label: 'Summary', key: 'summary' },
    { id: 'mynotes', label: 'My Notes', key: 'myNotes' },
    { id: 'coreConcept', label: 'Core Concept', key: 'coreConcept' },
    { id: 'workedExamples', label: 'Worked Examples', key: 'workedExamples' },
    { id: 'misconceptions', label: 'Misconceptions', key: 'misconceptions' },
    { id: 'realworld', label: 'Real World Application', key: 'realWorldApps' },
    { id: 'advanced', label: 'Advanced', key: 'advancedConcepts' },
    { id: 'practice', label: 'Practice', key: 'practice' },
    { id: 'insights', label: 'Key Insights', key: 'keyInsights' },
  ];

  const renderContent = () => {
    if (!notes) return null;
    const section = sections.find((s) => s.id === activeSection) ?? sections[0];
    const data = (notes as any)[section.key];

    if (data === undefined || data === null) {
      return (
        <p className="text-gray-400 dark:text-white/40 text-sm">
          Yeh section is note ke liye available nahi hai — "Deep Dive" ya "From Video" dobara chala ke fresh notes banao.
        </p>
      );
    }

    if (typeof data === 'string') {
      if (activeSection === 'mynotes') {
        return (
          <div
            className="text-gray-800 dark:text-white/90"
            style={{ fontSize: '1rem', lineHeight: '1.9rem' }}
          >
            {renderMyNotesMarkdown(data)}
          </div>
        );
      }
      return <p className="text-gray-700 dark:text-white/80 leading-relaxed whitespace-pre-wrap">{data}</p>;
    }
    if (!Array.isArray(data)) return null;
    return (
      <ul className="space-y-3">
        {data.map((item: string, i: number) => (
          <li key={i} className="text-gray-700 dark:text-white/80 leading-relaxed">
            • {item}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Deep Learning Notes</h1>
        <p className="text-gray-500 dark:text-white/60">Detailed, comprehensive notes for true mastery</p>
      </motion.div>

      <div className="max-w-4xl mx-auto">
        <HintBubble id="notes" text="Auto-generated notes from the video — edit anything, they're yours." />
      </div>

      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="Topic for deep learning..."
            className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="px-6 py-3 bg-black text-white dark:bg-white dark:text-black disabled:opacity-40 rounded-xl font-semibold transition"
          >
            {loading ? '...' : 'Deep Dive'}
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateFromVideo()}
            placeholder="Link"
            className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white"
          />
          <button
            onClick={handleGenerateFromVideo}
            disabled={loading || !youtubeUrl.trim()}
            className="px-6 py-3 border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/20 disabled:opacity-40 rounded-xl font-semibold transition"
          >
            {loading ? '...' : 'From Video'}
          </button>
        </div>

        {error && <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-2">{error}</p>}
      </div>

      {notes && (
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                  activeSection === s.id
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10'
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
            className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-8"
          >
            {currentVideoId && (
              <a
                href={`https://youtube.com/watch?v=${currentVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline mb-3 inline-block text-gray-500 dark:text-white/60 hover:text-black dark:hover:text-white"
              >
                🎥 Source video dekho
              </a>
            )}
            {notes.notesSource === 'transcript' && (
              <p className="text-xs text-gray-400 dark:text-white/40 mb-3">✓ Video transcript se banaye gaye notes</p>
            )}
            {notes.notesSource === 'metadata' && (
              <p className="text-xs text-gray-400 dark:text-white/40 mb-3">⚠ Transcript available nahi thi — sirf title/description se banaye gaye</p>
            )}
            <h2 className="text-2xl font-bold mb-4">
              {sections.find((s) => s.id === activeSection)?.label} — {notes.topic}
            </h2>
            {renderContent()}
          </motion.div>
        </div>
      )}

      {!notes && !loading && (
        <div className="max-w-2xl mx-auto text-center py-16 text-gray-400 dark:text-white/60">
          <p className="text-lg mb-2">Enter a topic for comprehensive, deep learning notes</p>
          <p className="text-sm">Goes beyond basics - covers WHY, HOW, and WHERE</p>
        </div>
      )}
    </div>
  );
}