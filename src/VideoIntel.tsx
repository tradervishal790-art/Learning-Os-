import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Play, CheckCircle, ThumbsUp, ThumbsDown, SkipForward } from 'lucide-react';
import type { Video, VideoWatchData, WatchHistoryEntry, EngagementSession, FeedbackValue, Topic } from './types';
import { withComputedSignal } from './engagementScoring';
import { upsertEngagementSession } from './engagementStore';
import { getRoadmapData, saveRoadmapData } from './roadmapData';
import Notes from './Notes';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const WATCH_HISTORY_STORAGE_KEY = 'video_watch_history';
const SEEK_FORWARD_THRESHOLD_SECONDS = 3;
// Persists searchQuery + results + selectedVideo across tab switches AND
// across full site visits — localStorage (not sessionStorage), because
// users expect their last search/video to still be there after closing
// the browser and coming back later, not just within the same tab session.
// Fixes: VideoIntel is conditionally mounted/unmounted by Dashboard's
// activePage switch (and sessionStorage was wiped on tab/browser close),
// so the same search had to be redone every time the user left and
// returned to the "video" tab, or left the site entirely.
const SEARCH_STATE_STORAGE_KEY = 'video_intel_search_state';

interface PersistedSearchState {
  searchQuery: string;
  videos: Video[];
  selectedVideoId: string | null;
  nextPageToken: string | null;
}

// Below this watch percentage, we don't treat the session as meaningful
// engagement with a topic at all — no status change happens.
const LOCKED_TO_LEARNING_THRESHOLD = 70;
// Above this, a topic already in progress is considered strongly engaged
// enough to mark as completed.
const LEARNING_TO_COMPLETED_THRESHOLD = 85;

/**
 * Simple, rule-based (no AI call) match between a watched video's title
 * and a roadmap topic's `topicKeywords`, updating locked/learning topics
 * in the saved roadmap based on watch percentage.
 */
function updateRoadmapFromWatch(goalId: string | undefined, videoTitle: string, watchPercentage: number) {
  if (watchPercentage < LOCKED_TO_LEARNING_THRESHOLD) return;

  try {
    const roadmap = getRoadmapData(goalId);
    if (!roadmap?.children?.length) return;

    const normalizedTitle = videoTitle.toLowerCase();
    let changed = false;

    // Index of a topic that gets marked 'completed' in this pass, if any —
    // used below to auto-unlock the next 'locked' topic in sequence.
    let justCompletedIndex = -1;

    const updatedChildren = roadmap.children.map((topic, index) => {
      if (topic.status !== 'locked' && topic.status !== 'learning') return topic;

      const keywords = topic.topicKeywords ?? [];
      if (keywords.length === 0) return topic;

      const isMatch = keywords.some((kw) => normalizedTitle.includes(kw.toLowerCase()));
      if (!isMatch) return topic;

      if (topic.status === 'locked') {
        changed = true;
        return { ...topic, status: 'learning' as const, learningStartedAt: new Date().toISOString() };
      }

      if (topic.status === 'learning' && watchPercentage >= LEARNING_TO_COMPLETED_THRESHOLD) {
        changed = true;
        justCompletedIndex = index;
        return { ...topic, status: 'completed' as const };
      }

      return topic;
    });

    // Sequential unlock: as soon as a topic is completed, open up the next
    // still-locked topic so the user isn't stuck unable to open it to find
    // a video for it (locked topics can't be opened from the roadmap UI).
    if (justCompletedIndex !== -1) {
      for (let i = justCompletedIndex + 1; i < updatedChildren.length; i++) {
        if (updatedChildren[i].status === 'locked') {
          updatedChildren[i] = {
            ...updatedChildren[i],
            status: 'learning' as const,
            learningStartedAt: new Date().toISOString(),
          };
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      const updatedRoadmap: Topic = { ...roadmap, children: updatedChildren };
      saveRoadmapData(goalId, updatedRoadmap);
    }
  } catch {
    // Corrupted roadmap data in storage — skip silently, don't break video tracking.
  }
}

/**
 * Read-only lookup: given a watched video's title, find which roadmap
 * Topic.id it matches (via the same topicKeywords used by
 * updateRoadmapFromWatch), regardless of that topic's current status.
 * Used to stamp EngagementSession.conceptId so PlaylistBuilder can do
 * concept-based reranking. Returns undefined if no roadmap or no match —
 * never throws, never mutates storage.
 */
function findMatchingTopicId(goalId: string | undefined, videoTitle: string): string | undefined {
  try {
    const roadmap = getRoadmapData(goalId);
    if (!roadmap?.children?.length) return undefined;

    const normalizedTitle = videoTitle.toLowerCase();
    for (const topic of roadmap.children) {
      const keywords = topic.topicKeywords ?? [];
      if (keywords.length === 0) continue;
      if (keywords.some((kw) => normalizedTitle.includes(kw.toLowerCase()))) {
        return topic.id;
      }
    }
  } catch {
    // Corrupted roadmap data — no concept match, not fatal.
  }
  return undefined;
}

function createEmptySession(video: Video, goalId: string | undefined): EngagementSession {
  return {
    id: `${video.id}-${Date.now()}`,
    videoId: video.id,
    userId: 'guest',
    teacherId: video.channelId,
    conceptId: findMatchingTopicId(goalId, video.title),
    totalDuration: 0,
    watchedSeconds: 0,
    watchPercentage: 0,
    pauseCount: 0,
    seekForwardCount: 0,
    replayCount: 0,
    completed: false,
    timeToFirstPause: null,
    feedback: null,
    signal: 'neutral',
    sessionTimestamp: new Date().toISOString(),
  };
}

interface VideoIntelProps {
  /** Ranked primary + fallback videos handed off from Roadmap's "Watch videos"
   *  button (via PlaylistBuilder). When present, auto-loads primary into the player and
   *  populates the left-panel list with primary + fallbacks. */
  initialPlaylist?: { primary: Video; fallbacks: Video[] } | null;
  /** Which goal's roadmap watch-progress (topic status, concept matching)
   *  should be attributed to — the currently open goal tab on Roadmap. */
  activeGoalId?: string | null;
}

export default function VideoIntel({ initialPlaylist, activeGoalId }: VideoIntelProps = {}) {
  // YouTube search now goes through /api/youtube-search — the key
  // used to be `import.meta.env.VITE_YOUTUBE_API_KEY` appended directly
  // to the googleapis.com URL from the browser, which bakes it into the
  // client bundle. It now lives server-side only.
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDeepNotes, setShowDeepNotes] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<FeedbackValue>(null);
  const [watchStats, setWatchStats] = useState({
    watchedDuration: 0,
    totalDuration: 0,
    watchPercentage: 0,
    pauseCount: 0,
    rewindCount: 0,
    playbackSpeed: 1,
  });

  // YouTube's pagination token from the last search for the CURRENT query —
  // lets us fetch the next fresh batch of results instead of re-fetching
  // the same top results (see fetchMoreVideos()). Reset to null whenever a
  // new manual search runs (searchVideos()).
  const nextPageTokenRef = useRef<string | null>(null);

  const playerRef = useRef<any>(null);
  const watchDataRef = useRef<VideoWatchData>({
    videoId: '',
    title: '',
    watchedDuration: 0,
    totalDuration: 0,
    watchPercentage: 0,
    pauseCount: 0,
    rewindCount: 0,
    playbackSpeed: 1,
  });

  const sessionRef = useRef<EngagementSession | null>(null);
  const playStartTimeRef = useRef<number | null>(null);
  const hasEndedRef = useRef(false);
  const lastTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!window.YT || !window.YT.Player) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(script);
    }

    try {
      const saved = localStorage.getItem(WATCH_HISTORY_STORAGE_KEY);
      if (saved) setWatchHistory(JSON.parse(saved));
    } catch {
      // Corrupted storage — ignore and start fresh.
    }

    // Restore last search (query + results + selected video) so switching
    // tabs and coming back doesn't force a re-search. A roadmap-handoff
    // playlist (initialPlaylist) always takes priority — that effect below
    // runs after this one and will overwrite this restore when present.
    try {
      const savedSearch = localStorage.getItem(SEARCH_STATE_STORAGE_KEY);
      if (savedSearch) {
        const parsed = JSON.parse(savedSearch) as PersistedSearchState;
        if (parsed.searchQuery) setSearchQuery(parsed.searchQuery);
        if (Array.isArray(parsed.videos) && parsed.videos.length > 0) {
          setVideos(parsed.videos);
          const restoredSelected = parsed.videos.find((v) => v.id === parsed.selectedVideoId) ?? null;
          if (restoredSelected) setSelectedVideo(restoredSelected);
        }
        nextPageTokenRef.current = parsed.nextPageToken ?? null;
      }
    } catch {
      // Corrupted/old-shape storage — ignore and start fresh.
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Keep localStorage in sync with the current search so it survives both
  // unmount (tab switch) and closing/reopening the site. Skipped while
  // nothing has been searched yet, so we don't overwrite a real saved
  // search with an empty initial state.
  useEffect(() => {
    if (!searchQuery && videos.length === 0) return;
    try {
      const toSave: PersistedSearchState = {
        searchQuery,
        videos,
        selectedVideoId: selectedVideo?.id ?? null,
        nextPageToken: nextPageTokenRef.current,
      };
      localStorage.setItem(SEARCH_STATE_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // Storage full/unavailable — non-critical, just skip persisting.
    }
  }, [searchQuery, videos, selectedVideo]);

  useEffect(() => {
    return () => {
      finalizeAndSaveSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideo]);

  // Preload a ranked playlist handed off from Roadmap ("Watch videos").
  // Keyed on the primary video's id so a fresh handoff (even for the same topic
  // revisited later) re-triggers, but re-renders of the parent don't loop this.
  useEffect(() => {
    if (!initialPlaylist?.primary) return;
    finalizeAndSaveSession();
    setVideos([initialPlaylist.primary, ...initialPlaylist.fallbacks]);
    setSelectedVideo(initialPlaylist.primary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlaylist?.primary.id]);

  const finalizeAndSaveSession = () => {
    if (!sessionRef.current) return;
    const completeSession = withComputedSignal(sessionRef.current);
    upsertEngagementSession(completeSession);
  };

  useEffect(() => {
    if (!selectedVideo) return;

    intervalRef.current = setInterval(() => {
      if (playerRef.current?.getPlayerState?.() === window.YT?.PlayerState?.PLAYING) {
        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        const speed = watchDataRef.current.playbackSpeed;

        const delta = currentTime - lastTimeRef.current;
        const expectedDelta = speed;

        if (delta < -1) {
          watchDataRef.current.rewindCount += 1;
        } else if (delta > expectedDelta + SEEK_FORWARD_THRESHOLD_SECONDS) {
          if (sessionRef.current) sessionRef.current.seekForwardCount += 1;
        }

        lastTimeRef.current = currentTime;
        watchDataRef.current.watchedDuration = currentTime;
        watchDataRef.current.totalDuration = duration;
        watchDataRef.current.watchPercentage = duration ? (currentTime / duration) * 100 : 0;

        if (sessionRef.current) {
          sessionRef.current.watchedSeconds = currentTime;
          sessionRef.current.totalDuration = duration;
          sessionRef.current.watchPercentage = watchDataRef.current.watchPercentage;
          upsertEngagementSession(withComputedSignal(sessionRef.current));
        }

        setWatchStats({
          watchedDuration: currentTime,
          totalDuration: duration,
          watchPercentage: watchDataRef.current.watchPercentage,
          pauseCount: watchDataRef.current.pauseCount,
          rewindCount: watchDataRef.current.rewindCount,
          playbackSpeed: watchDataRef.current.playbackSpeed,
        });
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedVideo]);

  const onPlayerReady = (event: any) => {
    if (!selectedVideo) return;
    watchDataRef.current = {
      videoId: selectedVideo.id,
      title: selectedVideo.title,
      watchedDuration: 0,
      totalDuration: event.target.getDuration(),
      watchPercentage: 0,
      pauseCount: 0,
      rewindCount: 0,
      playbackSpeed: 1,
    };
    lastTimeRef.current = 0;
    hasEndedRef.current = false;
    playStartTimeRef.current = null;
    sessionRef.current = createEmptySession(selectedVideo, activeGoalId ?? undefined);
    setFeedbackGiven(null);
    upsertEngagementSession(withComputedSignal(sessionRef.current));
  };

  const onPlayerStateChange = (event: any) => {
    const session = sessionRef.current;

    if (event.data === window.YT.PlayerState.PLAYING) {
      if (playStartTimeRef.current === null) {
        playStartTimeRef.current = performance.now();
      }
      if (hasEndedRef.current && session) {
        session.replayCount += 1;
        hasEndedRef.current = false;
        upsertEngagementSession(withComputedSignal(session));
      }
    }

    if (event.data === window.YT.PlayerState.PAUSED) {
      watchDataRef.current.pauseCount += 1;
      if (session) {
        session.pauseCount += 1;
        if (session.timeToFirstPause === null && playStartTimeRef.current !== null) {
          session.timeToFirstPause = Math.round((performance.now() - playStartTimeRef.current) / 1000);
        }
        upsertEngagementSession(withComputedSignal(session));
      }
    }

    if (event.data === window.YT.PlayerState.ENDED) {
      watchDataRef.current.watchPercentage = 100;
      watchDataRef.current.completedAt = new Date();
      hasEndedRef.current = true;
      if (session) {
        session.watchPercentage = 100;
        session.completed = true;
        upsertEngagementSession(withComputedSignal(session));
      }
      saveWatchData(watchDataRef.current);
      // Auto-advance to the next video — same logic as the manual "Next"
      // button (moves within the current batch, or fetches a fresh batch
      // once it's exhausted). If nothing's left, handleNextVideo just
      // surfaces the "no more videos" error and stays on this one.
      handleNextVideo();
    }
  };

  const onPlaybackRateChange = (event: any) => {
    watchDataRef.current.playbackSpeed = event.target.getPlaybackRate();
  };

  const handleFeedback = (value: 'like' | 'dislike') => {
    setFeedbackGiven(value);
    if (sessionRef.current) {
      sessionRef.current.feedback = value;
      upsertEngagementSession(withComputedSignal(sessionRef.current));
    }
  };

  const handleNextVideo = async () => {
    if (!selectedVideo || videos.length === 0) return;
    finalizeAndSaveSession();

    const currentIndex = videos.findIndex((v) => v.id === selectedVideo.id);

    // Still videos left in the current batch — just move to the next one.
    if (currentIndex !== -1 && currentIndex < videos.length - 1) {
      setSelectedVideo(videos[currentIndex + 1]);
      return;
    }

    // End of current batch reached — instead of wrapping back to video #1
    // (old behaviour), fetch a FRESH batch for the same query, skipping
    // anything already shown (see fetchMoreVideos()).
    setLoadingMore(true);
    setErrorMessage('');
    try {
      const freshVideos = await fetchMoreVideos();
      if (freshVideos && freshVideos.length > 0) {
        setSelectedVideo(freshVideos[0]);
      } else {
        setErrorMessage(`"${searchQuery}" ke liye aur naye videos nahi mile — sab dikha diye gaye.`);
      }
    } finally {
      setLoadingMore(false);
    }
  };

 const saveWatchData = (data: VideoWatchData) => {
    const score = Math.round(Math.max(0, Math.min(100, data.watchPercentage)));

    const entry: WatchHistoryEntry = {
      videoId: data.videoId,
      title: data.title,
      watchPercentage: Math.round(data.watchPercentage),
      aiScore: score,
    };

    setWatchHistory((prev) => {
      const updated = [entry, ...prev.filter((w) => w.videoId !== entry.videoId)].slice(0, 20);
      localStorage.setItem(WATCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    updateRoadmapFromWatch(activeGoalId ?? undefined, data.title, data.watchPercentage);
  };
  

  const searchVideos = async () => {
    if (!searchQuery.trim()) {
      setErrorMessage('Kuch search karo pehle');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    nextPageTokenRef.current = null; // fresh query — start pagination over

    try {
      const res = await fetch(
        `/api/youtube-search?maxResults=12&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'YouTube API error');
      }
      if (!data.items?.length) {
        setErrorMessage('Koi video nahi mila, kuch aur search karo');
        setVideos([]);
        return;
      }

      nextPageTokenRef.current = data.nextPageToken ?? null;

      setVideos(
        data.items.map(
          (item: any): Video => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url,
            channel: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            views: '—',
            duration: '—',
          })
        )
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Search fail hui, console check karo');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches the NEXT page of results for the same searchQuery (using
   * YouTube's pageToken) and appends only videos not already in the
   * current playlist. Called by handleNextVideo() when the current batch
   * runs out, instead of looping back to video #1.
   *
   * Returns the newly-added (deduplicated) videos, or an empty array if
   * nothing new was found (no more pages, or everything came back as a
   * repeat) — caller shows a "no more new videos" message in that case.
   */
  const fetchMoreVideos = async (): Promise<Video[]> => {
    if (!searchQuery.trim()) return [];
    // No more pages for this query — nothing fresh left to fetch.
    if (!nextPageTokenRef.current) return [];

    try {
      const res = await fetch(
        `/api/youtube-search?maxResults=12&q=${encodeURIComponent(searchQuery)}&pageToken=${encodeURIComponent(nextPageTokenRef.current)}`
      );
      const data = await res.json();
      if (!res.ok || !data.items?.length) {
        nextPageTokenRef.current = null;
        return [];
      }

      nextPageTokenRef.current = data.nextPageToken ?? null;

      const alreadyShown = new Set(videos.map((v) => v.id));
      const fresh: Video[] = data.items
        .map(
          (item: any): Video => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url,
            channel: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            views: '—',
            duration: '—',
          })
        )
        .filter((v: Video) => !alreadyShown.has(v.id));

      if (fresh.length === 0) return [];

      setVideos((prev) => [...prev, ...fresh]);
      return fresh;
    } catch {
      return [];
    }
  };

  const formatTime = (s: number) => {
    if (!s || Number.isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Pulled from the learner's own roadmap topics instead of a fixed generic
  // list — so suggestions are always relevant to what they're actually
  // learning, whatever subject that is.
  const suggestions = (getRoadmapData()?.children ?? [])
    .filter((t) => t.status !== 'locked')
    .slice(0, 4)
    .map((t) => t.title);
  const hasNextVideo = !!selectedVideo;

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      {showDeepNotes && selectedVideo ? (
        <div className="p-4 md:p-8">
          <button
            onClick={() => setShowDeepNotes(false)}
            className="mb-6 px-4 py-2 border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg font-semibold transition"
          >
            ← Back to Video
          </button>
          <Notes videoTitle={selectedVideo.title} />
        </div>
      ) : (
        <div className="p-4 md:p-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-4xl font-bold mb-2">📺 Videos</h1>
            <p className="text-gray-500 dark:text-white/60">Search • Watch • Personalized recommendations</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT: SEARCH */}
            <div className="lg:col-span-1">
              <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-white/40" />
                  <input
                    type="text"
                    placeholder="Search videos..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setErrorMessage('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && searchVideos()}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>
                <button
                  onClick={searchVideos}
                  disabled={loading}
                  className="px-5 py-2.5 bg-black text-white dark:bg-white dark:text-black disabled:opacity-40 rounded-lg font-semibold transition"
                >
                  {loading ? '...' : 'Search'}
                </button>
              </div>

              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 border border-gray-300 dark:border-white/20 rounded-lg p-3 text-sm"
                  >
                    {errorMessage}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap gap-2 mb-6">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSearchQuery(s)}
                    className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-full text-sm hover:bg-gray-100 dark:hover:bg-white/10 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {videos.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 dark:text-white/60">
                    <Play className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Search se start karo</p>
                  </div>
                ) : (
                  videos.map((video, i) => {
                    const watched = watchHistory.find((w) => w.videoId === video.id);
                    return (
                      <motion.div
                        key={video.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => {
                          finalizeAndSaveSession();
                          setSelectedVideo(video);
                        }}
                        className={`p-3 rounded-lg cursor-pointer transition border ${
                          selectedVideo?.id === video.id
                            ? 'border-black dark:border-white bg-gray-50 dark:bg-white/10'
                            : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="relative flex-shrink-0">
                            <img src={video.thumbnail} alt="" className="w-20 h-12 rounded object-cover" />
                            {watched && (
                              <CheckCircle className="w-4 h-4 text-black dark:text-white absolute -top-1 -right-1 bg-white dark:bg-black rounded-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm line-clamp-2">{video.title}</h3>
                            <p className="text-xs text-gray-500 dark:text-white/60">{video.channel}</p>
                            {watched && <span className="text-xs text-gray-500 dark:text-white/60">Score: {watched.aiScore}/100</span>}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT: PLAYER */}
            <div className="lg:col-span-2">
              {selectedVideo ? (
                <motion.div key={selectedVideo.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="bg-black rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10">
                    <YouTubePlayer
                      videoId={selectedVideo.id}
                      playerRef={playerRef}
                      onReady={onPlayerReady}
                      onStateChange={onPlayerStateChange}
                      onPlaybackRateChange={onPlaybackRateChange}
                    />
                  </div>

                  <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6">
                    <div className="mb-4">
                      <h2 className="text-2xl font-bold mb-1">{selectedVideo.title}</h2>
                      <p className="text-gray-500 dark:text-white/60">{selectedVideo.channel}</p>
                    </div>

                    {/* Feedback + Next controls */}
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        onClick={() => handleFeedback('like')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition border ${
                          feedbackGiven === 'like'
                            ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                            : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4" /> Helpful
                      </button>
                      <button
                        onClick={() => handleFeedback('dislike')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition border ${
                          feedbackGiven === 'dislike'
                            ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                            : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
                        }`}
                      >
                        <ThumbsDown className="w-4 h-4" /> Not for me
                      </button>

                      {hasNextVideo && (
                        <button
                          onClick={handleNextVideo}
                          disabled={loadingMore}
                          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition disabled:opacity-50"
                        >
                          {loadingMore ? 'Naye videos dhoondh raha hoon...' : 'Next'} <SkipForward className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="border border-gray-200 dark:border-white/10 rounded-lg p-4 mb-4">
                      <h3 className="font-semibold mb-3">Watch Progress</h3>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Watched</span>
                        <span className="text-gray-500 dark:text-white/60">
                          {formatTime(watchStats.watchedDuration)} / {formatTime(watchStats.totalDuration)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-2 mb-4">
                        <div
                          className="h-full bg-black dark:bg-white rounded-full transition-all"
                          style={{ width: `${watchStats.watchPercentage}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span>Pauses:</span>
                          <span className="text-gray-500 dark:text-white/60">{watchStats.pauseCount}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Rewinds:</span>
                          <span className="text-gray-500 dark:text-white/60">{watchStats.rewindCount}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Speed:</span>
                          <span className="text-gray-500 dark:text-white/60">{watchStats.playbackSpeed}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Complete:</span>
                          <span className="text-gray-500 dark:text-white/60">{Math.round(watchStats.watchPercentage)}%</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowDeepNotes(true)}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/10 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-white/10 transition"
                    >
                      Deep Notes
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="h-96 border border-gray-200 dark:border-white/10 rounded-2xl flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-white/30" />
                    <p className="text-gray-500 dark:text-white/60">Video select karo dekhne ke liye</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function YouTubePlayer({
  videoId,
  playerRef,
  onReady,
  onStateChange,
  onPlaybackRateChange,
}: {
  videoId: string;
  playerRef: React.MutableRefObject<any>;
  onReady: (e: any) => void;
  onStateChange: (e: any) => void;
  onPlaybackRateChange: (e: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementId = `yt-player-${videoId}`;

  useEffect(() => {
    let cancelled = false;

    const createPlayer = () => {
      if (cancelled || !containerRef.current) return;

      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
      containerRef.current.innerHTML = '';
      const div = document.createElement('div');
      div.id = elementId;
      containerRef.current.appendChild(div);

      playerRef.current = new window.YT.Player(elementId, {
        height: '400',
        width: '100%',
        videoId,
        playerVars: { autoplay: 1, controls: 1, modestbranding: 1, rel: 0 },
        events: { onReady, onStateChange, onPlaybackRateChange },
      });
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;
    }

    return () => {
      cancelled = true;
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  return <div ref={containerRef} className="w-full" />;
}