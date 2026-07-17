import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { revisionData, getRevisionStats } from './revisionData';
import type { RevisionStatus, RevisionDifficulty } from './types';

const statusConfig: Record<RevisionStatus, { label: string; color: string; bg: string; border: string; text: string; icon: string }> = {
  'due-today': { label: 'Due Today', color: 'from-purple-500 to-pink-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-300', icon: '🔥' },
  overdue: { label: 'Overdue', color: 'from-red-500 to-orange-500', bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', icon: '⚠️' },
  upcoming: { label: 'Upcoming', color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300', icon: '📅' },
  mastered: { label: 'Mastered', color: 'from-green-500 to-emerald-500', bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-300', icon: '⭐' },
};

const difficultyConfig: Record<RevisionDifficulty, string> = {
  Easy: 'text-green-300',
  Medium: 'text-yellow-300',
  Hard: 'text-red-300',
};

type FilterId = 'all' | RevisionStatus;

export default function Revision() {
  const [filter, setFilter] = useState<FilterId>('all');
  const [reviewedItems, setReviewedItems] = useState<Set<string>>(new Set());
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const handleMarkDone = (id: string) => {
    setReviewedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
    if (reviewingId === id) setReviewingId(null);
  };

  const handleReviewNow = (id: string) => {
    setReviewingId(id);
    // TODO: once AI Mentor is wired in, this should open a quiz/explanation
    // session for the topic instead of just flagging it as "in review".
  };

  const stats = getRevisionStats(revisionData);

  const filteredItems = filter === 'all' ? revisionData : revisionData.filter((i) => i.status === filter);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🔄</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white">Revision Engine</h1>
        </div>
        <p className="text-white/60 text-lg">Spaced repetition system — Day 1, 3, 7, 15, 30, 60</p>
      </motion.div>

      {/* Top stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-md">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Due Today</div>
          <div className="text-3xl font-bold text-white">{stats.dueToday}</div>
          <div className="text-xs text-purple-300 mt-1">concepts</div>
        </div>
        <div className="p-4 rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/10 to-orange-500/10 backdrop-blur-md">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Overdue</div>
          <div className="text-3xl font-bold text-white">{stats.overdue}</div>
          <div className="text-xs text-red-300 mt-1">catch up</div>
        </div>
        <div className="p-4 rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-md">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Mastered</div>
          <div className="text-3xl font-bold text-white">{stats.mastered}</div>
          <div className="text-xs text-green-300 mt-1">⭐ concepts</div>
        </div>
        <div className="p-4 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-md">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Retention</div>
          <div className="text-3xl font-bold text-white">{stats.avgRetention}%</div>
          <div className="text-xs text-blue-300 mt-1">average</div>
        </div>
      </motion.div>

      {/* Filter tabs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(
          [
            { id: 'all', label: 'All', count: stats.total },
            { id: 'due-today', label: 'Due Today', count: stats.dueToday },
            { id: 'overdue', label: 'Overdue', count: stats.overdue },
            { id: 'upcoming', label: 'Upcoming', count: stats.upcoming },
            { id: 'mastered', label: 'Mastered', count: stats.mastered },
          ] as { id: FilterId; label: string; count: number }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filter === tab.id ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tab.label} <span className="opacity-60">({tab.count})</span>
          </button>
        ))}
      </motion.div>

      {/* Revision cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredItems.map((item, i) => {
            const status = statusConfig[item.status];
            const isReviewed = reviewedItems.has(item.id);
            const isReviewing = reviewingId === item.id;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className={`p-5 rounded-2xl border ${isReviewing ? 'border-purple-400' : status.border} ${status.bg} backdrop-blur-md transition-all ${
                  isReviewed ? 'opacity-50' : ''
                }`}
                style={isReviewing ? { boxShadow: '0 0 25px rgba(139, 92, 246, 0.35)' } : {}}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${status.color} flex flex-col items-center justify-center flex-shrink-0`}>
                    <span className="text-[10px] uppercase tracking-wider text-white/80">Day</span>
                    <span className="text-2xl font-bold text-white">{item.day}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${status.bg} ${status.text} border ${status.border}`}>
                        {status.icon} {status.label}
                      </span>
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">• {item.category}</span>
                      <span className={`text-[10px] uppercase tracking-wider ${difficultyConfig[item.difficulty]}`}>
                        • {item.difficulty}
                      </span>
                      {isReviewing && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          Reviewing now
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-semibold mb-1">{item.topic}</h3>
                    <div className="flex items-center gap-3 text-xs text-white/50">
                      <span>📅 {item.dueDate}</span>
                      <span>•</span>
                      <span>🧠 Retention: {item.retention}%</span>
                    </div>

                    <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.retention}%` }}
                        transition={{ delay: 0.2 + i * 0.05, duration: 0.8 }}
                        className={`h-full bg-gradient-to-r ${status.color} rounded-full`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {item.status === 'mastered' ? (
                      <span className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 text-xs font-medium text-center">
                        ✓ Done
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleMarkDone(item.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isReviewed
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                              : 'bg-white text-black hover:scale-105'
                          }`}
                        >
                          {isReviewed ? '✓ Reviewed' : 'Mark Done'}
                        </button>
                        <button
                          onClick={() => handleReviewNow(item.id)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs font-medium hover:bg-white/10 transition"
                        >
                          {isReviewing ? 'Reviewing…' : 'Review Now'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredItems.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-xl font-semibold text-white mb-2">All caught up!</h3>
          <p className="text-white/60">No items in this category right now.</p>
        </motion.div>
      )}
    </div>
  );
}