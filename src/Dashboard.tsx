import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Film, BookOpen, ClipboardCheck, MessageCircle, Newspaper, Lock, Settings as SettingsIcon, Bell, X as CloseIcon, Target, RotateCcw, Flame, Check, ChevronRight } from 'lucide-react';
import PagePlaceholder from './PagePlaceholder';
import BottomNav from './BottomNav';
import QuickGrid from './QuickGrid';
import { useImmersive } from './immersive';
import { getRoadmapData, getCurrentTopic } from './roadmapData';
import { getRevisionStats, getRevisionDataForGoals } from './revisionData';
import { getPersonalityProfile, savePersonalityProfile, clearPersonalityProfile } from './personalityProfileStore';
import type { PersonalityProfile } from './personalityScoring';
import GrowthEdgesCard from './GrowthEdgesCard';
import PersonalityReportCard from './PersonalityReportCard';
import { computeGrowthEdges } from './growthEdges';
import { getBehaviourStats } from './behaviourStats';
import WelcomeBack from './WelcomeBack';
import DailyHabit from './DailyHabit';
import { analyzeAttempt, analyzeHistory } from './testAnalytics';
import { getTestAttempts } from './testStore';
import { getLearningProfile, saveLearningProfile, clearLearningProfile } from './learningProfileStore';
import { pushToCloud, pullFromCloud } from './cloudSync';
import { buildCandidatePoolForConcept } from './conceptVideoPool';
import { selectPlaylistForConcept, analyzedVideoToVideo } from './PlaylistBuilder';
import { expandSearchQuery } from './queryExpander';
import { useTheme } from './ThemeContext';
import { signOutOfApp, getCurrentUser } from './authStore';
import { useAuthPrompt, SignInButton, LoginRequired } from './AuthPrompt';
import type { DashboardPageId, PageConfig, UserOnboardingData, LearningProfile, Video, Topic, Goal, TopicBridge } from './types';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';

// Every real "page" is lazy-loaded: each one only downloads once the user
// actually navigates to its route, instead of every page's code shipping
// in the same bundle as the Dashboard shell. This is the main fix for the
// slow initial load — Dictionary alone used to pull in a 20MB fetch's
// worth of surrounding code paths on first paint even when unused.
const Roadmap = lazy(() => import('./Roadmap'));
const Revision = lazy(() => import('./Revision'));
const VideoIntel = lazy(() => import('./VideoIntel'));
const BlueprintInterview = lazy(() => import('./BlueprintInterview'));
const TasteOnboarding = lazy(() => import('./TasteOnboarding'));
const PersonalityQuiz = lazy(() => import('./PersonalityQuiz'));
const Mentor = lazy(() => import('./Mentor'));
const Notes = lazy(() => import('./NotesHome'));
const Progress = lazy(() => import('./progress'));
const Research = lazy(() => import('./Research'));
const Dictionary = lazy(() => import('./Dictionary'));
const CurrentAffairs = lazy(() => import('./CurrentAffairs'));
const Test = lazy(() => import('./Test'));

// Small, centered loading indicator shown while a lazy page's chunk is
// still downloading — kept intentionally minimal (no new deps).
function PageLoading() {
  return (
    <div className="flex items-center justify-center py-24 text-gray-400 dark:text-white/40 text-sm">
      Loading…
    </div>
  );
}

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

// Simple two-tone "bell" using Web Audio API — no audio file/asset needed,
// so it works offline and doesn't add anything to the bundle.
function playReminderBell() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const playTone = (freq: number, startAt: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };
    playTone(880, 0, 0.35);
    playTone(1108.73, 0.15, 0.4);
  } catch {
    // Audio blocked (autoplay policy / unsupported) — reminder banner still shows silently.
  }
}

// Pages that need a real account. Guests (no sign-up yet) can use the home page,
// the Mind Blueprint, Videos and Dictionary; everything below asks them to sign in.
// (The server enforces the same split for AI endpoints — see api/_lib/auth.ts.)
const LOGIN_ONLY_PAGES: DashboardPageId[] = ['roadmap', 'revision', 'notes', 'test', 'mentor', 'progress', 'research', 'current-affairs'];

function getSidebarItems(t: ReturnType<typeof useTranslation>): { id: DashboardPageId; label: string; icon?: ComponentType<{ className?: string }> }[] {
  return [
    { id: 'dashboard', label: t.dashboard.sidebar.home },
    { id: 'roadmap', label: t.dashboard.sidebar.roadmap },
    { id: 'revision', label: t.dashboard.sidebar.revision },
    { id: 'notes', label: t.dashboard.sidebar.notes },
    { id: 'test', label: t.dashboard.sidebar.test, icon: ClipboardCheck },
    { id: 'videos', label: t.dashboard.sidebar.videos },
    { id: 'mentor', label: t.dashboard.sidebar.mentor },
    { id: 'progress', label: t.dashboard.sidebar.progress },
    { id: 'research', label: t.dashboard.sidebar.research, icon: Search },
    { id: 'dictionary', label: t.dashboard.sidebar.dictionary, icon: BookOpen },
    { id: 'current-affairs', label: t.dashboard.sidebar.currentAffairs, icon: Newspaper },
  ];
}

const STAT_ICONS = { target: Target, refresh: RotateCcw, streak: Flame } as const;

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

const pageConfigs: Partial<Record<DashboardPageId, PageConfig>> = {};

const ACTIVE_DAYS_STORAGE_KEY = 'learning_os_active_days';
const TOPIC_TIMING_STORAGE_KEY = 'learning_os_topic_timing';

/**
 * Called once, the first time the user reaches the dashboard (see
 * App.tsx), to pull the active-days streak down from Firestore if this
 * device has none yet — otherwise a genuine multi-day streak would
 * appear to reset to 0 on a new device.
 */
export async function hydrateActiveDaysFromCloud(): Promise<void> {
  try {
    if (localStorage.getItem(ACTIVE_DAYS_STORAGE_KEY)) return; // already has local data
  } catch {
    return;
  }
  const cloud = await pullFromCloud<string[]>('activeDays');
  if (cloud && cloud.length > 0) {
    try {
      localStorage.setItem(ACTIVE_DAYS_STORAGE_KEY, JSON.stringify(cloud));
    } catch {
      // Best-effort.
    }
  }
}

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
    // Cross-device streak sync — best-effort, mirrors the pattern used by
    // learningProfileStore.ts/goalsStore.ts/etc. Only pushed when a NEW day
    // is actually added, not on every render, to avoid redundant writes.
    void pushToCloud('activeDays', activeDays);
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

function DashboardInner({ userData, onUpdateUserData, onRegenerateRoadmap, onGenerateForSubject, roadmapVersion, lastRoadmapError, goals, activeGoalId, onAddGoal, onEndGoal, onSwitchGoal }: DashboardProps) {
  const t = useTranslation();
  const { isGuest, requireAccount, openSignIn } = useAuthPrompt();
  const { theme, toggleTheme } = useTheme();
  // activePage now mirrors the real URL (/dashboard/:page) instead of being
  // plain React state — this is what gives every page its own shareable,
  // bookmarkable, refreshable URL. react-router's BrowserRouter already
  // maintains the browser/PWA history entries, so the previous manual
  // window.history.pushState/popstate bookkeeping (which existed only to
  // stop the hardware back button from closing the app) is no longer
  // needed — real route entries give the back button the same thing to
  // land on.
  const location = useLocation();
  const navigate = useNavigate();
  // location.pathname looks like "/dashboard" or "/dashboard/roadmap" — the
  // segment right after "/dashboard/" (if any) is the active page.
  const activePage = (location.pathname.replace(/^\/dashboard\/?/, '').split('/')[0] || 'dashboard') as DashboardPageId;
  const setActivePage = useCallback(
    (page: DashboardPageId) => {
      navigate(page === 'dashboard' ? '/dashboard' : `/dashboard/${page}`);
    },
    [navigate]
  );

  const [streak, setStreak] = useState(0);
  const immersive = useImmersive(); // true while a full-attention flow (e.g. a timed test) hides the bottom bar
  // Bell + sound reminder — computed once when the app/home page opens (not
  // only on navigating into the Revision tab), so nothing due gets missed.
  const [revisionAlert, setRevisionAlert] = useState<{ dueToday: number; overdue: number } | null>(null);
  const [showLearningQuiz, setShowLearningQuiz] = useState(false);
  // Alternative onboarding path — does NOT replace showLearningQuiz above,
  // both remain independently reachable from the home page.
  const [showTasteOnboarding, setShowTasteOnboarding] = useState(false);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(getLearningProfile);
  // Separate optional personality check (Settings only) — independent of
  // the Blueprint Interview / learning-style profile above.
  const [showPersonalityQuiz, setShowPersonalityQuiz] = useState(false);
  const [personalityProfile, setPersonalityProfile] = useState<PersonalityProfile | null>(getPersonalityProfile);
  const [showPersonalityResult, setShowPersonalityResult] = useState(false);
  const [preloadedPlaylist, setPreloadedPlaylist] = useState<{ primary: Video; fallbacks: Video[]; bridge?: TopicBridge; previousVideoId?: string | null } | null>(null);
  // Which topic's saved-video slot the Videos page is currently showing —
  // set whenever a topic's playlist is launched or its "Saved video" is
  // opened, so each topic keeps its own saved video instead of every topic
  // in a goal sharing one slot (see VideoIntel's activeTopicId).
  const [viewingTopicId, setViewingTopicId] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  // Deep-settings: the full learning-profile report is hidden by default,
  // only rendered when the user explicitly expands it here — see the
  // "Learning Profile Report" section inside the Settings modal below.
  // The whole app now sits behind AuthGate.tsx's per-user login, so the
  // deep report just needs a plain expand/collapse — no separate re-auth.
  const [showFullProfileReport, setShowFullProfileReport] = useState(false);
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
    const stats = getRevisionStats(getRevisionDataForGoals(t.revisionTasks, goals));
    if (stats.dueToday + stats.overdue > 0) {
      setRevisionAlert({ dueToday: stats.dueToday, overdue: stats.overdue });
      playReminderBell();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleTasteOnboardingComplete = (profile: LearningProfile) => {
    // TasteOnboarding.tsx already persisted this via saveLearningProfile/
    // mergeLearningProfile internally — this just syncs Dashboard's own
    // state so the home page's Learning Style card reflects it immediately.
    setLearningProfile(profile);
  };

  const handleClearProfile = () => {
    clearLearningProfile();
    setLearningProfile(null);
  };

  const handleLaunchPlaylist = (payload: { primary: Video; fallbacks: Video[]; bridge?: TopicBridge; previousVideoId?: string | null; topicId: string }) => {
    setPreloadedPlaylist(payload);
    setViewingTopicId(payload.topicId);
    setActivePage('videos');
  };

  // "Saved video" — opens the Videos page WITHOUT a fresh search/playlist
  // handoff, so VideoIntel's own per-goal-per-topic restore just shows
  // whatever was last searched/watched for THIS topic (no new API calls).
  const handleOpenSavedVideo = (topicId: string) => {
    setPreloadedPlaylist(null);
    setViewingTopicId(topicId);
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
    // Same fix as Roadmap.tsx's handleWatchVideos: use the ACTIVE goal's
    // own title, not the single global userData.goal — otherwise the
    // free-text video search hands the AI query-expander whichever goal
    // was onboarded with FIRST (could be a completely different subject
    // than whatever goal tab the learner currently has open).
    const activeGoalTitle = goals.find((g) => g.id === activeGoalId)?.title ?? userData.goal;
    return {
      role: userData.role,
      goal: activeGoalTitle,
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
      setCustomError('Enter a topic first');
      return;
    }

    const profile = getLearningProfile();
    if (!profile) {
      setCustomError('Complete the Learning Style Quiz first.');
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
        setCustomError('No video found. Try different words.');
        return;
      }

      const result = selectPlaylistForConcept(candidates, profile, undefined);
      if (!result) {
        setCustomError('Playlist could not be built, please try again.');
        return;
      }

      handleLaunchPlaylist({
        primary: analyzedVideoToVideo(result.primary),
        fallbacks: result.fallbacks.map(analyzedVideoToVideo),
        topicId: adhocTopic.id,
      });
      setShowCustomPlaylist(false);
      setCustomTopic('');
      setCustomHours(0);
      setCustomDeadline('');
    } catch (err: any) {
      setCustomError(err.message || 'Something went wrong.');
    } finally {
      setCustomLoading(false);
    }
  };

  if (showPersonalityQuiz) {
    return (
      <Suspense fallback={<PageLoading />}>
        <PersonalityQuiz
          onComplete={(p) => {
            savePersonalityProfile(p);
            setPersonalityProfile(p);
          }}
          onClose={() => setShowPersonalityQuiz(false)}
        />
      </Suspense>
    );
  }

  if (showLearningQuiz) {
    return (
      <Suspense fallback={<PageLoading />}>
        <BlueprintInterview
          onComplete={handleQuizComplete}
          onClose={() => setShowLearningQuiz(false)}
        />
      </Suspense>
    );
  }

  if (showTasteOnboarding) {
    return (
      <Suspense fallback={<PageLoading />}>
        <TasteOnboarding
          onComplete={handleTasteOnboardingComplete}
          onClose={() => setShowTasteOnboarding(false)}
        />
      </Suspense>
    );
  }

  const displayName = userData?.name?.trim() || t.dashboard.home.learnerFallback;
  const currentRoadmap = getRoadmapData(activeGoalId);
  const currentTopic = getCurrentTopic(currentRoadmap);
  const hasRoadmap = (currentRoadmap.children?.length ?? 0) > 0;
  const revisionStats = getRevisionStats(getRevisionDataForGoals(t.revisionTasks, goals));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return t.dashboard.greeting.night;
    if (hour < 12) return t.dashboard.greeting.morning;
    if (hour < 17) return t.dashboard.greeting.afternoon;
    if (hour < 21) return t.dashboard.greeting.evening;
    return t.dashboard.greeting.night;
  };

  const statsCards = [
    {
      title: t.dashboard.home.statsCards.goal,
      value: currentTopic ? currentTopic.title : t.dashboard.home.statsCards.pickTopic,
      subtitle: currentTopic ? `${currentTopic.estimatedTime} - ${currentTopic.difficulty}` : t.dashboard.home.statsCards.openRoadmap,
      icon: 'target',
      onClick: () => setActivePage('roadmap'),
    },
    {
      title: t.dashboard.home.statsCards.revision,
      value: format(t.dashboard.home.statsCards.dueSuffix, revisionStats.dueToday + revisionStats.overdue),
      subtitle: revisionStats.overdue > 0 ? format(t.dashboard.home.statsCards.overdueSuffix, revisionStats.overdue) : t.dashboard.home.statsCards.caughtUp,
      icon: 'refresh',
      onClick: () => setActivePage('revision'),
    },
    {
      title: t.dashboard.home.statsCards.streak,
      value: `${streak} ${streak === 1 ? t.dashboard.home.statsCards.day : t.dashboard.home.statsCards.days}`,
      subtitle: streak > 0 ? t.dashboard.home.statsCards.keepGoing : t.dashboard.home.statsCards.startToday,
      icon: 'streak',
      onClick: () => setActivePage('progress'),
    },
  ];

  const config = pageConfigs[activePage];
  const showLoginRequired = isGuest && LOGIN_ONLY_PAGES.includes(activePage);
  const loginRequiredLabel = getSidebarItems(t).find((i) => i.id === activePage)?.label ?? '';

  // Two different locks: authLocked = needs a real account (guest);
  // roadmapLocked = needs a roadmap first. A guest can never build a
  // roadmap (it needs an account), so Videos stays open for them.
  // Progressive disclosure: Revision/Notes/Videos/Progress only make sense
  // once a roadmap exists (they're all built around topics), so a new user
  // never lands on an empty page on their very first visit.
  const navState = (id: DashboardPageId) => {
    const authLocked = isGuest && LOGIN_ONLY_PAGES.includes(id);
    const roadmapLocked = ['revision', 'notes', 'videos', 'progress'].includes(id) && !hasRoadmap && !(isGuest && id === 'videos');
    return { authLocked, roadmapLocked, isLocked: authLocked || roadmapLocked };
  };
  // Shared by the desktop sidebar and the mobile bottom bar. Locked items
  // redirect to Roadmap instead of opening an empty page — nudges toward
  // the actual next step rather than silently doing nothing.
  const selectNav = (id: DashboardPageId, label: string) => {
    const { authLocked, roadmapLocked } = navState(id);
    if (authLocked) {
      requireAccount(label); // opens the sign-in modal for guests
      return;
    }
    setActivePage(roadmapLocked ? 'roadmap' : id);
  };
  const sidebarItems = getSidebarItems(t);

  const SidebarContent = (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">Learning OS</h1>
          <p className="text-xs text-gray-400 dark:text-white/40 mt-1">v1.0 - Beta</p>
        </div>
      </div>
      <nav className="space-y-1 flex-1">
        {sidebarItems.map((item, i) => {
          const { isLocked } = navState(item.id);
          return (
            <motion.button
              key={item.id}
              id={`onborda-nav-${item.id}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
              onClick={() => selectNav(item.id, item.label)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isLocked
                  ? 'text-gray-300 dark:text-white/20 hover:text-gray-400 dark:hover:text-white/30'
                  : activePage === item.id
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white'
                  : 'text-gray-500 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              {item.icon && <item.icon className="w-4 h-4" />}
              <span className="flex-1 text-left">{item.label}</span>
              {isLocked && <Lock className="w-3.5 h-3.5" strokeWidth={2} />}
            </motion.button>
          );
        })}
      </nav>
      <div className="mt-auto pt-6 border-t border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent truncate">{displayName}</div>
            <div className="text-xs text-gray-400 dark:text-white/40 truncate">{userData?.role ? (t.onboarding.roles[userData.role] ?? userData.role) : t.dashboard.home.learnerFallback}</div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-[#f4f6ff] dark:bg-black flex text-black dark:text-white">
      <aside className="hidden md:flex w-64 border-r border-gray-200 dark:border-white/10 p-6 flex-col flex-shrink-0">
        {SidebarContent}
      </aside>

      <div className={`flex-1 overflow-auto min-w-0 md:pb-0 ${immersive ? '' : 'pb-[calc(3.5rem+env(safe-area-inset-bottom))]'}`}>
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="border-b border-gray-200 dark:border-white/10 px-4 md:px-8 py-4 md:py-6 flex justify-between items-center gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg md:text-2xl font-bold truncate">
              {getGreeting()},{' '}
              <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                {displayName}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SignInButton className="px-3 md:px-4 py-2 rounded-full bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white text-sm font-semibold hover:opacity-90 transition" />
            <button id="onborda-settings-button" onClick={() => { setShowSettings(true); setShowFullProfileReport(false); }} aria-label={t.settingsModal.title} className="w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2 rounded-full md:border md:border-gray-300 md:dark:border-white/10 text-sm flex items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-white/10 active:bg-gray-200 dark:active:bg-white/15 transition-colors">
            <SettingsIcon className="w-[21px] h-[21px] md:w-4 md:h-4" strokeWidth={1.75} />
            <span className="hidden md:inline">{t.settingsModal.title}</span>
          </button>
          </div>
        </motion.div>

        <Suspense fallback={<PageLoading />}>
        {showLoginRequired && <LoginRequired feature={loginRequiredLabel} />}
        {activePage === 'dashboard' && (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-5 md:gap-5 md:px-8 md:py-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-white/50">{getGreeting()}</p>
                <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{displayName}</h2>
              </div>
            </div>

            <button
              onClick={() => hasRoadmap ? setActivePage('videos') : selectNav('roadmap', t.dashboard.sidebar.roadmap)}
              className="group flex w-full min-w-0 items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-4 text-left text-white shadow-sm transition hover:brightness-105 active:scale-[0.995] sm:gap-4 sm:p-5"
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 sm:h-11 sm:w-11">
                <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold sm:text-base">Continue Learning</span>
                <span className="mt-0.5 block truncate text-xs text-white/75 sm:text-sm">
                  {currentTopic ? currentTopic.title : 'Choose your learning path'}
                  {currentTopic?.estimatedTime ? ` · ${currentTopic.estimatedTime}` : ''}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={() => selectNav('roadmap', t.dashboard.sidebar.roadmap)}
                className="card flex min-w-0 flex-col items-start gap-2 rounded-xl p-3 text-left transition hover:bg-gray-50 active:scale-[0.98] dark:hover:bg-white/[0.08] sm:flex-row sm:items-center sm:gap-3 sm:p-3.5"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300">
                  <Target className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-tight sm:text-sm">Next topic</span>
                  <span className="mt-0.5 hidden truncate text-xs text-gray-500 dark:text-white/50 sm:block">Your roadmap</span>
                </span>
              </button>
              <button
                onClick={() => selectNav('mentor', t.dashboard.sidebar.mentor)}
                className="card flex min-w-0 flex-col items-start gap-2 rounded-xl p-3 text-left transition hover:bg-gray-50 active:scale-[0.98] dark:hover:bg-white/[0.08] sm:flex-row sm:items-center sm:gap-3 sm:p-3.5"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
                  <MessageCircle className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-tight sm:text-sm">AI Mentor</span>
                  <span className="mt-0.5 hidden truncate text-xs text-gray-500 dark:text-white/50 sm:block">Ask a question</span>
                </span>
              </button>
              <button
                onClick={() => selectNav('test', t.dashboard.sidebar.test)}
                className="card flex min-w-0 flex-col items-start gap-2 rounded-xl p-3 text-left transition hover:bg-gray-50 active:scale-[0.98] dark:hover:bg-white/[0.08] sm:flex-row sm:items-center sm:gap-3 sm:p-3.5"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <ClipboardCheck className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-tight sm:text-sm">Tests</span>
                  <span className="mt-0.5 hidden truncate text-xs text-gray-500 dark:text-white/50 sm:block">Practice & review</span>
                </span>
              </button>
            </div>

            <AnimatePresence>
              {revisionAlert && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 dark:border-indigo-400/20"
                >
                  <Bell className="h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-300" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {revisionAlert.overdue > 0
                        ? format(t.dashboard.home.revisionBanner.overdueTitle, revisionAlert.dueToday + revisionAlert.overdue, revisionAlert.overdue)
                        : format(t.dashboard.home.revisionBanner.dueTitle, revisionAlert.dueToday)}
                    </div>
                  </div>
                  <button
                    onClick={() => { setRevisionAlert(null); setActivePage('revision'); }}
                    className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:opacity-90"
                  >
                    View Revision
                  </button>
                  <button onClick={() => setRevisionAlert(null)} aria-label="Dismiss" className="rounded-lg p-2 text-gray-500 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10">
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="border-t border-gray-200 pt-3 dark:border-white/10">
              <button
                onClick={() => setShowMoreTools((open) => !open)}
                aria-expanded={showMoreTools}
                className="flex w-full items-center justify-between gap-3 rounded-lg py-2 text-left text-sm font-medium text-gray-600 transition hover:text-gray-950 dark:text-white/65 dark:hover:text-white"
              >
                <span>{showMoreTools ? 'Hide other tools' : 'More tools'}</span>
                <ChevronRight className={`h-4 w-4 transition-transform ${showMoreTools ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {showMoreTools && (
              <div className="flex min-w-0 flex-col gap-4 md:gap-5">
                <QuickGrid
                  items={sidebarItems
                    .filter((i) => !['dashboard', 'roadmap', 'mentor', 'progress'].includes(i.id))
                    .map((i) => ({
                      id: i.id,
                      label: i.label,
                      locked: navState(i.id).isLocked,
                      highlight: i.id === 'revision' && revisionStats.dueToday + revisionStats.overdue > 0,
                    }))}
                  onSelect={(id) => {
                    const item = sidebarItems.find((i) => i.id === id);
                    if (item) selectNav(item.id, item.label);
                  }}
                />
                <WelcomeBack goals={goals} revisionTasks={t.revisionTasks} onOpen={setActivePage} />
                <DailyHabit />

                <div className="hidden rounded-xl card md:grid md:grid-cols-3 md:divide-x md:divide-gray-100 md:overflow-hidden md:dark:divide-white/10">
                  {statsCards.map((card) => {
                    const StatIcon = STAT_ICONS[card.icon as keyof typeof STAT_ICONS];
                    return (
                      <button key={card.title} onClick={card.onClick} aria-label={card.title} className="px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5">
                        <StatIcon className="mb-2 h-4 w-4 text-gray-500 dark:text-white/50" strokeWidth={1.75} />
                        <div className="mb-1 text-xs text-gray-500 dark:text-white/50">{card.title}</div>
                        <div className="line-clamp-2 text-sm font-semibold tabular-nums">{card.value}</div>
                        <div className="text-xs text-gray-500 dark:text-white/50">{card.subtitle}</div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setActivePage('videos')}
                  className="hidden self-start rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-85 md:block dark:bg-indigo-500"
                >
                  {t.dashboard.home.suggestion.watchCta}
                </button>

                <section className="border-t border-gray-200 pt-4 dark:border-white/10">
                  <h3 className="text-sm font-semibold">{learningProfile ? t.dashboard.home.learningStyleCard.titleReady : t.dashboard.home.learningStyleCard.titleNotReady}</h3>
                  {(learningProfile ? t.dashboard.home.learningStyleCard.subtitleReady : t.dashboard.home.learningStyleCard.subtitleNotReady) && (
                    <p className="mb-2 mt-1 text-sm text-gray-500 dark:text-white/50">
                      {learningProfile ? t.dashboard.home.learningStyleCard.subtitleReady : t.dashboard.home.learningStyleCard.subtitleNotReady}
                    </p>
                  )}
                  {learningProfile && t.dashboard.home.learningStyleCard.detailReady && (
                    <p className="mb-2 text-sm text-gray-500 dark:text-white/50">{t.dashboard.home.learningStyleCard.detailReady}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button onClick={() => setShowLearningQuiz(true)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100 dark:border-white/20 dark:hover:bg-white/10">
                      {learningProfile ? t.dashboard.home.learningStyleCard.retakeCta : t.dashboard.home.learningStyleCard.startCta}
                    </button>
                    <button onClick={() => setShowTasteOnboarding(true)} className="flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline">
                      <Film className="h-4 w-4" strokeWidth={1.75} />
                      {t.dashboard.home.learningStyleCard.analyzeVideosCta}
                    </button>
                    {learningProfile && (
                      <button onClick={handleClearProfile} className="text-sm text-gray-400 transition-colors hover:text-red-500 dark:text-white/40 dark:hover:text-red-400">
                        Clear my profile
                      </button>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>

        )}

        {activePage === 'roadmap' && !showLoginRequired && (
          <Roadmap
            key={`${roadmapVersion}-${activeGoalId}`}
            userData={userData}
            onLaunchPlaylist={handleLaunchPlaylist}
            onOpenSavedVideo={handleOpenSavedVideo}
            onGenerateForSubject={onGenerateForSubject}
            lastRoadmapError={lastRoadmapError}
            goals={goals}
            activeGoalId={activeGoalId}
            onAddGoal={onAddGoal}
            onEndGoal={onEndGoal}
            onSwitchGoal={onSwitchGoal}
          />
        )}
        {activePage === 'revision' && !showLoginRequired && <Revision goals={goals} />}
        {activePage === 'videos' && (
          <div className="relative">
            <button
              onClick={() => setShowCustomPlaylist(true)}
              className="absolute top-4 right-4 md:top-0 md:right-0 z-10 h-9 px-3.5 rounded-full card text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:bg-gray-50 dark:hover:bg-white/10 transition"
            >
              {t.dashboard.home.suggestion.customCta}
            </button>
            <VideoIntel
              initialPlaylist={preloadedPlaylist}
              activeGoalId={activeGoalId}
              activeTopicId={viewingTopicId}
              allGoalIds={goals.filter((g) => g.status === 'active').map((g) => g.id)}
            />
          </div>
        )}
        {activePage === 'mentor' && !showLoginRequired && <Mentor />}
        {activePage === 'notes' && !showLoginRequired && <Notes />}
        {activePage === 'test' && !showLoginRequired && <Test />}
        {activePage === 'progress' && !showLoginRequired && <Progress goals={goals} />}
        {activePage === 'research' && !showLoginRequired && <Research />}
        {activePage === 'dictionary' && <Dictionary />}
        {activePage === 'current-affairs' && !showLoginRequired && <CurrentAffairs />}

        {config && (
          <PagePlaceholder
            title={config.title}
            description={config.description}
            icon={config.icon}
            features={config.features}
            status={config.status}
          />
        )}
        </Suspense>
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
                <h2 className="text-xl font-bold">{t.settingsModal.title}</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  X
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 dark:border-white/10">
                  <span className="text-sm font-medium">{t.settingsModal.theme}</span>
                  <button
                    onClick={toggleTheme}
                    className={`relative w-14 h-8 rounded-full transition-colors ${theme === 'light' ? 'bg-black' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${theme === 'light' ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">{t.settingsModal.nameLabel}</label>
                  <input
                    type="text"
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">{t.settingsModal.roleLabel}</label>
                  <div className="flex flex-wrap gap-2">
                    {roleOptions.map((r) => (
                      <button
                        key={r}
                        onClick={() => setSettingsRole(r)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition ${settingsRole === r ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white border-transparent' : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                      >
                        {t.onboarding.roles[r]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">{t.settingsModal.topicLabel}</label>
                  <input
                    type="text"
                    value={settingsGoal}
                    onChange={(e) => setSettingsGoal(e.target.value)}
                    placeholder={t.settingsModal.topicPlaceholder}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">{t.settingsModal.languageLabel}</label>
                  <div className="flex flex-wrap gap-2">
                    {languageOptions.map((l) => (
                      <button
                        key={l}
                        onClick={() => setSettingsLanguage(l)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition ${settingsLanguage === l ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white border-transparent' : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                      >
                        {t.onboarding.languages[l]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2 mt-4">{t.settingsModal.roadmapSection.label}</label>
                  <p className="text-xs text-gray-400 dark:text-white/40 mb-3">
                    {t.settingsModal.roadmapSection.hint}
                  </p>
                  <button
                    onClick={handleRegenerateRoadmap}
                    disabled={regeneratingRoadmap || !userData}
                    className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition disabled:opacity-40"
                  >
                    {regeneratingRoadmap ? t.settingsModal.roadmapSection.regeneratingCta : t.settingsModal.roadmapSection.regenerateCta}
                  </button>
                  {regenerateResult === 'success' && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">{t.settingsModal.roadmapSection.successMsg}</p>
                  )}
                  {regenerateResult === 'error' && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2">{t.settingsModal.roadmapSection.errorMsg}</p>
                  )}
                </div>

                {/* Deep setting — the full learning-profile report lives here,
                    not on the home page. Collapsed by default; only renders
                    when the user explicitly taps to view it. */}
                {learningProfile && (
                  <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                    <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2 mt-4">
                      {t.settingsModal.learningProfileSection.label}
                    </label>
                    <button
                      onClick={() => setShowFullProfileReport((v) => !v)}
                      className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition"
                    >
                      {showFullProfileReport ? t.settingsModal.learningProfileSection.hideCta : t.settingsModal.learningProfileSection.viewCta}
                    </button>
                    {showFullProfileReport && (
                      <div className="mt-3">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-white/60 mb-3">
                          <div>{t.settingsModal.learningProfileSection.dims.pace}: {learningProfile.pace}/10</div>
                          <div>{t.settingsModal.learningProfileSection.dims.practical}: {learningProfile.theoryVsPractical}/10</div>
                          <div>{t.settingsModal.learningProfileSection.dims.structure}: {learningProfile.structureNeed}/10</div>
                          <div>{t.settingsModal.learningProfileSection.dims.depth}: {learningProfile.depth}/10</div>
                          <div>{t.settingsModal.learningProfileSection.dims.language}: {learningProfile.languageComplexity}/10</div>
                          <div>{t.settingsModal.learningProfileSection.dims.storytelling}: {learningProfile.storytelling}/10</div>
                          <div>{t.settingsModal.learningProfileSection.dims.repetition}: {learningProfile.repetitionNeed}/10</div>
                          <div>{t.settingsModal.learningProfileSection.dims.reliability}: {learningProfile.reliabilityScore}%</div>
                        </div>
                        {learningProfile.blueprintReport && (
                          <p className="text-xs text-gray-500 dark:text-white/60 leading-relaxed border-t border-gray-200 dark:border-white/10 pt-3">
                            {learningProfile.blueprintReport}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Personality Check — separate optional 20-question screen,
                    opened from here only (not part of the Blueprint Interview). */}
                <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2 mt-4">
                    Personality Check
                  </label>
                  <p className="text-xs text-gray-400 dark:text-white/40 mb-3">
                    20 quick questions (about 5 minutes) on how you study and handle pressure. Optional, and it never changes your learning-style profile.
                  </p>
                  <button
                    onClick={() => setShowPersonalityQuiz(true)}
                    className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition"
                  >
                    {personalityProfile ? 'Retake personality check' : 'Take personality check'}
                  </button>
                  {personalityProfile && (
                    <>
                      <button
                        onClick={() => setShowPersonalityResult((v) => !v)}
                        className="w-full mt-2 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition"
                      >
                        {showPersonalityResult ? 'Hide result' : 'View result'}
                      </button>
                      {showPersonalityResult && (
                        <div className="mt-3 space-y-3">
                          <PersonalityReportCard
                            profile={personalityProfile}
                            onReport={(report) => {
                              const updated = { ...personalityProfile, report };
                              savePersonalityProfile(updated);
                              setPersonalityProfile(updated);
                            }}
                          />
                          {(() => {
                            const attempts = getTestAttempts();
                            if (attempts.length === 0) {
                              return (
                                <p className="text-xs text-gray-400 dark:text-white/40">
                                  Take a test in the Test section to see your growth edges here.
                                </p>
                              );
                            }
                            const latest = [...attempts].sort((x, y) => (x.completedAt < y.completedAt ? 1 : -1))[0];
                            const edges = computeGrowthEdges(personalityProfile, analyzeAttempt(latest), analyzeHistory(latest, attempts), getBehaviourStats(t.revisionTasks, goals));
                            return <GrowthEdgesCard edges={edges} hasPersonality />;
                          })()}
                          <button
                            onClick={() => {
                              clearPersonalityProfile();
                              setPersonalityProfile(null);
                              setShowPersonalityResult(false);
                            }}
                            className="w-full py-2 rounded-xl text-xs text-gray-400 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 transition"
                          >
                            Clear my personality result
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Account — sign out lives here now, inside Settings,
                    instead of a floating button on every screen. */}
                <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2 mt-4">
                    {t.settingsModal.accountSection.label}
                  </label>
                  {isGuest ? (
                    <>
                      <p className="text-xs text-gray-400 dark:text-white/40 mb-3">{t.authPrompt.guestAccountNote}</p>
                      <button
                        onClick={() => { setShowSettings(false); openSignIn(); }}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white text-sm font-semibold hover:opacity-90 transition"
                      >
                        {t.authPrompt.lockedCta}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-400 dark:text-white/40 mb-3">
                        {format(t.settingsModal.accountSection.signedInAs, getCurrentUser()?.displayName || getCurrentUser()?.email || '')}
                      </p>
                      <button
                        onClick={() => signOutOfApp()}
                        className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition"
                      >
                        {t.settingsModal.accountSection.signOutCta}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-6 pt-0">
                <button
                  onClick={handleSaveSettings}
                  disabled={!settingsName.trim()}
                  className="w-full px-6 py-3 rounded-full bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white font-semibold text-sm disabled:opacity-40 transition"
                >
                  {t.settingsModal.saveCta}
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
                <h2 className="text-xl font-bold">{t.customPlaylistModal.title}</h2>
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
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">{t.customPlaylistModal.topicLabel}</label>
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => {
                      setCustomTopic(e.target.value);
                      setCustomError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && !customLoading && handleCustomPlaylist()}
                    placeholder={t.customPlaylistModal.topicPlaceholder}
                    autoFocus
                    disabled={customLoading}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">{t.customPlaylistModal.hoursLabel}</label>
                  <div className="flex gap-2">
                    {hoursOptions.map((h) => (
                      <button
                        key={h}
                        onClick={() => setCustomHours(h)}
                        disabled={customLoading}
                        className={`flex-1 py-2 rounded-lg text-sm border transition ${customHours === h ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white border-transparent' : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">{t.customPlaylistModal.deadlineLabel}</label>
                  <div className="flex gap-2">
                    {deadlineOptions.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setCustomDeadline(d.id)}
                        disabled={customLoading}
                        className={`flex-1 py-2 rounded-lg text-sm border transition ${customDeadline === d.id ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white border-transparent' : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'}`}
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
                  <span className="text-xs text-gray-400 dark:text-white/40 mr-1 self-center">{t.customPlaylistModal.quickLabel}</span>
                  {(getRoadmapData(activeGoalId)?.children ?? [])
                    .filter((topic) => topic.status !== 'locked')
                    .slice(0, 6)
                    .map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => {
                        setCustomTopic(topic.title);
                        setCustomError('');
                      }}
                      disabled={customLoading}
                      className="px-3 py-1 border border-gray-200 dark:border-white/10 rounded-full text-xs hover:bg-gray-100 dark:hover:bg-white/10 transition disabled:opacity-50"
                    >
                      {topic.title}
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
                      <span>{t.customPlaylistModal.loadingCta}</span>
                    </div>
                  </div>
                )}

                {!learningProfile && !customLoading && t.customPlaylistModal.noProfileHint && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-300">{t.customPlaylistModal.noProfileHint}</p>
                )}
              </div>

              <div className="p-6 pt-0">
                <button
                  onClick={handleCustomPlaylist}
                  disabled={customLoading || !customTopic.trim()}
                  className="w-full px-6 py-3 rounded-full bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white disabled:opacity-40 font-semibold transition"
                >
                  {customLoading ? t.customPlaylistModal.generatingCta : t.customPlaylistModal.generateCta}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav
        items={sidebarItems.map((i) => ({ id: i.id, label: i.label, locked: navState(i.id).isLocked }))}
        activeId={activePage}
        onSelect={(id) => {
          const item = sidebarItems.find((i) => i.id === id);
          if (item) selectNav(item.id, item.label);
        }}
      />
    </div>
  );
}

export default function Dashboard(props: DashboardProps) {
  return <DashboardInner {...props} />;
}