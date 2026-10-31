import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserOnboardingData } from './types';
import { getCurrentUser } from './authStore';
import { useLanguage, useTranslation, mapOnboardingLanguage } from './i18n/LanguageContext';

interface Onboarding3DProps {
  onComplete: (data: UserOnboardingData) => void;
}

interface CardOption {
  id: string;
  label: string;
  icon?: string;
}

const languageFlags: Record<string, string> = {
  hindi: '🇮🇳',
  english: '🇬🇧',
  hinglish: '✨',
  any: '🌍',
};
const languageOrder = ['hindi', 'english', 'hinglish', 'any'];

const roleIcons: Record<string, string> = {
  student: '🎓',
  developer: '💻',
  researcher: '🔬',
  business: '💼',
  exam: '📚',
  creator: '🎨',
};
const roleOrder = ['student', 'developer', 'researcher', 'business', 'exam', 'creator'];

const goalIcons: Record<string, string> = {
  job: '🚀',
  skill: '⚡',
  research: '🧠',
  startup: '💡',
  curiosity: '🔍',
  mastery: '👑',
  teaching: '📖',
};
const goalOrder = ['job', 'skill', 'research', 'startup', 'curiosity', 'mastery', 'teaching'];

export default function Onboarding3D({ onComplete }: Onboarding3DProps) {
  const t = useTranslation();
  const { setLanguage } = useLanguage();
  // 4 steps: role, goal, language, name.
  const stepTitles = t.onboarding.stepTitles;
  const roles: CardOption[] = roleOrder.map((id) => ({ id, label: t.onboarding.roles[id], icon: roleIcons[id] }));
  const goals: CardOption[] = goalOrder.map((id) => ({ id, label: t.onboarding.goals[id], icon: goalIcons[id] }));
  const languages: CardOption[] = languageOrder.map((id) => ({ id, label: t.onboarding.languages[id], icon: languageFlags[id] }));

  const [step, setStep] = useState(0);
  // Prefill from the name entered at signup (Firebase displayName), so
  // the user isn't asked to type it twice — they can still edit it here.
  const [data, setData] = useState<UserOnboardingData>({
  role: '',
  goal: '',
  language: '',
  name: getCurrentUser()?.displayName ?? '',
  hours: 0,
  deadline: 'none',
});

  const next = () => {
    if (step < stepTitles.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(data);
    }
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
  };

  const canProceed = () => {
    if (step === 0) return data.role !== '';
    if (step === 1) return data.goal !== '';
    if (step === 2) return data.language !== '';
    if (step === 3) return data.name.trim() !== '';
    return false;
  };

  const renderCards = () => {
    if (step === 3) {
      return (
        <div className="max-w-sm mx-auto">
          <motion.input
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            type="text"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && canProceed() && next()}
            placeholder={t.onboarding.namePlaceholder}
            autoFocus
            className="los-onboarding-input"
          />
        </div>
      );
    }

    const options: CardOption[] = step === 0 ? roles : step === 1 ? goals : languages;
    const isGrid = step === 2;

    return (
      <div className={isGrid ? 'grid grid-cols-2 md:grid-cols-4 gap-4' : 'grid grid-cols-2 md:grid-cols-3 gap-4'}>
        {options.map((option, i) => {
          const isSelected =
            (step === 0 && data.role === option.id) ||
            (step === 1 && data.goal === option.id) ||
            (step === 2 && data.language === option.id);

          return (
            <motion.button
              key={`${step}-${option.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.035, duration: 0.2, ease: 'easeOut' }}
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                if (step === 0) setData({ ...data, role: option.id });
                else if (step === 1) setData({ ...data, goal: option.id });
                else if (step === 2) {
                  setData({ ...data, language: option.id });
                  // Live-preview: switch the app locale the instant the user
                  // picks a language, so the remaining onboarding steps (and
                  // the app behind it) already render in their choice.
                  setLanguage(mapOnboardingLanguage(option.id));
                }
              }}
              className="los-onboarding-card"
              aria-pressed={isSelected}
            >
              <div className="text-5xl mb-3">{option.icon}</div>
              <div className="text-white font-medium text-sm">{option.label}</div>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3 w-5 h-5 rounded-full bg-violet-300/20 border border-violet-200/30 flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-violet-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-dvh min-h-screen bg-[#030303] flex flex-col relative overflow-x-hidden overflow-y-auto">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.1) 0%, transparent 60%)' }}
      />

      <div className="relative w-full px-6 pt-8 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs uppercase tracking-[0.2em] text-white/40">
              {t.onboarding.stepOf.replace('{0}', String(step + 1)).replace('{1}', String(stepTitles.length))}
            </span>
            <span className="text-xs text-white/40">
              {Math.round(((step + 1) / stepTitles.length) * 100)}%
            </span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${((step + 1) / stepTitles.length) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                className="text-center mb-12"
              >
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-3">{stepTitles[step].title}</h2>
                <p className="text-white/50">{stepTitles[step].subtitle}</p>
              </motion.div>

              {renderCards()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="relative w-full px-6 pb-8 z-10">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <motion.button
            onClick={back}
            disabled={step === 0}
            whileHover={step > 0 ? { x: -1 } : {}}
            className={`los-btn los-btn-secondary rounded-full ${step === 0 ? 'opacity-0 pointer-events-none' : ''}`}
          >
            {t.onboarding.back}
          </motion.button>

          <motion.button
            onClick={next}
            disabled={!canProceed()}
            whileHover={canProceed() ? { scale: 1.015, y: -1 } : {}}
            whileTap={canProceed() ? { scale: 0.99 } : {}}
            className={`los-btn los-btn-primary rounded-full px-8 py-3 ${canProceed() ? '' : 'opacity-40 cursor-not-allowed'}`}
          >
            {step === stepTitles.length - 1 ? t.onboarding.start : t.onboarding.continue}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
