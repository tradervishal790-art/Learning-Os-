import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, LogIn, Settings as SettingsIcon } from 'lucide-react';
import { useAuthPrompt } from './AuthPrompt';
import { useTranslation } from './i18n/LanguageContext';

/**
 * The floating top controls for every in-app screen.
 *  - Back arrow (left): slides in/out as you leave/return to Home.
 *  - Sign in (right): guests only, so login is always one tap away.
 *  - Settings (right): icon-only on phones, icon + label from `sm` up.
 * Sits below the notch/status bar, hides while the user is scrolling down or in a
 * full-attention flow (timed test, typing to the Mentor), and stays UNDER the
 * More sheet backdrop (z-30) so the overlay dims it like everything else.
 */

interface Props {
  showBack: boolean;
  onBack: () => void;
  onOpenSettings: () => void;
  /** Slide the bar away (scrolling down, or an immersive flow). */
  hidden: boolean;
}

const GLASS =
  'pointer-events-auto flex h-11 items-center justify-center rounded-full border border-white/10 bg-[#111827]/85 text-white shadow-lg backdrop-blur-md transition-[background-color,transform] hover:bg-white/10 active:scale-95 motion-reduce:active:scale-100';

export default function TopControls({ showBack, onBack, onOpenSettings, hidden }: Props) {
  const t = useTranslation();
  const reduce = useReducedMotion();
  const { isGuest, authReady, openSignIn } = useAuthPrompt();
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 380, damping: 34 };

  return (
    <motion.div
      inert={hidden}
      aria-hidden={hidden || undefined}
      initial={reduce ? false : { y: -16, opacity: 0 }}
      animate={hidden ? { y: -72, opacity: 0 } : { y: 0, opacity: 1 }}
      transition={spring}
      className="pointer-events-none fixed inset-x-0 z-[25] flex items-start justify-between"
      style={{
        top: 'calc(env(safe-area-inset-top) + 0.75rem)',
        paddingLeft: 'calc(env(safe-area-inset-left) + 1rem)',
        paddingRight: 'calc(env(safe-area-inset-right) + 1rem)',
      }}
    >
      <AnimatePresence initial={false}>
        {showBack && (
          <motion.button
            key="back"
            onClick={onBack}
            aria-label={t.onboarding.back}
            title={t.onboarding.back}
            initial={reduce ? false : { opacity: 0, x: -14, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -14, scale: 0.9 }}
            transition={spring}
            className={`${GLASS} w-11`}
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.9} />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="ml-auto flex items-center gap-2">
        <AnimatePresence initial={false}>
          {authReady && isGuest && (
            <motion.button
              key="signin"
              onClick={() => openSignIn(undefined, 'signin')}
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              transition={spring}
              className={`${GLASS} gap-1.5 border-indigo-300/30 bg-indigo-500/90 px-4 text-sm font-semibold hover:bg-indigo-400/90`}
            >
              <LogIn className="h-4 w-4" strokeWidth={2} />
              {t.authPrompt.signInButton}
            </motion.button>
          )}
        </AnimatePresence>

        <button
          id="onborda-settings-button"
          onClick={onOpenSettings}
          aria-label={t.settingsModal.title}
          title={t.settingsModal.title}
          className={`${GLASS} w-11 gap-2 sm:w-auto sm:px-4`}
        >
          <SettingsIcon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          <span className="hidden text-sm sm:inline">{t.settingsModal.title}</span>
        </button>
      </div>
    </motion.div>
  );
}
