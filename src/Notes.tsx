/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Standalone "Notes" tab session (Dashboard renders <Notes /> with no
// videoTitle) — persisted to localStorage so it survives switching tabs
// AND closing/reopening the site, not just staying on the page.
const NOTES_STATE_STORAGE_KEY = 'learning_os_notes_state';

// Per-topic cache for topic-based "Deep Dive" generations, same idea as
// the existing per-video `deepnotes_v2_${videoId}` cache below — keyed by
// topic text so re-visiting the same topic (or the same video's title,
// when embedded inside VideoIntel) loads instantly instead of re-generating.
//
// v2: schema went from 15 fields to 10 (merged concept/mentalModel/analogy
// into coreConcept, and exercises/criticalThinking/deepQuestions into
// practice) — bumped so old v1-shaped cached notes don't get loaded into
// the new UI and render broken/missing sections. Old `deepnotes_topic_*` /
// `deepnotes_v2_${videoId}` entries are simply orphaned, not migrated.
function topicCacheKey(topic: string): string {
  return `deepnotes_v2_topic_${topic.trim().toLowerCase()}`;
}

interface DeepNotesData {
  topic: string;
  notesSource?: 'transcript' | 'metadata' | 'topic-only';
  summary: string;
  prerequisites: string;
  coreConcept: string;
  workedExamples: string[];
  misconceptions: string[];
  realWorldApps: string[];
  advancedConcepts: string[];
  practice: string[];
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
    body: JSON.stringify({ topic, videoContext, videoId }),
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
      const cached = localStorage.getItem(`deepnotes_v2_${videoId}`);
      if (cached) {
        setNotes(JSON.parse(cached));
        setLoading(false);
        return;
      }

      const meta = await fetchVideoMeta(videoId);
      const context = `Title: ${meta.title}\nDescription: ${meta.description.slice(0, 500)}`;
      const deepNotes = await generateDeepNotes(meta.title, context, videoId);

      localStorage.setItem(`deepnotes_v2_${videoId}`, JSON.stringify(deepNotes));
      setNotes(deepNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generating notes from video');
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { id: 'summary', label: 'Summary', key: 'summary' },
    { id: 'prereq', label: 'Prerequisites', key: 'prerequisites' },
    { id: 'coreConcept', label: 'Core Concept', key: 'coreConcept' },
    { id: 'workedExamples', label: 'Worked Examples', key: 'workedExamples' },
    { id: 'misconceptions', label: 'Misconceptions', key: 'misconceptions' },
    { id: 'realworld', label: 'Real World Application', key: 'realWorldApps' },
    { id: 'advanced', label: 'Advanced', key: 'advancedConcepts' },
    { id: 'practice', label: 'Practice', key: 'practice' },
    { id: 'path', label: 'Learning Path', key: 'learningPath' },
    { id: 'insights', label: 'Key Insights', key: 'keyInsights' },
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
        <h1 className="text-4xl font-bold mb-2">Deep Learning Notes</h1>
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
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 placeholder-white/40 focus:outline-none focus:border-purple-500/50"
          />
          <button
            onClick={handleGenerateFromVideo}
            disabled={loading || !youtubeUrl.trim()}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-xl font-semibold transition"
          >
            {loading ? '...' : 'From Video'}
          </button>
        </div>

        {error && <p className="text-yellow-400 text-sm mt-2">{error}</p>}
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
            {currentVideoId && (
              <a
                href={`https://youtube.com/watch?v=${currentVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:underline mb-3 inline-block"
              >
                🎥 Source video dekho
              </a>
            )}
            {notes.notesSource === 'transcript' && (
              <p className="text-xs text-white/40 mb-3">✓ Video transcript se banaye gaye notes</p>
            )}
            {notes.notesSource === 'metadata' && (
              <p className="text-xs text-white/40 mb-3">⚠ Transcript available nahi thi — sirf title/description se banaye gaye</p>
            )}
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