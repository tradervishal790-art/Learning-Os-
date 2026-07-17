import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import PagePlaceholder from './PagePlaceholder';
import Roadmap from './Roadmap';
import Revision from './Revision';
import VideoIntel from './VideoIntel';
import { roadmapData, getCurrentTopic } from './roadmapData';
import { revisionData, getRevisionStats } from './revisionData';
import type { DashboardPageId, PageConfig, UserOnboardingData } from './types';
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

const weeklyProgress = [
  { day: 'Mon', hours: 2.5 },
  { day: 'Tue', hours: 3 },
  { day: 'Wed', hours: 1.5 },
  { day: 'Thu', hours: 2 },
  { day: 'Fri', hours: 3.5 },
  { day: 'Sat', hours: 1 },
  { day: 'Sun', hours: 0 },
];

const pageConfigs: Partial<Record<DashboardPageId, PageConfig>> = {
  

  progress: {
    title: 'Progress Analytics',
    description: 'Track your learning speed, retention, and concept mastery.',
    icon: '📊',
    status: 'beta',
    features: [
      'Learning time tracking',
      'Concept mastery heatmap',
      'Retention rate analysis',
      'Completion percentages',
      'Consistency streaks',
      'Weak area identification',
    ],
  },
};

/** Learning DNA is derived once from onboarding role/goal — falls back to defaults if not set. */
function getLearningDNA(userData: UserOnboardingData | null) {
  if (!userData) {
    return [
      { label: 'Analytical', value: 90 },
      { label: 'Pattern Recognition', value: 88 },
      { label: 'System Thinking', value: 92 },
      { label: 'Curiosity', value: 94 },
    ];
  }
  // TODO: derive real trait weights from onboarding + behavior data once Firebase is wired in.
  return [
    { label: 'Analytical', value: 95 },
    { label: 'Pattern Recognition', value: 92 },
    { label: 'System Thinking', value: 98 },
    { label: 'Curiosity', value: 96 },
  ];
}

const ACTIVE_DAYS_STORAGE_KEY = 'learning_os_active_days';

/** Records today as an "active" day and returns the current consecutive-day streak. */
function trackAndComputeStreak(): number {
  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

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
  // Walk backward day by day from today until we hit a day with no activity.
  // eslint-disable-next-line no-constant-condition
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

  useEffect(() => {
    setStreak(trackAndComputeStreak());
  }, []);

  const maxHours = Math.max(...weeklyProgress.map((d) => d.hours));
  const displayName = 'Vishal'; // TODO: pull from auth/profile once Firebase Auth is added
  const learningDNA = getLearningDNA(userData);

  const currentTopic = getCurrentTopic(roadmapData);
  const revisionStats = getRevisionStats(revisionData);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const statsCards: {
    title: string;
    value: string;
    subtitle: string;
    icon: string;
    gradient: string;
    border: string;
    onClick: () => void;
  }[] = [
    {
      title: 'Current Mission',
      value: 'Understand Systems',
      subtitle: 'Not just information',
      icon: '🧠',
      gradient: 'from-purple-500/20 to-pink-500/20',
      border: 'border-purple-500/30',
      onClick: () => setActivePage('roadmap'),
    },
    {
      title: "Today's Goal",
      value: currentTopic ? currentTopic.title : 'Pick a topic to start',
      subtitle: currentTopic ? `${currentTopic.estimatedTime} • ${currentTopic.difficulty}` : 'Open the roadmap',
      icon: '🎯',
      gradient: 'from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500/30',
      onClick: () => setActivePage('roadmap'),
    },
    {
      title: 'Revision Due',
      value: `${revisionStats.dueToday} concepts`,
      subtitle: revisionStats.overdue > 0 ? `${revisionStats.overdue} overdue` : 'All caught up',
      icon: '🔄',
      gradient: 'from-orange-500/20 to-red-500/20',
      border: 'border-orange-500/30',
      onClick: () => setActivePage('revision'),
    },
    {
      title: 'Learning Streak',
      value: `${streak} ${streak === 1 ? 'day' : 'days'}`,
      subtitle: streak > 0 ? '🔥 Keep going!' : 'Start today!',
      icon: '⚡',
      gradient: 'from-yellow-500/20 to-orange-500/20',
      border: 'border-yellow-500/30',
      onClick: () => setActivePage('progress'),
    },
  ];

  const config = pageConfigs[activePage];

  return (
    <div className="min-h-screen bg-[#030303] flex">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="w-64 border-r border-white/5 p-6 flex flex-col"
      >
        <div className="mb-10">
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Learning OS
          </h1>
          <p className="text-xs text-white/40 mt-1">v1.0 • Beta</p>
        </div>

        <nav className="space-y-1 flex-1">
          {sidebarItems.map((item, i) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activePage === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </motion.button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold">
              {displayName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{displayName}</div>
              <div className="text-xs text-white/40 truncate">
                {userData?.role ? userData.role : 'Pro Learner'}
              </div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {/* Top bar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="border-b border-white/5 px-8 py-6 flex justify-between items-center"
        >
          <div>
            <h2 className="text-2xl font-bold text-white">
              {getGreeting()},{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {displayName}
              </span>
            </h2>
            <p className="text-sm text-white/50 mt-1">
              Mission: <span className="text-white/80">Understand Systems. Not Information.</span>
            </p>
          </div>
          <button
            onClick={() => console.log('TODO: open settings panel')}
            className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition"
          >
            ⚙️ Settings
          </button>
        </motion.div>

        {/* Dashboard home */}
        {activePage === 'dashboard' && (
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {statsCards.map((card, i) => (
                <motion.button
                  key={card.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                  whileHover={{ y: -4 }}
                  onClick={card.onClick}
                  className={`text-left p-5 rounded-2xl border ${card.border} bg-gradient-to-br ${card.gradient} backdrop-blur-md cursor-pointer transition-shadow hover:shadow-lg`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-2xl">{card.icon}</span>
                    <span className="text-[10px] uppercase tracking-wider text-white/40">{card.title}</span>
                  </div>
                  <div className="text-xl font-bold text-white mb-1 line-clamp-1">{card.value}</div>
                  <div className="text-xs text-white/50">{card.subtitle}</div>
                </motion.button>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="p-6 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5 backdrop-blur-md flex items-center gap-4"
            >
              <div className="text-3xl">💡</div>
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-purple-300 mb-1">AI Suggestion</div>
                <p className="text-white/80 text-sm leading-relaxed">
                  Based on your learning style, you grasp concepts 40% faster with visual examples. Try watching
                  the "React Visual Guide" next.
                </p>
              </div>
              <button
                onClick={() => setActivePage('videos')}
                className="px-4 py-2 rounded-full bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition"
              >
                Watch Now
              </button>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md"
              >
                <h3 className="text-white font-semibold mb-1">Weekly Progress</h3>
                <p className="text-xs text-white/40 mb-6">Hours studied this week</p>

                <div className="flex items-end justify-between gap-2 h-32">
                  {weeklyProgress.map((d, i) => (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-2 h-full">
                      <div className="w-full flex-1 bg-white/5 rounded-full relative overflow-hidden">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(d.hours / maxHours) * 100}%` }}
                          transition={{ delay: 1 + i * 0.1, duration: 0.8, ease: 'easeOut' }}
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full"
                          style={{ minHeight: d.hours > 0 ? '4px' : 0 }}
                        />
                      </div>
                      <span className="text-[10px] text-white/40">{d.day}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex justify-between">
                  <div>
                    <div className="text-xs text-white/40">Total this week</div>
                    <div className="text-lg font-bold text-white">
                      {weeklyProgress.reduce((sum, d) => sum + d.hours, 0).toFixed(1)} hrs
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/40">Daily avg</div>
                    <div className="text-lg font-bold text-white">
                      {(weeklyProgress.reduce((sum, d) => sum + d.hours, 0) / weeklyProgress.length).toFixed(1)} hrs
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.5 }}
                className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md"
              >
                <h3 className="text-white font-semibold mb-1">Your Learning DNA</h3>
                <p className="text-xs text-white/40 mb-6">Cognitive traits snapshot</p>

                <div className="space-y-3">
                  {learningDNA.map((trait, i) => (
                    <div key={trait.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/70">{trait.label}</span>
                        <span className="text-white/40">{trait.value}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${trait.value}%` }}
                          transition={{ delay: 1.2 + i * 0.1, duration: 1 }}
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setActivePage('progress')}
                  className="mt-6 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition"
                >
                  View Full Profile →
                </button>
              </motion.div>
            </div>
          </div>
        )}

        {activePage === 'roadmap' && <Roadmap />}
        {activePage === 'revision' && <Revision />}
        {activePage === 'videos' && <VideoIntel />}
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
    </div>
  );
}