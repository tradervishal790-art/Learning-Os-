// ============================================================
// TRANSLATIONS — Learning OS
// Single source of truth for every user-facing string in the app,
// grouped by screen/namespace (landing, demo, onboarding, ...).
// Add a new namespace here whenever a new screen is wired for i18n —
// see LanguageContext.tsx for how `t()` resolves keys against this.
// ============================================================

export type Locale = 'en' | 'hi' | 'hinglish';

export const LOCALES: Locale[] = ['en', 'hi', 'hinglish'];

export interface DemoStep {
  icon: string;
  title: string;
  description: string;
}

export interface TranslationShape {
  landing: {
    getStarted: string;
    dashboard: string;
    demo: string;
    tagline: string;
    /** Four hero words rendered as separate animated spans, in order. */
    heroWords: [string, string, string, string];
  };
  demo: {
    title: string;
    subtitle: string;
    startCta: string;
    dashboardCta: string;
    steps: DemoStep[];
  };
  onboarding: {
    stepTitles: { title: string; subtitle: string }[];
    roles: Record<string, string>;
    goals: Record<string, string>;
    languages: Record<string, string>;
    namePlaceholder: string;
    back: string;
    continue: string;
    start: string;
    stepOf: string; // e.g., "Step {0} of {1}"
  };
}

export const translations: Record<Locale, TranslationShape> = {
  en: {
    landing: {
      getStarted: 'Get Started',
      dashboard: 'Dashboard',
      demo: 'Demo',
      tagline: 'A learning system that adapts to your mind — not the other way around.',
      heroWords: ['Learn', 'How', 'You', 'Think'],
    },
    demo: {
      title: 'How It Works',
      subtitle: 'Three steps from sign-up to mastery',
      startCta: 'Start →',
      dashboardCta: 'Dashboard →',
      steps: [
        {
          icon: '🎯',
          title: '1. Tell us who you are',
          description:
            'A short onboarding captures your role, goal, preferred language, and your name.',
        },
        {
          icon: '🗺️',
          title: '2. Get a roadmap',
          description:
            'Instead of a generic course list, you get a topic sequence built around your goal — with a "WHY layer" explaining why each topic matters.',
        },
        {
          icon: '🔄',
          title: '3. Learn, watch, retain',
          description:
            'Video Intel tracks what you actually watch and understand. The Revision Engine schedules spaced repetition (Day 1, 3, 7, 15, 30, 60) so concepts stick.',
        },
      ],
    },
    onboarding: {
      stepTitles: [
        { title: 'Who are you?', subtitle: 'Pick one' },
        { title: 'Your goal?', subtitle: 'Pick one' },
        { title: 'Language', subtitle: 'Pick one' },
        { title: 'Your name', subtitle: 'Type it' },
      ],
      roles: {
        student: 'Student',
        developer: 'Developer',
        researcher: 'Researcher',
        business: 'Business',
        exam: 'Competitive Exam',
        creator: 'Creator',
      },
      goals: {
        job: 'Get a Job',
        skill: 'Learn a Skill',
        research: 'Research',
        startup: 'Build a Startup',
        curiosity: 'Curiosity',
        mastery: 'Mastery',
        teaching: 'Teaching',
      },
      languages: {
        hindi: 'Hindi',
        english: 'English',
        hinglish: 'Hinglish',
        any: 'No Preference',
      },
      namePlaceholder: 'Type your name',
      back: '← Back',
      continue: 'Continue →',
      start: 'Start →',
      stepOf: 'Step {0} of {1}',
    },
  },

  hi: {
    landing: {
      getStarted: 'शुरू करें',
      dashboard: 'डैशबोर्ड',
      demo: 'डेमो',
      tagline: 'एक लर्निंग सिस्टम जो आपके दिमाग के अनुसार ढलता है — इसके उलट नहीं।',
      heroWords: ['सीखें', 'जैसा', 'आप', 'सोचते हैं'],
    },
    demo: {
      title: 'यह कैसे काम करता है',
      subtitle: 'साइन-अप से महारत तक तीन कदम',
      startCta: 'शुरू करें →',
      dashboardCta: 'डैशबोर्ड →',
      steps: [
        {
          icon: '🎯',
          title: '1. हमें बताएं आप कौन हैं',
          description:
            'एक छोटा ऑनबोर्डिंग आपकी भूमिका, लक्ष्य, पसंदीदा भाषा और नाम पूछता है।',
        },
        {
          icon: '🗺️',
          title: '2. रोडमैप पाएं',
          description:
            'सामान्य कोर्स लिस्ट के बजाय, आपको अपने लक्ष्य के हिसाब से बना टॉपिक क्रम मिलता है — साथ में एक "WHY लेयर" जो बताती है हर टॉपिक क्यों ज़रूरी है।',
        },
        {
          icon: '🔄',
          title: '3. सीखें, देखें, याद रखें',
          description:
            'Video Intel ट्रैक करता है कि आपने असल में क्या देखा और समझा। Revision Engine स्पेस्ड रिपिटिशन (दिन 1, 3, 7, 15, 30, 60) शेड्यूल करता है ताकि कॉन्सेप्ट याद रहें।',
        },
      ],
    },
    onboarding: {
      stepTitles: [
        { title: 'आप कौन हैं?', subtitle: 'एक चुनें' },
        { title: 'आपका लक्ष्य?', subtitle: 'एक चुनें' },
        { title: 'भाषा', subtitle: 'एक चुनें' },
        { title: 'आपका नाम', subtitle: 'टाइप करें' },
      ],
      roles: {
        student: 'छात्र',
        developer: 'डेवलपर',
        researcher: 'शोधकर्ता',
        business: 'बिज़नेस',
        exam: 'प्रतियोगी परीक्षा',
        creator: 'क्रिएटर',
      },
      goals: {
        job: 'नौकरी पाना',
        skill: 'स्किल सीखना',
        research: 'रिसर्च',
        startup: 'स्टार्टअप बनाना',
        curiosity: 'जिज्ञासा',
        mastery: 'महारत',
        teaching: 'पढ़ाना',
      },
      languages: {
        hindi: 'हिंदी',
        english: 'अंग्रेज़ी',
        hinglish: 'हिंग्लिश',
        any: 'कोई प्राथमिकता नहीं',
      },
      namePlaceholder: 'अपना नाम लिखें',
      back: '← पीछे',
      continue: 'जारी रखें →',
      start: 'शुरू करें →',
      stepOf: 'Step {0} का {1}',
    },
  },

  hinglish: {
    landing: {
      getStarted: 'Shuru Karo',
      dashboard: 'Dashboard',
      demo: 'Demo',
      tagline: 'Ek learning system jo aapke dimaag ke hisaab se dhalta hai — ulta nahi.',
      heroWords: ['Seekho', 'Jaise', 'Tum', 'Sochte Ho'],
    },
    demo: {
      title: 'Ye Kaise Kaam Karta Hai',
      subtitle: 'Sign-up se mastery tak teen steps',
      startCta: 'Shuru Karo →',
      dashboardCta: 'Dashboard →',
      steps: [
        {
          icon: '🎯',
          title: '1. Batao tum kaun ho',
          description:
            'Ek chhota onboarding tumhara role, goal, pasandida bhasha aur naam poochta hai.',
        },
        {
          icon: '🗺️',
          title: '2. Roadmap pao',
          description:
            'Generic course list ke bajaye, tumhe apne goal ke hisaab se bana topic sequence milta hai — ek "WHY layer" ke saath jo batata hai har topic kyun zaroori hai.',
        },
        {
          icon: '🔄',
          title: '3. Seekho, dekho, yaad rakho',
          description:
            'Video Intel track karta hai ki tumne asal mein kya dekha aur samjha. Revision Engine spaced repetition (Day 1, 3, 7, 15, 30, 60) schedule karta hai taaki concepts yaad rahein.',
        },
      ],
    },
    onboarding: {
      stepTitles: [
        { title: 'Tum kaun ho?', subtitle: 'Ek chuno' },
        { title: 'Tumhara goal?', subtitle: 'Ek chuno' },
        { title: 'Language', subtitle: 'Ek chuno' },
        { title: 'Tumhara naam', subtitle: 'Type karo' },
      ],
      roles: {
        student: 'Student',
        developer: 'Developer',
        researcher: 'Researcher',
        business: 'Business',
        exam: 'Competitive Exam',
        creator: 'Creator',
      },
      goals: {
        job: 'Job Paana',
        skill: 'Skill Seekhna',
        research: 'Research',
        startup: 'Startup Banana',
        curiosity: 'Curiosity',
        mastery: 'Mastery',
        teaching: 'Padhana',
      },
      languages: {
        hindi: 'Hindi',
        english: 'English',
        hinglish: 'Hinglish',
        any: 'Koi Preference Nahi',
      },
      namePlaceholder: 'Naam likho',
      back: '← Peeche',
      continue: 'Aage Badho →',
      start: 'Shuru Karo →',
      stepOf: 'Step {0} of {1}',
    },
  },
};
