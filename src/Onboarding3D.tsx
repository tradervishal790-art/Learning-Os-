import { useState } from 'react';
import { motion } from 'framer-motion';
import type { UserOnboardingData } from './types';
import { getCurrentUser } from './authStore';
import { useTranslation } from './i18n/LanguageContext';

interface Onboarding3DProps {
  onComplete: (data: UserOnboardingData) => void | Promise<void>;
}

// One-screen onboarding: the only thing we truly need is WHAT the learner
// wants to learn. Everything else gets a sensible default and stays editable
// later (Settings for name/role/language, Roadmap form for hours/deadline).
// These defaults mirror the Roadmap page's own generate form (10 h/week, 4 weeks)
// so a roadmap built right here is identical to one built there.
const DEFAULT_HOURS_PER_WEEK = 10;
const DEFAULT_DEADLINE_DAYS = 28;
const DEFAULT_DEADLINE_LABEL = '4 hafte';
const DEFAULT_ROLE = 'student'; // generate-roadmap.ts rejects an empty role
const MAX_TOPIC_LENGTH = 120;

function detectLanguage(): string {
  const lang = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() ?? '' : '';
  return lang.startsWith('hi') ? 'hindi' : 'english';
}

export default function Onboarding3D({ onComplete }: Onboarding3DProps) {
  const t = useTranslation();
  const [topic, setTopic] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canProceed = topic.trim() !== '' && !submitting;

  const submit = async () => {
    if (!canProceed) return;
    setSubmitting(true);
    try {
      await onComplete({
        name: getCurrentUser()?.displayName ?? '',
        role: DEFAULT_ROLE,
        goal: topic.trim(),
        language: detectLanguage(),
        hours: DEFAULT_HOURS_PER_WEEK,
        deadline: DEFAULT_DEADLINE_LABEL,
        deadlineDays: DEFAULT_DEADLINE_DAYS,
      });
    } finally {
      // The page normally unmounts on success; this only matters if it doesn't.
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.1) 0%, transparent 60%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-xl flex flex-col gap-5"
      >
        <input
          type="text"
          value={topic}
          maxLength={MAX_TOPIC_LENGTH}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder={t.settingsModal.topicPlaceholder}
          autoFocus
          disabled={submitting}
          className="w-full text-center bg-white/5 border border-white/10 rounded-2xl px-5 py-5 text-xl md:text-2xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 disabled:opacity-60"
        />

        <motion.button
          onClick={() => void submit()}
          disabled={!canProceed}
          whileHover={canProceed ? { scale: 1.03 } : {}}
          whileTap={canProceed ? { scale: 0.97 } : {}}
          className={`self-center min-w-[140px] px-8 py-3.5 rounded-full font-semibold text-sm transition-all duration-300 flex items-center justify-center ${
            canProceed ? 'bg-white text-black' : 'bg-white/10 text-white/30 cursor-not-allowed'
          }`}
          style={canProceed ? { boxShadow: '0 0 30px rgba(139, 92, 246, 0.4)' } : {}}
        >
          {submitting ? (
            <span className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            t.onboarding.start
          )}
        </motion.button>
      </motion.div>
    </div>
  );
}
