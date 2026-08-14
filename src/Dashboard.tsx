import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PagePlaceholder from './PagePlaceholder';
import Roadmap from './Roadmap';
import Revision from './Revision';
import VideoIntel from './VideoIntel';
import BlueprintInterview from './BlueprintInterview';
import { getRoadmapData, getCurrentTopic } from './roadmapData';
import { getRevisionStats, getRevisionDataForGoals } from './revisionData';
import { getLearningProfile, saveLearningProfile, clearLearningProfile } from './learningProfileStore';
import { buildCandidatePoolForConcept } from './conceptVideoPool';
import { selectPlaylistForConcept, analyzedVideoToVideo } from './PlaylistBuilder';
import { expandSearchQuery } from './queryExpander';
import { useTheme } from './ThemeContext';
import type { DashboardPageId, PageConfig, UserOnboardingData, LearningProfile, Video, Topic, Goal } from './types';
import Mentor from './Mentor';
import Notes from './Notes';

interface DashboardProps {
  userData: UserOnboardingData | null;
  onUpdateUserData: (data: UserOnboardingData) => void;
  /** Re-runs roadmap generation with current userData + latest learning
   *  profile, overwriting the cached roadmap. Returns true on success. */
  onRegenerateRoadmap: () => Promise<boolean>;
  /** Updates userData.goal/hours/deadline to the given subject + slider
   *  values and generates a roadmap for it directly — the Roadmap page's
   *  own inline "type a subject, set your time, and go" flow, no full
   *  onboarding needed. */
  onGenerateForSubject: (
    subject: string,
    hours: number,
    deadlineDays: number,
    deadlineLabel: string
  ) => Promise<boolean>;
  /** Bumped every successful regenerate — passed as <Roadmap key={...}>
   *  so it remounts and re-reads the fresh roadmap from localStorage. */
  roadmapVersion: number;
  /** Actual server/network error message from the last generation attempt,
   *  shown in Roadmap.tsx's failure banner so failures are debuggable. */
  lastRoadmapError: string | null;
  /** Up to 2 goals can be 'active' simultaneously — each with its own
   *  roadmap. Passed straight through to Roadmap.tsx for the goal tabs. */
  goals: Goal[];
  activeGoalId: string | null;
  /** Opens a 2nd goal slot (returns false if 2 are already active). */
  onAddGoal: () => boolean;
  /** Ends a goal, freeing its slot for a new one. */
  onEndGoal: (goalId: string, outcome?: 'completed' | 'abandoned') => void;
  onSwitchGoal: (goalId: string) => void;
}

interface Blueprint {
  role: string;
  goal: string;
  language: string;
  hours: number;
  style: {
    pace: number;
    practical: number;
    depth: number;
    structure: number;
    storytelling: number;
    languageComplexity: number;
  };
}

const sidebarItems: { id: DashboardPageId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'roadmap', label: 'Roadmap', icon: 'roadmap' },
  { id: 'revision', label: 'Revision', icon: 'refresh' },
  { id: 'notes', label: 'AI Notes', icon: 'notes' },
  { id: 'videos', label: 'Videos', icon: 'video' },
  { id: 'mentor', label: 'AI Mentor', icon: 'mentor' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
];

const roleOptions = ['student', 'developer', 'researcher', 'business', 'exam', 'creator'];
const languageOptions = ['hindi', 'english', 'hinglish', 'any'];
const hoursOptions = [5, 10, 20, 40];
const deadlineOptions = [
  { id: 'none', label: 'None' },
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: '1y', label: '1Y' },
];

const pageConfigs: Partial<Record<DashboardPageId, PageConfig>> = {
  progress: {
    title: 'Progress',
    description: 'Track your speed, retention, and mastery.',
    icon: 'chart',
    status: 'beta',
    features: [
      'Time tracking', 'Mastery heatmap', 'Retention rate',
      'Completion %', 'Streaks', 'Weak areas',
    ],
  },
};

const ACTIVE_DAYS_STORAGE_KEY = 'learning_os_active_days';
const TOPIC_TIMING_STORAGE_KEY = 'learning_os_topic_timing';

function trackAndComputeStreak(): number {
  const todayKey = new Date().toISOString().slice(0, 10);
  let activeDays: string[] = [];
  try {
    const saved = localStorage.getItem(ACTIVE_DAYS_STORAGE_KEY);
    activeDays = saved ? (JSON.parse(saved) as string[]) : [];
  } catch {
    activeDays = [];
  }
  if (!activeDays.includes(todayKey)) {
    activeDays.push(todayKey);
    localStorage.setItem(ACTIVE_DAYS_STORAGE_KEY, JSON.stringify(activeDays));
  }
  const activeSet = new Set(activeDays);
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!activeSet.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function Dashboard({ userData, onUpdateUserData, onRegenerateRoadmap, onGenerateForSubject, roadmapVersion, lastRoadmapError, goals, activeGoalId, onAddGoal, onEndGoal, onSwitchGoal }: DashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const [activePage, setActivePage] = useState<DashboardPageId>('dashboard');
  const [showSidebar, setShowSidebar] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showLearningQuiz, setShowLearningQuiz] = useState(false);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(getLearningProfile);
  const [preloadedPlaylist, setPreloadedPlaylist] = useState<{ primary: Video; fallbacks: Video[] } | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsName, setSettingsName] = useState(userData?.name ?? '');
  const [settingsRole, setSettingsRole] = useState(userData?.role ?? '');
  const [settingsGoal, setSettingsGoal] = useState(userData?.goal ?? '');
  const [regeneratingRoadmap, setRegeneratingRoadmap] = useState(false);
  const [regenerateResult, setRegenerateResult] = useState<'success' | 'error' | null>(null);
  const [settingsLanguage, setSettingsLanguage] = useState(userData?.language ?? '');

  const [showCustomPlaylist, setShowCustomPlaylist] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [customHours, setCustomHours] = useState(0);
  const [customDeadline, setCustomDeadline] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState('');

  useEffect(() => {
    setStreak(trackAndComputeStreak());
  }, []);

  useEffect(() => {
    setSettingsName(userData?.name ?? '');
    setSettingsRole(userData?.role ?? '');
    setSettingsGoal(userData?.goal ?? '');
    setSettingsLanguage(userData?.language ?? '');
  }, [userData]);

  const handleQuizComplete = (profile: LearningProfile) => {
    setLearningProfile(profile);
    saveLearningProfile(profile);
    setShowLearningQuiz(false);
  };

  const handleClearProfile = () => {
    clearLearningProfile();
    setLearningProfile(null);
  };

  const handleLaunchPlaylist = (payload: { primary: Video; fallbacks: Video[] }) => {
    setPreloadedPlaylist(payload);
    setActivePage('videos');
  };

  // FIX: Pehle yahan sirf name/role/goal/language/hours bhej rahe the,
  // jisse `deadline` (aur userData ki koi bhi aur field) drop ho rahi thi
  // aur TypeScript sahi tarike se complain kar raha tha (Property 'deadline' is missing).
  // Ab existing userData ko spread karke sirf changed fields override kar rahe hain,
  // isliye deadline jaisi fields safely preserve hoti hain.
  const handleSaveSettings = () => {
    if (!settingsName.trim()) return;
    onUpdateUserData({
      ...(userData ?? { deadline: '' }),
      name: settingsName.trim(),
      role: settingsRole,
      goal: settingsGoal,
      language: settingsLanguage,
      hours: userData?.hours ?? 10,
    });
    setShowSettings(false);
  };

  // Re-runs roadmap generation with current userData + latest learning
  // profile — overwrites the cached roadmap in localStorage. Needed
  // because the roadmap is otherwise only generated ONCE, at onboarding;
  // improvements to generate-roadmap.ts (or a retaken quiz) never reach
  // an already-generated roadmap without this.
  const handleRegenerateRoadmap = async () => {
    setRegeneratingRoadmap(true);
    setRegenerateResult(null);
    const success = await onRegenerateRoadmap();
    setRegenerateResult(success ? 'success' : 'error');
    setRegeneratingRoadmap(false);
  };

  const buildBlueprint = (): Blueprint | null => {
    const profile = getLearningProfile();
    if (!profile || !userData) return null;
    return {
      role: userData.role,
      goal: userData.goal,
      language: userData.language,
      hours: userData.hours,
      style: {
        pace: profile.pace,
        practical: profile.theoryVsPractical,
        depth: profile.depth,
        structure: profile.structureNeed,
        storytelling: profile.storytelling,
        languageComplexity: profile.languageComplexity,
      },
    };
  };

  const handleCustomPlaylist = async () => {
    const trimmed = customTopic.trim();
    if (!trimmed) {
      setCustomError('Topic daalo pehle');
      return;
    }

    const profile = getLearningProfile();
    if (!profile) {
      setCustomError('Pehle Learning Style Quiz complete karo.');
      return;
    }

    setCustomError('');
    setCustomLoading(true);

    if (customHours || customDeadline) {
      try {
        localStorage.setItem(
          TOPIC_TIMING_STORAGE_KEY,
          JSON.stringify({ topic: trimmed, hours: customHours, deadline: customDeadline })
        );
      } catch {
        // non-fatal
      }
    }

    const blueprint = buildBlueprint();
    let queries: string[] = [trimmed];
    let searchHint = `User-defined learning session for: ${trimmed}`;

    if (blueprint) {
      try {
        const expansion = await expandSearchQuery(trimmed, blueprint);
        if (expansion?.queries && expansion.queries.length > 0) {
          queries = expansion.queries;
          searchHint = expansion.searchHint ?? searchHint;
        }
      } catch {
        // Expansion failed - use literal query
      }
    }

    const topicIdHash = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40);

    const adhocTopic: Topic = {
      id: `custom-${topicIdHash}`,
      title: trimmed,
      description: searchHint,
      status: 'learning',
      estimatedTime: '-',
      difficulty: 'Beginner',
      why: { learn: '', connect: '', system: '', risk: '' },
      topicKeywords: queries.map((q) => q.toLowerCase()),
    };

    try {
      const candidates = await buildCandidatePoolForConcept(adhocTopic, queries, userData?.language);
      if (candidates.length === 0) {
        setCustomError('Koi video nahi mili. Alag words try karo.');
        return;
      }

      const result = selectPlaylistForConcept(candidates, profile, undefined);
      if (!result) {
        setCustomError('Playlist ban nahi payi, dobara try karo.');
        return;
      }

      handleLaunchPlaylist({
        primary: analyzedVideoToVideo(result.primary),
        fallbacks: result.fallbacks.map(analyzedVideoToVideo),
      });
      setShowCustomPlaylist(false);
      setCustomTopic('');
      setCustomHours(0);
      setCustomDeadline('');
    } catch (err: any) {
      setCustomError(err.message || 'Kuch gadbad ho gayi.');
    } finally {
      setCustomLoading(false);
    }
  };

  if (showLearningQuiz) {
    return (
      <BlueprintInterview
        onComplete={handleQuizComplete}
        onClose={() => setShowLearningQuiz(false)}
      />
    );
  }

  const displayName = userData?.name?.trim() || 'Learner';
  const currentTopic = getCurrentTopic(getRoadmapData(activeGoalId ?? undefined));
  const revisionStats = getRevisionStats(getRevisionDataForGoals(goals));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const statsCards = [
    {
      title: 'Goal',
      value: currentTopic ? currentTopic.title : 'Pick a topic',
      subtitle: currentTopic ? `${currentTopic.estimatedTime} - ${currentTopic.difficulty}` : 'Open roadmap',
      icon: 'target',
      onClick: () => setActivePage('roadmap'),
    },
    {
      title: 'Revision',
      value: `${revisionStats.dueToday} due`,
      subtitle: revisionStats.overdue > 0 ? `${revisionStats.overdue} overdue` : 'Caught up',
      icon: 'refresh',
      onClick: () => setActivePage('revision'),
    },
    {
      title: 'Streak',
      value: `${streak} ${streak === 1 ? 'day' : 'days'}`,
      subtitle: streak > 0 ? 'Keep going' : 'Start today',
      icon: 'streak',
      onClick: () => setActivePage('progress'),
    },
  ];

  const config = pageConfigs[activePage];

  const SidebarContent = (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">Learning OS</h1>
          <p className="text-xs text-gray-400 dark:text-white/40 mt-1">v1.0 - Beta</p>
        </div>
        <button onClick={() => setShowSidebar(false)} className="md:hidden w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center">X</button>
      </div>
      <nav className="space-y-1 flex-1">
        {sidebarItems.map((item, i) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
            onClick={() => {
              setActivePage(item.id);
              setShowSidebar(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activePage === item.id ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-500 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </motion.button>
        ))}
      </nav>
      <div className="mt-auto pt-6 border-t border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent truncate">{displayName}</div>
            <div className="text-xs text-gray-400 dark:text-white/40 truncate">{userData?.role ? userData.role : 'Learner'}</div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-black flex text-black dark:text-white">
      <aside className="hidden md:flex w-64 border-r border-gray-200 dark:border-white/10 p-6 flex-col flex-shrink-0">
        {SidebarContent}
      </aside>

      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowSidebar(false)}
          >
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-64 h-full bg-white dark:bg-black border-r border-gray-200 dark:border-white/10 p-6 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {SidebarContent}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-auto min-w-0">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="border-b border-gray-200 dark:border-white/10 px-4 md:px-8 py-4 md:py-6 flex justify-between items-center gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setShowSidebar(true)} className="md:hidden w-9 h-9 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center flex-shrink-0">
              Menu
            </button>
            <h2 className="text-lg md:text-2xl font-bold truncate">
              {getGreeting()},{' '}
              <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                {displayName}
              </span>
            </h2>
          </div>
          <button onClick={() => setShowSettings(true)} className="px-3 md:px-4 py-2 rounded-full border border-gray-300 dark:border-white/10 text-sm hover:bg-gray-100 dark:hover:bg-white/10 transition flex-shrink-0">
            Settings
          </button>
        </motion.div>

        {activePage === 'dashboard' && (
          <div className="p-4 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {statsCards.map((card, i) => (
                <motion.button
                  key={card.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                  onClick={card.onClick}
                  className="text-left p-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-2xl">{card.icon}</span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/40">{card.title}</span>
                  </div>
                  <div className="text-xl font-bold mb-1 line-clamp-1">{card.value}</div>
                  <div className="text-xs text-gray-400 dark:text-white/50">{card.subtitle}</div>
                </motion.button>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex items-center gap-4 flex-wrap"
            >
              <div className="text-3xl">bulb</div>
              <div className="flex-1 min-w-[200px]">
                <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-1">Suggestion</div>
                <p className="text-sm">Try: React Visual Guide</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setShowCustomPlaylist(true)}
                  className="px-4 py-2 rounded-full border border-gray-300 dark:border-white/10 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition whitespace-nowrap"
                >
                  Custom
                </button>
                <button
                  onClick={() => setActivePage('videos')}
                  className="px-4 py-2 rounded-full bg-black text-white dark:bg-white dark:text-black text-sm font-medium hover:opacity-80 transition whitespace-nowrap"
                >
                  Watch
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5"
            >
              <h3 className="font-semibold mb-1">{learningProfile ? 'Learning Style' : 'Find Your Style'}</h3>
              <p className="text-xs text-gray-400 dark:text-white/40 mb-4">
                {learningProfile ? 'From your assessment' : 'Short quiz for better matches'}
              </p>
              {learningProfile && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-white/60 mb-4">
                  <div>Pace: {learningProfile.pace}/10</div>
                  <div>Practical: {learningProfile.theoryVsPractical}/10</div>
                  <div>Structure: {learningProfile.structureNeed}/10</div>
                  <div>Depth: {learningProfile.depth}/10</div>
                  <div>Language: {learningProfile.languageComplexity}/10</div>
                  <div>Storytelling: {learningProfile.storytelling}/10</div>
                  <div>Repetition: {learningProfile.repetitionNeed}/10</div>
                  <div>Reliability: {learningProfile.reliabilityScore}%</div>
                </div>
              )}
              {learningProfile?.blueprintReport && (
                <p className="text-xs text-gray-500 dark:text-white/60 leading-relaxed mb-4 border-t border-gray-200 dark:border-white/10 pt-3">
                  {learningProfile.blueprintReport}
                </p>
              )}
              <button
                onClick={() => setShowLearningQuiz(true)}
                className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                {learningProfile ? 'Retake Blueprint Interview' : 'Start Blueprint Interview'}
              </button>
              {learningProfile && (
                <button
                  onClick={handleClearProfile}
                  className="w-full mt-2 py-2 rounded-xl text-xs text-gray-400 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 transition"
                >
                  Clear my profile
                </button>
              )}
            </motion.div>
          </div>
        )}

        {activePage === 'roadmap' && (
          <Roadmap
            key={`${roadmapVersion}-${activeGoalId}`}
            userData={userData}
            onLaunchPlaylist={handleLaunchPlaylist}
            onGenerateForSubject={onGenerateForSubject}
            lastRoadmapError={lastRoadmapError}
            goals={goals}
            activeGoalId={activeGoalId}
            onAddGoal={onAddGoal}
            onEndGoal={onEndGoal}
            onSwitchGoal={onSwitchGoal}
          />
        )}
        {activePage === 'revision' && <Revision goals={goals} />}
        {activePage === 'videos' && <VideoIntel initialPlaylist={preloadedPlaylist} activeGoalId={activeGoalId} />}
        {activePage === 'mentor' && <Mentor />}
        {activePage === 'notes' && <Notes />}

        {config && (
          <PagePlaceholder
            title={config.title}
            description={config.description}
            icon={config.icon}
            features={config.features}
            status={config.status}
          />
        )}
      </div>

      {/* === Settings Modal === */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-3xl max-w-md w-full max-h-[85vh] overflow-auto text-black dark:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                <h2 className="text-xl font-bold">Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  X
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 dark:border-white/10">
                  <span className="text-sm font-medium">Theme</span>
                  <button
                    onClick={toggleTheme}
                    className={`relative w-14 h-8 rounded-full transition-colors ${theme === 'light' ? 'bg-black' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${theme === 'light' ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">Name</label>
                  <input
                    type="text"
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">Role</label>
                  <div className="flex flex-wrap gap-2">
                    {roleOptions.map((r) => (
                      <button
                        key={r}
                        onClick={() => setSettingsRole(r)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition ${settingsRole === r ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">Subject / Topic</label>
                  <input
                    type="text"
                    value={settingsGoal}
                    onChange={(e) => setSettingsGoal(e.target.value)}
                    placeholder='Jaise "React.js" ya "Class 12 Physics - Electric Charges"'
                    className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">Language</label>
                  <div className="flex flex-wrap gap-2">
                    {languageOptions.map((l) => (
                      <button
                        key={l}
                        onClick={() => setSettingsLanguage(l)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition ${settingsLanguage === l ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2 mt-4">Roadmap</label>
                  <p className="text-xs text-gray-400 dark:text-white/40 mb-3">
                    Roadmap sirf ek baar banta hai. Agar topics bahut broad lag rahe hain ya learning style change kiya hai, dobara generate karo.
                  </p>
                  <button
                    onClick={handleRegenerateRoadmap}
                    disabled={regeneratingRoadmap || !userData}
                    className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition disabled:opacity-40"
                  >
                    {regeneratingRoadmap ? 'Regenerating...' : 'Regenerate Roadmap'}
                  </button>
                  {regenerateResult === 'success' && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">Naya roadmap ban gaya.</p>
                  )}
                  {regenerateResult === 'error' && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2">Kuch gadbad ho gayi, dobara try karo.</p>
                  )}
                </div>
              </div>

              <div className="p-6 pt-0">
                <button
                  onClick={handleSaveSettings}
                  disabled={!settingsName.trim()}
                  className="w-full px-6 py-3 rounded-full bg-black text-white dark:bg-white dark:text-black font-semibold text-sm disabled:opacity-40 transition"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Custom Playlist Modal === */}
      <AnimatePresence>
        {showCustomPlaylist && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !customLoading && setShowCustomPlaylist(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-3xl max-w-xl w-full text-black dark:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                <h2 className="text-xl font-bold">Custom Playlist</h2>
                <button
                  onClick={() => setShowCustomPlaylist(false)}
                  disabled={customLoading}
                  className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition disabled:opacity-30 flex-shrink-0"
                >
                  X
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">Topic</label>
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => {
                      setCustomTopic(e.target.value);
                      setCustomError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && !customLoading && handleCustomPlaylist()}
                    placeholder="e.g., Django basics"
                    autoFocus
                    disabled={customLoading}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">Hours / week</label>
                  <div className="flex gap-2">
                    {hoursOptions.map((h) => (
                      <button
                        key={h}
                        onClick={() => setCustomHours(h)}
                        disabled={customLoading}
                        className={`flex-1 py-2 rounded-lg text-sm border transition ${customHours === h ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">Deadline</label>
                  <div className="flex gap-2">
                    {deadlineOptions.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setCustomDeadline(d.id)}
                        disabled={customLoading}
                        className={`flex-1 py-2 rounded-lg text-sm border transition ${customDeadline === d.id ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {customError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-300 text-sm">
                    {customError}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-400 dark:text-white/40 mr-1 self-center">Quick:</span>
                  {['React Hooks', 'Python Basics', 'Calculus', 'SQL', 'CSS Grid', 'Data Structures'].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setCustomTopic(s);
                        setCustomError('');
                      }}
                      disabled={customLoading}
                      className="px-3 py-1 border border-gray-200 dark:border-white/10 rounded-full text-xs hover:bg-gray-100 dark:hover:bg-white/10 transition disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {customLoading && (
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 dark:bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 dark:bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 dark:bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span>Dhundh raha hoon...</span>
                    </div>
                  </div>
                )}

                {!learningProfile && !customLoading && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-300">Pehle quiz complete karo for better matches</p>
                )}
              </div>

              <div className="p-6 pt-0">
                <button
                  onClick={handleCustomPlaylist}
                  disabled={customLoading || !customTopic.trim()}
                  className="w-full px-6 py-3 rounded-full bg-black text-white dark:bg-white dark:text-black disabled:opacity-40 font-semibold transition"
                >
                  {customLoading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}