import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserOnboardingData } from './types';

interface Onboarding3DProps {
  onComplete: (data: UserOnboardingData) => void;
}

interface CardOption {
  id: string;
  label: string;
  icon?: string;
  flag?: string;
}

const stepTitles = [
  { title: 'Who are you?', subtitle: 'Pick one' },
  { title: 'Your goal?', subtitle: 'Pick one' },
  { title: 'Language', subtitle: 'Pick one' },
  { title: 'Your name', subtitle: 'Type it' },
];

// Helper: random starting positions (off-screen sides) for the card entrance animation
const getStartPosition = (index: number, _total: number) => {
  const positions = [
    { x: -800, y: -400 }, // top-left
    { x: 800, y: -400 }, // top-right
    { x: -800, y: 0 }, // left
    { x: 800, y: 0 }, // right
    { x: -800, y: 400 }, // bottom-left
    { x: 800, y: 400 }, // bottom-right
    { x: 0, y: -600 }, // top
    { x: 0, y: 600 }, // bottom
  ];
  return positions[index % positions.length];
};

const roles: CardOption[] = [
  { id: 'student', label: 'Student', icon: '🎓' },
  { id: 'developer', label: 'Developer', icon: '💻' },
  { id: 'researcher', label: 'Researcher', icon: '🔬' },
  { id: 'business', label: 'Business', icon: '💼' },
  { id: 'exam', label: 'Competitive Exam', icon: '📚' },
  { id: 'creator', label: 'Creator', icon: '🎨' },
];

const goals: CardOption[] = [
  { id: 'job', label: 'Get a Job', icon: '🚀' },
  { id: 'skill', label: 'Learn a Skill', icon: '⚡' },
  { id: 'research', label: 'Research', icon: '🧠' },
  { id: 'startup', label: 'Build a Startup', icon: '💡' },
  { id: 'curiosity', label: 'Curiosity', icon: '🔍' },
  { id: 'mastery', label: 'Mastery', icon: '👑' },
  { id: 'teaching', label: 'Teaching', icon: '📖' },
];

const languages: CardOption[] = [
  { id: 'hindi', label: 'Hindi', flag: '🇮🇳' },
  { id: 'english', label: 'English', flag: '🇬🇧' },
  { id: 'hinglish', label: 'Hinglish', flag: '✨' },
  { id: 'any', label: 'No Preference', flag: '🌍' },
];

export default function Onboarding3D({ onComplete }: Onboarding3DProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<UserOnboardingData>({
  role: '',
  goal: '',
  language: '',
  name: '',
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
            placeholder="Naam likho"
            autoFocus
            className="w-full text-center bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
          />
        </div>
      );
    }

    const options: CardOption[] = step === 0 ? roles : step === 1 ? goals : languages;
    const isGrid = step === 2;

    return (
      <div className={isGrid ? 'grid grid-cols-2 md:grid-cols-4 gap-4' : 'grid grid-cols-2 md:grid-cols-3 gap-4'}>
        {options.map((option, i) => {
          const start = getStartPosition(i, options.length);
          const isSelected =
            (step === 0 && data.role === option.id) ||
            (step === 1 && data.goal === option.id) ||
            (step === 2 && data.language === option.id);

          return (
            <motion.button
              key={`${step}-${option.id}`}
              initial={{ x: start.x, y: start.y, opacity: 0, rotate: start.x > 0 ? 30 : -30, scale: 0.5 }}
              animate={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
              transition={{ delay: i * 0.08, duration: 0.8, type: 'spring', stiffness: 70, damping: 15 }}
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (step === 0) setData({ ...data, role: option.id });
                else if (step === 1) setData({ ...data, goal: option.id });
                else if (step === 2) setData({ ...data, language: option.id });
              }}
              className={`relative p-6 rounded-2xl border transition-all duration-300 overflow-hidden ${
                isSelected
                  ? 'bg-purple-500/20 border-purple-500/50'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
              style={isSelected ? { boxShadow: '0 0 40px rgba(139, 92, 246, 0.4)' } : {}}
            >
              <div className="text-5xl mb-3">{option.icon ?? option.flag}</div>
              <div className="text-white font-medium text-sm">{option.label}</div>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    <div className="min-h-screen bg-[#030303] flex flex-col relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.1) 0%, transparent 60%)' }}
      />

      <div className="relative w-full px-6 pt-8 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs uppercase tracking-[0.2em] text-white/40">
              Step {step + 1} of {stepTitles.length}
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
            whileHover={step > 0 ? { x: -4 } : {}}
            className={`px-6 py-3 rounded-full text-sm font-medium transition-all ${
              step === 0 ? 'opacity-0 pointer-events-none' : 'text-white/60 hover:text-white'
            }`}
          >
            ← Back
          </motion.button>

          <motion.button
            onClick={next}
            disabled={!canProceed()}
            whileHover={canProceed() ? { scale: 1.05 } : {}}
            whileTap={canProceed() ? { scale: 0.95 } : {}}
            className={`px-8 py-3 rounded-full font-semibold text-sm transition-all duration-300 ${
              canProceed() ? 'bg-white text-black' : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
            style={canProceed() ? { boxShadow: '0 0 30px rgba(139, 92, 246, 0.4)' } : {}}
          >
            {step === stepTitles.length - 1 ? 'Start →' : 'Continue →'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}