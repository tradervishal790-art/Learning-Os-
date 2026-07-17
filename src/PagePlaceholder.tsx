import { motion } from 'framer-motion';
import type { PageStatus } from './types';

interface PagePlaceholderProps {
  title: string;
  description: string;
  icon: string;
  features: string[];
  status: PageStatus;
}

const statusBadgeConfig: Record<PageStatus, { label: string; bg: string; border: string; text: string }> = {
  'coming-soon': { label: 'Coming Soon', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-300' },
  beta: { label: 'Beta', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300' },
  active: { label: 'Active', bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-300' },
};

export default function PagePlaceholder({ title, description, icon, features, status }: PagePlaceholderProps) {
  const badge = statusBadgeConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-8 max-w-5xl mx-auto"
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center text-3xl">
            {icon}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">{title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.bg} border ${badge.border} ${badge.text}`}
              >
                {badge.label}
              </span>
            </div>
          </div>
        </div>
        <p className="text-white/60 text-lg max-w-2xl">{description}</p>
      </div>

      {/* Features list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {features.map((feature, i) => (
          <motion.div
            key={feature}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
            className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300 text-sm flex-shrink-0">
              ✓
            </div>
            <div className="flex-1">
              <div className="text-white font-medium text-sm">{feature}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Preview card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="p-8 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5 backdrop-blur-md text-center"
        style={{ boxShadow: '0 0 40px rgba(139, 92, 246, 0.1)' }}
      >
        <div className="text-5xl mb-4">🚧</div>
        <h3 className="text-xl font-semibold text-white mb-2">Under Construction</h3>
        <p className="text-white/60 text-sm max-w-md mx-auto">
          This feature is part of the Learning OS roadmap. The UI is ready — we're now connecting it to AI
          engines and data sources.
        </p>
      </motion.div>
    </motion.div>
  );
}