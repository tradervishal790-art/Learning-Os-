import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRoadmapData, getRoadmapProgress } from './roadmapData';
import type { Topic } from './types';

const statusConfig: Record<Topic['status'], { label: string; color: string; bg: string; border: string; text: string; icon: string }> = {
  mastered: { label: 'Mastered', color: 'from-green-500 to-emerald-500', bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-300', icon: '⭐' },
  completed: { label: 'Completed', color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300', icon: '✓' },
  learning: { label: 'In Progress', color: 'from-purple-500 to-pink-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-300', icon: '🔥' },
  locked: { label: 'Locked', color: 'from-gray-500 to-gray-600', bg: 'bg-white/5', border: 'border-white/10', text: 'text-white/40', icon: '🔒' },
};

const difficultyConfig: Record<Topic['difficulty'], string> = {
  Beginner: 'text-green-300',
  Intermediate: 'text-yellow-300',
  Advanced: 'text-red-300',
};

export default function Roadmap() {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const roadmap = getRoadmapData();
  const { total: totalTopics, completed: completedTopics, learning: learningTopics, percent: progressPercent } =
    getRoadmapProgress(roadmap);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🗺️</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white">Your Learning Roadmap</h1>
        </div>
        <p className="text-white/60 text-lg">AI-generated path tailored to your mind, not just your goal.</p>
      </motion.div>

     
      {/* Top stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Progress</div>
          <div className="text-2xl font-bold text-white">{progressPercent}%</div>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Completed</div>
          <div className="text-2xl font-bold text-white">{completedTopics}/{totalTopics}</div>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">In Progress</div>
          <div className="text-2xl font-bold text-white">{learningTopics}</div>
        </div>
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Est. Time</div>
          <div className="text-2xl font-bold text-white">{roadmap.estimatedTime}</div>
        </div>
      </motion.div>

      {/* Progress bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="mb-10">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ delay: 0.3, duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full"
            style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)' }}
          />
        </div>
      </motion.div>

      {/* Main path card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }} className="p-6 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5 backdrop-blur-md mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl">🎯</div>
            <div>
             <h2 className="text-xl font-bold text-white">{roadmap.title}</h2>
              <p className="text-sm text-white/50">{roadmap.description}</p> 
            </div>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300">
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
            // `relative` is required here so the connecting-line div (position: absolute)
            // below anchors to this card instead of the nearest ancestor with layout.
            <motion.button
              key={topic.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
              onClick={() => {
                setSelectedTopic(topic);
                setShowWhy(false);
              }}
              disabled={topic.status === 'locked'}
              className={`relative w-full p-5 rounded-2xl border ${status.border} ${status.bg} backdrop-blur-md text-left transition-all ${
                topic.status === 'locked' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${status.color} flex items-center justify-center text-xl flex-shrink-0`}>
                  {status.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-white/30">STEP {i + 1}</span>
                    <span className={`text-[10px] uppercase tracking-wider ${difficultyConfig[topic.difficulty]}`}>
                      • {topic.difficulty}
                    </span>
                  </div>
                  <h3 className="text-white font-semibold mb-1">{topic.title}</h3>
                  <p className="text-sm text-white/50 line-clamp-1">{topic.description}</p>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className={`text-[10px] uppercase tracking-wider ${status.text} mb-1`}>{status.label}</div>
                  <div className="text-xs text-white/40">{topic.estimatedTime}</div>
                </div>
              </div>

              {!isLast && (
                <div className="absolute left-[2.4rem] -bottom-3 w-0.5 h-3 bg-gradient-to-b from-white/20 to-transparent" />
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedTopic(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`p-6 border-b border-white/5 bg-gradient-to-br ${statusConfig[selectedTopic.status].bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${statusConfig[selectedTopic.status].bg} ${statusConfig[selectedTopic.status].text} border ${statusConfig[selectedTopic.status].border}`}
                  >
                    {statusConfig[selectedTopic.status].label}
                  </span>
                  <button
                    onClick={() => setSelectedTopic(null)}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
                  >
                    ✕
                  </button>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{selectedTopic.title}</h2>
                <p className="text-white/60 text-sm">{selectedTopic.description}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-white/40">
                  <span>⏱️ {selectedTopic.estimatedTime}</span>
                  <span>•</span>
                  <span className={difficultyConfig[selectedTopic.difficulty]}>📊 {selectedTopic.difficulty}</span>
                </div>
              </div>

              <div className="flex border-b border-white/5">
                <button
                  onClick={() => setShowWhy(false)}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition ${!showWhy ? 'text-white border-b-2 border-purple-500' : 'text-white/50 hover:text-white'}`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setShowWhy(true)}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition ${showWhy ? 'text-white border-b-2 border-purple-500' : 'text-white/50 hover:text-white'}`}
                >
                  WHY Layer
                </button>
              </div>

              <div className="p-6">
                {!showWhy ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <h3 className="text-sm font-semibold text-white mb-2">📚 What you'll learn</h3>
                      <p className="text-sm text-white/60">{selectedTopic.description}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <h3 className="text-sm font-semibold text-white mb-2">🎯 Next steps</h3>
                      <ul className="space-y-2 text-sm text-white/60">
                        <li>• Watch AI-curated videos (5 best, ranked for you)</li>
                        <li>• Generate AI study notes</li>
                        <li>• Take adaptive quiz</li>
                        <li>• Build a mini-project</li>
                      </ul>
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
                        className="p-4 rounded-xl bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{item.icon}</span>
                          <h3 className="text-sm font-semibold text-white">{item.label}</h3>
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed">{item.content}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}