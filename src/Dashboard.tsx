import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PagePlaceholder from './PagePlaceholder';
import Roadmap from './Roadmap';
import Revision from './Revision';
import VideoIntel from './VideoIntel';
import LearningQuiz from './LearningQuiz';
import { getRoadmapData, getCurrentTopic } from './roadmapData';
import { revisionData, getRevisionStats } from './revisionData';
import { getLearningProfile, saveLearningProfile } from './learningProfileStore';
import { buildCandidatePoolForConcept } from './conceptVideoPool';
import { selectPlaylistForConcept, analyzedVideoToVideo } from './PlaylistBuilder';
import type { DashboardPageId, PageConfig, UserOnboardingData, LearningProfile, Video, Topic } from './types';
import Mentor from './Mentor';
import Notes from './Notes';

interface DashboardProps {
  userData: UserOnboardingData | null;
}

const sidebarItems: { id: DashboardPageId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'roadmap', label: 'Roadmap', icon: '🗺️' },
  { id: 'revision', label: 'Revision', icon: '🔄' },
  { id: 'notes', label: 'AI Notes', icon: '📝' },
  { id: 'videos', label: 'Video Intel', icon: '🎥' },
  { id: 'mentor', label: 'AI Mentor', icon: '🤖' },
  { id: 'progress', label: 'Progress', icon: '📊' },
];

const pageConfigs: Partial<Record<DashboardPageId, PageConfig>> = {
  progress: {
    title: 'Progress Analytics',
    description: 'Track your learning speed, retention, and concept mastery.',
    icon: '📊',
    status: 'beta',
    features: [
      'Learning time tracking', 'Concept mastery heatmap', 'Retention rate analysis',
      'Completion percentages', 'Consistency streaks', 'Weak area identification',
    ],
  },
};

const ACTIVE_DAYS_STORAGE_KEY = 'learning_os_active_days';

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

export default function Dashboard({ userData }: DashboardProps) {
  const [activePage, setActivePage] = useState<DashboardPageId>('dashboard');
  const [streak, setStreak] = useState(0);
  const [showLearningQuiz, setShowLearningQuiz] = useState(false);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(getLearningProfile);
  const [preloadedPlaylist, setPreloadedPlaylist] = useState<{ primary: Video; fallbacks: Video[] } | null>(null);

  // === Custom Playlist Modal State ===
  const [showCustomPlaylist, setShowCustomPlaylist] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState('');

  useEffect(() => {
    setStreak(trackAndComputeStreak());
  }, []);

  const handleQuizComplete = (profile: LearningProfile) => {
    setLearningProfile(profile);
    saveLearningProfile(profile);
    setShowLearningQuiz(false);
  };

  const handleLaunchPlaylist = (payload: { primary: Video; fallbacks: Video[] }) => {
    setPreloadedPlaylist(payload);
    setActivePage('videos');
  };

  // === Custom Topic Playlist Generator ===
  const handleCustomPlaylist = async () => {
    const trimmed = customTopic.trim();
    if (!trimmed) {
      setCustomError('Koi topic toh daal yaar!');
      return;
    }

    const profile = getLearningProfile();
    if (!profile) {
      setCustomError('Pehle Dashboard se Learning Style Quiz complete karo — tabhi videos personalize hongi.');
      return;
    }

    setCustomError('');
    setCustomLoading(true);

    // Build ad-hoc Topic object — sidha concept pool builder mein pass hoga
    const adhocTopic: Topic = {
      id: `custom-${Date.now()}`,
      title: trimmed,
      description: `User-defined learning session for: ${trimmed}`,
      status: 'learning',
      estimatedTime: '—',
      difficulty: 'Beginner',
      why: { learn: '', connect: '', system: '', risk: '' },
      topicKeywords: trimmed.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
    };

    try {
      const candidates = await buildCandidatePoolForConcept(adhocTopic);
      if (candidates.length === 0) {
        setCustomError('Is topic ke liye koi video nahi mili. Try different words!');
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
    } catch (err: any) {
      setCustomError(err.message || 'Kuch gadbad ho gayi. Console check karo.');
    } finally {
      setCustomLoading(false);
    }
  };

  if (showLearningQuiz) {
    return <LearningQuiz onComplete={handleQuizComplete} />;
  }

  const displayName = 'Vishal';
  const currentTopic = getCurrentTopic(getRoadmapData());
  const revisionStats = getRevisionStats(revisionData);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const statsCards = [
    { title: 'Current Mission', value: 'Understand Systems', subtitle: 'Not just information', icon: '🧠', gradient: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30', onClick: () => setActivePage('roadmap') },
    { title: "Today's Goal", value: currentTopic ? currentTopic.title : 'Pick a topic to start', subtitle: currentTopic ? `${currentTopic.estimatedTime} • ${currentTopic.difficulty}` : 'Open the roadmap', icon: '🎯', gradient: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', onClick: () => setActivePage('roadmap') },
    { title: 'Revision Due', value: `${revisionStats.dueToday} concepts`, subtitle: revisionStats.overdue > 0 ? `${revisionStats.overdue} overdue` : 'All caught up', icon: '🔄', gradient: 'from-orange-500/20 to-red-500/20', border: 'border-orange-500/30', onClick: () => setActivePage('revision') },
    { title: 'Learning Streak', value: `${streak} ${streak === 1 ? 'day' : 'days'}`, subtitle: streak > 0 ? '🔥 Keep going!' : 'Start today!', icon: '⚡', gradient: 'from-yellow-500/20 to-orange-500/20', border: 'border-yellow-500/30', onClick: () => setActivePage('progress') },
  ];

  const config = pageConfigs[activePage];

  return (
    <div className="min-h-screen bg-[#030303] flex">
      {/* Sidebar */}
      <motion.aside initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6 }} className="w-64 border-r border-white/5 p-6 flex flex-col">
        <div className="mb-10">
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Learning OS</h1>
          <p className="text-xs text-white/40 mt-1">v1.0 • Beta</p>
        </div>
        <nav className="space-y-1 flex-1">
          {sidebarItems.map((item, i) => (
            <motion.button key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }} onClick={() => setActivePage(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activePage === item.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">{item.icon}</span>{item.label}
            </motion.button>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-white/5">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold">{displayName.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{displayName}</div>
              <div className="text-xs text-white/40 truncate">{userData?.role ? userData.role : 'Pro Learner'}</div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {/* Top bar */}
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }} className="border-b border-white/5 px-8 py-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">{getGreeting()}, <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{displayName}</span></h2>
            <p className="text-sm text-white/50 mt-1">Mission: <span className="text-white/80">Understand Systems. Not Information.</span></p>
          </div>
          <button onClick={() => console.log('TODO: open settings panel')} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition">⚙️ Settings</button>
        </motion.div>

        {/* Dashboard home */}
        {activePage === 'dashboard' && (
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {statsCards.map((card, i) => (
                <motion.button key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }} whileHover={{ y: -4 }} onClick={card.onClick} className={`text-left p-5 rounded-2xl border ${card.border} bg-gradient-to-br ${card.gradient} backdrop-blur-md cursor-pointer transition-shadow hover:shadow-lg`}>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-2xl">{card.icon}</span>
                    <span className="text-[10px] uppercase tracking-wider text-white/40">{card.title}</span>
                  </div>
                  <div className="text-xl font-bold text-white mb-1 line-clamp-1">{card.value}</div>
                  <div className="text-xs text-white/50">{card.subtitle}</div>
                </motion.button>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }} className="p-6 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5 backdrop-blur-md flex items-center gap-4 flex-wrap">
              <div className="text-3xl">💡</div>
              <div className="flex-1 min-w-[200px]">
                <div className="text-xs uppercase tracking-wider text-purple-300 mb-1">AI Suggestion</div>
                <p className="text-white/80 text-sm leading-relaxed">Based on your learning style, you grasp concepts 40% faster with visual examples. Try watching the "React Visual Guide" next.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => setShowCustomPlaylist(true)} className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-white text-sm font-medium hover:bg-white/20 transition whitespace-nowrap">
                  ✨ Any Topic Playlist
                </button>
                <button onClick={() => setActivePage('videos')} className="px-4 py-2 rounded-full bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition whitespace-nowrap">
                  Watch Now
                </button>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.5 }} className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
              <h3 className="text-white font-semibold mb-1">{learningProfile ? 'Your Learning Style' : 'Discover Your Learning Style'}</h3>
              <p className="text-xs text-white/40 mb-4">{learningProfile ? 'Based on your learning-style assessment' : 'Take a short quiz so recommendations match how you actually learn'}</p>
              {learningProfile && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/60 mb-4">
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
              <button onClick={() => setShowLearningQuiz(true)} className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition">
                {learningProfile ? 'Retake Quiz →' : '🧠 Take Learning Style Quiz →'}
              </button>
            </motion.div>
          </div>
        )}

        {activePage === 'roadmap' && <Roadmap onLaunchPlaylist={handleLaunchPlaylist} />}
        {activePage === 'revision' && <Revision />}
        {activePage === 'videos' && <VideoIntel initialPlaylist={preloadedPlaylist} />}
        {activePage === 'mentor' && <Mentor />}
        {activePage === 'notes' && <Notes />}

        {config && <PagePlaceholder title={config.title} description={config.description} icon={config.icon} features={config.features} status={config.status} />}
      </div>

      {/* === Custom Playlist Modal === */}
      <AnimatePresence>
        {showCustomPlaylist && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !customLoading && setShowCustomPlaylist(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-3xl max-w-xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">✨ Custom Playlist</h2>
                  <p className="text-sm text-white/50 mt-1">Any topic — AI curated videos just for you</p>
                </div>
                <button
                  onClick={() => setShowCustomPlaylist(false)}
                  disabled={customLoading}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition disabled:opacity-30 flex-shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/60 mb-2">
                    What do you want to learn?
                  </label>
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => {
                      setCustomTopic(e.target.value);
                      setCustomError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && !customLoading && handleCustomPlaylist()}
                    placeholder="e.g., Django basics, Calculus integrals, UX design..."
                    autoFocus
                    disabled={customLoading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 placeholder-white/40 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
                  />
                </div>

                {customError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                    ⚠️ {customError}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-white/40 mr-1 self-center">Quick:</span>
                  {['React Hooks', 'Python Basics', 'Calculus', 'SQL', 'CSS Grid', 'Data Structures'].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setCustomTopic(s);
                        setCustomError('');
                      }}
                      disabled={customLoading}
                      className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs hover:bg-white/10 transition disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {customLoading && (
                  <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-sm text-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span>YouTube + Gemini se best videos dhundh raha hoon...</span>
                    </div>
                  </div>
                )}

                {!learningProfile && !customLoading && (
                  <p className="text-xs text-yellow-300">
                    ⚠️ Personalization ke liye pehle Learning Style Quiz complete karo
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 pt-0">
                <button
                  onClick={handleCustomPlaylist}
                  disabled={customLoading || !customTopic.trim()}
                  className="w-full px-6 py-3 rounded-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition"
                >
                  {customLoading ? 'Generating...' : '🚀 Generate Playlist'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
