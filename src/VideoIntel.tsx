import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Search, Play, CheckCircle, ThumbsUp, ThumbsDown, SkipForward, MessageCircle, Link2, ArrowLeft, ArrowRight, Film, Sparkles, Users, X as CloseIcon } from 'lucide-react';
import type { Video, VideoWatchData, WatchHistoryEntry, EngagementSession, FeedbackValue, Topic, TopicBridge } from './types';
import { withComputedSignal } from './engagementScoring';
import { upsertEngagementSession } from './engagementStore';
import RecallCheck from './RecallCheck';
import { getLearningProfile } from './learningProfileStore';
import { maybeUpdateProfileFromEngagement } from './implicitProfileUpdate';
import { getRoadmapData, saveRoadmapData, findTopicById } from './roadmapData';
import { useNavigate } from 'react-router-dom';
import { MENTOR_PREFILL_KEY } from './mentorPrefill';
import Notes from './Notes';
import Research from './Research';
import HintBubble from './HintBubble';
import { getCachedConnectorFacts } from './conceptVideoPool';
import { useOnborda } from './OnbordaContext';
import { hasSeenTour, markTourSeen } from './tourStore';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { authFetch } from './apiFetch';
import { pullSharedSearch, pushSharedSearch } from './sharedVideoCache';
import { contributeSharedVideoSignal, getSharedVideoLearningSummary, type SharedVideoLearningSummary } from './sharedLearningIntelligence';
import { GlassPanel, GlassButton, ProgressRing } from './ui/kit';

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

/** Per-goal + per-topic key — without the topic part, switching topics
 *  within the SAME goal (e.g. Step 2 -> Step 3) shared one storage slot,
 *  so Step 3's saved video silently overwrote/looked like Step 2's saved
 *  video (and vice versa). `topicId` undefined = the general/typed-search
 *  slot used outside the roadmap flow (Videos page opened directly). */
function getSearchStateKey(goalId: string | undefined, topicId: string | undefined): string {
  return `${SEARCH_STATE_STORAGE_KEY}:${goalId ?? 'primary'}:${topicId ?? 'general'}`;
}

/** Whether this specific topic (within this goal) has a previously
 *  watched/selected video saved — used by Roadmap.tsx to decide whether to
 *  show a "Saved video" button for THAT topic. Read-only, safe to call
 *  outside VideoIntel. */
export function hasSavedVideoForTopic(goalId: string | undefined, topicId: string): boolean {
  try {
    const saved = localStorage.getItem(getSearchStateKey(goalId, topicId));
    if (!saved) return false;
    const parsed = JSON.parse(saved) as PersistedSearchState;
    return !!parsed.selectedVideoId;
  } catch {
    return false;
  }
}

/** The actual videoId a learner watched/selected for this topic, if any —
 *  used by Roadmap.tsx to verify a bridge against the PREVIOUS topic's
 *  real watched video (via conceptVideoPool.ts's getCachedConnectorFacts,
 *  keyed by this same videoId) instead of just its title. */
export function getSavedVideoIdForTopic(goalId: string | undefined, topicId: string): string | null {
  try {
    const saved = localStorage.getItem(getSearchStateKey(goalId, topicId));
    if (!saved) return null;
    const parsed = JSON.parse(saved) as PersistedSearchState;
    return parsed.selectedVideoId ?? null;
  } catch {
    return null;
  }
}

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
 *
 * Checks EVERY given goal's roadmap (not just the goal tab that happens to
 * be selected right now) and applies the update to whichever one actually
 * has a matching topic. This matters because a learner can watch a video
 * for Goal B's topic while Goal A's tab is still the one they last had
 * open on the Roadmap page — without this, that watch would silently be
 * checked only against Goal A, find no keyword match, and do nothing,
 * leaving Goal B's step permanently stuck "in progress".
 */
function updateRoadmapFromWatch(goalIds: (string | undefined)[], videoTitle: string, watchPercentage: number) {
  if (watchPercentage < LOCKED_TO_LEARNING_THRESHOLD) return;

  for (const goalId of goalIds) {
    try {
      const roadmap = getRoadmapData(goalId);
      if (!roadmap?.children?.length) continue;

      const normalizedTitle = videoTitle.toLowerCase();
      const hasKeywordMatch = roadmap.children.some((topic) =>
        (topic.topicKeywords ?? []).some((kw) => normalizedTitle.includes(kw.toLowerCase()))
      );
      if (!hasKeywordMatch) continue; // this goal's topics don't mention this video — try the next goal

      let changed = false;
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
      return; // matched (and handled) against this goal — don't also apply to others
    } catch {
      // Corrupted roadmap data in storage for this goal — try the next one.
    }
  }
}

/**
 * Read-only lookup: given a watched video's title, find which roadmap
 * Topic.id it matches (via the same topicKeywords used by
 * updateRoadmapFromWatch), regardless of that topic's current status.
 * Checks every given goal and returns the first match. Used to stamp
 * EngagementSession.conceptId so PlaylistBuilder can do concept-based
 * reranking. Returns undefined if no roadmap or no match — never throws,
 * never mutates storage.
 */
function findMatchingTopicId(goalIds: (string | undefined)[], videoTitle: string): string | undefined {
  const normalizedTitle = videoTitle.toLowerCase();
  for (const goalId of goalIds) {
    try {
      const roadmap = getRoadmapData(goalId);
      if (!roadmap?.children?.length) continue;

      for (const topic of roadmap.children) {
        const keywords = topic.topicKeywords ?? [];
        if (keywords.length === 0) continue;
        if (keywords.some((kw) => normalizedTitle.includes(kw.toLowerCase()))) {
          return topic.id;
        }
      }
    } catch {
      // Corrupted roadmap data for this goal — try the next one.
    }
  }
  return undefined;
}

function createEmptySession(video: Video, goalIds: (string | undefined)[]): EngagementSession {
  return {
    id: `${video.id}-${Date.now()}`,
    videoId: video.id,
    userId: 'guest',
    teacherId: video.channelId,
    conceptId: findMatchingTopicId(goalIds, video.title),
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
  /** Ranked primary + fallback videos handed off from Roadmap's \"Watch videos\"
   *  button (via PlaylistBuilder). When present, auto-loads primary into the player and
   *  populates the left-panel list with primary + fallbacks.
   *  `bridge`, when present, describes how this topic connects to the one the
   *  learner just finished — shown as a banner above the player so the new
   *  video doesn't feel like an unrelated, disconnected clip. */
  initialPlaylist?: { primary: Video; fallbacks: Video[]; bridge?: TopicBridge; previousVideoId?: string | null } | null;
  /** Which goal's roadmap watch-progress (topic status, concept matching)
   *  should be attributed to — the currently open goal tab on Roadmap.
   *  Tried first, but see `allGoalIds` below for why it's not the only one. */
  activeGoalId?: string | null;
  /** Which topic's saved-video slot is currently being viewed — the topic
   *  the learner clicked "Watch videos"/"Saved video" on for. Together with
   *  activeGoalId this keys the saved search/video state (see
   *  getSearchStateKey) so each topic keeps its OWN saved video instead of
   *  all topics in a goal sharing one slot. Undefined/null = general
   *  search slot (Videos page opened directly, not via a specific topic). */
  activeTopicId?: string | null;
  /** Every currently-active goal's id (both slots, if 2 are running). Watch
   *  completion is checked against ALL of these, not just activeGoalId, so
   *  progress is attributed correctly even if the learner watches a video
   *  for Goal B while Goal A's tab is still the one selected on Roadmap. */
  allGoalIds?: string[];
}

// Shared class strings for the dark stage (kept here so every button looks and focuses the same).
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300';
const PILL = `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-violet-300/40 hover:bg-violet-400/10 hover:text-white motion-reduce:transition-none disabled:opacity-50 ${FOCUS}`;
const PILL_ON = `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-transparent bg-violet-500 px-4 py-2 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,.4)] transition hover:bg-violet-400 motion-reduce:transition-none ${FOCUS}`;
const PRIMARY = `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(139,92,246,.4)] transition hover:-translate-y-0.5 hover:bg-violet-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 ${FOCUS}`;

export default function VideoIntel({ initialPlaylist, activeGoalId, activeTopicId, allGoalIds }: VideoIntelProps = {}) {
  const t = useTranslation();
  const reduce = useReducedMotion();
  const { startOnborda } = useOnborda();
  // Every active goal, active-tab first (checked first so ties resolve in
  // the learner's favor) — deduped in case activeGoalId is also in the list.
  const goalIdsToCheck = Array.from(
    new Set([activeGoalId ?? undefined, ...(allGoalIds ?? [])])
  );
  // YouTube search now goes through /api/youtube — the key
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
  const navigate = useNavigate();
  const [recallFor, setRecallFor] = useState<string | null>(null); // videoId waiting for its recall check
  // Research panel opens alongside the still-playing video (unlike Deep
  // Notes, which replaces the page) — this is the "research in parallel
  // while watching" flow, so it never touches the video player at all.
  const [showResearch, setShowResearch] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<FeedbackValue>(null);
  // How this handoff's topic connects to the one the learner just finished
  // (see TopicBridge). Set once when a Roadmap "Watch videos" handoff loads,
  // dismissible, and NOT re-shown for fallback/"Next" videos within the same
  // topic — it's a topic-to-topic bridge, not a per-video one.
  const [activeBridge, setActiveBridge] = useState<TopicBridge | null>(null);
  const [watchStats, setWatchStats] = useState({
    watchedDuration: 0,
    totalDuration: 0,
    watchPercentage: 0,
    pauseCount: 0,
    rewindCount: 0,
    playbackSpeed: 1,
  });
  const [sharedLearningSummary, setSharedLearningSummary] = useState<SharedVideoLearningSummary | null>(null);

  useEffect(() => {
    let active = true;
    setSharedLearningSummary(null);
    if (!selectedVideo) return () => { active = false; };
    void getSharedVideoLearningSummary(selectedVideo.id).then((summary) => {
      if (active) setSharedLearningSummary(summary);
    });
    return () => { active = false; };
  }, [selectedVideo?.id]);

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
  const hasSavedProgressRef = useRef<string | null>(null);
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
      const savedSearch = localStorage.getItem(getSearchStateKey(activeGoalId ?? undefined, activeTopicId ?? undefined));
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

  // Re-load (or clear) search state whenever the active goal OR active topic
  // changes — without this, switching topics (even within the same goal,
  // e.g. Step 2 -> Step 3) kept showing whichever topic's search/video was
  // last active, since this component doesn't remount on topic switch.
  const isFirstGoalRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstGoalRenderRef.current) {
      // Already handled by the mount effect above — skip to avoid a
      // redundant double-load on first render.
      isFirstGoalRenderRef.current = false;
      return;
    }
    finalizeAndSaveSession();
    try {
      const savedSearch = localStorage.getItem(getSearchStateKey(activeGoalId ?? undefined, activeTopicId ?? undefined));
      if (savedSearch) {
        const parsed = JSON.parse(savedSearch) as PersistedSearchState;
        setSearchQuery(parsed.searchQuery ?? '');
        setVideos(Array.isArray(parsed.videos) ? parsed.videos : []);
        const restoredSelected = parsed.videos?.find((v) => v.id === parsed.selectedVideoId) ?? null;
        setSelectedVideo(restoredSelected);
        nextPageTokenRef.current = parsed.nextPageToken ?? null;
      } else {
        setSearchQuery('');
        setVideos([]);
        setSelectedVideo(null);
        nextPageTokenRef.current = null;
      }
    } catch {
      setSearchQuery('');
      setVideos([]);
      setSelectedVideo(null);
      nextPageTokenRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGoalId, activeTopicId]);

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
      localStorage.setItem(getSearchStateKey(activeGoalId ?? undefined, activeTopicId ?? undefined), JSON.stringify(toSave));
    } catch {
      // Storage full/unavailable — non-critical, just skip persisting.
    }
  }, [searchQuery, videos, selectedVideo, activeGoalId, activeTopicId]);

  useEffect(() => {
    return () => {
      finalizeAndSaveSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideo]);

  // Verifies (or re-verifies) the bridge banner against whichever video is
  // ACTUALLY selected — primary or a fallback — instead of always assuming
  // primary. Facts for both videos are already cached for free (see
  // conceptVideoPool.ts's getCachedConnectorFacts, piggybacked onto each
  // video's original analyze-video.ts call), so this is one small
  // fact-vs-fact call, never a transcript re-send. If either side's facts
  // aren't cached, falls back to the original pre-written (unverified)
  // bridge claim — same as before this feature existed.
  const verifyBridgeForVideo = async (video: Video) => {
    const baseBridge = initialPlaylist?.bridge;
    const previousVideoId = initialPlaylist?.previousVideoId;
    setActiveBridge(baseBridge ?? null);
    if (!baseBridge || !previousVideoId) return;

    const previousFacts = getCachedConnectorFacts(previousVideoId);
    const nextFacts = getCachedConnectorFacts(video.id);
    if (!previousFacts || !nextFacts) return; // keep the unverified baseBridge

    try {
      const res = await authFetch('/api/verify-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previous: { topicTitle: baseBridge.fromTopicTitle, facts: previousFacts },
          next: { topicTitle: baseBridge.toTopicTitle, facts: nextFacts },
          fallbackConnectText: baseBridge.connectText,
        }),
      });
      if (!res.ok) return;
      const verification = (await res.json()) as { connected: boolean; verifiedConnectText: string | null };
      if (verification.connected && verification.verifiedConnectText) {
        setActiveBridge({ ...baseBridge, connectText: verification.verifiedConnectText, verified: true });
      } else {
        setActiveBridge({ ...baseBridge, verified: false });
      }
    } catch {
      // network/API failure — keep the unverified baseBridge, never block the learner
    }
  };

  // Preload a ranked playlist handed off from Roadmap ("Watch videos").
  // Keyed on the primary video's id so a fresh handoff (even for the same topic
  // revisited later) re-triggers, but re-renders of the parent don't loop this.
  useEffect(() => {
    if (!initialPlaylist?.primary) return;
    finalizeAndSaveSession();
    setVideos([initialPlaylist.primary, ...initialPlaylist.fallbacks]);
    setSelectedVideo(initialPlaylist.primary);
    void verifyBridgeForVideo(initialPlaylist.primary);

    // First time a learner ever gets a 3-video (primary + fallbacks) picker,
    // explain that all 3 teach the SAME concept in different styles — pick
    // one, not all three — before it reads as a bug ("why 3 of the same
    // thing?"). See personalityEngine.ts for why there are always 3.
    if (initialPlaylist.fallbacks.length > 0 && !hasSeenTour('video-picker-intro')) {
      const timer = setTimeout(() => {
        startOnborda('video-picker-intro');
        markTourSeen('video-picker-intro');
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlaylist?.primary.id]);

  const finalizeAndSaveSession = () => {
    if (!sessionRef.current) return;
    const completeSession = withComputedSignal(sessionRef.current);
    upsertEngagementSession(completeSession);
    // Cross-user sharing is strictly opt-in; the server rules enforce one contribution per account/video.
    void contributeSharedVideoSignal(completeSession);

    // Rolling-window implicit profile update — silent, no UI notification
    // by design (see /areas/learning-os.md). No-ops until enough consistent
    // positive signals exist in the recent window.
    const profile = getLearningProfile();
    if (profile) maybeUpdateProfileFromEngagement(profile);
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

        // Don't wait for the YouTube 'ended' event to persist progress —
        // it doesn't always fire (tab switch, autoplay blocked, closing the
        // player early, etc). As soon as the completion threshold is
        // crossed, save immediately so roadmap unlock isn't silently lost.
        // Guarded per-video so this only fires once even though the
        // interval keeps ticking above the threshold.
        if (
          watchDataRef.current.watchPercentage >= LEARNING_TO_COMPLETED_THRESHOLD &&
          hasSavedProgressRef.current !== selectedVideo.id
        ) {
          hasSavedProgressRef.current = selectedVideo.id;
          saveWatchData(watchDataRef.current);
        }
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
    hasSavedProgressRef.current = null;
    playStartTimeRef.current = null;
    sessionRef.current = createEmptySession(selectedVideo, goalIdsToCheck);
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
      // Recall check first (skippable) — it calls handleNextVideo when done.
      setRecallFor(selectedVideo?.id ?? null);
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
    // The bridge connects the PREVIOUS topic to THIS topic's primary video —
    // once the learner moves to a fallback/fresh video within this same
    // topic, it no longer applies.
    setActiveBridge(null);

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
        setErrorMessage(format(t.videos.errors.noMoreVideos, searchQuery));
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

    updateRoadmapFromWatch(goalIdsToCheck, data.title, data.watchPercentage);
  };
  

  const searchVideos = async () => {
    if (!searchQuery.trim()) {
      setErrorMessage(t.videos.errors.searchSomethingFirst);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    // A new search is a new learning choice. Stop showing/playing the previous
    // result immediately so the list and player can never describe different queries.
    setSelectedVideo(null);
    setVideos([]);
    setActiveBridge(null);
    setRecallFor(null);
    setShowResearch(false);
    setWatchStats({
      watchedDuration: 0,
      totalDuration: 0,
      watchPercentage: 0,
      pauseCount: 0,
      rewindCount: 0,
      playbackSpeed: 1,
    });
    nextPageTokenRef.current = null; // fresh query — start pagination over

    try {
      // Shared cache first — same search by any earlier user = 0 YouTube quota.
      const searchKey = `search_${searchQuery.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 150)}`;
      const shared = await pullSharedSearch<Video>(searchKey);
      if (shared) {
        nextPageTokenRef.current = shared.nextPageToken;
        setVideos(shared.items);
        return;
      }

      const res = await authFetch(
        `/api/youtube?maxResults=12&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || t.videos.errors.searchFailed);
      }
      if (!data.items?.length) {
        setErrorMessage(t.videos.errors.noVideosFound);
        setVideos([]);
        return;
      }

      nextPageTokenRef.current = data.nextPageToken ?? null;

      const mapped: Video[] = data.items.map(
        (item: any): Video => ({
          id: item.id.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url,
          channel: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          views: '—',
          duration: '—',
        })
      );
      setVideos(mapped);
      pushSharedSearch(searchKey, mapped, nextPageTokenRef.current);
    } catch (err: any) {
      setErrorMessage(err.message || t.videos.errors.searchFailed);
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
      const res = await authFetch(
        `/api/youtube?maxResults=12&q=${encodeURIComponent(searchQuery)}&pageToken=${encodeURIComponent(nextPageTokenRef.current)}`
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
  // learning, whatever subject that is. Must scope to the currently active
  // goal — without a goalId this silently fell back to the 'primary' key
  // (whatever roadmap was made first, ever), showing stale/unrelated
  // suggestions once a learner had more than one goal.
  const suggestions = (getRoadmapData(activeGoalId ?? undefined)?.children ?? [])
    .filter((topic) => topic.status !== 'locked')
    .slice(0, 4)
    .map((topic) => topic.title);
  const hasNextVideo = !!selectedVideo;

  return (
    <div className="dark">
      <div className="relative min-h-dvh overflow-hidden bg-[#080d19] p-4 text-slate-100 md:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-violet-600/[0.13] blur-[120px]" />
          <div className="absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />
        </div>
        <div className="relative">
          {showDeepNotes && selectedVideo ? (
            <div>
              <button type="button" onClick={() => setShowDeepNotes(false)} className={`${PILL} mb-6`}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t.videos.backToVideo}
              </button>
              <Notes videoTitle={selectedVideo.title} videoId={selectedVideo.id} />
            </div>
          ) : (
            <>
              <motion.div initial={reduce ? false : { opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center gap-3 md:mb-8">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200">
                  <Film className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">{t.videos.header.title}</h1>
                  <p className="mt-0.5 text-sm text-slate-400 md:text-base">{t.videos.header.subtitle}</p>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                {/* LEFT: SEARCH */}
                <div className="lg:col-span-4">
                  <div className="mb-3 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                      <input
                        type="text"
                        aria-label={t.videos.searchPlaceholder}
                        placeholder={t.videos.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setErrorMessage('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && searchVideos()}
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-slate-100 placeholder-white/40 transition focus:border-violet-400 focus:shadow-[0_0_18px_rgba(139,92,246,.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
                      />
                    </div>
                    <button type="button" onClick={searchVideos} disabled={loading} className={`${PRIMARY} shrink-0`}>
                      {loading ? '...' : t.videos.searchCta}
                    </button>
                  </div>

                  <AnimatePresence>
                    {errorMessage && (
                      <motion.div
                        role="alert"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mb-4 rounded-xl border border-red-400/30 bg-red-400/[0.08] p-3 text-sm text-red-200"
                      >
                        {errorMessage}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mb-5 flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setSearchQuery(s)}
                        className={`rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition hover:border-violet-300/50 hover:bg-violet-400/10 hover:text-white motion-reduce:transition-none ${FOCUS}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {videos.length > 1 && <HintBubble id="video-picker" text={t.videos.pickHint} />}
                  <div aria-busy={loading} className="max-h-[600px] space-y-3 overflow-y-auto pr-2 [scrollbar-color:rgba(255,255,255,.18)_transparent] [scrollbar-width:thin]">
                    {videos.length === 0 ? (
                      loading ? (
                        <div aria-hidden="true" className="space-y-3">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="flex animate-pulse gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3 motion-reduce:animate-none">
                              <div className="h-12 w-20 shrink-0 rounded-lg bg-white/10" />
                              <div className="flex-1 space-y-2 pt-1">
                                <div className="h-3 w-4/5 rounded bg-white/10" />
                                <div className="h-3 w-2/5 rounded bg-white/[0.07]" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-400 md:py-12">
                          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-400/10 text-violet-300 shadow-[0_0_30px_rgba(139,92,246,.25)]">
                            <Play className="h-7 w-7" aria-hidden="true" />
                          </span>
                          <p>{t.videos.noResultsYet}</p>
                        </div>
                      )
                    ) : (
                      videos.map((video, i) => {
                        const watched = watchHistory.find((w) => w.videoId === video.id);
                        const isSelected = selectedVideo?.id === video.id;
                        return (
                          <GlassButton
                            key={video.id}
                            id={i === 0 ? 'onborda-video-primary' : i === 1 ? 'onborda-video-fallback' : undefined}
                            pressed={isSelected}
                            accent="#a78bfa"
                            className={`w-full ${isSelected ? 'ring-1 shadow-[0_0_24px_rgba(167,139,250,.2)]' : ''}`}
                            onClick={() => {
                              finalizeAndSaveSession();
                              setSelectedVideo(video);
                              // Verify against WHICHEVER video the learner actually
                              // picked — primary or fallback — not always primary.
                              void verifyBridgeForVideo(video);
                            }}
                          >
                            <span className="flex gap-3 p-3">
                              <span className="relative block shrink-0">
                                <img src={video.thumbnail} alt="" loading="lazy" className="h-12 w-20 rounded-lg object-cover" />
                                {watched && (
                                  <CheckCircle className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-[#080d19] text-emerald-300" aria-hidden="true" />
                                )}
                              </span>
                              <span className="block min-w-0 flex-1">
                                <span className="line-clamp-2 block text-sm font-semibold">{video.title}</span>
                                <span className="block truncate text-xs text-slate-400">{video.channel}</span>
                                {watched && <span className="block text-xs text-emerald-300/80">{format(t.videos.score, watched.aiScore)}</span>}
                              </span>
                              {isSelected && (
                                <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-violet-300 shadow-[0_0_10px_rgba(167,139,250,.9)] motion-reduce:animate-none" />
                              )}
                            </span>
                          </GlassButton>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* RIGHT: PLAYER */}
                <div className="lg:col-span-8">
                  {selectedVideo ? (
                    <motion.div key={selectedVideo.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 md:space-y-6">
                      {/* verified === false means Gemini actually checked the two videos'
                          real content and found no genuine connection — showing the
                          original unproven claim in that case would be worse than
                          showing nothing, so it's suppressed rather than displayed
                          softened. verified === undefined ("not checked") still shows
                          normally, same as before this feature existed. Shown for
                          whichever video is actually selected — primary or fallback —
                          since verifyBridgeForVideo now re-checks on every pick. */}
                      {activeBridge && activeBridge.verified !== false && (
                        <div className="flex items-start gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.06] p-4">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200">
                            <Link2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                              <span>{activeBridge.fromTopicTitle}</span>
                              <ArrowRight className="h-3 w-3" aria-hidden="true" />
                              <span className="font-medium text-slate-100">{activeBridge.toTopicTitle}</span>
                              {activeBridge.verified === true && (
                                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                                  {t.videos.verifiedBadge}
                                </span>
                              )}
                            </div>
                            <p className="text-sm leading-relaxed text-slate-300">{activeBridge.connectText}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveBridge(null)}
                            className={`-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white ${FOCUS}`}
                            aria-label={t.videos.dismissAria}
                          >
                            <CloseIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        </div>
                      )}

                      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-[0_0_40px_rgba(167,139,250,.12)]">
                        <YouTubePlayer
                          videoId={selectedVideo.id}
                          playerRef={playerRef}
                          onReady={onPlayerReady}
                          onStateChange={onPlayerStateChange}
                          onPlaybackRateChange={onPlaybackRateChange}
                        />
                      </div>

                      {recallFor === selectedVideo.id && (
                        <RecallCheck
                          videoId={selectedVideo.id}
                          onDone={() => {
                            setRecallFor(null);
                            handleNextVideo();
                          }}
                        />
                      )}

                      <GlassPanel accent="#a78bfa">
                        <div className="p-4 md:p-6">
                          <div className="mb-4">
                            <h2 className="mb-1 text-xl font-semibold md:text-2xl">{selectedVideo.title}</h2>
                            <p className="text-slate-400">{selectedVideo.channel}</p>
                          </div>

                          {sharedLearningSummary && (
                            <div className="mb-4 border-t border-white/[0.07] pt-4">
                              <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-emerald-200">
                                <Users className="h-3.5 w-3.5" aria-hidden="true" /> {t.videos.community.title}
                              </p>
                              <p className="text-sm text-slate-200">
                                {sharedLearningSummary.completedRate >= 65
                                  ? t.videos.community.mostFinished
                                  : sharedLearningSummary.earlyDropRate >= 45
                                    ? t.videos.community.manyStopped
                                    : t.videos.community.mixed}
                              </p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {[
                                  { label: format(t.videos.community.completed, sharedLearningSummary.completedRate), value: sharedLearningSummary.completedRate, bar: 'from-emerald-400 to-cyan-300 shadow-[0_0_10px_rgba(52,211,153,.5)]' },
                                  { label: format(t.videos.community.stoppedEarly, sharedLearningSummary.earlyDropRate), value: sharedLearningSummary.earlyDropRate, bar: 'from-amber-300 to-amber-400 shadow-[0_0_10px_rgba(252,211,77,.4)]' },
                                ].map((row) => (
                                  <div key={row.label}>
                                    <div className="mb-1 text-[11px] text-slate-400">{row.label}</div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                                      <motion.div
                                        initial={reduce ? false : { width: 0 }}
                                        animate={{ width: `${Math.max(0, Math.min(100, row.value))}%` }}
                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                        className={`h-full rounded-full bg-gradient-to-r ${row.bar}`}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="mt-2 text-[11px] text-slate-500">{t.videos.community.disclaimer}</p>
                            </div>
                          )}

                          {/* Feedback + Next controls */}
                          <div className="mb-4 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-4">
                            <button
                              type="button"
                              aria-pressed={feedbackGiven === 'like'}
                              onClick={() => handleFeedback('like')}
                              className={feedbackGiven === 'like' ? PILL_ON : PILL}
                            >
                              <ThumbsUp className="h-4 w-4" aria-hidden="true" /> {t.videos.helpfulCta}
                            </button>
                            <button
                              type="button"
                              aria-pressed={feedbackGiven === 'dislike'}
                              onClick={() => handleFeedback('dislike')}
                              className={feedbackGiven === 'dislike' ? PILL_ON : PILL}
                            >
                              <ThumbsDown className="h-4 w-4" aria-hidden="true" /> {t.videos.notForMeCta}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const topicTitle = (activeTopicId && findTopicById(activeTopicId, getRoadmapData(activeGoalId))?.title) || selectedVideo.title;
                                try {
                                  sessionStorage.setItem(MENTOR_PREFILL_KEY, format(t.videos.mentorPrefill, topicTitle));
                                } catch {
                                  // best effort
                                }
                                navigate('/dashboard/mentor');
                              }}
                              className={PILL}
                            >
                              <MessageCircle className="h-4 w-4" aria-hidden="true" /> {t.videos.askMentorCta}
                            </button>

                            {hasNextVideo && (
                              <button type="button" onClick={handleNextVideo} disabled={loadingMore} aria-busy={loadingMore} className={`${PRIMARY} ml-auto`}>
                                {loadingMore ? t.videos.loadingNextCta : t.videos.nextCta} <SkipForward className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>

                          <div className="border-t border-white/[0.07] pt-4">
                            <h3 className="mb-3 text-sm font-semibold text-slate-200">{t.videos.watchProgress.title}</h3>
                            <div className="flex items-center gap-4 md:gap-6">
                              <div role="img" aria-label={`${t.videos.watchProgress.complete}: ${Math.round(watchStats.watchPercentage)}%`}>
                                <ProgressRing value={watchStats.watchPercentage} size={96} stroke={8} color="#67e8f9">
                                  <span className="text-xl font-semibold tabular-nums text-white">{Math.round(watchStats.watchPercentage)}%</span>
                                  <span className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-slate-500">{t.videos.watchProgress.complete}</span>
                                </ProgressRing>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mb-3 flex items-baseline justify-between gap-2 text-sm">
                                  <span className="text-slate-400">{t.videos.watchProgress.watched}</span>
                                  <span className="tabular-nums text-slate-100">
                                    {formatTime(watchStats.watchedDuration)} / {formatTime(watchStats.totalDuration)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                  {[
                                    { label: t.videos.watchProgress.pauses, value: `${watchStats.pauseCount}x` },
                                    { label: t.videos.watchProgress.rewinds, value: `${watchStats.rewindCount}x` },
                                    { label: t.videos.watchProgress.speed, value: `${watchStats.playbackSpeed}x` },
                                  ].map((stat) => (
                                    <div key={stat.label}>
                                      <div className="text-lg font-semibold tabular-nums">{stat.value}</div>
                                      <div className="text-[10px] uppercase tracking-wider text-slate-500">{stat.label}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
                            <button type="button" onClick={() => setShowDeepNotes(true)} className={PILL}>
                              <Sparkles className="h-4 w-4" aria-hidden="true" /> {t.videos.deepNotesCta}
                            </button>
                            <button
                              type="button"
                              aria-pressed={showResearch}
                              onClick={() => setShowResearch((v) => !v)}
                              className={showResearch ? PILL_ON : PILL}
                            >
                              <Search className="h-4 w-4" aria-hidden="true" /> {t.videos.researchCta}
                            </button>
                          </div>
                        </div>
                      </GlassPanel>

                      {showResearch && (
                        <Research key={selectedVideo.id} embedded onClose={() => setShowResearch(false)} />
                      )}
                    </motion.div>
                  ) : (
                    <div className="hidden h-96 lg:block">
                      <GlassPanel accent="#a78bfa" className="h-full">
                        <div className="flex h-full items-center justify-center p-6 text-center">
                          <div>
                            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-400/10 text-violet-300 shadow-[0_0_30px_rgba(139,92,246,.25)]">
                              <Play className="h-7 w-7" aria-hidden="true" />
                            </span>
                            <p className="text-slate-400">{t.videos.selectVideoPrompt}</p>
                          </div>
                        </div>
                      </GlassPanel>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
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