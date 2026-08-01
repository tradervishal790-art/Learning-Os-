import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRoadmapData, getRoadmapProgress } from './roadmapData';
import type { Topic, Video } from './types';
import { buildCandidatePoolForConcept } from './conceptVideoPool';
import { selectPlaylistForConcept, analyzedVideoToVideo, getLastTeacherForConcept } from './PlaylistBuilder';
import { getLearningProfile } from './learningProfileStore';
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

const hoursOptions = [5, 10, 20, 40];
const deadlineOptions = [
  { id: 'none', label: 'None' },
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: '1y', label: '1Y' },
];

interface RoadmapProps {
  /** Called with the ranked primary + 2 fallback videos, so the parent can
   *  switch to the Video Intelligence page and preload them into the player. */
  onLaunchPlaylist: (payload: { primary: Video; fallbacks: Video[] }) => void;
}

export default function Roadmap({ onLaunchPlaylist }: RoadmapProps) {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState('');
  const [topicHours, setTopicHours] = useState(0);
  const [topicDeadline, setTopicDeadline] = useState('');
  const [showDeepDive, setShowDeepDive] = useState(false);

  const roadmap = getRoadmapData();
  const { total: totalTopics, completed: completedTopics, learning: learningTopics, percent: progressPercent } =
    getRoadmapProgress(roadmap);

  const openTopic = (topic: Topic) => {
    setSelectedTopic(topic);
    setShowWhy(false);
    setPlaylistError('');
    setTopicHours(0);
    setTopicDeadline('');
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
      // Timing choice stored for the Revision engine to read later —
      // not yet used by the ranking algorithm itself.
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

      const candidates = await buildCandidatePoolForConcept(selectedTopic);
      if (candidates.length === 0) {
        setPlaylistError('Koi achhi video nahi mili. Thodi der baad try karo.');
        return;
      }

      const currentTeacherId = getLastTeacherForConcept(selectedTopic.id);
      const result = selectPlaylistForConcept(candidates, learnerProfile, currentTeacherId);
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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🗺️</span>
          <h1 className="text-2xl md:text-4xl font-bold">Your Roadmap</h1>
        </div>
      </motion.div>

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
                      <h3 className="text-sm font-semibold mb-2">Hours / week</h3>
                      <div className="flex gap-2 mb-4">
                        {hoursOptions.map((h) => (
                          <button
                            key={h}
                            onClick={() => setTopicHours(h)}
                            className={`flex-1 py-2.5 md:py-2 rounded-lg text-sm border transition ${topicHours === h ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                          >
                            {h}h
                          </button>
                        ))}
                      </div>
                      <h3 className="text-sm font-semibold mb-2">Deadline</h3>
                      <div className="flex gap-2 flex-wrap">
                        {deadlineOptions.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => setTopicDeadline(d.id)}
                            className={`flex-1 min-w-[3.5rem] py-2.5 md:py-2 rounded-lg text-sm border transition ${topicDeadline === d.id ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
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
                      {playlistError && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{playlistError}</p>}
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