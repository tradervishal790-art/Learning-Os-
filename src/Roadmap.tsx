import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRoadmapData, getRoadmapProgress, markTopicFinished } from './roadmapData';
import { hasSavedVideoForGoal } from './VideoIntel';
import { MAX_ACTIVE_GOALS } from './goalsStore';
import type { Topic, Video, UserOnboardingData, Goal } from './types';
import { buildCandidatePoolForConcept } from './conceptVideoPool';
import { selectPlaylistForConcept, analyzedVideoToVideo, getLastTeacherForConcept } from './PlaylistBuilder';
import { getLearningProfile } from './learningProfileStore';
import { expandSearchQuery } from './queryExpander';
import DeepDiveChat from './DeepDiveChat';

const statusConfig: Record<Topic['status'], { label: string; bg: string; border: string; text: string; icon: string }> = {
  mastered: { label: 'Mastered', bg: 'bg-gray-50 dark:bg-white/5', border: 'border-gray-200 dark:border-white/10', text: 'text-gray-600 dark:text-white/70', icon: '⭐' },
  completed: { label: 'Done', bg: 'bg-gray-50 dark:bg-white/5', border: 'border-gray-200 dark:border-white/10', text: 'text-gray-600 dark:text-white/70', icon: '✓' },
  learning: { label: 'In Progress', bg: 'bg-gray-50 dark:bg-white/5', border: 'border-gray-300 dark:border-white/20', text: 'text-black dark:text-white', icon: '🔥' },
  locked: { label: 'Locked', bg: 'bg-gray-50 dark:bg-white/5', border: 'border-gray-200 dark:border-white/10', text: 'text-gray-400 dark:text-white/40', icon: '🔒' },
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
   *  switch to the Video Intelligence page and preload them into the player. */
  onLaunchPlaylist: (payload: { primary: Video; fallbacks: Video[] }) => void;
  /** Opens the Videos page showing whatever was last searched/watched for
   *  the active goal, with no new search — the "Saved video" button. */
  onOpenSavedVideo: () => void;
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
    deadlineLabel: string
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
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState('');
  const [topicHours, setTopicHours] = useState(0);
  const [topicDeadline, setTopicDeadline] = useState('');
  const [showDeepDive, setShowDeepDive] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');
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

  const activeGoals = goals.filter((g) => g.status === 'active');
  const canAddGoal = activeGoals.length < MAX_ACTIVE_GOALS;

  const roadmap = getRoadmapData(activeGoalId ?? undefined);
  const { total: totalTopics, completed: completedTopics, learning: learningTopics, percent: progressPercent } =
    getRoadmapProgress(roadmap);

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
      DEADLINE_UNIT_CONFIG[deadlineUnit].label(deadlineValue)
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

  // Manual override for when the auto-detect (video watch % / keyword
  // match) doesn't cooperate — lets the learner mark a topic done and move
  // on without having to keep re-watching a video to retrigger it.
  const handleMarkComplete = () => {
    if (!selectedTopic) return;
    markTopicFinished(activeGoalId ?? undefined, selectedTopic.id, 'completed');
    setSelectedTopic(null);
    forceRefresh((n) => n + 1);
  };

  const handleWatchVideos = async () => {
    if (!selectedTopic) return;

    const learnerProfile = getLearningProfile();
    if (!learnerProfile) {
      setPlaylistError('Pehle Learning Style Quiz complete karo.');
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
      let queries: string[] | undefined;
      if (userData) {
        const blueprint = {
          role: userData.role,
          goal: userData.goal,
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
        setPlaylistError('Koi achhi video nahi mili. Thodi der baad try karo.');
        return;
      }

      const currentTeacherId = getLastTeacherForConcept(selectedTopic.id);
      const result = selectPlaylistForConcept(candidates, learnerProfile, currentTeacherId, {
        hours: topicHours,
        deadline: topicDeadline,
      });
      if (!result) {
        setPlaylistError('Playlist ban nahi payi, dobara try karo.');
        return;
      }

      onLaunchPlaylist({
        primary: analyzedVideoToVideo(result.primary),
        fallbacks: result.fallbacks.map(analyzedVideoToVideo),
      });
      setSelectedTopic(null);
    } catch (err: any) {
      setPlaylistError(err.message || 'Kuch gadbad ho gayi.');
    } finally {
      setPlaylistLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto text-black dark:text-white">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🗺️</span>
          <h1 className="text-2xl md:text-4xl font-bold">Your Roadmap</h1>
        </div>
      </motion.div>

      {/* Goal tabs — up to MAX_ACTIVE_GOALS active goals at once */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="flex items-center gap-2 mb-6 flex-wrap"
      >
        {activeGoals.map((g) => (
          <button
            key={g.id}
            onClick={() => onSwitchGoal(g.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition truncate max-w-[220px] ${
              g.id === activeGoalId
                ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
            title={g.title || 'Naya Goal'}
          >
            🎯 {g.title || 'Naya Goal'}
          </button>
        ))}

        {canAddGoal ? (
          <button
            onClick={onAddGoal}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-dashed border-gray-300 dark:border-white/20 text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 transition"
          >
            + Add Goal
          </button>
        ) : (
          <span className="text-[11px] text-gray-400 dark:text-white/40 px-1">
            Max {MAX_ACTIVE_GOALS} goals ek saath — koi ek end karo naya start karne ke liye.
          </span>
        )}

        {activeGoalId && !hasNoRoadmap && (
          <button
            onClick={() => setConfirmEndGoal(true)}
            className="ml-auto px-3 py-2 rounded-xl text-xs font-medium border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
          >
            End this goal
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
              <h3 className="text-lg font-bold mb-2">Ye goal end karein?</h3>
              <p className="text-sm text-gray-500 dark:text-white/50 mb-5">
                "{roadmap.title}" end ho jayega — progress safe rahega, aur slot free ho jayega naye goal ke liye.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmEndGoal(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onEndGoal(activeGoalId, 'abandoned');
                    setConfirmEndGoal(false);
                  }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition"
                >
                  End Goal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">Progress</div>
          <div className="text-2xl font-bold">{progressPercent}%</div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">Done</div>
          <div className="text-2xl font-bold">{completedTopics}/{totalTopics}</div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">In Progress</div>
          <div className="text-2xl font-bold">{learningTopics}</div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">Est. Time</div>
          <div className="text-2xl font-bold">{roadmap.estimatedTime}</div>
        </div>
      </motion.div>

      {/* Progress bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="mb-10">
        <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ delay: 0.3, duration: 1, ease: 'easeOut' }}
            className="h-full bg-black dark:bg-white rounded-full"
          />
        </div>
      </motion.div>

      {/* Main path card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }} className="p-5 md:p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-black dark:bg-white flex items-center justify-center text-2xl flex-shrink-0">🎯</div>
            <div>
             <h2 className="text-lg md:text-xl font-bold">{roadmap.title}</h2>
              <p className="text-sm text-gray-500 dark:text-white/50">{roadmap.description}</p>
            </div>
          </div>
          <span className="text-xs px-3 py-1 rounded-full border border-gray-200 dark:border-white/10">
           {roadmap.difficulty}
          </span>
        </div>

        {hasNoRoadmap && !activeGoalId && (
          <div className="mt-5 p-5 rounded-xl border border-dashed border-gray-300 dark:border-white/20 text-center text-sm text-gray-500 dark:text-white/50">
            Koi active goal nahi hai. Upar "+ Add Goal" dabao naya goal shuru karne ke liye.
          </div>
        )}

        {hasNoRoadmap && activeGoalId && onGenerateForSubject && (
          <div className="mt-5 p-5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
            <label className="block text-sm font-semibold mb-2">Kya seekhna hai?</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateClick()}
                placeholder="Aap kya seekhna chahte ho?"
                autoFocus
                className="flex-1 px-4 py-2.5 rounded-lg text-sm border border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 focus:outline-none focus:border-black dark:focus:border-white"
              />
              <button
                onClick={handleGenerateClick}
                disabled={generating || !subjectInput.trim()}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition disabled:opacity-40 flex-shrink-0"
              >
                {generating ? 'Roadmap ban raha hai...' : 'Generate Roadmap'}
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold">Weekly time available</label>
                <span className="text-sm font-mono px-2 py-0.5 rounded-md bg-black text-white dark:bg-white dark:text-black">
                  {hoursInput} hrs/week
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
                <span>1 hr</span>
                <span>40 hrs</span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-white/40 mt-1.5">
                Isse roadmap ke topics aur unki depth aapke available time ke hisaab se accurate banti hai.
              </p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold mb-2">Time limit</label>
              <div className="flex gap-2 mb-3">
                {(['day', 'week', 'month'] as const).map((unit) => (
                  <button
                    key={unit}
                    onClick={() => handleDeadlineUnitChange(unit)}
                    className={`flex-1 py-2 rounded-lg text-sm border transition capitalize ${
                      deadlineUnit === unit
                        ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                        : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 dark:text-white/40">Deadline</span>
                <span className="text-sm font-mono px-2 py-0.5 rounded-md bg-black text-white dark:bg-white dark:text-black">
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
                <span>{DEADLINE_UNIT_CONFIG[deadlineUnit].min} {deadlineUnit}</span>
                <span>{DEADLINE_UNIT_CONFIG[deadlineUnit].max} {deadlineUnit}{DEADLINE_UNIT_CONFIG[deadlineUnit].max > 1 ? 's' : ''}</span>
              </div>
            </div>

            {generateFailed && (
              <div className="mt-3">
                <p className="text-xs text-red-600 dark:text-red-400">Roadmap generate nahi ho paaya — dobara try karo.</p>
                {lastRoadmapError && (
                  <p className="text-[11px] font-mono text-red-500/70 dark:text-red-400/60 mt-1 break-all">
                    {lastRoadmapError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Topic list */}
      <div className="space-y-3">
        {roadmap.children?.map((topic, i) => {
          const status = statusConfig[topic.status];
          const isLast = i === (roadmap.children?.length ?? 0) - 1;
          return (
            <motion.button
              key={topic.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
              onClick={() => openTopic(topic)}
              disabled={topic.status === 'locked'}
              className={`relative w-full p-4 md:p-5 rounded-2xl border ${status.border} ${status.bg} text-left transition-all ${
                topic.status === 'locked' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-center text-lg md:text-xl flex-shrink-0">
                  {status.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-gray-400 dark:text-white/30">STEP {i + 1}</span>
                    <span className={`text-[10px] uppercase tracking-wider ${difficultyConfig[topic.difficulty]}`}>
                      • {topic.difficulty}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-1 text-sm md:text-base">{topic.title}</h3>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-white/50 line-clamp-1">{topic.description}</p>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className={`text-[10px] uppercase tracking-wider ${status.text} mb-1`}>{status.label}</div>
                  <div className="text-xs text-gray-400 dark:text-white/40">{topic.estimatedTime}</div>
                </div>
              </div>

              {!isLast && (
                <div className="absolute left-[2.2rem] md:left-[2.4rem] -bottom-3 w-0.5 h-3 bg-gradient-to-b from-gray-200 dark:from-white/20 to-transparent" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedTopic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            onClick={() => setSelectedTopic(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-auto text-black dark:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 md:p-6 border-b border-gray-200 dark:border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusConfig[selectedTopic.status].border} ${statusConfig[selectedTopic.status].text}`}
                  >
                    {statusConfig[selectedTopic.status].label}
                  </span>
                  <button
                    onClick={() => setSelectedTopic(null)}
                    className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-2">{selectedTopic.title}</h2>
                <p className="text-gray-500 dark:text-white/60 text-sm">{selectedTopic.description}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 dark:text-white/40">
                  <span>⏱️ {selectedTopic.estimatedTime}</span>
                  <span>•</span>
                  <span className={difficultyConfig[selectedTopic.difficulty]}>📊 {selectedTopic.difficulty}</span>
                </div>
              </div>

              <div className="flex border-b border-gray-200 dark:border-white/5">
                <button
                  onClick={() => setShowWhy(false)}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition ${!showWhy ? 'border-b-2 border-black dark:border-white' : 'text-gray-400 dark:text-white/50 hover:text-black dark:hover:text-white'}`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setShowWhy(true)}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition ${showWhy ? 'border-b-2 border-black dark:border-white' : 'text-gray-400 dark:text-white/50 hover:text-black dark:hover:text-white'}`}
                >
                  Why
                </button>
              </div>

              <div className="p-5 md:p-6">
                {!showWhy ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10">
                      <h3 className="text-sm font-semibold mb-2">What you'll learn</h3>
                      <p className="text-sm text-gray-500 dark:text-white/60">{selectedTopic.description}</p>
                    </div>

                    <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10">
                      <button
                        onClick={() => setShowDeepDive(true)}
                        className="w-full text-left px-3 py-3 rounded-lg border border-purple-300/30 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/5 text-sm text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/10 active:scale-[0.99] transition mb-3"
                      >
                        🔍 2 quick sawaal poochu? Better matched videos milenge (optional)
                      </button>

                      <button
                        onClick={handleWatchVideos}
                        disabled={playlistLoading}
                        className="w-full px-4 py-3.5 md:py-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black disabled:opacity-40 text-sm font-semibold transition active:scale-[0.98]"
                      >
                        {playlistLoading ? 'Dhundh raha hoon...' : 'Watch videos'}
                      </button>
                      {hasSavedVideoForGoal(activeGoalId ?? undefined) && (
                        <button
                          onClick={onOpenSavedVideo}
                          className="w-full mt-2 px-4 py-3 md:py-2 rounded-lg border border-gray-300 dark:border-white/20 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98] transition"
                        >
                          Saved video
                        </button>
                      )}
                      {playlistError && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{playlistError}</p>}

                      {selectedTopic.status !== 'completed' && selectedTopic.status !== 'mastered' && (
                        <button
                          onClick={handleMarkComplete}
                          className="w-full mt-2 px-4 py-3 md:py-2 rounded-lg border border-gray-300 dark:border-white/20 text-sm font-medium text-gray-600 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98] transition"
                        >
                          ✓ Maine ye already seekh liya — mark as complete
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[
                      { label: 'Why learn this?', content: selectedTopic.why.learn, icon: '❓' },
                      { label: 'How does it connect?', content: selectedTopic.why.connect, icon: '🔗' },
                      { label: 'What system does it belong to?', content: selectedTopic.why.system, icon: '🌐' },
                      { label: "What if you don't learn it?", content: selectedTopic.why.risk, icon: '⚠️' },
                    ].map((item, i) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-4 rounded-xl border border-gray-200 dark:border-white/10"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{item.icon}</span>
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
  );
}