import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Play, AlertCircle, CheckCircle, Volume2, ThumbsUp, ThumbsDown, SkipForward } from 'lucide-react';
import type { Video, VideoWatchData, WatchHistoryEntry, EngagementSession, FeedbackValue, Topic } from './types';
import { withComputedSignal } from './engagementScoring';
import { upsertEngagementSession } from './engagementStore';
import Notes from './Notes';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const WATCH_HISTORY_STORAGE_KEY = 'video_watch_history';
const SEEK_FORWARD_THRESHOLD_SECONDS = 3;
const GENERATED_ROADMAP_STORAGE_KEY = 'learning_os_generated_roadmap';

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
function updateRoadmapFromWatch(videoTitle: string, watchPercentage: number) {
  if (watchPercentage < LOCKED_TO_LEARNING_THRESHOLD) return;

  try {
    const saved = localStorage.getItem(GENERATED_ROADMAP_STORAGE_KEY);
    if (!saved) return;
    const roadmap = JSON.parse(saved) as Topic;
    if (!roadmap?.children?.length) return;

    const normalizedTitle = videoTitle.toLowerCase();
    let changed = false;

    const updatedChildren = roadmap.children.map((topic) => {
      if (topic.status !== 'locked' && topic.status !== 'learning') return topic;

      const keywords = topic.topicKeywords ?? [];
      if (keywords.length === 0) return topic;

      const isMatch = keywords.some((kw) => normalizedTitle.includes(kw.toLowerCase()));
      if (!isMatch) return topic;

      if (topic.status === 'locked') {
        changed = true;
        return { ...topic, status: 'learning' as const };
      }

      if (topic.status === 'learning' && watchPercentage >= LEARNING_TO_COMPLETED_THRESHOLD) {
        changed = true;
        return { ...topic, status: 'completed' as const };
      }

      return topic;
    });

    if (changed) {
      const updatedRoadmap: Topic = { ...roadmap, children: updatedChildren };
      localStorage.setItem(GENERATED_ROADMAP_STORAGE_KEY, JSON.stringify(updatedRoadmap));
    }
  } catch {
    // Corrupted roadmap data in storage — skip silently, don't break video tracking.
  }
}
interface TeacherProfile {
  pace: number;
  theory_vs_practical: number;
  structure: number;
  depth: number;
  language_complexity: number;
  storytelling: number;
  repetition: number;
  prerequisite_assumed: number;
  primary_style: string;
  ideal_for: string;
  avoid_for: string;
}

function createEmptySession(video: Video): EngagementSession {
  return {
    id: `${video.id}-${Date.now()}`,
    videoId: video.id,
    userId: 'guest',
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

export default function VideoIntel() {
  const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
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

  // AI Analysis (transcript + Gemini teacher-profile) state
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState('');

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

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      finalizeAndSaveSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideo]);

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
    sessionRef.current = createEmptySession(selectedVideo);
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

  const handleNextVideo = () => {
    if (!selectedVideo || videos.length === 0) return;
    finalizeAndSaveSession();
    const currentIndex = videos.findIndex((v) => v.id === selectedVideo.id);
    const nextIndex = (currentIndex + 1) % videos.length;
    setSelectedVideo(videos[nextIndex]);
  };

 const saveWatchData = (data: VideoWatchData) => {
    const engagementPenalty = Math.max(0, data.pauseCount * 5);
    const aiScore = Math.round(Math.max(0, data.watchPercentage - engagementPenalty));

    const entry: WatchHistoryEntry = {
      videoId: data.videoId,
      title: data.title,
      watchPercentage: Math.round(data.watchPercentage),
      aiScore,
    };

    setWatchHistory((prev) => {
      const updated = [entry, ...prev.filter((w) => w.videoId !== entry.videoId)].slice(0, 20);
      localStorage.setItem(WATCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    updateRoadmapFromWatch(data.title, data.watchPercentage);
  };
  

  const analyzeVideoTranscript = async (videoId: string) => {
    setTranscriptLoading(true);
    setTranscriptError('');
    setTeacherProfile(null);

    try {
      const res = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed');
      }
      setTeacherProfile(data.profile);
    } catch (err: any) {
      setTranscriptError(err.message || 'Transcript analysis fail hui');
    } finally {
      setTranscriptLoading(false);
    }
  };

  const searchVideos = async () => {
    if (!searchQuery.trim()) {
      setErrorMessage('Kuch search karo pehle');
      return;
    }
    if (!API_KEY) {
      setErrorMessage('❌ API Key missing! .env.local mein VITE_YOUTUBE_API_KEY add karo, phir server restart karo.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&type=video&q=${encodeURIComponent(
          searchQuery
        )}&key=${API_KEY}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || 'YouTube API error');
      }
      if (!data.items?.length) {
        setErrorMessage('Koi video nahi mila, kuch aur search karo');
        setVideos([]);
        return;
      }

      setVideos(
        data.items.map(
          (item: any): Video => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url,
            channel: item.snippet.channelTitle,
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

  const formatTime = (s: number) => {
    if (!s || Number.isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const suggestions = ['React Hooks', 'JavaScript Closures', 'TypeScript Basics', 'REST API Design'];
  const hasNextVideo = videos.length > 1 && !!selectedVideo;

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      {!API_KEY && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-yellow-600/20 border border-yellow-500 rounded-lg p-4 flex gap-3"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">⚠️ API Key Missing</h3>
            <p className="text-sm text-white/80 mt-1">
              <code className="bg-black/50 px-2 py-1 rounded text-xs">.env.local</code> (project root) mein add karo:
            </p>
            <code className="block bg-black/50 p-2 rounded mt-2 text-xs">VITE_YOUTUBE_API_KEY=your_key_here</code>
            <p className="text-xs text-white/50 mt-2">Phir `npm run dev` restart karo.</p>
          </div>
        </motion.div>
      )}

      {showDeepNotes && selectedVideo ? (
        <div className="p-4 md:p-8">
          <button
            onClick={() => setShowDeepNotes(false)}
            className="mb-6 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition"
          >
            ← Back to Video
          </button>
          <Notes videoTitle={selectedVideo.title} />
        </div>
      ) : (
        <div className="p-4 md:p-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-4xl font-bold mb-2">📺 Video Intelligence</h1>
            <p className="text-white/60">Search • Watch with AI tracking • Personalized recommendations</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT: SEARCH */}
            <div className="lg:col-span-1">
              <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search videos..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setErrorMessage('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && searchVideos()}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 placeholder-white/40 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <button
                  onClick={searchVideos}
                  disabled={loading}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-semibold transition"
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
                    className="mb-4 bg-red-600/20 border border-red-500 rounded-lg p-3 text-sm"
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
                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm hover:bg-white/10 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {videos.length === 0 ? (
                  <div className="text-center py-12 text-white/60">
                    <Play className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>🔍 Search se start karo</p>
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
                        className={`p-3 rounded-lg cursor-pointer transition ${
                          selectedVideo?.id === video.id
                            ? 'bg-purple-600/30 border border-purple-500'
                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="relative flex-shrink-0">
                            <img src={video.thumbnail} alt="" className="w-20 h-12 rounded object-cover" />
                            {watched && (
                              <CheckCircle className="w-4 h-4 text-green-400 absolute -top-1 -right-1 bg-black rounded-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm line-clamp-2">{video.title}</h3>
                            <p className="text-xs text-white/60">{video.channel}</p>
                            {watched && <span className="text-xs text-green-400">🎯 Score: {watched.aiScore}/100</span>}
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
                  <div className="bg-black rounded-2xl overflow-hidden border border-white/10">
                    <YouTubePlayer
                      videoId={selectedVideo.id}
                      playerRef={playerRef}
                      onReady={onPlayerReady}
                      onStateChange={onPlayerStateChange}
                      onPlaybackRateChange={onPlaybackRateChange}
                    />
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-2xl font-bold mb-1">{selectedVideo.title}</h2>
                        <p className="text-white/60">{selectedVideo.channel}</p>
                      </div>
                      <button
                        onClick={() => window.open(`https://youtube.com/watch?v=${selectedVideo.id}`, '_blank')}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition"
                      >
                        ▶️ YouTube
                      </button>
                    </div>

                    {/* Feedback + Next controls */}
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        onClick={() => handleFeedback('like')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                          feedbackGiven === 'like'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                            : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4" /> Helpful
                      </button>
                      <button
                        onClick={() => handleFeedback('dislike')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                          feedbackGiven === 'dislike'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <ThumbsDown className="w-4 h-4" /> Not for me
                      </button>

                      {hasNextVideo && (
                        <button
                          onClick={handleNextVideo}
                          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 transition"
                        >
                          Next <SkipForward className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="bg-purple-600/10 border border-purple-500/20 rounded-lg p-4 mb-4">
                      <h3 className="font-semibold mb-3">📊 Watch Progress</h3>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Watched</span>
                        <span className="text-white/60">
                          {formatTime(watchStats.watchedDuration)} / {formatTime(watchStats.totalDuration)}
                        </span>
                      </div>
                      <div className="w-full bg-black/30 rounded-full h-2 mb-4">
                        <div
                          className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all"
                          style={{ width: `${watchStats.watchPercentage}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span>Pauses:</span>
                          <span className="text-white/60">{watchStats.pauseCount}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Rewinds:</span>
                          <span className="text-white/60">{watchStats.rewindCount}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Speed:</span>
                          <span className="text-white/60">{watchStats.playbackSpeed}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Complete:</span>
                          <span className="text-white/60">{Math.round(watchStats.watchPercentage)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* TWO BUTTONS: Deep Notes + AI Analysis */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setShowDeepNotes(true)}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
                      >
                        📚 Deep Notes
                      </button>
                      <button
                        onClick={() => {
                          setShowTranscript(!showTranscript);
                          if (!showTranscript && !teacherProfile && selectedVideo) {
                            analyzeVideoTranscript(selectedVideo.id);
                          }
                        }}
                        className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                      >
                        <Volume2 className="w-4 h-4" /> AI Analysis
                      </button>
                    </div>

                    <AnimatePresence>
                      {showTranscript && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 bg-black/30 rounded-lg p-4 text-sm text-white/70 space-y-3"
                        >
                          {transcriptLoading && <p>🔍 Transcript fetch ho raha hai aur Gemini analyze kar raha hai...</p>}
                          {transcriptError && <p className="text-red-400">❌ {transcriptError}</p>}
                          {teacherProfile && !transcriptLoading && (
                            <div className="space-y-2">
                              <h4 className="text-white font-semibold text-sm">🎯 Teaching Style Profile</h4>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>Pace: {teacherProfile.pace}/10</div>
                                <div>Practical: {teacherProfile.theory_vs_practical}/10</div>
                                <div>Structure: {teacherProfile.structure}/10</div>
                                <div>Depth: {teacherProfile.depth}/10</div>
                                <div>Language: {teacherProfile.language_complexity}/10</div>
                                <div>Storytelling: {teacherProfile.storytelling}/10</div>
                                <div>Repetition: {teacherProfile.repetition}/10</div>
                                <div>Prerequisite: {teacherProfile.prerequisite_assumed}/10</div>
                              </div>
                              <p className="text-white/60 mt-2">
                                <span className="text-purple-300">Style:</span> {teacherProfile.primary_style}
                              </p>
                              <p className="text-white/60">
                                <span className="text-green-300">Ideal for:</span> {teacherProfile.ideal_for}
                              </p>
                              <p className="text-white/60">
                                <span className="text-red-300">Avoid for:</span> {teacherProfile.avoid_for}
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ) : (
                <div className="h-96 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-16 h-16 mx-auto mb-4 text-white/30" />
                    <p className="text-white/60">Video select karo dekhne ke liye</p>
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