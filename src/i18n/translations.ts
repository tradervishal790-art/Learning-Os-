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

export interface DashboardTourStep {
  title: string;
  content: string;
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
  dashboard: {
    sidebar: {
      home: string;
      roadmap: string;
      revision: string;
      notes: string;
      videos: string;
      mentor: string;
      progress: string;
      research: string;
    };
    greeting: {
      morning: string;
      afternoon: string;
      evening: string;
      night: string;
    };
    /** DASHBOARD_TOUR's two Onborda tours: dashboard-intro (4 steps) then
     *  video-picker-intro (2 steps) — order matches DASHBOARD_TOUR exactly. */
    tour: {
      dashboardIntro: [DashboardTourStep, DashboardTourStep, DashboardTourStep, DashboardTourStep];
      videoPickerIntro: [DashboardTourStep, DashboardTourStep];
    };
    checklist: {
      heading: string;
      subheading: string;
      steps: [
        { title: string; subtitle: string; cta: string },
        { title: string; subtitle: string; cta: string },
        { title: string; subtitle: string; cta: string },
      ];
    };
    home: {
      statsCards: {
        goal: string;
        pickTopic: string;
        openRoadmap: string;
        revision: string;
        dueSuffix: string; // "{0} due"
        overdueSuffix: string; // "{0} overdue"
        caughtUp: string;
        streak: string;
        day: string;
        days: string;
        keepGoing: string;
        startToday: string;
      };
      suggestion: { label: string; customCta: string; watchCta: string };
      learningStyleCard: {
        titleReady: string;
        titleNotReady: string;
        subtitleReady: string;
        subtitleNotReady: string;
        detailReady: string;
        retakeCta: string;
        startCta: string;
        analyzeVideosCta: string;
      };
    };
  };
  settingsModal: {
    title: string;
    theme: string;
    nameLabel: string;
    roleLabel: string;
    topicLabel: string;
    topicPlaceholder: string;
    languageLabel: string;
    roadmapSection: {
      label: string;
      hint: string;
      regenerateCta: string;
      regeneratingCta: string;
      successMsg: string;
      errorMsg: string;
    };
    learningProfileSection: {
      label: string;
      hint: string;
      hintBubble: string;
      viewCta: string;
      hideCta: string;
      dims: {
        pace: string;
        practical: string;
        structure: string;
        depth: string;
        language: string;
        storytelling: string;
        repetition: string;
        reliability: string;
      };
    };
    saveCta: string;
    deadlineNone: string;
  };
  customPlaylistModal: {
    title: string;
    topicLabel: string;
    topicPlaceholder: string;
    hoursLabel: string;
    deadlineLabel: string;
    quickLabel: string;
    loadingCta: string;
    noProfileHint: string;
    generateCta: string;
    generatingCta: string;
  };
  roadmap: {
    header: { title: string; subtitle: string };
    goalTabs: {
      newGoal: string;
      addGoal: string;
      maxGoalsNote: string; // "{0}" = MAX_ACTIVE_GOALS
      endGoal: string;
    };
    endGoalModal: {
      title: string;
      body: string; // "{0}" = roadmap title
      cancel: string;
      confirm: string;
    };
    stats: { progress: string; done: string; inProgress: string; estTime: string };
    noActiveGoal: string;
    generateForm: {
      label: string;
      placeholder: string;
      generateCta: string;
      generatingCta: string;
      examLabel: string;
      examOptional: string;
      examPlaceholder: string;
      examHint: string;
      weeklyTimeLabel: string;
      weeklyTimeHint: string;
      timeLimitLabel: string;
      deadlineLabel: string;
      generateFailed: string;
    };
    statusLabels: { mastered: string; completed: string; learning: string; locked: string };
    examWeightage: Record<'high' | 'medium' | 'low', string>;
    step: string; // "{0}" = step number
    topicModal: {
      overviewTab: string;
      whyTab: string;
      whatYoullLearn: string;
      bridgeHint: string;
      deepDiveCta: string;
      watchVideosCta: string;
      searchingCta: string;
      savedVideoCta: string;
      markCompleteCta: string;
      challengeTitle: string;
      challengeCta: string;
      whyItems: { learn: string; connect: string; system: string; risk: string };
    };
  };
  revision: {
    header: { title: string; subtitle: string };
    stats: { dueToday: string; overdue: string; mastered: string; retention: string };
    filters: { all: string; dueToday: string; overdue: string; upcoming: string; mastered: string };
    difficultyLabels: { easy: string; medium: string; hard: string };
    card: {
      day: string;
      reviewingNow: string;
      retentionLabel: string; // "{0}" = percent
      doneLabel: string;
      doneCta: string;
      reviewNowCta: string;
      reviewingCta: string;
    };
    emptyState: {
      noRevisionTitle: string;
      noRevisionBody: string;
      allCaughtUpTitle: string;
      allCaughtUpBody: string;
    };
  };
  notes: {
    header: { title: string; subtitle: string };
    topicPlaceholder: string;
    deepDiveCta: string;
    linkPlaceholder: string;
    fromVideoCta: string;
    invalidUrlError: string;
    genericGenerateError: string;
    genericVideoGenerateError: string;
    sections: {
      summary: string;
      myNotes: string;
      coreConcept: string;
      workedExamples: string;
      misconceptions: string;
      realWorldApp: string;
      advanced: string;
      practice: string;
      insights: string;
    };
    sectionUnavailable: string;
    sourceVideoLink: string;
    transcriptSourceNote: string;
    metadataSourceNote: string;
    emptyState: { title: string; subtitle: string };
  };
  videos: {
    header: { title: string; subtitle: string };
    searchPlaceholder: string;
    searchCta: string;
    noResultsYet: string;
    backToVideo: string;
    score: string; // "{0}" = score number
    helpfulCta: string;
    notForMeCta: string;
    nextCta: string;
    loadingNextCta: string;
    watchProgress: { title: string; watched: string; pauses: string; rewinds: string; speed: string; complete: string };
    deepNotesCta: string;
    researchCta: string;
    selectVideoPrompt: string;
    verifiedBadge: string;
    dismissAria: string;
    errors: {
      noMoreVideos: string; // "{0}" = search query
      searchSomethingFirst: string;
      noVideosFound: string;
      searchFailed: string;
    };
  };
  mentor: {
    header: { title: string; subtitle: string };
    welcomeMessage: string;
    suggestedPrompts: [
      { icon: string; label: string; prompt: string },
      { icon: string; label: string; prompt: string },
      { icon: string; label: string; prompt: string },
      { icon: string; label: string; prompt: string },
      { icon: string; label: string; prompt: string },
      { icon: string; label: string; prompt: string },
    ];
    youLabel: string;
    mentorLabel: string;
    inputPlaceholder: string;
    sendCta: string;
    errors: {
      generic: string; // "{0}" = HTTP status
      noResponse: string;
      truncatedSuffix: string;
      network: string;
    };
  };
  progress: {
    header: { title: string; subtitle: string };
    stats: { completion: string; streak: string; totalWatchTime: string; retention: string };
    completionBar: { topicsDone: string; inProgress: string }; // "{0}/{1}" and "{0}"
    emptyState: { title: string; body: string };
    timeTracking: { title: string; last7Days: string }; // "{0}" = minutes
    masteryHeatmap: { title: string; legendWeak: string; legendOk: string; legendStrong: string };
    retentionDetail: { title: string; dueToday: string; overdue: string; mastered: string };
    weakAreas: { title: string; noneFound: string };
  };
  research: {
    header: { title: string; subtitle: string };
    searchPlaceholder: string;
    searchCta: string;
    notGroundedNote: string;
    genericError: string;
    embedded: { title: string; hint: string };
    closeAria: string;
    emptyState: { title: string; subtitle: string };
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
    dashboard: {
      sidebar: {
        home: 'Home',
        roadmap: 'Roadmap',
        revision: 'Revision',
        notes: 'Notes',
        videos: 'Videos',
        mentor: 'Mentor',
        progress: 'Progress',
        research: 'Research',
      },
      greeting: {
        morning: 'Good Morning',
        afternoon: 'Good Afternoon',
        evening: 'Good Evening',
        night: 'Good Night',
      },
      tour: {
        dashboardIntro: [
          {
            title: 'Roadmap',
            content: 'Your topics are ordered here — foundation-first. Following this order works best.',
          },
          {
            title: 'Revision',
            content: 'Topics that are due for revision show up here.',
          },
          {
            title: 'Progress',
            content: 'Track your streak and overall progress here.',
          },
          {
            title: 'Settings',
            content: 'Change your profile and preferences from here.',
          },
        ],
        videoPickerIntro: [
          {
            title: 'These 3 videos — same topic',
            content:
              'All three videos teach the same concept, just in a different teaching style (pace, examples, structure). Pick whichever one suits you best — you don\u2019t need to watch all three.',
          },
          {
            title: 'Different style, same concept',
            content: 'This is the second option — try it if the first one didn\u2019t suit you. Same content, different presentation.',
          },
        ],
      },
      checklist: {
        heading: 'Get Started',
        subheading: 'Follow these 3 steps in order for the best result',
        steps: [
          {
            title: 'Set your learning style',
            subtitle: 'A short AI interview — you\u2019ll get better video matches',
            cta: 'Start',
          },
          {
            title: 'Build your roadmap',
            subtitle: 'The right order for topics — what to learn first',
            cta: 'Generate',
          },
          {
            title: 'Watch your first video',
            subtitle: 'Start with the first topic on your roadmap',
            cta: 'Watch',
          },
        ],
      },
      home: {
        statsCards: {
          goal: 'Goal',
          pickTopic: 'Pick a topic',
          openRoadmap: 'Open roadmap',
          revision: 'Revision',
          dueSuffix: '{0} due',
          overdueSuffix: '{0} overdue',
          caughtUp: 'Caught up',
          streak: 'Streak',
          day: 'day',
          days: 'days',
          keepGoing: 'Keep going',
          startToday: 'Start today',
        },
        suggestion: { label: 'Suggestion', customCta: 'Custom', watchCta: 'Watch' },
        learningStyleCard: {
          titleReady: 'Learning Style',
          titleNotReady: 'Find Your Style',
          subtitleReady: 'Profile ready — full report is in Settings',
          subtitleNotReady: 'Short quiz for better matches',
          detailReady:
            '✓ 8 learning dimensions set — pace, depth, structure and more. See the full breakdown in Settings → "Learning Profile Report".',
          retakeCta: 'Retake Blueprint Interview',
          startCta: 'Start Blueprint Interview',
          analyzeVideosCta: "Analyze Videos I've Watched",
        },
      },
    },
    settingsModal: {
      title: 'Settings',
      theme: 'Theme',
      nameLabel: 'Name',
      roleLabel: 'Role',
      topicLabel: 'Subject / Topic',
      topicPlaceholder: 'What do you want to learn?',
      languageLabel: 'Language',
      roadmapSection: {
        label: 'Roadmap',
        hint: "The roadmap is generated once. If topics feel too broad or you've changed your learning style, regenerate it.",
        regenerateCta: 'Regenerate Roadmap',
        regeneratingCta: 'Regenerating...',
        successMsg: 'New roadmap generated.',
        errorMsg: 'Something went wrong, try again.',
      },
      learningProfileSection: {
        label: 'Learning Profile Report',
        hint: 'This only shows when requested — the home page just has a short summary.',
        hintBubble: 'Your full learning profile lives here — tap to view it.',
        viewCta: 'View Full Report',
        hideCta: 'Hide Report',
        dims: {
          pace: 'Pace',
          practical: 'Practical',
          structure: 'Structure',
          depth: 'Depth',
          language: 'Language',
          storytelling: 'Storytelling',
          repetition: 'Repetition',
          reliability: 'Reliability',
        },
      },
      saveCta: 'Save',
      deadlineNone: 'None',
    },
    customPlaylistModal: {
      title: 'Custom Playlist',
      topicLabel: 'Topic',
      topicPlaceholder: 'e.g., Django basics',
      hoursLabel: 'Hours / week',
      deadlineLabel: 'Deadline',
      quickLabel: 'Quick:',
      loadingCta: 'Finding videos...',
      noProfileHint: 'Complete the quiz first for better matches',
      generateCta: 'Generate',
      generatingCta: 'Generating...',
    },
    roadmap: {
      header: { title: 'Your Roadmap', subtitle: 'Foundation-first order — follow it for best results' },
      goalTabs: {
        newGoal: 'New Goal',
        addGoal: '+ Add Goal',
        maxGoalsNote: 'Max {0} goals at once — end one to start a new one.',
        endGoal: 'End this goal',
      },
      endGoalModal: {
        title: 'End this goal?',
        body: '"{0}" will end — progress stays safe, and a slot frees up for a new goal.',
        cancel: 'Cancel',
        confirm: 'End Goal',
      },
      stats: { progress: 'Progress', done: 'Done', inProgress: 'In Progress', estTime: 'Est. Time' },
      noActiveGoal: 'No active goal. Tap "+ Add Goal" above to start a new one.',
      generateForm: {
        label: 'What do you want to learn?',
        placeholder: 'What do you want to learn?',
        generateCta: 'Generate Roadmap',
        generatingCta: 'Generating roadmap...',
        examLabel: 'For a specific exam/board?',
        examOptional: '(optional)',
        examPlaceholder: 'e.g. CBSE Class 10, JEE, NEET — leave blank for general learning',
        examHint: "If you tell us, the roadmap will follow that exam's syllabus order and marks-weightage.",
        weeklyTimeLabel: 'Weekly time available',
        weeklyTimeHint: "This makes the roadmap's topics and depth accurate to your available time.",
        timeLimitLabel: 'Time limit',
        deadlineLabel: 'Deadline',
        generateFailed: "Couldn't generate the roadmap — try again.",
      },
      statusLabels: { mastered: 'Mastered', completed: 'Done', learning: 'In Progress', locked: 'Locked' },
      examWeightage: { high: 'High weightage', medium: 'Medium weightage', low: 'Low weightage' },
      step: 'STEP {0}',
      topicModal: {
        overviewTab: 'Overview',
        whyTab: 'Why',
        whatYoullLearn: "What you'll learn",
        bridgeHint: 'This shows how the last topic connects to this one.',
        deepDiveCta: '🔍 2 quick questions? Get better matched videos (optional)',
        watchVideosCta: 'Watch videos',
        searchingCta: 'Searching...',
        savedVideoCta: 'Saved video',
        markCompleteCta: '✓ I already know this — mark as complete',
        challengeTitle: 'Try a small applied challenge first, then mark the topic complete.',
        challengeCta: 'Tried it — mark complete',
        whyItems: {
          learn: 'Why learn this?',
          connect: 'How does it connect?',
          system: 'What system does it belong to?',
          risk: "What if you don't learn it?",
        },
      },
    },
    revision: {
      header: { title: 'Revision', subtitle: 'Comes back to you on a schedule — 1, 3, 7, 15, 30, 60 days' },
      stats: { dueToday: 'Due Today', overdue: 'Overdue', mastered: 'Mastered', retention: 'Retention' },
      filters: { all: 'All', dueToday: 'Due Today', overdue: 'Overdue', upcoming: 'Upcoming', mastered: 'Mastered' },
      difficultyLabels: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
      card: {
        day: 'Day',
        reviewingNow: 'Reviewing now',
        retentionLabel: 'Retention: {0}%',
        doneLabel: '✓ Done',
        doneCta: 'Done',
        reviewNowCta: 'Review Now',
        reviewingCta: 'Reviewing…',
      },
      emptyState: {
        noRevisionTitle: 'No revisions yet',
        noRevisionBody: 'Start a topic on your roadmap or watch a video — a revision schedule will build itself here.',
        allCaughtUpTitle: 'All caught up!',
        allCaughtUpBody: 'No items in this category right now.',
      },
    },
    notes: {
      header: { title: 'Deep Learning Notes', subtitle: "Auto-generated from the video — edit anything, they're yours" },
      topicPlaceholder: 'Topic for deep learning...',
      deepDiveCta: 'Deep Dive',
      linkPlaceholder: 'Link',
      fromVideoCta: 'From Video',
      invalidUrlError: 'Invalid YouTube URL',
      genericGenerateError: 'Error generating notes',
      genericVideoGenerateError: 'Error generating notes from video',
      sections: {
        summary: 'Summary',
        myNotes: 'My Notes',
        coreConcept: 'Core Concept',
        workedExamples: 'Worked Examples',
        misconceptions: 'Misconceptions',
        realWorldApp: 'Real World Application',
        advanced: 'Advanced',
        practice: 'Practice',
        insights: 'Key Insights',
      },
      sectionUnavailable: 'This section isn\u2019t available for this note yet — run "Deep Dive" or "From Video" again to generate fresh notes.',
      sourceVideoLink: '🎥 Watch source video',
      transcriptSourceNote: '✓ Notes generated from the video transcript',
      metadataSourceNote: '⚠ Transcript wasn\u2019t available — generated from title/description only',
      emptyState: {
        title: 'Enter a topic for comprehensive, deep learning notes',
        subtitle: 'Goes beyond basics - covers WHY, HOW, and WHERE',
      },
    },
    videos: {
      header: { title: '📺 Videos', subtitle: 'Search • Watch • Personalized recommendations' },
      searchPlaceholder: 'Search videos...',
      searchCta: 'Search',
      noResultsYet: 'Start with a search',
      backToVideo: '← Back to Video',
      score: 'Score: {0}/100',
      helpfulCta: 'Helpful',
      notForMeCta: 'Not for me',
      nextCta: 'Next',
      loadingNextCta: 'Finding new videos...',
      watchProgress: {
        title: 'Watch Progress',
        watched: 'Watched',
        pauses: 'Pauses:',
        rewinds: 'Rewinds:',
        speed: 'Speed:',
        complete: 'Complete:',
      },
      deepNotesCta: 'Deep Notes',
      researchCta: 'Research',
      selectVideoPrompt: 'Select a video to watch',
      verifiedBadge: 'verified',
      dismissAria: 'Dismiss',
      errors: {
        noMoreVideos: 'No more new videos for "{0}" — you\u2019ve seen them all.',
        searchSomethingFirst: 'Search for something first',
        noVideosFound: 'No videos found, try searching something else',
        searchFailed: 'Search failed, check console',
      },
    },
    mentor: {
      header: { title: '🤖 AI Mentor', subtitle: "Stuck? Ask here — it knows what you're learning right now" },
      welcomeMessage:
        "Hello! I'm your AI Mentor. 🙏\n\nYou can ask me anything:\n• Explain concepts\n• Real-world analogies\n• Take a quiz\n• Project ideas\n• Common mistakes\n\nTry a suggestion below, or type your own question!",
      suggestedPrompts: [
        { icon: '💡', label: 'Explain simply', prompt: 'Explain this concept simply' },
        { icon: '🧠', label: 'Deep dive', prompt: 'Explain this in depth with examples' },
        { icon: '🎯', label: 'Real analogy', prompt: 'Give me a real-world analogy' },
        { icon: '📝', label: 'Quiz me', prompt: 'Generate a quiz on this topic' },
        { icon: '🛠️', label: 'Project idea', prompt: 'Suggest a mini project' },
        { icon: '🐛', label: 'Find mistake', prompt: 'What are common mistakes?' },
      ],
      youLabel: '👤 You',
      mentorLabel: '🤖 Mentor',
      inputPlaceholder: 'Ask anything...',
      sendCta: 'Send',
      errors: {
        generic: 'Something went wrong ({0}). Please try again in a bit. 🔄',
        noResponse: "Couldn't get a response, please try again. 🔄",
        truncatedSuffix:
          '\n\n_(⚠️ The response was long and got cut off — try asking a shorter question instead of "Deep dive")_',
        network: 'A network error occurred. Please check your internet and try again. 🔄',
      },
    },
    progress: {
      header: { title: 'Progress', subtitle: 'Your real stats — streak, watch time, weak spots' },
      stats: { completion: 'Completion', streak: 'Streak', totalWatchTime: 'Total Watch Time', retention: 'Retention' },
      completionBar: { topicsDone: '{0}/{1} topics done', inProgress: '{0} in progress' },
      emptyState: {
        title: 'Nothing to track yet',
        body: 'Start a topic from your roadmap — progress will start showing up here automatically.',
      },
      timeTracking: { title: '⏱ Time Tracking', last7Days: 'Last 7 days: {0} min' },
      masteryHeatmap: { title: '🧠 Mastery Heatmap', legendWeak: 'Weak', legendOk: 'OK', legendStrong: 'Strong' },
      retentionDetail: { title: '📉 Retention', dueToday: 'Due Today', overdue: 'Overdue', mastered: 'Mastered' },
      weakAreas: { title: '⚠️ Weak Areas', noneFound: 'No weak topics found — everything is going well.' },
    },
    research: {
      header: { title: 'Research', subtitle: 'Search any topic — from the internet, for deeper reading' },
      searchPlaceholder: 'What do you want to know?',
      searchCta: 'Search',
      notGroundedNote:
        "Couldn't find a live search source this time — the answer below is from general knowledge, double-check it for anything current",
      genericError: 'Research failed',
      embedded: { title: 'Research (alongside the video)', hint: 'Search for anything — the video keeps playing.' },
      closeAria: 'Close research panel',
      emptyState: { title: 'Search any topic', subtitle: 'You can also open this alongside a video — from the Videos page' },
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
    dashboard: {
      sidebar: {
        home: 'होम',
        roadmap: 'रोडमैप',
        revision: 'रिवीज़न',
        notes: 'नोट्स',
        videos: 'वीडियो',
        mentor: 'मेंटर',
        progress: 'प्रगति',
        research: 'रिसर्च',
      },
      greeting: {
        morning: 'सुप्रभात',
        afternoon: 'शुभ दोपहर',
        evening: 'शुभ संध्या',
        night: 'शुभ रात्रि',
      },
      tour: {
        dashboardIntro: [
          {
            title: 'रोडमैप',
            content: 'यहां आपके टॉपिक सही क्रम में हैं — पहले बुनियादी बातें। इसी क्रम में सीखना सबसे बेहतर रहेगा।',
          },
          {
            title: 'रिवीज़न',
            content: 'जिन टॉपिक को रिवाइज़ करना है, वे यहां दिखते हैं।',
          },
          {
            title: 'प्रगति',
            content: 'अपनी स्ट्रीक और कुल प्रगति यहां देख सकते हैं।',
          },
          {
            title: 'सेटिंग्स',
            content: 'यहां से अपनी प्रोफ़ाइल और प्राथमिकताएं बदल सकते हैं।',
          },
        ],
        videoPickerIntro: [
          {
            title: 'ये 3 वीडियो — एक ही टॉपिक',
            content:
              'तीनों वीडियो एक ही कॉन्सेप्ट सिखाते हैं, बस अलग तरीके से (गति, उदाहरण, संरचना)। जो आपको सबसे सही लगे, बस वही चुनकर देखें — तीनों देखने की ज़रूरत नहीं।',
          },
          {
            title: 'अलग तरीका, वही कॉन्सेप्ट',
            content: 'यह दूसरा विकल्प है — अगर पहला वाला सही न लगे, तो इसे आज़मा सकते हैं। बात वही है, बस पेश करने का तरीका अलग है।',
          },
        ],
      },
      checklist: {
        heading: 'शुरू करें',
        subheading: 'सबसे अच्छे नतीजे के लिए इन 3 चरणों को इसी क्रम में पूरा करें',
        steps: [
          {
            title: 'अपनी लर्निंग स्टाइल सेट करें',
            subtitle: 'एक छोटा AI इंटरव्यू — बेहतर वीडियो मैच मिलेंगे',
            cta: 'शुरू करें',
          },
          {
            title: 'अपना रोडमैप बनाएं',
            subtitle: 'टॉपिक का सही क्रम — पहले क्या सीखना है',
            cta: 'बनाएं',
          },
          {
            title: 'पहला वीडियो देखें',
            subtitle: 'रोडमैप के पहले टॉपिक से शुरू करें',
            cta: 'देखें',
          },
        ],
      },
      home: {
        statsCards: {
          goal: 'लक्ष्य',
          pickTopic: 'टॉपिक चुनें',
          openRoadmap: 'रोडमैप खोलें',
          revision: 'रिवीज़न',
          dueSuffix: '{0} देय',
          overdueSuffix: '{0} बकाया',
          caughtUp: 'सब पूरा',
          streak: 'स्ट्रीक',
          day: 'दिन',
          days: 'दिन',
          keepGoing: 'चलते रहें',
          startToday: 'आज शुरू करें',
        },
        suggestion: { label: 'सुझाव', customCta: 'कस्टम', watchCta: 'देखें' },
        learningStyleCard: {
          titleReady: 'लर्निंग स्टाइल',
          titleNotReady: 'अपनी स्टाइल जानें',
          subtitleReady: 'प्रोफ़ाइल तैयार है — पूरी रिपोर्ट Settings में है',
          subtitleNotReady: 'बेहतर मैच के लिए छोटा क्विज़',
          detailReady:
            '✓ 8 लर्निंग डाइमेंशन सेट हैं — पेस, गहराई, संरचना और बाकी। पूरा ब्रेकडाउन Settings → "Learning Profile Report" में देखें।',
          retakeCta: 'ब्लूप्रिंट इंटरव्यू दोबारा लें',
          startCta: 'ब्लूप्रिंट इंटरव्यू शुरू करें',
          analyzeVideosCta: 'देखे गए वीडियो एनालाइज़ करें',
        },
      },
    },
    settingsModal: {
      title: 'सेटिंग्स',
      theme: 'थीम',
      nameLabel: 'नाम',
      roleLabel: 'भूमिका',
      topicLabel: 'विषय / टॉपिक',
      topicPlaceholder: 'आप क्या सीखना चाहते हैं?',
      languageLabel: 'भाषा',
      roadmapSection: {
        label: 'रोडमैप',
        hint: 'रोडमैप सिर्फ एक बार बनता है। अगर टॉपिक बहुत broad लग रहे हैं या लर्निंग स्टाइल बदली है, तो दोबारा बनाएं।',
        regenerateCta: 'रोडमैप दोबारा बनाएं',
        regeneratingCta: 'बन रहा है...',
        successMsg: 'नया रोडमैप बन गया।',
        errorMsg: 'कुछ गड़बड़ हो गई, दोबारा कोशिश करें।',
      },
      learningProfileSection: {
        label: 'लर्निंग प्रोफ़ाइल रिपोर्ट',
        hint: 'यह सिर्फ मांगने पर दिखती है — होम पेज पर सिर्फ छोटा सारांश होता है।',
        hintBubble: 'आपकी पूरी लर्निंग प्रोफ़ाइल यहां है — देखने के लिए टैप करें।',
        viewCta: 'पूरी रिपोर्ट देखें',
        hideCta: 'रिपोर्ट छुपाएं',
        dims: {
          pace: 'गति',
          practical: 'व्यावहारिक',
          structure: 'संरचना',
          depth: 'गहराई',
          language: 'भाषा',
          storytelling: 'कहानी शैली',
          repetition: 'दोहराव',
          reliability: 'विश्वसनीयता',
        },
      },
      saveCta: 'सेव करें',
      deadlineNone: 'कोई नहीं',
    },
    customPlaylistModal: {
      title: 'कस्टम प्लेलिस्ट',
      topicLabel: 'टॉपिक',
      topicPlaceholder: 'जैसे, Django basics',
      hoursLabel: 'घंटे / सप्ताह',
      deadlineLabel: 'डेडलाइन',
      quickLabel: 'क्विक:',
      loadingCta: 'वीडियो ढूंढ रहा हूं...',
      noProfileHint: 'बेहतर मैच के लिए पहले क्विज़ पूरा करें',
      generateCta: 'बनाएं',
      generatingCta: 'बन रहा है...',
    },
    roadmap: {
      header: { title: 'आपका रोडमैप', subtitle: 'पहले बुनियाद — सबसे अच्छे नतीजे के लिए इसी क्रम में चलें' },
      goalTabs: {
        newGoal: 'नया लक्ष्य',
        addGoal: '+ लक्ष्य जोड़ें',
        maxGoalsNote: 'एक साथ अधिकतम {0} लक्ष्य — नया शुरू करने के लिए एक को समाप्त करें।',
        endGoal: 'यह लक्ष्य समाप्त करें',
      },
      endGoalModal: {
        title: 'यह लक्ष्य समाप्त करें?',
        body: '"{0}" समाप्त हो जाएगा — प्रगति सुरक्षित रहेगी, और नए लक्ष्य के लिए जगह खाली हो जाएगी।',
        cancel: 'रद्द करें',
        confirm: 'लक्ष्य समाप्त करें',
      },
      stats: { progress: 'प्रगति', done: 'पूरा', inProgress: 'जारी है', estTime: 'अनुमानित समय' },
      noActiveGoal: 'कोई सक्रिय लक्ष्य नहीं है। नया शुरू करने के लिए ऊपर "+ लक्ष्य जोड़ें" दबाएं।',
      generateForm: {
        label: 'क्या सीखना है?',
        placeholder: 'आप क्या सीखना चाहते हैं?',
        generateCta: 'रोडमैप बनाएं',
        generatingCta: 'रोडमैप बन रहा है...',
        examLabel: 'किसी खास परीक्षा/बोर्ड के लिए?',
        examOptional: '(वैकल्पिक)',
        examPlaceholder: 'जैसे CBSE कक्षा 10, JEE, NEET — सामान्य पढ़ाई के लिए खाली छोड़ें',
        examHint: 'बताने पर रोडमैप उस परीक्षा के सिलेबस-क्रम और अंक-भार (weightage) के हिसाब से बनेगा।',
        weeklyTimeLabel: 'साप्ताहिक उपलब्ध समय',
        weeklyTimeHint: 'इससे रोडमैप के टॉपिक और उनकी गहराई आपके उपलब्ध समय के हिसाब से सटीक बनती है।',
        timeLimitLabel: 'समय सीमा',
        deadlineLabel: 'डेडलाइन',
        generateFailed: 'रोडमैप नहीं बन पाया — दोबारा कोशिश करें।',
      },
      statusLabels: { mastered: 'महारत', completed: 'पूरा', learning: 'जारी है', locked: 'लॉक्ड' },
      examWeightage: { high: 'ज़्यादा वेटेज', medium: 'मध्यम वेटेज', low: 'कम वेटेज' },
      step: 'चरण {0}',
      topicModal: {
        overviewTab: 'ओवरव्यू',
        whyTab: 'क्यों',
        whatYoullLearn: 'आप क्या सीखेंगे',
        bridgeHint: 'यह दिखाता है कि पिछला टॉपिक इससे कैसे जुड़ता है।',
        deepDiveCta: '🔍 2 छोटे सवाल पूछूं? बेहतर मैच वाले वीडियो मिलेंगे (वैकल्पिक)',
        watchVideosCta: 'वीडियो देखें',
        searchingCta: 'ढूंढ रहा हूं...',
        savedVideoCta: 'सेव किया वीडियो',
        markCompleteCta: '✓ मुझे यह पहले से आता है — पूरा हुआ मार्क करें',
        challengeTitle: 'पहले एक छोटा applied challenge करें, फिर टॉपिक पूरा मार्क करें।',
        challengeCta: 'कोशिश कर ली — पूरा मार्क करें',
        whyItems: {
          learn: 'यह क्यों सीखें?',
          connect: 'यह कैसे जुड़ता है?',
          system: 'यह किस सिस्टम का हिस्सा है?',
          risk: 'अगर यह न सीखा तो?',
        },
      },
    },
    revision: {
      header: { title: 'रिवीज़न', subtitle: '1, 3, 7, 15, 30, 60 दिन के शेड्यूल पर वापस आता है' },
      stats: { dueToday: 'आज देय', overdue: 'बकाया', mastered: 'महारत', retention: 'रिटेंशन' },
      filters: { all: 'सभी', dueToday: 'आज देय', overdue: 'बकाया', upcoming: 'आने वाला', mastered: 'महारत' },
      difficultyLabels: { easy: 'आसान', medium: 'मध्यम', hard: 'कठिन' },
      card: {
        day: 'दिन',
        reviewingNow: 'अभी रिव्यू हो रहा है',
        retentionLabel: 'रिटेंशन: {0}%',
        doneLabel: '✓ पूरा हुआ',
        doneCta: 'पूरा हुआ',
        reviewNowCta: 'अभी रिव्यू करें',
        reviewingCta: 'रिव्यू हो रहा है…',
      },
      emptyState: {
        noRevisionTitle: 'अभी कोई रिवीज़न नहीं',
        noRevisionBody: 'रोडमैप में कोई टॉपिक शुरू करें या कोई वीडियो देखें — रिवीज़न शेड्यूल अपने आप यहां बन जाएगा।',
        allCaughtUpTitle: 'सब कुछ पूरा हो गया!',
        allCaughtUpBody: 'इस श्रेणी में अभी कोई आइटम नहीं है।',
      },
    },
    notes: {
      header: { title: 'डीप लर्निंग नोट्स', subtitle: 'वीडियो से अपने आप बनते हैं — कुछ भी बदलो, ये तुम्हारे अपने हैं' },
      topicPlaceholder: 'डीप लर्निंग के लिए टॉपिक...',
      deepDiveCta: 'डीप डाइव',
      linkPlaceholder: 'लिंक',
      fromVideoCta: 'वीडियो से',
      invalidUrlError: 'गलत YouTube लिंक',
      genericGenerateError: 'नोट्स बनाने में गलती हुई',
      genericVideoGenerateError: 'वीडियो से नोट्स बनाने में गलती हुई',
      sections: {
        summary: 'सारांश',
        myNotes: 'मेरे नोट्स',
        coreConcept: 'मुख्य कॉन्सेप्ट',
        workedExamples: 'हल किए उदाहरण',
        misconceptions: 'गलतफहमियां',
        realWorldApp: 'असल दुनिया में उपयोग',
        advanced: 'एडवांस्ड',
        practice: 'अभ्यास',
        insights: 'मुख्य बातें',
      },
      sectionUnavailable: 'यह सेक्शन अभी इस नोट के लिए उपलब्ध नहीं है — नए नोट्स बनाने के लिए "डीप डाइव" या "वीडियो से" फिर से चलाएं।',
      sourceVideoLink: '🎥 मूल वीडियो देखें',
      transcriptSourceNote: '✓ ये नोट्स वीडियो की ट्रांसक्रिप्ट से बनाए गए हैं',
      metadataSourceNote: '⚠ ट्रांसक्रिप्ट उपलब्ध नहीं थी — सिर्फ टाइटल/डिस्क्रिप्शन से बनाए गए',
      emptyState: {
        title: 'गहराई से सीखने के लिए एक टॉपिक डालें',
        subtitle: 'बेसिक्स से आगे — WHY, HOW और WHERE कवर करता है',
      },
    },
    videos: {
      header: { title: '📺 वीडियो', subtitle: 'खोजें • देखें • व्यक्तिगत सुझाव' },
      searchPlaceholder: 'वीडियो खोजें...',
      searchCta: 'खोजें',
      noResultsYet: 'खोजकर शुरू करें',
      backToVideo: '← वीडियो पर वापस जाएं',
      score: 'स्कोर: {0}/100',
      helpfulCta: 'मददगार',
      notForMeCta: 'मेरे लिए नहीं',
      nextCta: 'अगला',
      loadingNextCta: 'नए वीडियो ढूंढ रहा हूं...',
      watchProgress: {
        title: 'देखने की प्रगति',
        watched: 'देखा गया',
        pauses: 'रुका:',
        rewinds: 'पीछे किया:',
        speed: 'स्पीड:',
        complete: 'पूरा:',
      },
      deepNotesCta: 'डीप नोट्स',
      researchCta: 'रिसर्च',
      selectVideoPrompt: 'देखने के लिए एक वीडियो चुनें',
      verifiedBadge: 'सत्यापित',
      dismissAria: 'बंद करें',
      errors: {
        noMoreVideos: '"{0}" के लिए और नए वीडियो नहीं मिले — सभी दिखाए जा चुके हैं।',
        searchSomethingFirst: 'पहले कुछ खोजें',
        noVideosFound: 'कोई वीडियो नहीं मिला, कुछ और खोजें',
        searchFailed: 'खोज विफल हुई, कंसोल जांचें',
      },
    },
    mentor: {
      header: { title: '🤖 AI मेंटर', subtitle: 'अटक गए? यहां पूछें — इसे पता है आप अभी क्या सीख रहे हैं' },
      welcomeMessage:
        'नमस्ते! मैं आपका AI मेंटर हूं। 🙏\n\nआप मुझसे कुछ भी पूछ सकते हैं:\n• कॉन्सेप्ट समझाना\n• असल दुनिया की मिसालें\n• क्विज़ लेना\n• प्रोजेक्ट आइडिया\n• आम गलतियां\n\nनीचे दिए सुझाव आज़माएं, या अपना सवाल टाइप करें!',
      suggestedPrompts: [
        { icon: '💡', label: 'आसानी से समझाओ', prompt: 'यह कॉन्सेप्ट आसान भाषा में समझाओ' },
        { icon: '🧠', label: 'गहराई से', prompt: 'इसे उदाहरणों के साथ विस्तार से समझाओ' },
        { icon: '🎯', label: 'असल मिसाल', prompt: 'मुझे इसकी असल दुनिया की मिसाल दो' },
        { icon: '📝', label: 'क्विज़ लो', prompt: 'इस टॉपिक पर एक क्विज़ बनाओ' },
        { icon: '🛠️', label: 'प्रोजेक्ट आइडिया', prompt: 'एक छोटा प्रोजेक्ट सुझाओ' },
        { icon: '🐛', label: 'गलती पकड़ो', prompt: 'इसमें आम गलतियां क्या होती हैं?' },
      ],
      youLabel: '👤 आप',
      mentorLabel: '🤖 मेंटर',
      inputPlaceholder: 'कुछ भी पूछें...',
      sendCta: 'भेजें',
      errors: {
        generic: 'कुछ गड़बड़ हो गई ({0})। थोड़ी देर में फिर कोशिश करें। 🔄',
        noResponse: 'जवाब नहीं मिल पाया, फिर से कोशिश करें। 🔄',
        truncatedSuffix: '\n\n_(⚠️ जवाब लंबा था और बीच में कट गया — "गहराई से" की जगह छोटा सवाल पूछें)_',
        network: 'नेटवर्क में गड़बड़ आई। इंटरनेट जांचें और फिर कोशिश करें। 🔄',
      },
    },
    progress: {
      header: { title: 'प्रगति', subtitle: 'आपके असली आंकड़े — स्ट्रीक, वॉच टाइम, कमजोर टॉपिक' },
      stats: { completion: 'पूर्णता', streak: 'स्ट्रीक', totalWatchTime: 'कुल वॉच टाइम', retention: 'रिटेंशन' },
      completionBar: { topicsDone: '{0}/{1} टॉपिक पूरे', inProgress: '{0} जारी हैं' },
      emptyState: {
        title: 'अभी ट्रैक करने को कुछ नहीं है',
        body: 'रोडमैप से कोई टॉपिक शुरू करें — प्रगति अपने आप यहां दिखनी शुरू हो जाएगी।',
      },
      timeTracking: { title: '⏱ टाइम ट्रैकिंग', last7Days: 'पिछले 7 दिन: {0} मिनट' },
      masteryHeatmap: { title: '🧠 महारत हीटमैप', legendWeak: 'कमजोर', legendOk: 'ठीक', legendStrong: 'मजबूत' },
      retentionDetail: { title: '📉 रिटेंशन', dueToday: 'आज देय', overdue: 'बकाया', mastered: 'महारत' },
      weakAreas: { title: '⚠️ कमजोर टॉपिक', noneFound: 'कोई कमजोर टॉपिक नहीं मिला — सब कुछ ठीक चल रहा है।' },
    },
    research: {
      header: { title: 'रिसर्च', subtitle: 'कोई भी टॉपिक खोजें — इंटरनेट से, गहराई से पढ़ने के लिए' },
      searchPlaceholder: 'क्या जानना है?',
      searchCta: 'खोजें',
      notGroundedNote: 'इस बार लाइव सर्च सोर्स नहीं मिला — नीचे दिया जवाब सामान्य जानकारी से है, हाल की किसी बात के लिए दोबारा जांच लें',
      genericError: 'रिसर्च नहीं हो पाई',
      embedded: { title: 'रिसर्च (वीडियो के साथ-साथ)', hint: 'कुछ भी खोजें — वीडियो चलती रहेगी।' },
      closeAria: 'रिसर्च पैनल बंद करें',
      emptyState: { title: 'कोई भी टॉपिक खोजें', subtitle: 'वीडियो देखते हुए भी इसे साथ में खोल सकते हैं — Videos पेज से' },
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
    dashboard: {
      sidebar: {
        home: 'Home',
        roadmap: 'Roadmap',
        revision: 'Revision',
        notes: 'Notes',
        videos: 'Videos',
        mentor: 'Mentor',
        progress: 'Progress',
        research: 'Research',
      },
      greeting: {
        morning: 'Good Morning',
        afternoon: 'Good Afternoon',
        evening: 'Good Evening',
        night: 'Good Night',
      },
      tour: {
        dashboardIntro: [
          {
            title: 'Roadmap',
            content: 'Yahan aapke topics order me hain — foundation-first, isi order me follow karna best rahega.',
          },
          {
            title: 'Revision',
            content: 'Jo topics due hain revise karne ke liye, wo yahan dikhte hain.',
          },
          {
            title: 'Progress',
            content: 'Apni streak aur overall progress yahan track kar sakte ho.',
          },
          {
            title: 'Settings',
            content: 'Yahan se apna profile aur preferences badal sakte ho.',
          },
        ],
        videoPickerIntro: [
          {
            title: 'Ye 3 videos — same topic hai',
            content:
              'Teenon video ek hi concept sikhate hain, bas alag teaching style me (pace, examples, structure). Sirf ek chunkar dekhna hai jo aapko sabse suit kare — teeno dekhne ki zaroorat nahi.',
          },
          {
            title: 'Alag style, wahi concept',
            content: 'Ye doosra option hai — agar pehla wala suit na kare, to isse try kar sakte ho. Same cheez, bas presentation different.',
          },
        ],
      },
      checklist: {
        heading: 'Shuru karo',
        subheading: 'Ye 3 steps follow karo — is order me best result milega',
        steps: [
          {
            title: 'Apna learning style set karo',
            subtitle: 'Short AI interview — better video matches milenge',
            cta: 'Start',
          },
          {
            title: 'Apna roadmap banao',
            subtitle: 'Topics ka sahi order — kya pehle seekhna hai',
            cta: 'Generate',
          },
          {
            title: 'Pehla video dekho',
            subtitle: 'Roadmap ke pehle topic se shuru karo',
            cta: 'Watch',
          },
        ],
      },
      home: {
        statsCards: {
          goal: 'Goal',
          pickTopic: 'Pick a topic',
          openRoadmap: 'Open roadmap',
          revision: 'Revision',
          dueSuffix: '{0} due',
          overdueSuffix: '{0} overdue',
          caughtUp: 'Caught up',
          streak: 'Streak',
          day: 'day',
          days: 'days',
          keepGoing: 'Keep going',
          startToday: 'Start today',
        },
        suggestion: { label: 'Suggestion', customCta: 'Custom', watchCta: 'Watch' },
        learningStyleCard: {
          titleReady: 'Learning Style',
          titleNotReady: 'Find Your Style',
          subtitleReady: 'Profile ready — full report Settings me hai',
          subtitleNotReady: 'Short quiz for better matches',
          detailReady:
            '✓ 8 learning dimensions set — pace, depth, structure aur baaki. Settings → "Learning Profile Report" me poora breakdown dekho.',
          retakeCta: 'Retake Blueprint Interview',
          startCta: 'Start Blueprint Interview',
          analyzeVideosCta: "Analyze Videos I've Watched",
        },
      },
    },
    settingsModal: {
      title: 'Settings',
      theme: 'Theme',
      nameLabel: 'Name',
      roleLabel: 'Role',
      topicLabel: 'Subject / Topic',
      topicPlaceholder: 'Aap kya seekhna chahte ho?',
      languageLabel: 'Language',
      roadmapSection: {
        label: 'Roadmap',
        hint: 'Roadmap sirf ek baar banta hai. Agar topics bahut broad lag rahe hain ya learning style change kiya hai, dobara generate karo.',
        regenerateCta: 'Regenerate Roadmap',
        regeneratingCta: 'Regenerating...',
        successMsg: 'Naya roadmap ban gaya.',
        errorMsg: 'Kuch gadbad ho gayi, dobara try karo.',
      },
      learningProfileSection: {
        label: 'Learning Profile Report',
        hint: 'Yeh sirf request karne par dikhta hai — home page pe sirf ek short summary hoti hai.',
        hintBubble: 'Your full learning profile lives here — tap to view it.',
        viewCta: 'View Full Report',
        hideCta: 'Hide Report',
        dims: {
          pace: 'Pace',
          practical: 'Practical',
          structure: 'Structure',
          depth: 'Depth',
          language: 'Language',
          storytelling: 'Storytelling',
          repetition: 'Repetition',
          reliability: 'Reliability',
        },
      },
      saveCta: 'Save',
      deadlineNone: 'None',
    },
    customPlaylistModal: {
      title: 'Custom Playlist',
      topicLabel: 'Topic',
      topicPlaceholder: 'e.g., Django basics',
      hoursLabel: 'Hours / week',
      deadlineLabel: 'Deadline',
      quickLabel: 'Quick:',
      loadingCta: 'Dhundh raha hoon...',
      noProfileHint: 'Pehle quiz complete karo for better matches',
      generateCta: 'Generate',
      generatingCta: 'Generating...',
    },
    roadmap: {
      header: { title: 'Your Roadmap', subtitle: 'Foundation-first order — follow it for best results' },
      goalTabs: {
        newGoal: 'Naya Goal',
        addGoal: '+ Add Goal',
        maxGoalsNote: 'Max {0} goals ek saath — koi ek end karo naya start karne ke liye.',
        endGoal: 'End this goal',
      },
      endGoalModal: {
        title: 'Ye goal end karein?',
        body: '"{0}" end ho jayega — progress safe rahega, aur slot free ho jayega naye goal ke liye.',
        cancel: 'Cancel',
        confirm: 'End Goal',
      },
      stats: { progress: 'Progress', done: 'Done', inProgress: 'In Progress', estTime: 'Est. Time' },
      noActiveGoal: 'Koi active goal nahi hai. Upar "+ Add Goal" dabao naya goal shuru karne ke liye.',
      generateForm: {
        label: 'Kya seekhna hai?',
        placeholder: 'Aap kya seekhna chahte ho?',
        generateCta: 'Generate Roadmap',
        generatingCta: 'Roadmap ban raha hai...',
        examLabel: 'Kisi specific exam/board ke liye?',
        examOptional: '(optional)',
        examPlaceholder: 'jaise CBSE Class 10, JEE, NEET — khaali chhodo agar general learning hai',
        examHint: 'Bataoge to roadmap us exam ke syllabus-order aur marks-weightage ke hisaab se banega.',
        weeklyTimeLabel: 'Weekly time available',
        weeklyTimeHint: 'Isse roadmap ke topics aur unki depth aapke available time ke hisaab se accurate banti hai.',
        timeLimitLabel: 'Time limit',
        deadlineLabel: 'Deadline',
        generateFailed: 'Roadmap generate nahi ho paaya — dobara try karo.',
      },
      statusLabels: { mastered: 'Mastered', completed: 'Done', learning: 'In Progress', locked: 'Locked' },
      examWeightage: { high: 'High weightage', medium: 'Medium weightage', low: 'Low weightage' },
      step: 'STEP {0}',
      topicModal: {
        overviewTab: 'Overview',
        whyTab: 'Why',
        whatYoullLearn: "What you'll learn",
        bridgeHint: 'This shows how the last topic connects to this one.',
        deepDiveCta: '🔍 2 quick sawaal poochu? Better matched videos milenge (optional)',
        watchVideosCta: 'Watch videos',
        searchingCta: 'Dhundh raha hoon...',
        savedVideoCta: 'Saved video',
        markCompleteCta: '✓ Maine ye already seekh liya — mark as complete',
        challengeTitle: 'Pehle ek chhota applied challenge try karo, phir topic complete maaro.',
        challengeCta: 'Try kar liya — complete maaro',
        whyItems: {
          learn: 'Why learn this?',
          connect: 'How does it connect?',
          system: 'What system does it belong to?',
          risk: "What if you don't learn it?",
        },
      },
    },
    revision: {
      header: { title: 'Revision', subtitle: 'Comes back to you on a schedule — 1, 3, 7, 15, 30, 60 days' },
      stats: { dueToday: 'Due Today', overdue: 'Overdue', mastered: 'Mastered', retention: 'Retention' },
      filters: { all: 'All', dueToday: 'Due Today', overdue: 'Overdue', upcoming: 'Upcoming', mastered: 'Mastered' },
      difficultyLabels: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
      card: {
        day: 'Day',
        reviewingNow: 'Reviewing now',
        retentionLabel: 'Retention: {0}%',
        doneLabel: '✓ Done',
        doneCta: 'Done',
        reviewNowCta: 'Review Now',
        reviewingCta: 'Reviewing…',
      },
      emptyState: {
        noRevisionTitle: 'Abhi koi revision nahi',
        noRevisionBody: 'Roadmap mein koi topic start karo ya video dekho — revision schedule yahin apne aap ban jayega.',
        allCaughtUpTitle: 'All caught up!',
        allCaughtUpBody: 'No items in this category right now.',
      },
    },
    notes: {
      header: { title: 'Deep Learning Notes', subtitle: "Auto-generated from the video — edit anything, they're yours" },
      topicPlaceholder: 'Topic for deep learning...',
      deepDiveCta: 'Deep Dive',
      linkPlaceholder: 'Link',
      fromVideoCta: 'From Video',
      invalidUrlError: 'Invalid YouTube URL',
      genericGenerateError: 'Error generating notes',
      genericVideoGenerateError: 'Error generating notes from video',
      sections: {
        summary: 'Summary',
        myNotes: 'My Notes',
        coreConcept: 'Core Concept',
        workedExamples: 'Worked Examples',
        misconceptions: 'Misconceptions',
        realWorldApp: 'Real World Application',
        advanced: 'Advanced',
        practice: 'Practice',
        insights: 'Key Insights',
      },
      sectionUnavailable: 'Yeh section is note ke liye available nahi hai — "Deep Dive" ya "From Video" dobara chala ke fresh notes banao.',
      sourceVideoLink: '🎥 Source video dekho',
      transcriptSourceNote: '✓ Video transcript se banaye gaye notes',
      metadataSourceNote: '⚠ Transcript available nahi thi — sirf title/description se banaye gaye',
      emptyState: {
        title: 'Enter a topic for comprehensive, deep learning notes',
        subtitle: 'Goes beyond basics - covers WHY, HOW, and WHERE',
      },
    },
    videos: {
      header: { title: '📺 Videos', subtitle: 'Search • Watch • Personalized recommendations' },
      searchPlaceholder: 'Search videos...',
      searchCta: 'Search',
      noResultsYet: 'Search se start karo',
      backToVideo: '← Back to Video',
      score: 'Score: {0}/100',
      helpfulCta: 'Helpful',
      notForMeCta: 'Not for me',
      nextCta: 'Next',
      loadingNextCta: 'Naye videos dhoondh raha hoon...',
      watchProgress: {
        title: 'Watch Progress',
        watched: 'Watched',
        pauses: 'Pauses:',
        rewinds: 'Rewinds:',
        speed: 'Speed:',
        complete: 'Complete:',
      },
      deepNotesCta: 'Deep Notes',
      researchCta: 'Research',
      selectVideoPrompt: 'Video select karo dekhne ke liye',
      verifiedBadge: 'verified',
      dismissAria: 'Dismiss',
      errors: {
        noMoreVideos: '"{0}" ke liye aur naye videos nahi mile — sab dikha diye gaye.',
        searchSomethingFirst: 'Kuch search karo pehle',
        noVideosFound: 'Koi video nahi mila, kuch aur search karo',
        searchFailed: 'Search fail hui, console check karo',
      },
    },
    mentor: {
      header: { title: '🤖 AI Mentor', subtitle: "Stuck? Ask here — it knows what you're learning right now" },
      welcomeMessage:
        'Namaste! Main aapka AI Mentor hoon. 🙏\n\nAap mujhse kuch bhi poochh sakte hain:\n• Concepts explain karwana\n• Real-world analogies\n• Quiz lena\n• Project ideas\n• Common mistakes\n\nNeeche suggestions try karein, ya apna question type karein!',
      suggestedPrompts: [
        { icon: '💡', label: 'Explain simply', prompt: 'Explain this concept simply' },
        { icon: '🧠', label: 'Deep dive', prompt: 'Explain this in depth with examples' },
        { icon: '🎯', label: 'Real analogy', prompt: 'Give me a real-world analogy' },
        { icon: '📝', label: 'Quiz me', prompt: 'Generate a quiz on this topic' },
        { icon: '🛠️', label: 'Project idea', prompt: 'Suggest a mini project' },
        { icon: '🐛', label: 'Find mistake', prompt: 'What are common mistakes?' },
      ],
      youLabel: '👤 You',
      mentorLabel: '🤖 Mentor',
      inputPlaceholder: 'Ask anything...',
      sendCta: 'Send',
      errors: {
        generic: 'Kuch gadbad ho gayi ({0}). Thodi der mein phir try karein. 🔄',
        noResponse: 'Response nahi mil paaya, phir se try karein. 🔄',
        truncatedSuffix:
          '\n\n_(⚠️ Response lambi thi aur beech mein kat gayi — "Deep dive" ki jagah chhota sawaal poochhein)_',
        network: 'Network error aaya. Internet check karein aur phir try karein. 🔄',
      },
    },
    progress: {
      header: { title: 'Progress', subtitle: 'Your real stats — streak, watch time, weak spots' },
      stats: { completion: 'Completion', streak: 'Streak', totalWatchTime: 'Total Watch Time', retention: 'Retention' },
      completionBar: { topicsDone: '{0}/{1} topics done', inProgress: '{0} in progress' },
      emptyState: {
        title: 'Abhi kuch track karne ko nahi hai',
        body: 'Roadmap se koi topic start karo — progress yahin apne aap dikhna shuru ho jayega.',
      },
      timeTracking: { title: '⏱ Time Tracking', last7Days: 'Last 7 days: {0} min' },
      masteryHeatmap: { title: '🧠 Mastery Heatmap', legendWeak: 'Weak', legendOk: 'OK', legendStrong: 'Strong' },
      retentionDetail: { title: '📉 Retention', dueToday: 'Due Today', overdue: 'Overdue', mastered: 'Mastered' },
      weakAreas: { title: '⚠️ Weak Areas', noneFound: 'Koi weak topic nahi mila — sab theek chal raha hai.' },
    },
    research: {
      header: { title: 'Research', subtitle: 'Koi bhi topic search karo — internet se, deeper reading ke liye' },
      searchPlaceholder: 'Kya jaanna hai?',
      searchCta: 'Search',
      notGroundedNote:
        'Live search source nahi mila is baar — neeche wala jawab general knowledge se hai, current cheezon ke liye double-check kar lena',
      genericError: 'Research failed',
      embedded: { title: 'Research (video ke saath saath)', hint: 'Kuch bhi search karo — video chalti rahegi.' },
      closeAria: 'Close research panel',
      emptyState: { title: 'Koi bhi topic search karo', subtitle: 'Video dekhte hue side mein bhi khol sakte ho — Videos page se' },
    },
  },
};
