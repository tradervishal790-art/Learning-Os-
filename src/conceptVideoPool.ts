import type { Topic } from './types';
import type { AnalyzedVideo, TeachingDimensions } from './PlaylistBuilder';

// ============================================================
// conceptVideoPool.ts
//
// Builds the small candidate pool (Top 5-10) of pre-analyzed videos
// for a single roadmap concept/topic. Caches both the YouTube search
// results (per topic) and the Gemini teaching-style analysis (per
// video) in localStorage, so re-visiting the same topic costs zero
// extra YouTube/Gemini API calls — matches the "minimize YouTube API
// usage" requirement from the playlist logic spec.
//
// Cache is currently unbounded (no TTL). If a topic's video catalog
// needs a manual refresh later, clear its entry from
// learning_os_topic_video_pool_cache in localStorage — no refresh
// function exists yet, kept out of scope for this pass.
// ============================================================

const SEARCH_CACHE_KEY = 'learning_os_topic_video_pool_cache';
const ANALYSIS_CACHE_KEY = 'learning_os_video_analysis_cache';
const CANDIDATE_POOL_SIZE = 8; // Top 5-10 range, per spec

interface CandidateMeta {
  videoId: string;
  title: string;
  thumbnail: string;
  channel: string;
  channelId: string;
}

interface CachedTopicPool {
  candidates: CandidateMeta[];
  cachedAt: string;
}

interface GeminiProfile extends TeachingDimensions {
  primary_style?: string;
  ideal_for?: string;
  avoid_for?: string;
}

interface CachedVideoAnalysis {
  profile: GeminiProfile;
  cachedAt: string;
}

function readCache<T>(key: string): Record<string, T> {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as Record<string, T>) : {};
  } catch {
    return {};
  }
}

function writeCache<T>(key: string, data: Record<string, T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full/unavailable — cache is best-effort, not critical path.
  }
}

/** Builds a YouTube search query from a topic's title + keywords. */
function buildSearchQuery(topic: Topic): string {
  const keywordPart = topic.topicKeywords?.slice(0, 2).join(' ') ?? '';
  return `${topic.title} ${keywordPart}`.trim();
}

/** Step 1: get Top N candidate videos for this topic — cached per topic, so a repeat visit costs 0 YouTube calls. */
async function getCandidateVideos(topic: Topic): Promise<CandidateMeta[]> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YouTube API key missing — .env.local mein VITE_YOUTUBE_API_KEY add karo.');
  }

  const cache = readCache<CachedTopicPool>(SEARCH_CACHE_KEY);
  const cached = cache[topic.id];
  if (cached && cached.candidates.length > 0) {
    return cached.candidates;
  }

  const query = buildSearchQuery(topic);
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${CANDIDATE_POOL_SIZE}&type=video&q=${encodeURIComponent(
      query
    )}&key=${apiKey}`
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || 'YouTube API error');
  }
  if (!data.items?.length) return [];

  const candidates: CandidateMeta[] = data.items.map((item: any) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
    channel: item.snippet.channelTitle,
    channelId: item.snippet.channelId,
  }));

  // Only cache non-empty results — an empty result might be a transient
  // fluke (bad query, API hiccup), worth retrying next visit rather than
  // permanently caching "no videos found" for this topic.
  if (candidates.length > 0) {
    cache[topic.id] = { candidates, cachedAt: new Date().toISOString() };
    writeCache(SEARCH_CACHE_KEY, cache);
  }

  return candidates;
}

/** Step 2: analyze one video's teaching style — cached per video, reused across every topic it appears in. */
async function getAnalyzedProfile(videoId: string): Promise<GeminiProfile | null> {
  const cache = readCache<CachedVideoAnalysis>(ANALYSIS_CACHE_KEY);
  if (cache[videoId]) return cache[videoId].profile;

  try {
    const res = await fetch('/api/analyze-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    });
    const data = await res.json();
    if (!res.ok) return null; // this one candidate is skipped, not fatal for the whole pool

    cache[videoId] = { profile: data.profile as GeminiProfile, cachedAt: new Date().toISOString() };
    writeCache(ANALYSIS_CACHE_KEY, cache);
    return data.profile as GeminiProfile;
  } catch {
    return null;
  }
}

/**
 * Main entry point: given a roadmap Topic, returns a ready-to-rank
 * AnalyzedVideo[] pool (dimensions filled in). Any candidate whose
 * transcript/analysis fails (disabled subtitles, Gemini error, etc.)
 * is silently dropped from the pool rather than failing the whole request.
 */
export async function buildCandidatePoolForConcept(topic: Topic): Promise<AnalyzedVideo[]> {
  const candidates = await getCandidateVideos(topic);
  if (candidates.length === 0) return [];

  const analyzed = await Promise.all(
    candidates.map(async (c): Promise<AnalyzedVideo | null> => {
      const profile = await getAnalyzedProfile(c.videoId);
      if (!profile) return null;

      return {
        videoId: c.videoId,
        title: c.title,
        thumbnail: c.thumbnail,
        channel: c.channel,
        teacherId: c.channelId,
        conceptId: topic.id,
        dimensions: {
          pace: profile.pace,
          theory_vs_practical: profile.theory_vs_practical,
          structure: profile.structure,
          depth: profile.depth,
          language_complexity: profile.language_complexity,
          storytelling: profile.storytelling,
          repetition: profile.repetition,
          prerequisite_assumed: profile.prerequisite_assumed,
        },
        primaryStyle: profile.primary_style,
        idealFor: profile.ideal_for,
        avoidFor: profile.avoid_for,
      };
    })
  );

  return analyzed.filter((v): v is AnalyzedVideo => v !== null);
}