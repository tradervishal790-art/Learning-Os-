import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { translations, type Locale, type TranslationShape } from './translations';

// ============================================================
// LANGUAGE CONTEXT — Learning OS
// Single root-level source of truth for which language the whole app
// renders in.
//
// CURRENT STATE: rendering is locked to English via LOCKED_TO_ENGLISH.
// Only the Landing page, Onboarding flow, and Demo modal have translated
// strings (see translations.ts) — the rest of the app (Dashboard, Roadmap,
// VideoIntel, Notes, etc.) is still hardcoded English, so letting every
// screen actually render in the user's chosen locale would leave them
// with a half-translated experience.
//
// The user's real choice (from onboarding or Settings) IS still captured
// and persisted normally — see loadInitialLocale() and setLanguage()
// below — only the `t` object handed out by useTranslation() is forced
// to the 'en' dictionary while locked (see renderedLocale in
// LanguageProvider). Once every screen in Phase 2 is wired up, flip
// LOCKED_TO_ENGLISH to false: every already-saved choice will start
// rendering immediately, no migration needed.
// ============================================================

const STORAGE_KEY = 'learning_os_language';
const LOCKED_TO_ENGLISH = false;

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
  // NOTE: even while locked, we still read/track the user's real saved
  // choice below (see LanguageProvider) — LOCKED_TO_ENGLISH only forces
  // what actually gets *rendered* (`t`), not what's remembered. That way
  // onboarding/Settings can already capture and persist the user's pick
  // correctly, and flipping LOCKED_TO_ENGLISH to false later needs no
  // migration — every stored choice just starts rendering immediately.
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'hi' || saved === 'hinglish') return saved;
  } catch {
    /* localStorage unavailable — fall through to default */
  }
  return 'en';
}

/**
 * Non-hook variant of the same locale resolution, for the rare spot that
 * can't sit inside <LanguageProvider> — namely ErrorBoundary, which wraps
 * LanguageProvider itself (so it can also catch errors thrown by the
 * provider) and, being a class component, can't call hooks anyway. Reads
 * localStorage directly and applies the same English lock.
 */
export function getStaticTranslation(): TranslationShape {
  const locale = LOCKED_TO_ENGLISH ? 'en' : loadInitialLocale();
  return translations[locale];
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

  // Rendered content stays English while locked, even though `locale`
  // itself (returned by useLanguage(), used to drive selected-state in
  // pickers) already reflects the user's real, persisted choice.
  const renderedLocale: Locale = LOCKED_TO_ENGLISH ? 'en' : locale;

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLanguage, t: translations[renderedLocale] }),
    [locale, setLanguage, renderedLocale]
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
