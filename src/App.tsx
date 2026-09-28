import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sphere from './Sphere';
import Stars from './Stars';
import Dashboard, { hydrateActiveDaysFromCloud } from './Dashboard';
import { ThemeProvider } from './ThemeContext';
import type { UserOnboardingData, Goal } from './types';
import { trackOnboardingComplete } from './firebase';
import { getLearningProfile, hydrateLearningProfileFromCloud } from './learningProfileStore';
import { saveRoadmapData } from './roadmapData';
import { getGoals, getActiveGoals, addGoal, endGoal as endGoalInStore, updateGoal, saveGoals, MAX_ACTIVE_GOALS, hydrateGoalsFromCloud } from './goalsStore';
import { useTranslation, useLanguage, mapOnboardingLanguage } from './i18n/LanguageContext';
import radheRadheLogo from './assets/brand/radhe-radhe.png';
import { authFetch } from './apiFetch';

// Onboarding3D is its own route ("/onboarding") — no need to ship it in the
// initial landing/dashboard bundle, so it's loaded on demand only.
const Onboarding3D = lazy(() => import('./Onboarding3D'));

type Page = 'landing' | 'onboarding' | 'dashboard';

const ONBOARDING_STORAGE_KEY = 'learning_os_onboarding_data';

function loadSavedOnboardingData(): UserOnboardingData | null {
  try {
    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as UserOnboardingData) : null;
  } catch {
    return null;
  }
}

function App() {
  const t = useTranslation();
  const { setLanguage } = useLanguage();
  const demoSteps = t.demo.steps;
  const navigate = useNavigate();
  const location = useLocation();
  // `page` now mirrors the URL (real, shareable/bookmarkable routes) instead
  // of being disconnected local state. setPage keeps every existing call
  // site below unchanged — it just navigates instead of setting state.
  const page: Page = location.pathname.startsWith('/dashboard')
    ? 'dashboard'
    : location.pathname.startsWith('/onboarding')
      ? 'onboarding'
      : 'landing';
  const setPage = (p: Page) => {
    navigate(p === 'dashboard' ? '/dashboard' : p === 'onboarding' ? '/onboarding' : '/');
  };
  const [userData, setUserData] = useState<UserOnboardingData | null>(loadSavedOnboardingData);
  const [showDemo, setShowDemo] = useState(false);

  // SYNC FIX: setLanguage() was previously only called at the moment
  // onboarding completes or Settings is saved — an EXISTING user who
  // already had e.g. userData.language === 'hindi' saved from before
  // never had that reflected into LanguageContext's own locale on a
  // fresh app load (its localStorage key is separate from userData's),
  // so they'd see Settings correctly showing "Hindi" selected while the
  // rest of the app silently rendered in English. Run once whenever
  // userData first becomes available (mount, or right after onboarding
  // finishes and setUserData(data) runs) so this can't drift again.
  useEffect(() => {
    if (userData?.language) {
      setLanguage(mapOnboardingLanguage(userData.language));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.language]);

  // Multi-goal state — up to MAX_ACTIVE_GOALS (2) goals can be 'active' at
  // once, each with its own roadmap (roadmapData.ts keys it by goal id).
  // getGoals() auto-wraps a pre-existing single roadmap as a 'primary'
  // goal the first time this runs, so old users see it as Goal #1.
  const [goals, setGoals] = useState<Goal[]>(() => getGoals(loadSavedOnboardingData()));
  const [activeGoalId, setActiveGoalId] = useState<string | null>(
    () => getActiveGoals(getGoals(loadSavedOnboardingData()))[0]?.id ?? null
  );

  // ON-DEMAND CLOUD HYDRATION, dashboard-wide pieces only: pulls the
  // learning profile, goal list, and streak/active-days down from
  // Firestore for a device that doesn't have them yet (new device / new
  // browser). This only runs once, the first time the user actually
  // reaches the dashboard — not on landing, and not repeated on every
  // page/tab switch inside the dashboard. Goal/roadmap-specific data,
  // revision data, and test data are each hydrated by their OWN page
  // (Roadmap.tsx, Revision.tsx, Test.tsx) only when that page opens, so a
  // visit to the dashboard never fetches more than what's about to be shown.
  const hydratedDashboardRef = useRef(false);
  useEffect(() => {
    if (page !== 'dashboard' || hydratedDashboardRef.current) return;
    hydratedDashboardRef.current = true;
    void (async () => {
      // Independent of each other — run together instead of one after
      // another so this finishes as fast as the slowest single fetch.
      await Promise.all([
        hydrateLearningProfileFromCloud(),
        hydrateGoalsFromCloud(),
        hydrateActiveDaysFromCloud(),
      ]);
      // Re-sync state that was read from localStorage before hydration
      // resolved, so a new device picks up the cloud data without needing
      // a manual refresh. No-op (same values) for a device that already
      // had everything locally.
      const freshUserData = loadSavedOnboardingData();
      setUserData(freshUserData);
      const freshGoals = getGoals(freshUserData);
      setGoals(freshGoals);
      setActiveGoalId((current) => current ?? getActiveGoals(freshGoals)[0]?.id ?? null);
    })();
  }, [page]);

  // Actual server/network error from the last generate-roadmap attempt —
  // shown in Roadmap.tsx's failure banner so a failure is debuggable
  // instead of a silent "something went wrong".
  const [lastRoadmapError, setLastRoadmapError] = useState<string | null>(null);

  /**
   * Generates a roadmap via the API and saves it to localStorage. Shared by
   * both onboarding (first-time) and the "Regenerate Roadmap" button in
   * Settings (re-run with the SAME onboarding data + latest learning profile,
   * whenever generate-roadmap.ts's prompt/logic has been improved, or the
   * user's answers/learning style have changed since the roadmap was made).
   * Returns true on success so the caller can show a confirmation/error message.
   * Also stores the actual failure reason in lastRoadmapError (server error
   * message, not just a generic "it failed") so the Roadmap page banner and
   * the browser console can show WHY, instead of a black-box failure.
   */
  const generateAndSaveRoadmap = async (data: UserOnboardingData, goalId?: string): Promise<boolean> => {
    try {
      const learningProfile = getLearningProfile();
      const res = await authFetch('/api/generate-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, ...(learningProfile ? { learningProfile } : {}) }),
      });
      const result = await res.json();
      if (res.ok && result.roadmap) {
        // Stamp the first topic's learning-start date client-side (server
        // has no reliable "now" to attach) — this is the anchor the
        // Revision engine schedules Day 1/3/7/15/30/60 checkpoints from.
        const stampedRoadmap = {
          ...result.roadmap,
          children: (result.roadmap.children ?? []).map((t: any) =>
            t.status === 'learning' && !t.learningStartedAt
              ? { ...t, learningStartedAt: new Date().toISOString() }
              : t
          ),
        };
        saveRoadmapData(goalId, stampedRoadmap);
        setLastRoadmapError(null);
        return true;
      }
      const serverMessage =
        typeof result?.error === 'string'
          ? result.error
          : result?.detail
            ? JSON.stringify(result.detail)
            : `Server returned ${res.status}`;
      console.error('generate-roadmap failed:', serverMessage, result);
      setLastRoadmapError(serverMessage);
      return false;
    } catch (err: any) {
      const message = err?.message || 'Network/fetch error while calling /api/generate-roadmap';
      console.error('generate-roadmap failed:', message, err);
      setLastRoadmapError(message);
      return false;
    }
  };

  const handleOnboardingComplete = async (data: UserOnboardingData) => {
    setUserData(data);
    setLanguage(mapOnboardingLanguage(data.language));
    trackOnboardingComplete({
  name: (data as unknown as Record<string, string>).name,
  role: (data as unknown as Record<string, string>).role,
  goal: (data as unknown as Record<string, string>).goal,
  language: (data as unknown as Record<string, string>).language,
});
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data));

    // First-ever goal always gets id 'primary' — aliases the legacy flat
    // roadmap key in roadmapData.ts, same as pre-multi-goal behaviour.
    const primaryGoal: Goal = {
      id: 'primary',
      title: data.goal,
      hours: data.hours,
      deadline: data.deadline,
      deadlineDays: data.deadlineDays,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    setGoals([primaryGoal]);
    saveGoals([primaryGoal]);
    setActiveGoalId('primary');

    // If generation fails, Roadmap.tsx falls back to its default empty state —
    // don't block the user from reaching the dashboard.
    await generateAndSaveRoadmap(data, 'primary');

    setPage('dashboard');
  };

  // Used by the Settings panel to edit name / role / goal / language
  // after onboarding, without going through the full flow again.
  const handleUpdateUserData = (data: UserOnboardingData) => {
    setUserData(data);
    setLanguage(mapOnboardingLanguage(data.language));
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data));
  };

  // Regenerate Roadmap button (Settings panel) — re-runs generation with the
  // CURRENT userData + latest learning profile, overwriting the cached
  // roadmap. Bumps roadmapVersion so <Roadmap key={roadmapVersion}> remounts
  // and re-reads the fresh roadmap from localStorage (Roadmap.tsx reads it
  // directly at render time, so a plain state update elsewhere wouldn't
  // force it to re-read on its own).
  const [roadmapVersion, setRoadmapVersion] = useState(0);
  const handleRegenerateRoadmap = async (): Promise<boolean> => {
    if (!userData || !activeGoalId) return false;
    const activeGoal = goals.find((g) => g.id === activeGoalId);
    // Regenerate with the active goal's own subject/hours/deadline (not
    // necessarily userData's, if this isn't the primary goal).
    const data: UserOnboardingData = activeGoal
      ? { ...userData, goal: activeGoal.title, hours: activeGoal.hours, deadline: activeGoal.deadline, deadlineDays: activeGoal.deadlineDays }
      : userData;
    const success = await generateAndSaveRoadmap(data, activeGoalId);
    if (success) setRoadmapVersion((v) => v + 1);
    return success;
  };

  // "+ Add Goal" — opens a 2nd (max) empty goal slot. No roadmap yet, so
  // Roadmap.tsx's existing "What do you want to learn?" empty-state form renders for
  // it automatically (same as a brand-new user), scoped to this goal id.
  const handleAddGoal = (): boolean => {
    if (getActiveGoals(goals).length >= MAX_ACTIVE_GOALS) return false;
    const { goals: updated, goal } = addGoal(goals);
    setGoals(updated);
    setActiveGoalId(goal.id);
    return true;
  };

  // Ends a goal (default: abandoned) — frees a slot for a new one. The
  // ended goal's roadmap/revision data stays in localStorage untouched.
  const handleEndGoal = (goalId: string, outcome: 'completed' | 'abandoned' = 'abandoned') => {
    const updated = endGoalInStore(goals, goalId, outcome);
    setGoals(updated);
    if (activeGoalId === goalId) {
      const stillActive = getActiveGoals(updated);
      setActiveGoalId(stillActive[0]?.id ?? null);
    }
  };

  const handleSwitchGoal = (goalId: string) => {
    setActiveGoalId(goalId);
  };

  // Roadmap page's own empty-state input (when there's no roadmap yet, or
  // the user wants to build one for a different subject without going back
  // through full onboarding). Updates userData.goal/hours/deadline with the
  // typed subject + slider values and generates immediately — passes the
  // updated data straight into generateAndSaveRoadmap rather than relying
  // on React state (which wouldn't be updated yet in this same function
  // call).
  // `hours` = weekly hours available, `deadlineDays` = exact day count from
  // the Day/Week/Month slider — both drive generate-roadmap.ts's
  // time-budget calc (how many topics, how deep each one goes). Without
  // `hours` the backend used to silently assume 0 hours/week, and without
  // an exact `deadlineDays` it only had 5 coarse presets to snap to — this
  // is why past roadmaps were inaccurate regardless of subject.
  const handleGenerateForSubject = async (
    subject: string,
    hours: number,
    deadlineDays: number,
    deadlineLabel: string,
    examType?: string
  ): Promise<boolean> => {
    const trimmed = subject.trim();
    if (!trimmed || !userData) return false;

    // Which goal slot this generation is for: the currently active tab if
    // one exists (covers both "first-ever goal" and "filling a freshly
    // added 2nd goal"), else fall back to 'primary'.
    const goalId = activeGoalId ?? 'primary';
    const updatedData: UserOnboardingData = {
      ...userData,
      goal: trimmed,
      hours,
      deadline: deadlineLabel,
      deadlineDays,
      examType,
    };

    // Only the primary goal mirrors into userData/onboarding storage (role,
    // language etc. stay shared) — a 2nd goal just updates its own Goal record.
    if (goalId === 'primary') {
      setUserData(updatedData);
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(updatedData));
    }
    const updatedGoals = updateGoal(goals, goalId, {
      title: trimmed,
      hours,
      deadline: deadlineLabel,
      deadlineDays,
      examType,
    });
    setGoals(updatedGoals);

    const success = await generateAndSaveRoadmap(updatedData, goalId);
    if (success) setRoadmapVersion((v) => v + 1);
    return success;
  };

  let content: React.ReactNode;

  if (page === 'onboarding') {
    content = (
      <Suspense fallback={<div className="min-h-screen bg-[#030303]" />}>
        <Onboarding3D onComplete={handleOnboardingComplete} />
      </Suspense>
    );
  } else if (page === 'dashboard') {
    content = (
      <Dashboard
        userData={userData}
        onUpdateUserData={handleUpdateUserData}
        onRegenerateRoadmap={handleRegenerateRoadmap}
        onGenerateForSubject={handleGenerateForSubject}
        roadmapVersion={roadmapVersion}
        lastRoadmapError={lastRoadmapError}
        goals={goals}
        activeGoalId={activeGoalId}
        onAddGoal={handleAddGoal}
        onEndGoal={handleEndGoal}
        onSwitchGoal={handleSwitchGoal}
      />
    );
  } else {
    content = (
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
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9 }}
            className="mb-8 select-none"
          >
            <img
              src={radheRadheLogo}
              alt="राधे - राधे"
              className="w-full max-w-[280px] sm:max-w-[380px] md:max-w-[480px] lg:max-w-[560px] h-auto mx-auto"
              style={{ filter: 'drop-shadow(0 0 24px rgba(242, 201, 76, 0.35))' }}
            />
          </motion.div>

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
                {userData ? t.landing.dashboard : t.landing.getStarted}
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
                {t.landing.demo}
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
                    <h2 className="text-2xl font-bold text-white">{t.demo.title}</h2>
                    <p className="text-sm text-white/50 mt-1">{t.demo.subtitle}</p>
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
                    {userData ? t.demo.dashboardCta : t.demo.startCta}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return <ThemeProvider>{content}</ThemeProvider>;
}

export default App;