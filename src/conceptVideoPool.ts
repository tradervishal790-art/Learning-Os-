import type { Topic } from './types';
import type { AnalyzedVideo, TeachingDimensions } from './PlaylistBuilder';

// ============================================================
// conceptVideoPool.ts
//
// Builds the small candidate pool (Top 5-10) of pre-analyzed videos
// for a single roadmap concept/topic. Supports multi-query YouTube
// search via expandedQueries[] — when Dashboard.tsx sends Gemini-derived
// smart queries, we hit YouTube multiple times and merge-dedupe results
// to get a richer, more personalized pool than a single literal query.
//
// Caches both YouTube search results (per-query-set) and Gemini teaching-
// style analysis (per-video) in localStorage. Repeat visits cost 0 API calls.
// ============================================================

const SEARCH_CACHE_KEY = 'learning_os_topic_video_pool_cache';
const ANALYSIS_CACHE_KEY = 'learning_os_video_analysis_cache';
const CANDIDATE_POOL_SIZE = 8;

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
    // Storage full/unavailable - cache is best-effort.
  }
}

/**
 * Cleans a topic title for fallback search — strips generic filler like
 * "class 12", "chapter 1", "unit 2" so YouTube gets something queryable
 * (used only when no Gemini-expanded queries are available).
 */
function cleanTitleForSearch(title: string): string {
  return title
    .replace(/\bclass\s*\d+\w*\b/gi, '')
    .replace(/\bchapter\s*\d+\w*\b/gi, '')
    .replace(/\bunit\s*\d+\w*\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds fallback YouTube queries when no Gemini-expanded queries exist.
 * Returns 1-3 cleaned queries with helpful context suffixes.
 */
function buildFallbackQueries(topic: Topic): string[] {
  const cleaned = cleanTitleForSearch(topic.title);
  const keywords = topic.topicKeywords?.slice(0, 2).filter((k) => k.length > 2) ?? [];

  const queries: string[] = [];
  if (cleaned) queries.push(cleaned);
  if (keywords.length > 0) queries.push(`${cleaned} ${keywords.join(' ')}`.trim());
  queries.push(`${cleaned} tutorial for students explanation`.trim());

  return queries.filter((q, i, arr) => q.length > 2 && arr.indexOf(q) === i).slice(0, 3);
}

/** Step 1: get Top N candidate videos for this topic. Multi-query when expandedQueries provided. */
async function getCandidateVideos(
  topic: Topic,
  expandedQueries?: string[]
): Promise<CandidateMeta[]> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YouTube API key missing — .env.local mein VITE_YOUTUBE_API_KEY add karo.');
  }

  // Decide which queries to use
  const queries = expandedQueries && expandedQueries.length > 0
    ? expandedQueries.filter((q) => q.trim().length > 2)
    : buildFallbackQueries(topic);

  if (queries.length === 0) queries.push(topic.title);

  // Cache key: hash the joined queries so different query-sets get separate cache
  const cacheKey = `pool_${topic.id}__${queries.join('|').toLowerCase().slice(0, 120)}`;

  const cache = readCache<CachedTopicPool>(SEARCH_CACHE_KEY);
  const cached = cache[cacheKey];
  if (cached && cached.candidates.length > 0) return cached.candidates;

  // Multi-query search — split YouTube quota across queries, merge + dedupe
  const seen = new Set<string>();
  const allCandidates: CandidateMeta[] = [];
  const perQueryLimit = Math.max(3, Math.ceil(CANDIDATE_POOL_SIZE / queries.length));

  for (const query of queries) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${perQueryLimit}&type=video&q=${encodeURIComponent(query)}&key=${apiKey}`
      );
      const data = await res.json();
      if (!res.ok) {
        console.warn(`[conceptVideoPool] YouTube query failed for "${query}": ${data?.error?.message}`);
        continue;
      }
      if (!data.items?.length) continue;

      for (const item of data.items) {
        const videoId = item.id.videoId;
        if (seen.has(videoId)) continue;
        seen.add(videoId);

        allCandidates.push({
          videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
          channel: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
        });

        if (allCandidates.length >= CANDIDATE_POOL_SIZE) break;
      }
      if (allCandidates.length >= CANDIDATE_POOL_SIZE) break;
    } catch (err: any) {
      console.warn(`[conceptVideoPool] fetch failed for "${query}": ${err?.message}`);
      continue;
    }
  }

  if (allCandidates.length === 0) return [];

  // Cache non-empty results — empty might be transient, worth retrying
  cache[cacheKey] = { candidates: allCandidates, cachedAt: new Date().toISOString() };
  writeCache(SEARCH_CACHE_KEY, cache);

  return allCandidates;
}

/** Step 2: analyze one video's teaching style — cached per video, reused across every topic. */
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
    if (!res.ok) {
      console.warn(`[conceptVideoPool] skipped ${videoId}: ${data?.error ?? 'analyze-video error'}`);
      return null;
    }

    cache[videoId] = { profile: data.profile as GeminiProfile, cachedAt: new Date().toISOString() };
    writeCache(ANALYSIS_CACHE_KEY, cache);
    return data.profile as GeminiProfile;
  } catch (err: any) {
    console.warn(`[conceptVideoPool] skipped ${videoId}: ${err?.message ?? err}`);
    return null;
  }
}

/**
 * Main entry point: given a roadmap Topic (or adhoc custom topic), returns
 * ready-to-rank AnalyzedVideo[] pool. Accepts optional expandedQueries[]
 * — when provided, YouTube is hit multiple times with merged results; when
 * omitted, falls back to cleaned topic.title + keywords.
 *
 * Any candidate whose analysis fails (no captions, Gemini error, etc.) is
 * silently dropped rather than failing the whole request.
 */
export async function buildCandidatePoolForConcept(
  topic: Topic,
  expandedQueries?: string[]
): Promise<AnalyzedVideo[]> {
  const candidates = await getCandidateVideos(topic, expandedQueries);
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

  const pool = analyzed.filter((v): v is AnalyzedVideo => v !== null);

  if (pool.length === 0 && candidates.length > 0) {
    console.warn(
      `[conceptVideoPool] YouTube ne ${candidates.length} videos diye "${topic.title}" ke liye, lekin sabka analysis fail ho gaya (likely: no captions). Check earlier warnings.`
    );
  }

  return pool;
}
