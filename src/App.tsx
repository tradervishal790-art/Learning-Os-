import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sphere from './Sphere';
import Stars from './Stars';
import Onboarding3D from './Onboarding3D';
import Dashboard from './Dashboard';
import type { UserOnboardingData } from './types';

type Page = 'landing' | 'onboarding' | 'dashboard';

const ONBOARDING_STORAGE_KEY = 'learning_os_onboarding_data';

const wordAnimation = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.8,
      ease: [0.215, 0.61, 0.355, 1] as const,
    },
  }),
};

// Content for the "Watch Demo" walkthrough modal — a lightweight explainer
// in place of an actual demo video, so the button has a real, specific purpose.
const demoSteps = [
  {
    icon: '🎯',
    title: '1. Tell us who you are',
    description:
      'A 4-step onboarding captures your role, goal, preferred language, and how much time you can commit each week.',
  },
  {
    icon: '🗺️',
    title: '2. Get an AI-generated roadmap',
    description:
      'Instead of a generic course list, you get a topic sequence built around your goal — with a "WHY layer" explaining why each topic matters.',
  },
  {
    icon: '🔄',
    title: '3. Learn, watch, retain',
    description:
      'Video Intel tracks what you actually watch and understand. The Revision Engine schedules spaced repetition (Day 1, 3, 7, 15, 30, 60) so concepts stick.',
  },
];

function loadSavedOnboardingData(): UserOnboardingData | null {
  try {
    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as UserOnboardingData) : null;
  } catch {
    return null;
  }
}

function App() {
  const [page, setPage] = useState<Page>('landing');
  const [userData, setUserData] = useState<UserOnboardingData | null>(loadSavedOnboardingData);
  const [showDemo, setShowDemo] = useState(false);

  const handleOnboardingComplete = (data: UserOnboardingData) => {
    setUserData(data);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data));
    setPage('dashboard');
  };

  if (page === 'onboarding') {
    return <Onboarding3D onComplete={handleOnboardingComplete} />;
  }

  if (page === 'dashboard') {
    return <Dashboard userData={userData} />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030303]">
      <Stars />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
          zIndex: 2,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 3 }}>
        <Sphere />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8 px-5 py-2 rounded-full backdrop-blur-md bg-white/5 border border-white/10"
          style={{ boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)' }}
        >
          <span className="text-xs font-medium tracking-[0.2em] uppercase text-white/80">
            AI-Powered Learning OS
          </span>
        </motion.div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] max-w-5xl">
          <span className="block">
            <motion.span
              custom={0}
              initial="hidden"
              animate="visible"
              variants={wordAnimation}
              className="inline-block bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent"
            >
              Learn
            </motion.span>{' '}
            <motion.span
              custom={1}
              initial="hidden"
              animate="visible"
              variants={wordAnimation}
              className="inline-block bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent"
            >
              How
            </motion.span>
          </span>
          <span className="block">
            <motion.span
              custom={2}
              initial="hidden"
              animate="visible"
              variants={wordAnimation}
              className="inline-block bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent"
            >
              You
            </motion.span>{' '}
            <motion.span
              custom={3}
              initial="hidden"
              animate="visible"
              variants={wordAnimation}
              className="inline-block bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent"
            >
              Think
            </motion.span>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-8 max-w-2xl text-base md:text-lg text-white/60 leading-relaxed"
        >
          The world's first AI-powered Personalized Learning Operating System that
          adapts to your mind — not the other way around.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.8 }}
          className="mt-12 flex flex-col sm:flex-row items-center gap-4"
        >
          <button
            onClick={() => setPage(userData ? 'dashboard' : 'onboarding')}
            className="group relative px-8 py-3.5 rounded-full bg-white text-black font-semibold text-sm tracking-wide overflow-hidden transition-all duration-300 hover:scale-105"
          >
            <span className="relative z-10 flex items-center gap-2">
              {userData ? 'Continue to Dashboard' : 'Get Started'}
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          </button>

          <button
            onClick={() => setShowDemo(true)}
            className="group px-8 py-3.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white font-medium text-sm tracking-wide transition-all duration-300 hover:bg-white/10 hover:border-purple-400/50"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch Demo
            </span>
          </button>
        </motion.div>
      </div>

      {/* "Watch Demo" walkthrough modal */}
      <AnimatePresence>
        {showDemo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDemo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">How Learning OS Works</h2>
                  <p className="text-sm text-white/50 mt-1">Three steps from sign-up to mastery</p>
                </div>
                <button
                  onClick={() => setShowDemo(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition flex-shrink-0"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                {demoSteps.map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                      {step.icon}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">{step.title}</h3>
                      <p className="text-sm text-white/60 leading-relaxed">{step.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="p-6 pt-0">
                <button
                  onClick={() => {
                    setShowDemo(false);
                    setPage(userData ? 'dashboard' : 'onboarding');
                  }}
                  className="w-full px-6 py-3 rounded-full bg-white text-black font-semibold text-sm hover:scale-[1.02] transition-transform"
                >
                  {userData ? 'Continue to Dashboard →' : 'Start Onboarding →'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;