import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { translations, type Locale, type TranslationShape } from './translations';

// ============================================================
// LANGUAGE CONTEXT — Learning OS
// Single root-level source of truth for which language the whole app
// renders in.
//
// CURRENT STATE: locked to English. Only the Landing page, Onboarding
// flow, and Demo modal have translated strings (see translations.ts) —
// the rest of the app (Dashboard, Roadmap, VideoIntel, Notes, etc.) is
// still hardcoded English. Letting the locale vary would leave users
// with a half-translated experience, so loadInitialLocale() below
// ignores any stored preference (including one saved before this
// lock was added) and always resolves to 'en'. Once every screen is
// translated, re-enable the localStorage read to restore per-user
// language choice.
// ============================================================

const STORAGE_KEY = 'learning_os_language';
const LOCKED_TO_ENGLISH = true;

/**
 * The onboarding language picker (when enabled) stores one of these raw
 * ids ('hindi' | 'english' | 'hinglish' | 'any') on UserOnboardingData.
 * This maps that id to an actual UI Locale. 'any' (No Preference)
 * defaults to English rather than leaving the UI unset.
 */
export function mapOnboardingLanguage(rawLanguage: string | undefined | null): Locale {
  switch (rawLanguage) {
    case 'hindi':
      return 'hi';
    case 'hinglish':
      return 'hinglish';
    case 'english':
    case 'any':
    default:
      return 'en';
  }
}

function loadInitialLocale(): Locale {
  if (LOCKED_TO_ENGLISH) return 'en';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'hi' || saved === 'hinglish') return saved;
  } catch {
    /* localStorage unavailable — fall through to default */
  }
  return 'en';
}

interface LanguageContextValue {
  locale: Locale;
  setLanguage: (locale: Locale) => void;
  t: TranslationShape;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(loadInitialLocale);

  const setLanguage = useCallback((next: Locale) => {
    setLocale(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* best-effort persistence only */
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLanguage, t: translations[locale] }),
    [locale, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Returns the current locale plus a setter — use this to build a language switcher. */
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return { locale: ctx.locale, setLanguage: ctx.setLanguage };
}

/** Returns the full translation object for the current locale — e.g. t.landing.getStarted. */
export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used within a LanguageProvider');
  return ctx.t;
}
