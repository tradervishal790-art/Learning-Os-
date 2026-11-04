import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CircleX, Star, Check, Flame, Lock, Route, Target, CircleCheck, Clock, X as CloseIcon, ChartNoAxesColumn, Link2, CircleHelp, Globe, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { getRoadmapData, getRoadmapProgress, markTopicFinished, hydrateRoadmapDataFromCloud } from './roadmapData';
import { hasSavedVideoForTopic, getSavedVideoIdForTopic } from './VideoIntel';
import { MAX_ACTIVE_GOALS } from './goalsStore';
import type { Topic, Video, UserOnboardingData, Goal, TopicBridge } from './types';
import { buildCandidatePoolForConcept } from './conceptVideoPool';
import { selectPlaylistForConceptV2, analyzedVideoToVideo, getLastTeacherForConcept } from './PlaylistBuilder';
import { getLearningProfile } from './learningProfileStore';
import { expandSearchQuery } from './queryExpander';
import DeepDiveChat from './DeepDiveChat';
import HintBubble from './HintBubble';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { getSharedVideoLearningSummaries } from './sharedLearningIntelligence';
import { GlassButton, GlassPanel, ProgressRing } from './ui/kit';

const statusIcons: Record<Topic['status'], ReactNode> = {
  mastered: <Star className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2} fill="currentColor" />,
  completed: <Check className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} />,
  learning: <Flame className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2} />,
  locked: <Lock className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2} />,
};

const statusStyles: Record<Topic['status'], { bg: string; border: string; text: string }> = {
  mastered: { bg: 'card', border: 'border-transparent', text: 'text-emerald-600 dark:text-emerald-400' },
  completed: { bg: 'card', border: 'border-transparent', text: 'text-emerald-600 dark:text-emerald-400' },
  learning: { bg: 'card', border: 'border-indigo-400 dark:border-indigo-400/60', text: 'text-indigo-600 dark:text-indigo-400' },
  locked: { bg: 'card', border: 'border-transparent', text: 'text-gray-400 dark:text-white/40' },
};

const difficultyConfig: Record<Topic['difficulty'], string> = {
  Beginner: 'text-gray-500 dark:text-white/60',
  Intermediate: 'text-gray-600 dark:text-white/70',
  Advanced: 'text-gray-700 dark:text-white/80',
};

interface RoadmapProps {
  /** Onboarding data (role/goal/language/hours) — needed to build the
   *  Blueprint for query expansion so roadmap-topic searches get the
   *  same personalized YouTube queries the Custom Playlist flow already gets. */
  userData: UserOnboardingData | null;
  /** Called with the ranked primary + 2 fallback videos, so the parent can
   *  switch to the Video Intelligence page and preload them into the player.
   *  `bridge`, when present, tells VideoIntel how this topic's video connects
   *  to the one the learner just finished — see TopicBridge. `topicId` tells
   *  the parent which topic's OWN saved-video slot this playlist belongs to
   *  (see VideoIntel's activeTopicId) — without it, every topic in a goal
   *  shared one saved-video slot and topics could show each other's videos. */
  onLaunchPlaylist: (payload: { primary: Video; fallbacks: Video[]; bridge?: TopicBridge; previousVideoId?: string | null; topicId: string }) => void;
  /** Opens the Videos page showing whatever was last searched/watched for
   *  THIS SPECIFIC topic, with no new search — the "Saved video" button. */
  onOpenSavedVideo: (topicId: string) => void;
  /** Updates userData.goal/hours/deadline to the typed subject + slider
   *  values and generates a roadmap for it directly from this page — powers
   *  the empty-state "type a subject, set your time, and go" form (no
   *  roadmap yet, or a previous generation failed). `deadlineDays` is the
   *  exact day count from the Day/Week/Month slider; `deadlineLabel` is the
   *  human-readable text (e.g. "4 hafte") stored for display. */
  onGenerateForSubject?: (
    subject: string,
    hours: number,
    deadlineDays: number,
    deadlineLabel: string,
    examType?: string
  ) => Promise<boolean>;
  /** Actual server/network error from the last generation attempt (e.g.
   *  missing API key, Gemini quota, bad JSON) — shown under the form so the
   *  cause is visible instead of a generic "something went wrong". */
  lastRoadmapError?: string | null;
  /** Up to MAX_ACTIVE_GOALS goals can run simultaneously — each with its
   *  own roadmap, switched between via the tab strip below the header. */
  goals: Goal[];
  activeGoalId: string | null;
  onAddGoal: () => boolean;
  onEndGoal: (goalId: string, outcome?: 'completed' | 'abandoned') => void;
  onSwitchGoal: (goalId: string) => void;
}

export default function Roadmap({
  userData,
  onLaunchPlaylist,
  onOpenSavedVideo,
  onGenerateForSubject,
  lastRoadmapError,
  goals,
  activeGoalId,
  onAddGoal,
  onEndGoal,
  onSwitchGoal,
}: RoadmapProps) {
  const t = useTranslation();
  const statusLabels: Record<Topic['status'], string> = {
    mastered: t.roadmap.statusLabels.mastered,
    completed: t.roadmap.statusLabels.completed,
    learning: t.roadmap.statusLabels.learning,
    locked: t.roadmap.statusLabels.locked,
  };
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [completionFeedback, setCompletionFeedback] = useState<{ completed: string; next: string | null } | null>(null);
  const [showFullJourney, setShowFullJourney] = useState(true);
  // Which teaching process is currently active for the launched playlist —
  // only set on the 'personality_v1' path, used to decide the push-trigger
  // behavior in handleMarkComplete/handleWatchVideos below. Control-group
  // users always have this null, so their flow is untouched.
  const [activeTeachingProcess, setActiveTeachingProcess] = useState<import('./personalityEngine').TeachingProcess | null>(null);
  // Gate for Converging-type push flow: 'true' means the challenge prompt
  // modal should render; only ever set true when pushTrigger === 'on_challenge_submit'.
  const [showChallengePrompt, setShowChallengePrompt] = useState(false);
  // True once the user has confirmed they attempted the challenge — lets
  // handleMarkComplete's re-entry actually finish instead of re-prompting.
  const [pendingChallengeCleared, setPendingChallengeCleared] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState('');
  const [topicHours, setTopicHours] = useState(0);
  const [topicDeadline, setTopicDeadline] = useState('');
  const [showDeepDive, setShowDeepDive] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');
  const [examTypeInput, setExamTypeInput] = useState('');
  const [hoursInput, setHoursInput] = useState(10);
  const [deadlineUnit, setDeadlineUnit] = useState<'day' | 'week' | 'month'>('week');
  const [deadlineValue, setDeadlineValue] = useState(4); // matches 'week' default range below
  const [generating, setGenerating] = useState(false);
  const [generateFailed, setGenerateFailed] = useState(false);
  const [confirmEndGoal, setConfirmEndGoal] = useState(false);
  // Bumped after a manual "Mark as Complete" so `roadmap` below (read fresh
  // from storage on every render) re-fetches the just-updated data — the
  // state value itself is unused, only the setter's re-render matters.
  const [, forceRefresh] = useState(0);

  // ON-DEMAND CLOUD HYDRATION: pulls this goal's roadmap down from
  // Firestore for a device that doesn't have it yet, but only when the
  // Roadmap page is actually opened and only for the goal currently being
  // viewed — not every goal the user has, and not upfront on sign-in.
  // No-op (and near-instant) if this device already has the data.
  useEffect(() => {
    if (!activeGoalId) return;
    void hydrateRoadmapDataFromCloud(activeGoalId).then(() => forceRefresh((n) => n + 1));
  }, [activeGoalId]);

  const activeGoals = goals.filter((g) => g.status === 'active');
  const canAddGoal = activeGoals.length < MAX_ACTIVE_GOALS;

  const roadmap = getRoadmapData(activeGoalId);
  const { total: totalTopics, completed: completedTopics, learning: learningTopics, percent: progressPercent } =
    getRoadmapProgress(roadmap);
  const currentTopic = roadmap.children?.find((topic) => topic.status === 'learning');
  const currentTopicIndex = currentTopic ? roadmap.children?.findIndex((topic) => topic.id === currentTopic.id) ?? -1 : -1;
  // If there is no active step (for example, the journey is complete), never hide the entire roadmap.
  const isJourneyExpanded = showFullJourney || !currentTopic;

  // No roadmap yet — either never generated, or a previous attempt failed.
  // Either way, the fix is the same: let the user type a subject + set
  // their weekly time right here and generate, instead of sending them
  // back through onboarding/Settings.
  const hasNoRoadmap = roadmap.id === 'no-roadmap' || !activeGoalId;

  // One slider, range/default swap based on the Day/Week/Month toggle —
  // not three separate sliders. Defaults chosen to land near a "1 month"
  // deadline regardless of which unit is picked, so switching units
  // mid-way doesn't suddenly imply a wildly different total timeframe.
  const DEADLINE_UNIT_CONFIG = {
    day: { min: 1, max: 30, default: 30, label: (v: number) => `${v} ${v === 1 ? 'din' : 'din'}` },
    week: { min: 1, max: 12, default: 4, label: (v: number) => `${v} ${v === 1 ? 'hafta' : 'hafte'}` },
    month: { min: 1, max: 12, default: 1, label: (v: number) => `${v} ${v === 1 ? 'mahina' : 'mahine'}` },
  } as const;

  const handleDeadlineUnitChange = (unit: 'day' | 'week' | 'month') => {
    setDeadlineUnit(unit);
    setDeadlineValue(DEADLINE_UNIT_CONFIG[unit].default);
  };

  // Exact day count sent to the backend — replaces the old 5-preset
  // (none/1m/3m/6m/1y) lookup with the precise value from the slider.
  const deadlineDays =
    deadlineUnit === 'day' ? deadlineValue : deadlineUnit === 'week' ? deadlineValue * 7 : deadlineValue * 30;

  const handleGenerateClick = async () => {
    if (!onGenerateForSubject || !subjectInput.trim()) return;
    setGenerating(true);
    setGenerateFailed(false);
    const success = await onGenerateForSubject(
      subjectInput.trim(),
      hoursInput,
      deadlineDays,
      DEADLINE_UNIT_CONFIG[deadlineUnit].label(deadlineValue),
      examTypeInput.trim() || undefined
    );
    if (!success) setGenerateFailed(true);
    setGenerating(false);
  };

  const openTopic = (topic: Topic) => {
    setSelectedTopic(topic);
    setShowWhy(false);
    setPlaylistError('');
    setTopicHours(0);
    setTopicDeadline('');
  };

  /** The topic immediately before `topic` in the roadmap's flat sequence —
   *  used to build the "connects to what you just watched" bridge. Returns
   *  null for the first topic (nothing to connect from) or if the topic
   *  isn't found in the current roadmap's children. */
  const getPreviousTopic = (topic: Topic): Topic | null => {
    const index = (roadmap.children ?? []).findIndex((t) => t.id === topic.id);
    if (index <= 0) return null;
    return roadmap.children![index - 1];
  };

  /** Builds the bridge for `topic`, if there's a previous topic AND
   *  generate-roadmap.ts actually wrote a non-empty `why.connect` for it —
   *  no bridge is better than a blank/placeholder one. */
  const getBridgeForTopic = (topic: Topic): TopicBridge | undefined => {
    const previousTopic = getPreviousTopic(topic);
    if (!previousTopic || !topic.why?.connect?.trim()) return undefined;
    return {
      fromTopicTitle: previousTopic.title,
      toTopicTitle: topic.title,
      connectText: topic.why.connect.trim(),
    };
  };

  /**
   * Resolves the previous topic's ACTUALLY-watched videoId, if any, so
   * VideoIntel.tsx can verify the bridge against whichever video the
   * learner ends up picking for the next topic — primary or a fallback —
   * instead of this file assuming primary upfront. No API call happens
   * here; VideoIntel.tsx's verifyBridgeForVideo() does the one small
   * fact-vs-fact call, re-run every time the learner picks a different
   * video from the list. See conceptVideoPool.ts's getCachedConnectorFacts
   * for why that call never re-sends either transcript.
   */
  const getPreviousWatchedVideoId = (topic: Topic): string | null => {
    const previousTopic = getPreviousTopic(topic);
    if (!previousTopic) return null;
    return getSavedVideoIdForTopic(activeGoalId ?? undefined, previousTopic.id);
  };

  // Manual override for when the auto-detect (video watch % / keyword
  // match) doesn't cooperate — lets the learner mark a topic done and move
  // on without having to keep re-watching a video to retrigger it.
  //
  // PUSH-TRIGGER BRANCH (personality_v1 only): control-group users (or
  // personality_v1 users with no active teaching process yet) fall through
  // to the exact same immediate-finish behavior as before — nothing changes
  // for them. For personality_v1 users with an active teaching process, the
  // process' pushTrigger decides whether "done" advances immediately
  // ('on_video_end'), needs the existing checklist gate ('on_checklist_complete' —
  // same markTopicFinished call, no extra gate added here since Roadmap.tsx
  // doesn't have a separate checklist UI yet), or should show a challenge
  // prompt first ('on_challenge_submit') before actually finishing the topic.
  const handleMarkComplete = () => {
    if (!selectedTopic) return;

    if (activeTeachingProcess?.pushTrigger === 'on_challenge_submit' && !pendingChallengeCleared) {
      setShowChallengePrompt(true);
      return;
    }

    const completedTitle = selectedTopic.title;
    const topicIndex = (roadmap.children ?? []).findIndex((topic) => topic.id === selectedTopic.id);
    const nextTopic = topicIndex >= 0 ? roadmap.children?.slice(topicIndex + 1).find((topic) => topic.status === 'locked') : undefined;
    setCompletionFeedback({ completed: completedTitle, next: nextTopic?.title ?? null });
    markTopicFinished(activeGoalId ?? undefined, selectedTopic.id, 'completed');
    setSelectedTopic(null);
    setActiveTeachingProcess(null);
    setShowChallengePrompt(false);
    setPendingChallengeCleared(false);
    forceRefresh((n) => n + 1);
  };

  /** Called when the user confirms they've done the applied challenge
   *  (Converging type). Clears the gate and re-runs handleMarkComplete
   *  so the actual finish logic isn't duplicated. */
  const handleChallengeSubmit = () => {
    setPendingChallengeCleared(true);
    setShowChallengePrompt(false);
    // Re-run on next tick so the state update above is visible to handleMarkComplete.
    setTimeout(() => handleMarkComplete(), 0);
  };

  const handleWatchVideos = async () => {
    if (!selectedTopic) return;

    const learnerProfile = getLearningProfile();
    if (!learnerProfile) {
      setPlaylistError('Complete the Learning Style Quiz first.');
      return;
    }

    setPlaylistError('');
    setPlaylistLoading(true);
    try {
      // Timing choice stored for the Revision engine to read later,
      // AND now also fed into the ranking algorithm below (timing param)
      // so a tight deadline actually biases which videos get picked.
      if (topicHours || topicDeadline) {
        try {
          localStorage.setItem(
            'learning_os_topic_timing',
            JSON.stringify({ topic: selectedTopic.title, hours: topicHours, deadline: topicDeadline })
          );
        } catch {
          // non-fatal
        }
      }

      // FIX: pehle yahan buildCandidatePoolForConcept() bina expandedQueries
      // ke call ho raha tha, jisse ye silently buildFallbackQueries() (sirf
      // topic-title cleaning) pe gir jaata tha — na learner ka style (pace,
      // depth, practical) use hota tha, na hi time-pressure. Ab Custom
      // Playlist flow (Dashboard.tsx) jaisa hi expand-query call karte hain,
      // taaki roadmap ke topics ke liye bhi personalized queries banein.
      //
      // FIX 2: `goal` yahan userData.goal (ek hi global onboarding field)
      // se nahi, balki CURRENTLY ACTIVE goal ke title se lena chahiye —
      // multi-goal setup (n8n + Agwentic AI) mein userData.goal sirf ek hi
      // goal ko reflect karta hai, chahe koi bhi tab open ho. Isse dusre
      // goal ka topic search karte waqt AI ko galat "overall goal" context
      // milta tha, jisse query expansion generic/irrelevant results deta
      // tha (e.g. n8n ke "Data Structure" topic ke liye generic DSA video).
      const activeGoalTitle = goals.find((g) => g.id === activeGoalId)?.title ?? userData?.goal;

      let queries: string[] | undefined;
      if (userData) {
        const blueprint = {
          role: userData.role,
          goal: activeGoalTitle ?? userData.goal,
          language: userData.language,
          // Is topic ke liye explicitly chuna gaya hours/week agar hai to
          // use karo (onboarding ke weekly hours se zyada relevant hai
          // is specific topic ke liye), warna onboarding wala fallback.
          hours: topicHours || userData.hours,
          style: {
            pace: learnerProfile.pace,
            practical: learnerProfile.theoryVsPractical,
            depth: learnerProfile.depth,
            structure: learnerProfile.structureNeed,
            storytelling: learnerProfile.storytelling,
            languageComplexity: learnerProfile.languageComplexity,
          },
        };
        try {
          const expansion = await expandSearchQuery(selectedTopic.title, blueprint);
          if (expansion?.queries && expansion.queries.length > 0) {
            queries = expansion.queries;
          }
        } catch {
          // Expansion failed — buildCandidatePoolForConcept falls back to
          // cleaned-title queries on its own, no need to block here.
        }
      }

      const candidates = await buildCandidatePoolForConcept(selectedTopic, queries, userData?.language, true);
      if (candidates.length === 0) {
        setPlaylistError('No good video found. Please try again in a bit.');
        return;
      }

      const currentTeacherId = getLastTeacherForConcept(selectedTopic.id);
      const communitySignals = await getSharedVideoLearningSummaries(candidates.map((video) => video.videoId));
      const result = selectPlaylistForConceptV2(candidates, learnerProfile, currentTeacherId, {
        hours: topicHours,
        deadline: topicDeadline,
      }, communitySignals);
      if (!result) {
        setPlaylistError('Playlist could not be built, please try again.');
        return;
      }

      // 'control' variant -> teachingProcess is undefined -> this stays null,
      // so handleMarkComplete's push-trigger branch below is a no-op for them,
      // exactly like today.
      setActiveTeachingProcess(result.teachingProcess ?? null);

      // No API call here anymore — VideoIntel.tsx verifies against whichever
      // video the learner actually ends up picking (primary or fallback).
      // This file only hands over the unverified claim + the previous
      // topic's watched videoId so that re-check can happen there.
      const bridge = getBridgeForTopic(selectedTopic);
      const previousVideoId = getPreviousWatchedVideoId(selectedTopic);

      onLaunchPlaylist({
        primary: analyzedVideoToVideo(result.primary),
        fallbacks: result.fallbacks.map(analyzedVideoToVideo),
        bridge,
        previousVideoId,
        topicId: selectedTopic.id,
      });
      setSelectedTopic(null);
    } catch (err: any) {
      setPlaylistError(err.message || 'Something went wrong.');
    } finally {
      setPlaylistLoading(false);
    }
  };

  const topicTone = (status: Topic['status']) => status === 'learning'
    ? { accent: '#a78bfa', text: 'text-violet-300' }
    : status === 'locked'
    ? { accent: '#64748b', text: 'text-slate-500' }
    : { accent: '#6ee7b7', text: 'text-emerald-300' };

  return (
    <div className="dark">
    <div className="relative mx-auto max-w-6xl overflow-hidden rounded-none bg-[#080d19] p-4 text-slate-100 md:m-4 md:rounded-3xl md:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-violet-600/[0.12] blur-[120px]" />
        <div className="absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />
      </div>
      <div className="relative">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200"><Route className="h-5 w-5" strokeWidth={1.75} /></span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight md:text-3xl">{t.roadmap.header.title}</h1>
          <p className="text-xs text-slate-400 md:text-sm">{t.roadmap.header.subtitle}</p>
        </div>
      </motion.div>

      {/* Goal tabs — up to MAX_ACTIVE_GOALS active goals at once */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="-mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:mb-6 md:flex-wrap md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {activeGoals.map((g) => (
          <button
            key={g.id}
            onClick={() => onSwitchGoal(g.id)}
            aria-pressed={g.id === activeGoalId}
            className={`h-10 max-w-[220px] flex-shrink-0 truncate rounded-full px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
              g.id === activeGoalId
                ? 'bg-violet-500 text-white shadow-[0_0_18px_rgba(139,92,246,.45)]'
                : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.09]'
            }`}
            title={g.title || t.roadmap.goalTabs.newGoal}
          >
            <Target className="-mt-0.5 mr-1.5 inline h-4 w-4" strokeWidth={1.75} />{g.title || t.roadmap.goalTabs.newGoal}
          </button>
        ))}

        {canAddGoal ? (
          <button
            onClick={onAddGoal}
            className="flex-shrink-0 rounded-xl border border-dashed border-white/20 px-4 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            {t.roadmap.goalTabs.addGoal}
          </button>
        ) : (
          <span className="hidden px-1 text-[11px] text-slate-500 md:inline">
            {format(t.roadmap.goalTabs.maxGoalsNote, MAX_ACTIVE_GOALS)}
          </span>
        )}

        {activeGoalId && !hasNoRoadmap && (
          <button
            onClick={() => setConfirmEndGoal(true)}
            aria-label={t.roadmap.goalTabs.endGoal}
            title={t.roadmap.goalTabs.endGoal}
            className="ml-auto inline-flex h-10 min-w-10 flex-shrink-0 items-center justify-center gap-1.5 rounded-full border border-red-500/25 px-3 text-xs font-medium text-red-300 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            <CircleX className="h-4 w-4 md:hidden" strokeWidth={1.75} />
            <span className="hidden md:inline">{t.roadmap.goalTabs.endGoal}</span>
          </button>
        )}
      </motion.div>

      {/* End-goal confirmation */}
      <AnimatePresence>
        {confirmEndGoal && activeGoalId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmEndGoal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-2xl max-w-sm w-full p-6 text-black dark:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2">{t.roadmap.endGoalModal.title}</h3>
              <p className="text-sm text-gray-500 dark:text-white/50 mb-5">
                {format(t.roadmap.endGoalModal.body, roadmap.title)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmEndGoal(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  {t.roadmap.endGoalModal.cancel}
                </button>
                <button
                  onClick={() => {
                    onEndGoal(activeGoalId, 'abandoned');
                    setConfirmEndGoal(false);
                  }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition"
                >
                  {t.roadmap.endGoalModal.confirm}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero: progress ring + the goal's own title/description + three stats */}
      {!hasNoRoadmap && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="mb-4">
          <GlassPanel accent="#a78bfa" className="border-violet-300/20 bg-gradient-to-br from-violet-500/[0.10] to-transparent">
            <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center md:p-6">
              <ProgressRing value={progressPercent} size={124} stroke={10} color="#a78bfa">
                <span className="text-3xl font-semibold tabular-nums text-white">{progressPercent}%</span>
                <span className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-slate-500">{t.roadmap.stats.progress}</span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold leading-snug text-white md:text-2xl">{roadmap.title}</h2>
                <p className="mt-1 line-clamp-3 text-sm text-slate-400">{roadmap.description}</p>
                <span className="mt-3 inline-block rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">{roadmap.difficulty}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-white/[0.07] border-t border-white/[0.07]">
              {[
                { label: t.roadmap.stats.done, value: `${completedTopics}/${totalTopics}`, Icon: CircleCheck, tone: 'text-emerald-300' },
                { label: t.roadmap.stats.inProgress, value: String(learningTopics), Icon: Flame, tone: 'text-amber-300' },
                { label: t.roadmap.stats.estTime, value: String(roadmap.estimatedTime), Icon: Clock, tone: 'text-cyan-300' },
              ].map(({ label, value, Icon, tone }) => (
                <div key={label} aria-label={`${label}: ${value}`} className="min-w-0 px-3 py-3 md:px-5 md:py-4">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500"><Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} strokeWidth={1.75} /><span className="truncate">{label}</span></div>
                  <div className="mt-1 truncate text-base font-semibold tabular-nums text-white md:text-xl">{value}</div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {completionFeedback && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <CircleCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-200">{t.roadmap.journey.completedTitle}: {completionFeedback.completed}</p>
            <p className="mt-0.5 text-xs text-slate-300">
              {completionFeedback.next
                ? format(t.roadmap.journey.nextUnlocked, completionFeedback.next)
                : t.roadmap.journey.allComplete}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCompletionFeedback(null)}
            aria-label={t.roadmap.dismissLabel}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {currentTopic && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
          aria-labelledby="roadmap-next-step-title"
          className="mb-6"
        >
          <GlassPanel accent="#a78bfa" className="border-violet-300/30 bg-violet-500/[0.08]">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-violet-300/70 animate-ping motion-reduce:hidden" /><span className="relative inline-flex h-2 w-2 rounded-full bg-violet-300" /></span>
                  {t.roadmap.journey.nextUp}
                </div>
                <p className="mb-1 text-[10px] text-slate-500">{format(t.roadmap.step, currentTopicIndex + 1)} · {currentTopic.estimatedTime}</p>
                <h2 id="roadmap-next-step-title" className="text-base font-semibold leading-snug text-white md:text-lg">{currentTopic.title}</h2>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{currentTopic.description}</p>
              </div>
              <button
                type="button"
                onClick={() => openTopic(currentTopic)}
                className="inline-flex min-h-10 flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(139,92,246,.4)] transition hover:bg-violet-400 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"
              >
                {t.roadmap.journey.openStep}
                <Target className="h-4 w-4" />
              </button>
            </div>
          </GlassPanel>
        </motion.section>
      )}

      {/* No roadmap yet: the goal's placeholder title + the generate form */}
      {hasNoRoadmap && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="mb-6">
          <GlassPanel accent="#67e8f9">
            <div className="p-4 md:p-6">
              <div className="flex items-start gap-3 md:gap-4">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,.4)]"><Target className="h-6 w-6" strokeWidth={1.75} /></span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-snug text-white md:text-xl">{roadmap.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{roadmap.description}</p>
                </div>
              </div>
        {hasNoRoadmap && !activeGoalId && (
          <div className="mt-5 p-5 rounded-xl border border-dashed border-gray-300 dark:border-white/20 text-center text-sm text-gray-500 dark:text-white/50">
            {t.roadmap.noActiveGoal}
          </div>
        )}

        {hasNoRoadmap && activeGoalId && onGenerateForSubject && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
            <label className="block text-sm font-semibold mb-2">{t.roadmap.generateForm.label}</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateClick()}
                placeholder={t.roadmap.generateForm.placeholder}
                autoFocus
                className="flex-1 px-4 py-2.5 rounded-lg text-sm border border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 focus:outline-none focus:border-black dark:focus:border-white"
              />
              <button
                onClick={handleGenerateClick}
                disabled={generating || !subjectInput.trim()}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white hover:opacity-80 transition disabled:opacity-40 flex-shrink-0"
              >
                {generating ? t.roadmap.generateForm.generatingCta : t.roadmap.generateForm.generateCta}
              </button>
            </div>

            <details className="mt-4 rounded-xl border border-gray-200 dark:border-white/10 px-3 py-2.5">
              <summary className="cursor-pointer list-none text-sm font-medium text-gray-600 dark:text-white/70">{t.roadmap.generateForm.customizeSummary} <span className="text-xs font-normal text-gray-400">{t.roadmap.generateForm.customizeOptional}</span></summary>
              <div className="mt-4">
              <label className="block text-sm font-semibold mb-2">
                {t.roadmap.generateForm.examLabel} <span className="font-normal text-gray-400 dark:text-white/40">{t.roadmap.generateForm.examOptional}</span>
              </label>
              <input
                type="text"
                value={examTypeInput}
                onChange={(e) => setExamTypeInput(e.target.value)}
                placeholder={t.roadmap.generateForm.examPlaceholder}
                className="w-full px-4 py-2.5 rounded-lg text-sm border border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 focus:outline-none focus:border-black dark:focus:border-white"
              />
              <p className="text-[11px] text-gray-400 dark:text-white/40 mt-1.5">
                {t.roadmap.generateForm.examHint}
              </p>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold">{t.roadmap.generateForm.weeklyTimeLabel}</label>
                <span className="text-sm font-mono px-2 py-0.5 rounded-md bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white">
                  {format(t.roadmap.generateForm.hoursPerWeek, hoursInput)}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={40}
                step={1}
                value={hoursInput}
                onChange={(e) => setHoursInput(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-white/10 accent-black dark:accent-white"
              />
              <div className="flex justify-between text-[11px] text-gray-400 dark:text-white/40 mt-1">
                <span>{format(t.roadmap.generateForm.hoursMin, 1)}</span>
                <span>{format(t.roadmap.generateForm.hoursMax, 40)}</span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-white/40 mt-1.5">
                {t.roadmap.generateForm.weeklyTimeHint}
              </p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold mb-2">{t.roadmap.generateForm.timeLimitLabel}</label>
              <div className="flex gap-2 mb-3">
                {(['day', 'week', 'month'] as const).map((unit) => (
                  <button
                    key={unit}
                    onClick={() => handleDeadlineUnitChange(unit)}
                    className={`flex-1 py-2 rounded-lg text-sm border transition capitalize ${
                      deadlineUnit === unit
                        ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white border-transparent'
                        : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {unit === 'day' ? t.roadmap.generateForm.unitDay : unit === 'week' ? t.roadmap.generateForm.unitWeek : t.roadmap.generateForm.unitMonth}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 dark:text-white/40">{t.roadmap.generateForm.deadlineLabel}</span>
                <span className="text-sm font-mono px-2 py-0.5 rounded-md bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white">
                  {DEADLINE_UNIT_CONFIG[deadlineUnit].label(deadlineValue)}
                </span>
              </div>
              <input
                type="range"
                min={DEADLINE_UNIT_CONFIG[deadlineUnit].min}
                max={DEADLINE_UNIT_CONFIG[deadlineUnit].max}
                step={1}
                value={deadlineValue}
                onChange={(e) => setDeadlineValue(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-white/10 accent-black dark:accent-white"
              />
              <div className="flex justify-between text-[11px] text-gray-400 dark:text-white/40 mt-1">
                <span>{DEADLINE_UNIT_CONFIG[deadlineUnit].label(DEADLINE_UNIT_CONFIG[deadlineUnit].min)}</span>
                <span>{DEADLINE_UNIT_CONFIG[deadlineUnit].label(DEADLINE_UNIT_CONFIG[deadlineUnit].max)}</span>
              </div>
              </div>
            </details>

            {generateFailed && (
              <div className="mt-3">
                <p className="text-xs text-red-600 dark:text-red-400">{t.roadmap.generateForm.generateFailed}</p>
                {lastRoadmapError && (
                  <p className="text-[11px] font-mono text-red-500/70 dark:text-red-400/60 mt-1 break-all">
                    {lastRoadmapError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {totalTopics > 0 && (
        <>
          {/* The learning path: nodes alternate along a central spine on wide screens, stack on phones. */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">{t.roadmap.journey.journeyTitle}</h2>
            {currentTopic && (
              <button
                type="button"
                onClick={() => setShowFullJourney((visible) => !visible)}
                aria-expanded={isJourneyExpanded}
                className="rounded-lg px-3 py-2 text-xs font-medium text-violet-300 transition hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                {isJourneyExpanded ? t.roadmap.journey.showLess : format(t.roadmap.journey.showAll, totalTopics)}
              </button>
            )}
          </div>
          <ol className="relative">
            {roadmap.children?.map((topic, i) => {
              if (!isJourneyExpanded && topic.status !== 'learning') return null;
              const count = roadmap.children?.length ?? 0;
              const isFirst = i === 0;
              const isLast = i === count - 1;
              const isLocked = topic.status === 'locked';
              const isDone = topic.status === 'completed' || topic.status === 'mastered';
              const isActive = topic.status === 'learning';
              const prev = i > 0 ? roadmap.children?.[i - 1] : undefined;
              const prevDone = prev ? prev.status === 'completed' || prev.status === 'mastered' : false;
              const tone = topicTone(topic.status);
              const onLeft = i % 2 === 0;
              const lineDone = 'w-0.5 bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,.6)]';
              const lineOpen = 'w-0 border-l-2 border-dashed border-white/15';
              return (
                <li key={topic.id} id={isActive ? 'roadmap-current' : undefined} className="grid grid-cols-[auto_1fr] gap-x-3 md:grid-cols-[1fr_auto_1fr] md:gap-x-6">
                  <div className="relative col-start-1 row-start-1 w-9 md:col-start-2">
                    {!isFirst && <span aria-hidden="true" className={`absolute left-1/2 top-0 h-[1.125rem] -translate-x-1/2 ${prevDone ? lineDone : lineOpen}`} />}
                    {!isLast && <span aria-hidden="true" className={`absolute bottom-0 left-1/2 top-[1.125rem] -translate-x-1/2 ${isDone ? lineDone : isActive ? 'w-0 border-l-2 border-dashed border-violet-300/50' : lineOpen}`} />}
                    <span
                      title={statusLabels[topic.status]}
                      aria-label={statusLabels[topic.status]}
                      className={`absolute left-1/2 top-0 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full ${
                        isDone
                          ? 'border border-emerald-300/50 bg-emerald-400/15 text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,.35)]'
                          : isActive
                          ? 'bg-violet-500 text-white shadow-[0_0_22px_rgba(139,92,246,.7)]'
                          : 'border border-white/15 bg-[#0b1221] text-slate-500'
                      }`}
                    >
                      {isActive && <span aria-hidden="true" className="absolute inset-0 rounded-full bg-violet-400/40 animate-ping motion-reduce:hidden" />}
                      <span className="relative">{statusIcons[topic.status]}</span>
                    </span>
                  </div>

                  <div className={`col-start-2 row-start-1 pb-4 md:pb-6 ${onLeft ? 'md:col-start-1' : 'md:col-start-3'}`}>
                    <GlassButton
                      onClick={() => openTopic(topic)}
                      disabled={isLocked}
                      accent={tone.accent}
                      className={`w-full ${isActive ? 'border-violet-300/40 bg-violet-500/[0.07] shadow-[0_0_28px_rgba(139,92,246,.18)]' : ''} ${isLocked ? 'opacity-55' : ''}`}
                    >
                      <span className="block p-4 md:p-5">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-wider">
                          <span className="text-slate-500">{format(t.roadmap.step, i + 1)}</span>
                          <span className="text-slate-400">• {topic.difficulty}</span>
                          {topic.examWeightage && (
                            <span
                              title={t.roadmap.examWeightageTitle}
                              className={`rounded px-1.5 py-0.5 ${
                                topic.examWeightage === 'high' ? 'bg-red-500/15 text-red-300' : topic.examWeightage === 'medium' ? 'bg-amber-400/15 text-amber-300' : 'bg-white/10 text-slate-400'
                              }`}
                            >
                              {topic.examWeightage === 'high' ? t.roadmap.examWeightage.high : topic.examWeightage === 'medium' ? t.roadmap.examWeightage.medium : t.roadmap.examWeightage.low}
                            </span>
                          )}
                          <span className={`ml-auto ${tone.text}`}>{statusLabels[topic.status]}</span>
                        </span>
                        <span className="mt-1.5 block text-sm font-semibold leading-snug text-white md:text-base">{topic.title}</span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-slate-400">{topic.description}</span>
                        <span className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" strokeWidth={1.75} />{topic.estimatedTime}</span>
                      </span>
                    </GlassButton>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {/* Modal */}
      <AnimatePresence>
        {selectedTopic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
            onClick={() => setSelectedTopic(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-t-3xl md:rounded-3xl max-w-3xl w-full max-h-[90dvh] overflow-auto text-black dark:text-white"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 md:p-6 border-b border-gray-200 dark:border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusStyles[selectedTopic.status].border} ${statusStyles[selectedTopic.status].text}`}
                  >
                    {statusLabels[selectedTopic.status]}
                  </span>
                  <button
                    onClick={() => setSelectedTopic(null)}
                    aria-label="Close"
                    className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition flex-shrink-0"
                  >
                    <CloseIcon className="w-5 h-5" strokeWidth={1.75} />
                  </button>
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-2">{selectedTopic.title}</h2>
                <p className="text-gray-500 dark:text-white/60 text-sm">{selectedTopic.description}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 dark:text-white/40">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" strokeWidth={1.75} />{selectedTopic.estimatedTime}</span>
                  <span>•</span>
                  <span className={`inline-flex items-center gap-1 ${difficultyConfig[selectedTopic.difficulty]}`}><ChartNoAxesColumn className="w-3.5 h-3.5" strokeWidth={1.75} />{selectedTopic.difficulty}</span>
                </div>
              </div>

              <div className="flex border-b border-gray-200 dark:border-white/5">
                <button
                  onClick={() => setShowWhy(false)}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition ${!showWhy ? 'border-b-2 border-black dark:border-white' : 'text-gray-400 dark:text-white/50 hover:text-black dark:hover:text-white'}`}
                >
                  {t.roadmap.topicModal.overviewTab}
                </button>
                <button
                  onClick={() => setShowWhy(true)}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition ${showWhy ? 'border-b-2 border-black dark:border-white' : 'text-gray-400 dark:text-white/50 hover:text-black dark:hover:text-white'}`}
                >
                  {t.roadmap.topicModal.whyTab}
                </button>
              </div>

              <div className="p-5 md:p-6">
                {!showWhy ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10">
                      <h3 className="text-sm font-semibold mb-2">{t.roadmap.topicModal.whatYoullLearn}</h3>
                      <p className="text-sm text-gray-500 dark:text-white/60">{selectedTopic.description}</p>
                    </div>

                    {/* Connection bridge — shown BEFORE "Watch videos" so the
                        learner sees how this video picks up from the last one,
                        instead of it feeling like a disconnected new clip.
                        Previously this same text (`why.connect`) only lived
                        buried inside the "Why" tab, easy to never open. */}
                    {(() => {
                      const bridge = getBridgeForTopic(selectedTopic);
                      if (!bridge) return null;
                      return (
                        <>
                        <HintBubble id="bridge" text={t.roadmap.topicModal.bridgeHint} />
                        <div className="p-4 rounded-xl border border-gray-300 dark:border-white/20 card">
                          <div className="flex items-center gap-2 mb-2 text-xs text-gray-400 dark:text-white/40">
                            <span>{bridge.fromTopicTitle}</span>
                            <span>→</span>
                            <span className="text-black dark:text-white font-medium">{bridge.toTopicTitle}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Link2 className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                            <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed">{bridge.connectText}</p>
                          </div>
                        </div>
                        </>
                      );
                    })()}

                    <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10">
                      <button
                        onClick={() => setShowDeepDive(true)}
                        className="w-full text-left px-3 py-3 rounded-lg border border-purple-300/30 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/5 text-sm text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/10 active:scale-[0.99] transition mb-3"
                      >
                        {t.roadmap.topicModal.deepDiveCta}
                      </button>

                      <button
                        onClick={handleWatchVideos}
                        disabled={playlistLoading}
                        className="w-full px-4 py-3.5 md:py-2.5 rounded-lg bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white disabled:opacity-40 text-sm font-semibold transition active:scale-[0.98]"
                      >
                        {playlistLoading ? t.roadmap.topicModal.searchingCta : t.roadmap.topicModal.watchVideosCta}
                      </button>
                      {hasSavedVideoForTopic(activeGoalId ?? undefined, selectedTopic.id) && (
                        <button
                          onClick={() => onOpenSavedVideo(selectedTopic.id)}
                          className="w-full mt-2 px-4 py-3 md:py-2 rounded-lg border border-gray-300 dark:border-white/20 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98] transition"
                        >
                          {t.roadmap.topicModal.savedVideoCta}
                        </button>
                      )}
                      {playlistError && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{playlistError}</p>}

                      {selectedTopic.status !== 'completed' && selectedTopic.status !== 'mastered' && (
                        <button
                          onClick={handleMarkComplete}
                          className="w-full mt-2 px-4 py-3 md:py-2 rounded-lg border border-gray-300 dark:border-white/20 text-sm font-medium text-gray-600 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98] transition"
                        >
                          {t.roadmap.topicModal.markCompleteCta}
                        </button>
                      )}

                      {/* personality_v1 only, Converging type only — appears when
                          handleMarkComplete's pushTrigger check gates completion
                          on an applied challenge. Control-group users never see this. */}
                      {showChallengePrompt && (
                        <div className="mt-3 p-4 rounded-xl border border-gray-300 dark:border-white/20 card">
                          <p className="text-sm font-medium mb-2">
                            {t.roadmap.topicModal.challengeTitle}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-white/50 mb-3">
                            {activeTeachingProcess?.pushStrategy}
                          </p>
                          <button
                            onClick={handleChallengeSubmit}
                            className="w-full px-4 py-2.5 rounded-lg bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white text-sm font-semibold transition active:scale-[0.98]"
                          >
                            {t.roadmap.topicModal.challengeCta}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[
                      { label: t.roadmap.topicModal.whyItems.learn, content: selectedTopic.why.learn, Icon: CircleHelp },
                      { label: t.roadmap.topicModal.whyItems.connect, content: selectedTopic.why.connect, Icon: Link2 },
                      { label: t.roadmap.topicModal.whyItems.system, content: selectedTopic.why.system, Icon: Globe },
                      { label: t.roadmap.topicModal.whyItems.risk, content: selectedTopic.why.risk, Icon: TriangleAlert },
                    ].map((item, i) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-4 rounded-xl border border-gray-200 dark:border-white/10"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <item.Icon className="w-4 h-4" strokeWidth={1.75} />
                          <h3 className="text-sm font-semibold">{item.label}</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed">{item.content}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deep Dive optional Q&A modal */}
      <AnimatePresence>
        {showDeepDive && (
          <DeepDiveChat
            onClose={() => setShowDeepDive(false)}
            onComplete={() => setShowDeepDive(false)}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
    </div>
  );
}
