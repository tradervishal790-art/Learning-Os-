import { motion } from 'framer-motion';
import type { PageStatus } from './types';

interface PagePlaceholderProps {
  title: string;
  description: string;
  icon: string;
  features: string[];
  status: PageStatus;
}

const statusBadgeConfig: Record<PageStatus, string> = {
  'coming-soon': 'Coming Soon',
  beta: 'Beta',
  active: 'Active',
};

export default function PagePlaceholder({ title, description, icon, features, status }: PagePlaceholderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-8 max-w-5xl mx-auto text-black dark:text-white"
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-16 h-16 rounded-2xl border border-gray-200 dark:border-white/10 flex items-center justify-center text-3xl">
            {icon}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">{title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/60">
                {statusBadgeConfig[status]}
              </span>
            </div>
          </div>
        </div>
        <p className="text-gray-500 dark:text-white/60 text-lg max-w-2xl">{description}</p>
      </div>

      {/* Features list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {features.map((feature, i) => (
          <motion.div
            key={feature}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
            className="p-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-center text-sm flex-shrink-0">
              ✓
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{feature}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Preview card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="p-8 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-center"
      >
        <div className="text-5xl mb-4">🚧</div>
        <h3 className="text-xl font-semibold mb-2">Under Construction</h3>
        <p className="text-gray-500 dark:text-white/60 text-sm max-w-md mx-auto">
          Part of the Learning OS roadmap — UI ready, connecting it to data and engines next.
        </p>
      </motion.div>
    </motion.div>
  );
}