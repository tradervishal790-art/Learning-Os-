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
//
// IMPORTANT: sends title + description with every /api/analyze-video call.
// analyze-video.ts uses these as a FALLBACK when transcript fetch fails
// (captions disabled / blocked) — without them, videos with no transcript
// get silently dropped and the whole pool can end up empty.
// ============================================================

const SEARCH_CACHE_KEY = 'learning_os_topic_video_pool_cache';
const ANALYSIS_CACHE_KEY = 'learning_os_video_analysis_cache';
const CANDIDATE_POOL_SIZE = 8;

interface CandidateMeta {
  videoId: string;
  title: string;
  description: string;
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
  analysisSource?: 'transcript' | 'metadata-fallback';
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
 * Maps the user's onboarding `language` choice to a YouTube Data API
 * `relevanceLanguage` code — biases search results toward that language
 * without hard-filtering (YouTube doesn't guarantee exact language match,
 * but this meaningfully shifts results toward Hindi content for
 * hindi/hinglish learners instead of always surfacing English-first results).
 */
function relevanceLanguageFor(language?: string): string | undefined {
  const normalized = language?.toLowerCase();
  if (normalized === 'hindi' || normalized === 'hinglish') return 'hi';
  if (normalized === 'english') return 'en';
  return undefined; // 'any' or unset — don't bias
}

/**
 * Appends a language hint to a fallback query so even the un-personalized
 * path (no Gemini-expanded queries) still searches for content in the
 * user's chosen language, instead of defaulting to whatever language
 * happens to rank highest on YouTube for that topic.
 */
function appendLanguageHint(query: string, language?: string): string {
  const normalized = language?.toLowerCase();
  if (normalized === 'hindi') return `${query} hindi mein explanation`;
  if (normalized === 'hinglish') return `${query} hindi medium`;
  return query;
}

/**
 * Builds fallback YouTube queries when no Gemini-expanded queries exist.
 * Returns 1-3 cleaned queries with helpful context suffixes.
 */
function buildFallbackQueries(topic: Topic, language?: string): string[] {
  const cleaned = cleanTitleForSearch(topic.title);
  const keywords = topic.topicKeywords?.slice(0, 2).filter((k) => k.length > 2) ?? [];

  const queries: string[] = [];
  if (cleaned) queries.push(appendLanguageHint(cleaned, language));
  if (keywords.length > 0) queries.push(appendLanguageHint(`${cleaned} ${keywords.join(' ')}`.trim(), language));
  queries.push(appendLanguageHint(`${cleaned} tutorial for students explanation`.trim(), language));

  return queries.filter((q, i, arr) => q.length > 2 && arr.indexOf(q) === i).slice(0, 3);
}

/** Step 1: get Top N candidate videos for this topic. Multi-query when expandedQueries provided. */
async function getCandidateVideos(
  topic: Topic,
  expandedQueries?: string[],
  language?: string
): Promise<CandidateMeta[]> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YouTube API key missing — .env.local mein VITE_YOUTUBE_API_KEY add karo.');
  }

  // Decide which queries to use
  const queries = expandedQueries && expandedQueries.length > 0
    ? expandedQueries.filter((q) => q.trim().length > 2)
    : buildFallbackQueries(topic, language);

  if (queries.length === 0) queries.push(topic.title);

  const relevanceLanguage = relevanceLanguageFor(language);

  // Cache key: hash the joined queries + language so different query-sets
  // AND different language preferences get separate cache entries — same
  // topic in English vs Hindi should never share a cached result.
  const cacheKey = `pool_${topic.id}__${relevanceLanguage ?? 'any'}__${queries.join('|').toLowerCase().slice(0, 120)}`;

  const cache = readCache<CachedTopicPool>(SEARCH_CACHE_KEY);
  const cached = cache[cacheKey];
  if (cached && cached.candidates.length > 0) return cached.candidates;

  // Multi-query search — split YouTube quota across queries, merge + dedupe
  const seen = new Set<string>();
  const allCandidates: CandidateMeta[] = [];
  const perQueryLimit = Math.max(3, Math.ceil(CANDIDATE_POOL_SIZE / queries.length));

  for (const query of queries) {
    try {
      const langParam = relevanceLanguage ? `&relevanceLanguage=${relevanceLanguage}` : '';
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${perQueryLimit}&type=video&q=${encodeURIComponent(query)}${langParam}&key=${apiKey}`
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
          description: item.snippet.description ?? '',
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

/**
 * Step 2: analyze one video's teaching style — cached per video, reused
 * across every topic. Sends title + description so analyze-video.ts can
 * fall back to metadata-based scoring if the transcript is unavailable.
 */
async function getAnalyzedProfile(candidate: CandidateMeta): Promise<GeminiProfile | null> {
  const cache = readCache<CachedVideoAnalysis>(ANALYSIS_CACHE_KEY);
  if (cache[candidate.videoId]) return cache[candidate.videoId].profile;

  try {
    const res = await fetch('/api/analyze-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: candidate.videoId,
        title: candidate.title,
        description: candidate.description,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn(`[conceptVideoPool] skipped ${candidate.videoId}: ${data?.error ?? 'analyze-video error'}`);
      return null;
    }

    cache[candidate.videoId] = {
      profile: data.profile as GeminiProfile,
      analysisSource: data.analysisSource,
      cachedAt: new Date().toISOString(),
    };
    writeCache(ANALYSIS_CACHE_KEY, cache);

    if (data.analysisSource === 'metadata-fallback') {
      console.info(`[conceptVideoPool] ${candidate.videoId} analyzed via metadata fallback (no transcript available).`);
    }

    return data.profile as GeminiProfile;
  } catch (err: any) {
    console.warn(`[conceptVideoPool] skipped ${candidate.videoId}: ${err?.message ?? err}`);
    return null;
  }
}

/**
 * Main entry point: given a roadmap Topic (or adhoc custom topic), returns
 * ready-to-rank AnalyzedVideo[] pool. Accepts optional expandedQueries[]
 * — when provided, YouTube is hit multiple times with merged results; when
 * omitted, falls back to cleaned topic.title + keywords.
 *
 * @param language  user's onboarding language choice ('hindi' | 'hinglish' |
 *                  'english' | 'any'). Biases YouTube search toward that
 *                  language via relevanceLanguage, and — when no
 *                  expandedQueries are given — adds a language hint to the
 *                  fallback queries too. Omit for no language bias.
 *
 * A candidate is only dropped if BOTH the transcript path AND the
 * metadata-fallback path fail server-side (see analyze-video.ts) — a
 * missing transcript alone no longer empties the whole pool.
 */
export async function buildCandidatePoolForConcept(
  topic: Topic,
  expandedQueries?: string[],
  language?: string
): Promise<AnalyzedVideo[]> {
  const candidates = await getCandidateVideos(topic, expandedQueries, language);
  if (candidates.length === 0) return [];

  const analyzed = await Promise.all(
    candidates.map(async (c): Promise<AnalyzedVideo | null> => {
      const profile = await getAnalyzedProfile(c);
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
      `[conceptVideoPool] YouTube ne ${candidates.length} videos diye "${topic.title}" ke liye, lekin sabka analysis fail ho gaya (both transcript and metadata-fallback failed for every candidate). Check earlier warnings.`
    );
  }

  return pool;
}