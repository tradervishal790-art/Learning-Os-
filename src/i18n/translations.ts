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
      dictionary: string;
      test: string;
      currentAffairs: string;
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
      revisionBanner: { overdueTitle: string; dueTitle: string; subtitle: string }; // overdueTitle: "{0} ... {1}", dueTitle: "{0}"
      learnerFallback: string;
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
    accountSection: {
      label: string;
      signedInAs: string; // "Signed in as {0}"
      signOutCta: string;
    };
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
  learningQuiz: {
    assessmentLabel: string;
    quickCheckBadge: string;
    lastOneBadge: string;
    hintText: string;
    honestNote: string;
    questions: { id: string; prompt: string; options: { key: string; text: string }[] }[];
    honestyQuestion: { prompt: string; options: { value: string; label: string }[] };
  };
  blueprintInterview: {
    headerTitle: string;
    progress: { complete: string; analyzing: string; questionOf: string }; // "{0}/{1}"
    backCta: string;
    analyzingText: string;
    resultSection: { mindMapTitle: string; mindScoreLabel: string; reportTitle: string };
    errorRetryCta: string;
    genericError: string;
    doneCta: string;
    dimensionLabels: {
      pace: string;
      practical: string;
      structure: string;
      depth: string;
      language: string;
      storytelling: string;
      repetition: string;
      priorKnowledge: string;
    };
    /** SAFETY: this text IS bundled into the Gemini grading prompt (see
     *  api/blueprint-interview.ts) — translate for exact meaning, never
     *  word-for-word, since Gemini reads the selected option's semantic
     *  intent to score 8 learning dimensions. */
    questions: { id: string; text: string; options: { key: string; text: string }[] }[];
  };
  blueprintVerdicts: {
    pace: { high: string; mid: string; low: string };
    theoryVsPractical: { high: string; mid: string; low: string };
    structureNeed: { high: string; mid: string; low: string };
    depth: { high: string; mid: string; low: string };
    languageComplexity: { high: string; mid: string; low: string };
    storytelling: { high: string; mid: string; low: string };
    repetitionNeed: { high: string; mid: string; low: string };
    priorKnowledgeComfort: { high: string; mid: string; low: string };
  };
  authErrors: {
    sessionExpired: string;
    emailAlreadyInUse: string;
    weakPassword: string;
    invalidEmail: string;
    wrongPassword: string;
    userNotFound: string;
    operationNotAllowed: string;
    unauthorizedDomain: string;
    popupBlocked: string;
    popupClosedByUser: string;
    genericAuthError: string;
  };
  authScreen: {
    signOutBtn: string; // "Sign out ({0})"
    subtitleCreate: string;
    subtitleSignin: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    createAccountCta: string;
    signInCta: string;
    orDivider: string;
    googleCta: string;
    switchToSignin: string;
    switchToCreate: string;
    validationEmailPassword: string;
    validationName: string;
  };
  /** Guest -> account prompt (sign-in modal, locked-page card, header button). */
  authPrompt: {
    signInButton: string;
    guestTitle: string;
    featureTitle: string; // "Sign in to use {0}"
    subtitle: string;
    notNow: string;
    lockedTitle: string;
    lockedBody: string; // "{0} needs a free account..."
    lockedCta: string;
    roadmapPending: string;
    guestBadge: string;
    guestAccountNote: string;
  };
  errorBoundary: { title: string; body: string; reloadCta: string; clearDataCta: string };
  deepDiveChat: {
    badge: string;
    questionOf: string; // "{0} / {1}"
    answerPlaceholder: string;
    submitCta: string;
    nextCta: string;
    processingText: string;
    closeCta: string;
    errors: { noResponse: string; noProfile: string; generic: string };
  };
  /** SAFETY: bundled into the deep-dive Gemini extraction prompt (see
   *  deepDiveScoring.ts buildExtractionPrompt) — the user answers freely
   *  in whatever language they type, so only the question wording needs
   *  faithful translation here. */
  deepDiveQuestions: [string, string, string];
  tasteOnboarding: {
    badge: string;
    formTitle: string;
    formSubtitle: string; // "{0}" = min videos, "{1}" = min duration
    urlPlaceholder: string;
    watchedCheckbox: string;
    linkNotRecognized: string;
    addAnotherCta: string;
    analyzeCta: string; // "Analyze {0} Videos"
    validationHint: string;
    analyzingText: string;
    videoFallbackLabel: string; // "Video {0}"
    doneTitle: string;
    doneSubtitle: string; // "{0}" = count, "{1}" = "" or "s"
    doneCta: string;
    retryCta: string;
    errors: { noneAnalyzed: string };
  };
  revisionTasks: { day1: string; day3: string; day7: string; day15: string; day30: string; day60: string; fallback: string };
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
  notebook: {
    tabNotebook: string;
    tabAi: string;
    searchPlaceholder: string;
    newNote: string;
    newFolder: string;
    untitled: string;
    folders: string;
    viewAll: string;
    viewFavorites: string;
    viewArchive: string;
    viewTrash: string;
    sortRecent: string;
    sortCreated: string;
    sortTitle: string;
    allTags: string;
    emptyTitle: string;
    emptySubtitle: string;
    emptySearch: string;
    emptyTrash: string;
    emptyArchive: string;
    emptyFavorites: string;
    emptyFolder: string;
    pages: string;
    edited: string;
    rename: string;
    duplicate: string;
    move: string;
    pin: string;
    unpin: string;
    favorite: string;
    unfavorite: string;
    archive: string;
    unarchive: string;
    editTags: string;
    moveToTrash: string;
    restore: string;
    deleteForever: string;
    emptyTrashBtn: string;
    select: string;
    selected: string;
    cancel: string;
    moveHere: string;
    rootFolder: string;
    moveTitle: string;
    newSubfolder: string;
    renameFolder: string;
    deleteFolder: string;
    folderNamePrompt: string;
    renameFolderPrompt: string;
    renamePrompt: string;
    tagsPrompt: string;
    confirmDeleteForever: string;
    confirmEmptyTrash: string;
    confirmDeleteFolderWithNotes: string;
    confirmDeleteFolder: string;
    trashInfo: string;
    undo: string;
    toastTrashed: string;
    toastMoved: string;
    toastArchived: string;
    toastUnarchived: string;
    toastRestored: string;
    toastDuplicated: string;
    toastFolderDeleted: string;
    saving: string;
    saved: string;
    savedLocal: string;
    offline: string;
    saveError: string;
    syncNow: string;
    study: {
      statusNotStarted: string;
      statusLearning: string;
      statusNeedsRevision: string;
      statusMastered: string;
      statusLabel: string;
      confidenceLabel: string;
      confidenceNone: string;
      examDateLabel: string;
      clearDate: string;
      details: string;
      save: string;
      filterAll: string;
      filterExamSoon: string;
      sortExam: string;
      examToday: string;
      examTomorrow: string;
      examInDays: string;
      examPast: string;
      confidenceShort: string;
    };
    pageOps: {
      deleteConfirm: string;
      deleteBtn: string;
      needOnePage: string;
      toastDeleted: string;
      moveUp: string;
      moveDown: string;
      bookmark: string;
      removeBookmark: string;
      pageOf: string;
      duplicatePage: string;
      addPageAfter: string;
      panelTitle: string;
      panelAdd: string;
      template: string;
      paper: string;
      collapsePanel: string;
      expandPanel: string;
      tplBlank: string;
      tplRuled: string;
      tplDotted: string;
      tplGrid: string;
      tplCornell: string;
      zoomIn: string;
      zoomOut: string;
      zoomFit: string;
      pagesButton: string;
      closePanel: string;
    };
    ink: {
      modeType: string;
      modePen: string;
      modeHighlighter: string;
      modeEraser: string;
      penBallpoint: string;
      penFountain: string;
      penFelt: string;
      penPencil: string;
      penBrush: string;
      penCalligraphy: string;
      penFineliner: string;
      penMarker: string;
      penDotted: string;
      penType: string;
      color: string;
      colorAuto: string;
      customColor: string;
      recentColors: string;
      thickness: string;
      smoothing: string;
      favorites: string;
      saveFavorite: string;
      removeFavorite: string;
      fingerDraw: string;
      fingerDrawOn: string;
      fingerDrawOff: string;
      more: string;
      resetPen: string;
      eraserStroke: string;
      eraserArea: string;
      targetAll: string;
      targetInk: string;
      targetHl: string;
      eraserSize: string;
      eraseAll: string;
      eraseAllConfirm: string;
      undo: string;
      redo: string;
      modeSelect: string;
      selLasso: string;
      selRect: string;
      selAll: string;
      selHint: string;
      selCount: string;
      selDelete: string;
      selCopy: string;
      selCut: string;
      selPaste: string;
      selDuplicate: string;
      selColor: string;
      selWidth: string;
      selFront: string;
      selBack: string;
      selNeaten: string;
      selNeatNone: string;
      selToText: string;
      shapeSnap: string;
      ocrConsent: string;
      ocrTitle: string;
      ocrLoading: string;
      ocrError: string;
      ocrEmpty: string;
      ocrLowConf: string;
      ocrEdit: string;
      ocrInsert: string;
      ocrInsertDelete: string;
      ocrCancel: string;
    };
    editor: {
      back: string;
      titlePlaceholder: string;
      bodyPlaceholder: string;
      addPage: string;
      pageLabel: string;
      loadError: string;
      undo: string;
      redo: string;
      normalText: string;
      heading1: string;
      heading2: string;
      heading3: string;
      bold: string;
      italic: string;
      underline: string;
      strike: string;
      textColor: string;
      resetColor: string;
      highlight: string;
      removeHighlight: string;
      superscript: string;
      subscript: string;
      bulletList: string;
      numberedList: string;
      checklist: string;
      quote: string;
      codeBlock: string;
      inlineCode: string;
      link: string;
      linkPrompt: string;
      removeLink: string;
      table: string;
      addRow: string;
      addColumn: string;
      deleteRow: string;
      deleteColumn: string;
      deleteTable: string;
      divider: string;
      alignLeft: string;
      alignCenter: string;
      alignRight: string;
      clearFormat: string;
      fontSize: string;
      sizeSmall: string;
      sizeNormal: string;
      sizeLarge: string;
      sizeHuge: string;
      find: string;
      findPlaceholder: string;
      replacePlaceholder: string;
      replace: string;
      replaceAll: string;
      noMatches: string;
      matchCount: string;
      next: string;
      prev: string;
      close: string;
      words: string;
      chars: string;
      readTime: string;
      focusMode: string;
      exitFocus: string;
      readAloud: string;
      stopReading: string;
      shortcuts: string;
      shortcutsTitle: string;
      pageHint: string;
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
  currentAffairs: {
    title: string;
    subtitle: string;
    streak: string; // "{0}-day streak"
    previousDays: string;
    today: string;
    loading: string;
    retry: string;
    dayNotAvailable: string;
    tabs: { all: string; national: string; international: string; economy: string; sports: string; scitech: string };
    sourceLabel: string;
    aiNote: string;
    quizTitle: string;
    quizSubtitle: string;
    correct: string;
    wrong: string;
    scoreLine: string; // "You scored {0} / {1}"
    streakDone: string;
    mistakesTitle: string;
    correctAnswerLabel: string;
  };
  channelDigest: {
    switchNews: string;
    switchChannels: string;
    subtitle: string;
    addPlaceholder: string;
    addButton: string;
    adding: string;
    limitReached: string; // "You can add up to {0} channels."
    noChannels: string;
    removeAria: string; // "Remove {0}"
    dayLabel: string; // "Yesterday ({0}) — every video, 12 AM to 12 AM"
    loading: string;
    retry: string;
    noVideos: string;
    progress: string; // "Covered {0} of {1} videos"
    summarising: string;
    videoFailed: string;
    retryFailed: string; // "Retry {0} failed"
    videosTitle: string;
    noTranscript: string;
    watch: string;
    tabs: { all: string; national: string; international: string; economy: string; sports: string; scitech: string; other: string };
    aiNote: string;
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
      subtitle: '',
      startCta: 'Start →',
      dashboardCta: 'Dashboard →',
      steps: [
        {
          icon: '',
          title: '1. Tell us who you are',
          description:
            'A short onboarding captures your role, goal, preferred language, and your name.',
        },
        {
          icon: '',
          title: '2. Get a personalized roadmap',
          description:
            'Instead of a generic course list, you get a topic sequence built around your goal — with a "WHY layer" explaining why each topic matters, and exam-weightage badges when you\'re prepping for something specific like JEE or board exams.',
        },
        {
          icon: '',
          title: '3. Video Intel',
          description:
            'Pick from curated videos per topic or lock in your own. Deep Notes analyzes the transcript into a structured, section-by-section breakdown so you don\'t have to re-watch to remember what mattered.',
        },
        {
          icon: '',
          title: '4. Notes',
          description:
            'Auto-generated notes from what you actually watched — human-style writing, not a wall of AI bullet points.',
        },
        {
          icon: '',
          title: '5. Revision Engine',
          description:
            'Spaced repetition on a proven schedule (Day 1, 3, 7, 15, 30, 60) so what you learn actually sticks instead of fading in a week.',
        },
        {
          icon: '',
          title: '6. AI Mentor',
          description:
            'Stuck on something? Chat with a mentor that explains in a respectful, patient tone and adapts to how you talk.',
        },
        {
          icon: '',
          title: '7. Research',
          description:
            'Go deeper on any topic with an AI-assisted research and deep-dive tool when the roadmap isn\'t enough.',
        },
        {
          icon: '',
          title: '8. Progress',
          description:
            'Real numbers from your real activity — completion %, streak, watch time, retention, and a mastery heatmap that shows exactly where you\'re weak.',
        },
        {
          icon: '',
          title: '9. Test',
          description:
            'NTA/JEE-style exam mode with a timer and question palette. Build tests by hand, bulk-paste questions, or import from photos/PDFs of your textbook — AI is used only to read the photos/PDFs.',
        },
        {
          icon: '',
          title: '10. Dictionary',
          description:
            'Instant word lookup with pronunciation, built right into the app so you never have to leave to check a meaning.',
        },
      ],
    },
    onboarding: {
      stepTitles: [
        { title: 'Who are you?', subtitle: '' },
        { title: 'Your goal?', subtitle: '' },
        { title: 'Language', subtitle: '' },
        { title: 'Your name', subtitle: '' },
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
      namePlaceholder: '',
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
        dictionary: 'Dictionary',
        test: 'Test',
        currentAffairs: 'Current Affairs',
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
            content: '',
          },
          {
            title: 'Revision',
            content: '',
          },
          {
            title: 'Progress',
            content: '',
          },
          {
            title: 'Settings',
            content: '',
          },
        ],
        videoPickerIntro: [
          {
            title: 'These 3 videos — same topic',
            content: '',
          },
          {
            title: 'Different style, same concept',
            content: '',
          },
        ],
      },
      checklist: {
        heading: 'Get Started',
        subheading: '',
        steps: [
          {
            title: 'Set your learning style',
            subtitle: '',
            cta: 'Start',
          },
          {
            title: 'Build your roadmap',
            subtitle: '',
            cta: 'Generate',
          },
          {
            title: 'Watch your first video',
            subtitle: '',
            cta: 'Watch',
          },
        ],
      },
      home: {
        revisionBanner: {
          overdueTitle: '{0} topics need revision — {1} overdue!',
          dueTitle: '{0} topics to revise today',
          subtitle: '',
        },
        learnerFallback: 'Learner',
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
          subtitleReady: '',
          subtitleNotReady: '',
          detailReady: '',
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
        hint: '',
        regenerateCta: 'Regenerate Roadmap',
        regeneratingCta: 'Regenerating...',
        successMsg: 'New roadmap generated.',
        errorMsg: 'Something went wrong, try again.',
      },
      learningProfileSection: {
        label: 'Learning Profile Report',
        hint: '',
        hintBubble: '',
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
      accountSection: {
        label: 'Account',
        signedInAs: 'Signed in as {0}',
        signOutCta: 'Sign Out',
      },
    },
    customPlaylistModal: {
      title: 'Custom Playlist',
      topicLabel: 'Topic',
      topicPlaceholder: 'e.g., Django basics',
      hoursLabel: 'Hours / week',
      deadlineLabel: 'Deadline',
      quickLabel: 'Quick:',
      loadingCta: 'Finding videos...',
      noProfileHint: '',
      generateCta: 'Generate',
      generatingCta: 'Generating...',
    },
    learningQuiz: {
      assessmentLabel: 'Learning Style Assessment',
      quickCheckBadge: 'Quick check',
      lastOneBadge: 'Last one',
      hintText: 'Answer honestly — this shapes which videos we pick for you.',
      honestNote: 'No answer is wrong — just be honest.',
      questions: [
        {
          id: 'q1_pace',
          prompt: 'You need to learn a new topic in one hour for an exam. Which video would you pick?',
          options: [
            { key: 'A', text: 'A medium-length video that gives some context, then the core points' },
            { key: 'B', text: "A detailed 45-min video — explains everything, but you might not get time to finish it" },
            { key: 'C', text: "A fast 15-min video — straight to the core points, but no clarity if a doubt comes up" },
            { key: 'D', text: 'A short written summary instead of a video — quick to finish' },
          ],
        },
        {
          id: 'q2_theory_practical',
          prompt: 'Which teacher would you pick to learn a new concept?',
          options: [
            { key: 'A', text: 'A bit of theory, then straight into an example — a mix of both' },
            { key: 'B', text: 'Gives you the formula/method directly — you start working right away, figure out the "why" yourself' },
            { key: 'C', text: 'Explains the full "why" first — you\u2019ll feel confident, but it\u2019ll take longer to start' },
            { key: 'D', text: 'Only gives practice problems, no explanation — learn by trial and error' },
          ],
        },
        {
          id: 'q3_structure',
          prompt: 'You need to pick content for a group study session.',
          options: [
            { key: 'A', text: 'A fixed-order playlist — everyone follows the same sequence, no flexibility' },
            { key: 'B', text: 'A loose roadmap — the topic order is somewhat flexible' },
            { key: 'C', text: 'Just a playlist — watch whatever looks interesting first, no fixed order' },
            { key: 'D', text: 'Nothing organized at all — wherever curiosity takes you' },
          ],
        },
        {
          id: 'q4_language',
          prompt: 'Two teachers are available for the same topic.',
          options: [
            { key: 'A', text: 'Completely simple, everyday language — no technical terms' },
            { key: 'B', text: 'Technical/precise language — exact, but takes extra effort to follow' },
            { key: 'C', text: 'Simple language, but occasionally a technical term comes up (explained)' },
            { key: 'D', text: 'Jargon-heavy, professional/industry language, with less explanation' },
          ],
        },
        {
          id: 'q5_repetition',
          prompt: 'Choose a revision strategy before an exam.',
          options: [
            { key: 'A', text: "Never touch a topic again once you've seen it, unless there's a specific doubt" },
            { key: 'B', text: "Fewer new topics — revise what you've seen 2-3 times to lock it in" },
            { key: 'C', text: "Cover more new topics — don't repeat what you've already seen once" },
            { key: 'D', text: 'Revise every topic many times, even if it means missing new topics' },
          ],
        },
        {
          id: 'q6_depth',
          prompt: 'You\u2019ve understood "what" to do for a concept. The teacher asks — move on, or go into the "why" part first?',
          options: [
            { key: 'A', text: 'See a bit of the "why", then move on' },
            { key: 'B', text: 'Move on — it\u2019s working, look at "why" later' },
            { key: 'C', text: "Don't want to move on until the root cause is understood" },
            { key: 'D', text: 'Not interested in "why", just want the result quickly' },
          ],
        },
        {
          id: 'q7_storytelling',
          prompt: 'A concept can be explained in two ways.',
          options: [
            { key: 'A', text: 'Through a story/case-study — the concept reveals itself gradually' },
            { key: 'B', text: 'With a short real-life example, straight to the point' },
            { key: 'C', text: 'With an analogy/story that also has an emotional connection' },
            { key: 'D', text: 'Straight to the definition and formula — direct, no extra talk' },
          ],
        },
        {
          id: 'q8_prior_knowledge',
          prompt: 'You\u2019re starting a completely new subject you know nothing about.',
          options: [
            { key: 'A', text: 'I need a bit of basic background first — not completely from zero' },
            { key: 'B', text: 'I usually already know something related that I can connect it to' },
            { key: 'C', text: 'Starting from zero feels comfortable — no rush' },
            { key: 'D', text: 'There\u2019s usually some overlap with prior knowledge, even in new subjects' },
          ],
        },
        {
          id: 'q9_pace_check',
          prompt: 'Two online courses are available for the same topic — both give the same result.',
          options: [
            { key: 'A', text: 'Course B — 2 months, thorough — being thorough matters more' },
            { key: 'B', text: 'Course A — 2 weeks, fast — need to finish it quickly' },
            { key: 'C', text: 'Want something in between — not too fast, not too slow' },
            { key: 'D', text: 'Either works, as long as the content is good' },
          ],
        },
        {
          id: 'q10_repetition_check',
          prompt: 'You got a quiz question wrong on a concept you thought you had "understood".',
          options: [
            { key: 'A', text: 'Need to stop and go through the whole concept again' },
            { key: 'B', text: 'It was just one mistake, moving on' },
            { key: 'C', text: 'Will only revisit that specific part, not the whole thing' },
            { key: 'D', text: "Will ask someone, won't go back and review it myself" },
          ],
        },
        {
          id: 'q11_language_check',
          prompt: 'While reading an article, a new technical term comes up whose meaning can be guessed from context.',
          options: [
            { key: 'A', text: 'Think a bit and guess, then try to confirm it' },
            { key: 'B', text: 'Guess and move on — flow matters' },
            { key: 'C', text: 'Stop and look up the exact meaning first' },
            { key: 'D', text: 'Skip that article, look for another source' },
          ],
        },
      ],
      honestyQuestion: {
        prompt: 'While filling out this quiz, did you think about "which answer will make me look like a more serious/advanced learner"?',
        options: [
          { value: 'A', label: 'No, I chose whatever I actually felt' },
          { value: 'B', label: 'Thought about it a little, but was mostly honest' },
          { value: 'C', label: 'Yes, it was somewhat on my mind' },
          { value: 'D', label: "Don't want to answer" },
        ],
      },
    },
    blueprintInterview: {
      headerTitle: 'AI Blueprint Interview',
      progress: { complete: 'Complete!', analyzing: 'Analyzing your answers...', questionOf: 'Question {0} / {1}' },
      backCta: '← Previous question',
      analyzingText: 'Deeply analyzing your answers...',
      resultSection: {
        mindMapTitle: 'Your Mind Map',
        mindScoreLabel: 'Mind Score',
        reportTitle: 'Your Learning Blueprint',
      },
      errorRetryCta: 'Try again',
      genericError: 'Analysis failed.',
      doneCta: 'Done',
      dimensionLabels: {
        pace: 'Pace',
        practical: 'Practical',
        structure: 'Structure',
        depth: 'Depth',
        language: 'Language',
        storytelling: 'Storytelling',
        repetition: 'Repetition',
        priorKnowledge: 'Prior Knowledge',
      },
      questions: [
        {
          id: 'q1',
          text: 'You need to learn a completely new skill — what do you naturally do first?',
          options: [
            { key: 'A', text: 'I look for the best video or resource — a visual explanation makes it click right away' },
            { key: 'B', text: 'I dive straight into a small task — things become clear as I do it' },
            { key: 'C', text: 'I understand the full structure first — moving systematically feels better' },
            { key: 'D', text: "I talk to someone experienced — what you learn from real experience isn't in books" },
          ],
        },
        {
          id: 'q2',
          text: "Despite a lot of effort, the result wasn't what you expected — what do you do?",
          options: [
            { key: 'A', text: 'I analyze deeply — I look for the exact point where something was missed' },
            { key: 'B', text: 'I take a bit of space — coming back with a clear mind is more effective' },
            { key: 'C', text: 'I immediately try a different approach — keeping momentum matters' },
            { key: 'D', text: 'I talk to someone I trust — an outside perspective helps' },
          ],
        },
        {
          id: 'q3',
          text: "While studying a topic, you come across something that won't be directly useful — what do you do?",
          options: [
            { key: 'A', text: "I stop and understand it — moving ahead with incomplete understanding doesn't suit me" },
            { key: 'B', text: "I note it down — I'll come back to it when it's relevant" },
            { key: 'C', text: 'I start exploring it more deeply — curiosity takes me there' },
            { key: 'D', text: "I keep the focus on the goal — whatever's directly useful comes first" },
          ],
        },
        {
          id: 'q4',
          text: 'You need to make an important decision and the information is incomplete — you?',
          options: [
            { key: 'A', text: 'I gather more data first — an informed decision is better' },
            { key: 'B', text: 'I look at past patterns — what similar situations suggested' },
            { key: 'C', text: 'I decide with the best available information — the perfect moment never comes' },
            { key: 'D', text: "I get a trusted person's perspective — it covers my blind spots" },
          ],
        },
        {
          id: 'q5',
          text: "You can't understand a complex concept — which approach works for you?",
          options: [
            { key: 'A', text: 'I connect it to real life — "it\u2019s just like..." makes things click' },
            { key: 'B', text: 'I make a visual flow — seeing it as a diagram makes it clear' },
            { key: 'C', text: 'I experiment myself — the theory settles in after being hands-on' },
            { key: 'D', text: 'I read it multiple times — repetition brings deep clarity' },
          ],
        },
        {
          id: 'q6',
          text: "You're studying a deep topic for 2 hours — what naturally happens after 45 minutes?",
          options: [
            { key: 'A', text: "I'm in the flow — staying focused comes naturally, I lose track of time" },
            { key: 'B', text: 'I take a short mental break — I come back recharged, productivity stays better' },
            { key: 'C', text: 'I switch topics — variety keeps my energy up' },
            { key: 'D', text: "I've already made good progress — I work at an efficient pace" },
          ],
        },
        {
          id: 'q7',
          text: "What's the ideal format for learning something new, for you?",
          options: [
            { key: 'A', text: 'Focused short videos — concise, to the point, respects my time' },
            { key: 'B', text: 'A detailed, comprehensive video — getting the full picture in one place feels better' },
            { key: 'C', text: 'Written content — reading at my own pace is more effective for me' },
            { key: 'D', text: 'Project-based learning — learning by building directly feels natural' },
          ],
        },
        {
          id: 'q8',
          text: 'A teacher in a video uses technical jargon without explaining it — what do you do?',
          options: [
            {
              key: 'A',
              text: "I immediately pause and look up the word's meaning — moving ahead without understanding doesn't feel right",
            },
            { key: 'B', text: "I figure out the meaning from context and keep going — jargon isn't a problem" },
            { key: 'C', text: 'I find a simpler resource that explains it in easy language' },
            { key: 'D', text: 'I note down those words and clarify all of them together later' },
          ],
        },
        {
          id: 'q9',
          text: 'Someone explained a new concept to you through a real-life story or analogy — how does that feel?',
          options: [
            { key: 'A', text: 'Very helpful — the story makes the concept stick forever' },
            { key: 'B', text: 'Somewhat helpful, but I prefer a direct technical/clear definition' },
            { key: 'C', text: "Depends — it only helps if the story is genuinely relevant, otherwise it feels like a waste of time" },
            { key: 'D', text: 'The story stays in memory but not the actual concept — so I avoid these' },
          ],
        },
        {
          id: 'q10',
          text: 'A week after learning a difficult concept, how often do you naturally revise it?',
          options: [
            { key: 'A', text: "Once I've understood it well, I don't need to revisit it" },
            { key: 'B', text: 'I definitely revise 2-3 times, only then confidence comes' },
            { key: 'C', text: 'I only revise when I actually need to use it, otherwise not' },
            { key: 'D', text: 'I make notes and glance at them from time to time' },
          ],
        },
        {
          id: 'q11',
          text: "When starting a new topic, if it's related to something you already know — what do you do?",
          options: [
            { key: 'A', text: 'I connect it right away — "this is just like that" — makes the new thing easier to learn' },
            { key: 'B', text: 'I set aside the old knowledge and start completely fresh, to avoid confusion' },
            { key: 'C', text: "I connect a little but don't depend on it too much — case by case" },
            { key: 'D', text: "I need to revise the old concept first, otherwise the new one doesn't make sense" },
          ],
        },
      ],
    },
    blueprintVerdicts: {
      pace: {
        high: "You're a fast-paced learner — you skim long content and grasp the essence quickly.",
        mid: 'Your pace is balanced — not too slow, not too fast.',
        low: 'You need thorough, slow-paced content — things get missed when rushed.',
      },
      theoryVsPractical: {
        high: 'You learn hands-on — doing first, then understanding, is your style.',
        mid: 'A mix of theory and practical works for you.',
        low: 'You need solid theory first — confidence in practice comes only after that.',
      },
      structureNeed: {
        high: 'You need clear, step-by-step structure — flexible/random content confuses you.',
        mid: "A bit of structure helps, but full rigidity isn't necessary.",
        low: "You're a flexible learner — you don't need much structure.",
      },
      depth: {
        high: "You like getting to the root cause — surface-level explanations don't satisfy you.",
        mid: 'You go into depth when needed, not always.',
        low: 'Surface-level understanding is enough for you — deep-diving slows your pace.',
      },
      languageComplexity: {
        high: "Technical jargon isn't a problem for you — you're comfortable with complex vocabulary.",
        mid: 'Some jargon is fine, but too much technical language can confuse you.',
        low: 'You need things explained in simple, everyday language — you keep your distance from jargon.',
      },
      storytelling: {
        high: 'Real-life stories and analogies make concepts stick permanently in your mind.',
        mid: "Stories help, but aren't necessary everywhere.",
        low: 'You prefer direct, to-the-point explanations — stories can distract you.',
      },
      repetitionNeed: {
        high: "You need multiple revisions for deep clarity — reading once isn't enough.",
        mid: "A bit of revision helps, but you don't need much.",
        low: 'Once you understand something, you rarely need to revise it again.',
      },
      priorKnowledgeComfort: {
        high: 'You learn quickly by connecting new topics to what you already know.',
        mid: 'You sometimes connect to prior knowledge, not always.',
        low: "You prefer a fresh start — connecting to prior knowledge doesn't feel necessary to you.",
      },
    },
    authErrors: {
      sessionExpired: "Couldn't find your session, please sign in again.",
      emailAlreadyInUse: 'This email is already registered — please sign in.',
      weakPassword: 'Password must be at least 6 characters.',
      invalidEmail: "That email isn't in a valid format.",
      wrongPassword: 'Incorrect password.',
      userNotFound: "This email isn't registered.",
      operationNotAllowed: "Email/Password sign-in isn't enabled in the Firebase Console.",
      unauthorizedDomain: "This website domain isn't authorized in the Firebase Console.",
      popupBlocked: 'Your browser blocked the popup — allow popups and try again.',
      popupClosedByUser: 'The Google popup was closed before sign-in completed.',
      genericAuthError: 'Something went wrong, please try again.',
    },
    authScreen: {
      signOutBtn: 'Sign out ({0})',
      subtitleCreate: 'Create a new account',
      subtitleSignin: 'Sign in to your account',
      namePlaceholder: 'Name',
      emailPlaceholder: 'Email',
      passwordPlaceholder: 'Password',
      createAccountCta: 'Create Account',
      signInCta: 'Sign In',
      orDivider: 'OR',
      googleCta: 'Continue with Google',
      switchToSignin: 'Already have an account? Sign in',
      switchToCreate: 'New user? Create an account',
      validationEmailPassword: 'Enter a valid email and a password of at least 6 characters.',
      validationName: 'Enter your name.',
    },
    authPrompt: {
      signInButton: 'Sign in',
      guestTitle: 'Create your free account',
      featureTitle: 'Sign in to use {0}',
      subtitle: 'It takes a few seconds. Everything you did as a guest is kept.',
      notNow: 'Not now',
      lockedTitle: 'Sign in to continue',
      lockedBody: '{0} needs a free account. Your Mind Blueprint, video searches and everything else you did as a guest will be kept.',
      lockedCta: 'Sign in or create account',
      roadmapPending: 'Your roadmap will be created as soon as you sign in.',
      guestBadge: 'Guest',
      guestAccountNote: "You're using Learning OS as a guest. Sign in to unlock roadmap, notes, tests, mentor and more.",
    },
    errorBoundary: {
      title: 'Something went wrong',
      body: "The app ran into an error. Try reloading — if the problem persists, clear local data and reload (your progress/roadmap won't come back, so try just reloading first).",
      reloadCta: 'Reload',
      clearDataCta: 'Clear local data and reload',
    },
    deepDiveChat: {
      badge: 'Deep Dive · Optional',
      questionOf: '{0} / {1}',
      answerPlaceholder: 'Type your answer here...',
      submitCta: 'Submit',
      nextCta: 'Next',
      processingText: 'Updating your profile...',
      closeCta: 'Close',
      errors: {
        noResponse: "Couldn't understand the response, try again or skip.",
        noProfile: 'Complete the quiz first.',
        generic: 'Something went wrong.',
      },
    },
    deepDiveQuestions: [
      'Tell us about a recent topic that was hard to understand — what exactly was the problem?',
      'When a concept "clicks" well for you, what does that moment feel like? Give an example.',
      "If you had to start a completely new subject tomorrow that you know nothing about — what would your very first step be?",
    ],
    tasteOnboarding: {
      badge: 'Video Taste · Alternative to quiz',
      formTitle: 'Learning Profile',
      formSubtitle: '',
      urlPlaceholder: 'https://youtube.com/watch?v=...',
      watchedCheckbox: "I've watched this video in full",
      linkNotRecognized: "(couldn't recognize this link)",
      addAnotherCta: '+ Add another video',
      analyzeCta: 'Analyze {0} Videos',
      validationHint: '',
      analyzingText: 'Analyzing videos — this will take a moment...',
      videoFallbackLabel: 'Video {0}',
      doneTitle: 'Profile updated',
      doneSubtitle: 'Built from analyzing {0} video{1}',
      doneCta: 'Done',
      retryCta: 'Try Again',
      errors: { noneAnalyzed: "Couldn't analyze any videos. Check the links and try again." },
    },
    revisionTasks: {
      day1: 'Deep read it — understand WHY, not just WHAT',
      day3: 'Apply it to 3-4 different real examples',
      day7: 'Teach it to someone — without looking at notes',
      day15: 'Find advanced applications and edge cases',
      day30: 'Connect it to related concepts, spot the pattern',
      day60: 'Final recall check — explain it fully without looking',
      fallback: 'Revise this topic',
    },
    roadmap: {
      header: { title: 'Your Roadmap', subtitle: '' },
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
      noActiveGoal: 'No active goal.',
      generateForm: {
        label: 'What do you want to learn?',
        placeholder: 'What do you want to learn?',
        generateCta: 'Generate Roadmap',
        generatingCta: 'Generating roadmap...',
        examLabel: 'For a specific exam/board?',
        examOptional: '(optional)',
        examPlaceholder: 'e.g. CBSE Class 10, JEE, NEET — leave blank for general learning',
        examHint: '',
        weeklyTimeLabel: 'Weekly time available',
        weeklyTimeHint: '',
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
        bridgeHint: '',
        deepDiveCta: '2 quick questions? Get better matched videos (optional)',
        watchVideosCta: 'Watch videos',
        searchingCta: 'Searching...',
        savedVideoCta: 'Saved video',
        markCompleteCta: 'I already know this — mark as complete',
        challengeTitle: '',
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
        doneLabel: 'Done',
        doneCta: 'Done',
        reviewNowCta: 'Review Now',
        reviewingCta: 'Reviewing…',
      },
      emptyState: {
        noRevisionTitle: 'No revisions yet',
        noRevisionBody: '' ,
        allCaughtUpTitle: 'All caught up!',
        allCaughtUpBody: 'No items in this category right now.',
      },
    },
    notebook: {
      tabNotebook: "My notebook",
      tabAi: "AI notes",
      searchPlaceholder: "Search title, tags or text...",
      newNote: "New note",
      newFolder: "New folder",
      untitled: "Untitled note",
      folders: "Folders",
      viewAll: "All notes",
      viewFavorites: "Favorites",
      viewArchive: "Archive",
      viewTrash: "Trash",
      sortRecent: "Recently edited",
      sortCreated: "Newest created",
      sortTitle: "Title A-Z",
      allTags: "All tags",
      emptyTitle: "Your notebook is empty",
      emptySubtitle: "",
      emptySearch: "No notes match your search.",
      emptyTrash: "Trash is empty.",
      emptyArchive: "No archived notes.",
      emptyFavorites: "No favorite notes yet.",
      emptyFolder: "This folder has no notes yet.",
      pages: "pages",
      edited: "Edited",
      rename: "Rename",
      duplicate: "Duplicate",
      move: "Move to folder",
      pin: "Pin",
      unpin: "Unpin",
      favorite: "Add to favorites",
      unfavorite: "Remove from favorites",
      archive: "Archive",
      unarchive: "Unarchive",
      editTags: "Edit tags",
      moveToTrash: "Move to trash",
      restore: "Restore",
      deleteForever: "Delete forever",
      emptyTrashBtn: "Empty trash",
      select: "Select",
      selected: "{0} selected",
      cancel: "Cancel",
      moveHere: "Move here",
      rootFolder: "No folder (top level)",
      moveTitle: "Move to...",
      newSubfolder: "New subfolder",
      renameFolder: "Rename folder",
      deleteFolder: "Delete folder",
      folderNamePrompt: "Folder name",
      renameFolderPrompt: "New folder name",
      renamePrompt: "Note title",
      tagsPrompt: "Tags, separated by commas",
      confirmDeleteForever: "Delete permanently? This cannot be undone.",
      confirmEmptyTrash: "Permanently delete everything in the trash? This cannot be undone.",
      confirmDeleteFolderWithNotes: "This folder has {0} note(s). They will not be deleted - they move up one level. Delete the folder?",
      confirmDeleteFolder: "Delete this folder?",
      trashInfo: "Notes in the trash are removed after 30 days.",
      undo: "Undo",
      toastTrashed: "Moved to trash",
      toastMoved: "Moved",
      toastArchived: "Archived",
      toastUnarchived: "Unarchived",
      toastRestored: "Restored",
      toastDuplicated: "Duplicated",
      toastFolderDeleted: "Folder deleted",
      saving: "Saving...",
      saved: "Saved",
      savedLocal: "Saved on this device - not synced yet",
      offline: "Offline - saved on this device",
      saveError: "Could not save - storage is full or blocked",
      syncNow: "Sync now",
      study: {
        statusNotStarted: "Not started",
        statusLearning: "Learning",
        statusNeedsRevision: "Needs revision",
        statusMastered: "Mastered",
        statusLabel: "Study status",
        confidenceLabel: "How confident are you?",
        confidenceNone: "Not rated",
        examDateLabel: "Exam date",
        clearDate: "Clear date",
        details: "Study details",
        save: "Save",
        filterAll: "All statuses",
        filterExamSoon: "Exam within 2 weeks",
        sortExam: "Exam date (soonest)",
        examToday: "Exam today",
        examTomorrow: "Exam tomorrow",
        examInDays: "Exam in {0} days",
        examPast: "Exam was {0} day(s) ago",
        confidenceShort: "Confidence {0}/5",
      },
      pageOps: {
        deleteConfirm: "Delete page {0}? Its text and handwriting will be removed. You can undo this right after.",
        deleteBtn: "Delete page",
        needOnePage: "A note needs at least one page.",
        toastDeleted: "Page deleted",
        moveUp: "Move page up",
        moveDown: "Move page down",
        bookmark: "Bookmark this page",
        removeBookmark: "Remove bookmark",
        pageOf: "Page {0} of {1}",
        duplicatePage: "Duplicate page",
        addPageAfter: "Add page after this",
        panelTitle: "Pages",
        panelAdd: "Add page",
        template: "Template",
        paper: "Paper",
        collapsePanel: "Hide pages panel",
        expandPanel: "Show pages panel",
        tplBlank: "Blank",
        tplRuled: "Ruled",
        tplDotted: "Dotted",
        tplGrid: "Grid",
        tplCornell: "Cornell",
        zoomIn: "Zoom in",
        zoomOut: "Zoom out",
        zoomFit: "Fit",
        pagesButton: "Pages",
        closePanel: "Close",
      },
      ink: {
        modeType: "Type",
        modePen: "Pen",
        modeHighlighter: "Highlighter",
        modeEraser: "Eraser",
        penBallpoint: "Ballpoint",
        penFountain: "Fountain pen",
        penFelt: "Felt tip",
        penPencil: "Pencil",
        penBrush: "Brush",
        penCalligraphy: "Calligraphy",
        penFineliner: "Fine liner",
        penMarker: "Marker",
        penDotted: "Dotted line",
        penType: "Pen type",
        color: "Colour",
        colorAuto: "Black / white (follows theme)",
        customColor: "Custom colour",
        recentColors: "Recent colours",
        thickness: "Thickness",
        smoothing: "Smoothing",
        favorites: "Favourite pens",
        saveFavorite: "Save this pen as a favourite",
        removeFavorite: "Remove favourite",
        fingerDraw: "Draw with finger",
        fingerDrawOn: "Finger draws",
        fingerDrawOff: "Finger scrolls",
        more: "More",
        resetPen: "Reset pen settings",
        eraserStroke: "Whole stroke",
        eraserArea: "Part of stroke",
        targetAll: "Everything",
        targetInk: "Pen only",
        targetHl: "Highlights only",
        eraserSize: "Eraser size",
        eraseAll: "Erase whole page",
        eraseAllConfirm: "Erase all handwriting on this page? You can undo this.",
        undo: "Undo drawing",
        redo: "Redo drawing",
        modeSelect: "Select",
        selLasso: "Lasso",
        selRect: "Rectangle",
        selAll: "Select all",
        selHint: "",
        selCount: "{0} selected",
        selDelete: "Delete",
        selCopy: "Copy",
        selCut: "Cut",
        selPaste: "Paste",
        selDuplicate: "Duplicate",
        selColor: "Change colour",
        selWidth: "Change thickness",
        selFront: "Bring to front",
        selBack: "Send to back",
        selNeaten: "Make shapes neat",
        selNeatNone: "No lines or shapes found to neaten.",
        selToText: "Handwriting to text",
        shapeSnap: "Hold still to snap shapes",
        ocrConsent: "To read your handwriting, a picture of the selected strokes is sent to an AI service. Your handwriting is not changed. Continue?",
        ocrTitle: "Handwriting as text",
        ocrLoading: "Reading your handwriting...",
        ocrError: "Could not read the handwriting. Try again or select less.",
        ocrEmpty: "No writing was found in the selection.",
        ocrLowConf: "Some words may be wrong ([?] means unreadable)." ,
        ocrEdit: "",
        ocrInsert: "Insert as text",
        ocrInsertDelete: "Insert and remove handwriting",
        ocrCancel: "Cancel",
      },
      editor: {
        back: "Back to notes",
        titlePlaceholder: "Title",
        bodyPlaceholder: "Start writing...",
        addPage: "Add page",
        pageLabel: "Page",
        loadError: "Could not open this note.",
        undo: "Undo",
        redo: "Redo",
        normalText: "Normal text",
        heading1: "Heading 1",
        heading2: "Heading 2",
        heading3: "Heading 3",
        bold: "Bold",
        italic: "Italic",
        underline: "Underline",
        strike: "Strikethrough",
        textColor: "Text colour",
        resetColor: "Default colour",
        highlight: "Highlight",
        removeHighlight: "Remove highlight",
        superscript: "Superscript",
        subscript: "Subscript",
        bulletList: "Bulleted list",
        numberedList: "Numbered list",
        checklist: "Checklist",
        quote: "Quote",
        codeBlock: "Code block",
        inlineCode: "Inline code",
        link: "Link",
        linkPrompt: "Link address (https://...)",
        removeLink: "Remove link",
        table: "Insert table",
        addRow: "Add row",
        addColumn: "Add column",
        deleteRow: "Delete row",
        deleteColumn: "Delete column",
        deleteTable: "Delete table",
        divider: "Divider",
        alignLeft: "Align left",
        alignCenter: "Align centre",
        alignRight: "Align right",
        clearFormat: "Clear formatting",
        fontSize: "Text size",
        sizeSmall: "Small",
        sizeNormal: "Normal",
        sizeLarge: "Large",
        sizeHuge: "Huge",
        find: "Find and replace",
        findPlaceholder: "Find...",
        replacePlaceholder: "Replace with...",
        replace: "Replace",
        replaceAll: "Replace all",
        noMatches: "No matches",
        matchCount: "{0} of {1}",
        next: "Next",
        prev: "Previous",
        close: "Close",
        words: "{0} words",
        chars: "{0} characters",
        readTime: "{0} min read",
        focusMode: "Focus mode",
        exitFocus: "Exit focus mode",
        readAloud: "Read aloud",
        stopReading: "Stop reading",
        shortcuts: "Keyboard shortcuts",
        shortcutsTitle: "Shortcuts",
        pageHint: "Page",
      },
    },
    notes: {
      header: { title: 'Deep Learning Notes', subtitle: '' },
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
      sourceVideoLink: 'Watch source video',
      transcriptSourceNote: 'Notes generated from the video transcript',
      metadataSourceNote: 'Transcript wasn\u2019t available — generated from title/description only',
      emptyState: {
        title: 'No notes yet',
        subtitle: '',
      },
    },
    videos: {
      header: { title: 'Videos', subtitle: '' },
      searchPlaceholder: 'Search videos...',
      searchCta: 'Search',
      noResultsYet: 'No results yet',
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
      selectVideoPrompt: '',
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
      header: { title: 'AI Mentor', subtitle: '' },
      welcomeMessage: "Hi! What are we learning today?", 
      suggestedPrompts: [
        { icon: '', label: 'Explain simply', prompt: 'Explain this concept simply' },
        { icon: '', label: 'Deep dive', prompt: 'Explain this in depth with examples' },
        { icon: '', label: 'Real analogy', prompt: 'Give me a real-world analogy' },
        { icon: '', label: 'Quiz me', prompt: 'Generate a quiz on this topic' },
        { icon: '', label: 'Project idea', prompt: 'Suggest a mini project' },
        { icon: '', label: 'Find mistake', prompt: 'What are common mistakes?' },
      ],
      youLabel: 'You',
      mentorLabel: 'Mentor',
      inputPlaceholder: 'Ask anything...',
      sendCta: 'Send',
      errors: {
        generic: 'Something went wrong ({0}). Please try again in a bit.',
        noResponse: "Couldn't get a response, please try again.",
        truncatedSuffix:
          '\n\n_( The response was long and got cut off — try asking a shorter question instead of "Deep dive")_',
        network: 'A network error occurred. Please check your internet and try again.',
      },
    },
    progress: {
      header: { title: 'Progress', subtitle: '' },
      stats: { completion: 'Completion', streak: 'Streak', totalWatchTime: 'Total Watch Time', retention: 'Retention' },
      completionBar: { topicsDone: '{0}/{1} topics done', inProgress: '{0} in progress' },
      emptyState: {
        title: 'Nothing to track yet',
        body: '',
      },
      timeTracking: { title: 'Time Tracking', last7Days: 'Last 7 days: {0} min' },
      masteryHeatmap: { title: 'Mastery Heatmap', legendWeak: 'Weak', legendOk: 'OK', legendStrong: 'Strong' },
      retentionDetail: { title: 'Retention', dueToday: 'Due Today', overdue: 'Overdue', mastered: 'Mastered' },
      weakAreas: { title: 'Weak Areas', noneFound: 'No weak topics found — everything is going well.' },
    },
    research: {
      header: { title: 'Research', subtitle: '' },
      searchPlaceholder: 'What do you want to know?',
      searchCta: 'Search',
      notGroundedNote:
        "Couldn't find a live search source this time — the answer below is from general knowledge, double-check it for anything current",
      genericError: 'Research failed',
      embedded: { title: 'Research (alongside the video)', hint: '' },
      closeAria: 'Close research panel',
      emptyState: { title: 'No results yet', subtitle: '' },
    },
    currentAffairs: {
      title: 'Current Affairs',
      subtitle: "Today's key news for competitive exams, in short points",
      streak: '{0}-day streak',
      previousDays: 'Previous days',
      today: 'Today',
      loading: "Preparing today's Current Affairs…",
      retry: 'Try again',
      dayNotAvailable: 'This day is not available.',
      tabs: { all: 'All', national: 'National', international: 'International', economy: 'Economy', sports: 'Sports', scitech: 'Sci & Tech' },
      sourceLabel: 'Source',
      aiNote: 'Summarised from public news by AI. For anything important, check the original source.',
      quizTitle: 'Quick quiz',
      quizSubtitle: '5 questions from today\'s points',
      correct: 'Correct!',
      wrong: 'Not quite.',
      scoreLine: 'You scored {0} / {1}',
      streakDone: "Today's Current Affairs done",
      mistakesTitle: 'Questions you missed',
      correctAnswerLabel: 'Correct answer',
    },
    channelDigest: {
      switchNews: 'Newspapers',
      switchChannels: 'YouTube channels',
      subtitle: "What your channels reported yesterday, video by video and topic by topic",
      addPlaceholder: 'Channel link, @handle or name',
      addButton: 'Add channel',
      adding: 'Adding…',
      limitReached: 'You can add up to {0} channels.',
      noChannels: "",
      removeAria: 'Remove {0}',
      dayLabel: 'Yesterday ({0}) — every video, 12 AM to 12 AM',
      loading: "Finding yesterday's videos…",
      retry: 'Try again',
      noVideos: 'This channel did not post any videos yesterday.',
      progress: 'Covered {0} of {1} videos',
      summarising: 'Summarising…',
      videoFailed: "Couldn't summarise this video.",
      retryFailed: 'Retry {0} failed',
      videosTitle: 'Videos',
      noTranscript: 'Summarised from title and description only — no transcript was available.',
      watch: 'Watch',
      tabs: { all: 'All', national: 'National', international: 'International', economy: 'Economy', sports: 'Sports', scitech: 'Sci & Tech', other: 'Other' },
      aiNote: 'Written by AI from the channel\'s own videos. It shows what the channel said, not verified facts — check the video for anything important.',
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
      subtitle: 'Learning OS जो कुछ भी करता है, एक ही जगह',
      startCta: 'शुरू करें →',
      dashboardCta: 'डैशबोर्ड →',
      steps: [
        {
          icon: '',
          title: '1. हमें बताएं आप कौन हैं',
          description:
            'एक छोटा ऑनबोर्डिंग आपकी भूमिका, लक्ष्य, पसंदीदा भाषा और नाम पूछता है।',
        },
        {
          icon: '',
          title: '2. अपने हिसाब से रोडमैप पाएं',
          description:
            'सामान्य कोर्स लिस्ट के बजाय, आपको अपने लक्ष्य के हिसाब से बना टॉपिक क्रम मिलता है — साथ में एक "WHY लेयर" जो बताती है हर टॉपिक क्यों ज़रूरी है, और JEE या बोर्ड जैसी परीक्षा की तैयारी में exam-weightage बैज भी।',
        },
        {
          icon: '',
          title: '3. Video Intel',
          description:
            'हर टॉपिक के लिए चुने हुए वीडियो में से पिक करें या अपना वीडियो लॉक करें। Deep Notes ट्रांसक्रिप्ट को सेक्शन-दर-सेक्शन ब्रेकडाउन में बदल देता है ताकि दोबारा देखने की ज़रूरत न पड़े।',
        },
        {
          icon: '',
          title: '4. नोट्स',
          description:
            'आपने जो असल में देखा उससे बने ऑटो-जेनरेटेड नोट्स — इंसान जैसी लेखनी, AI बुलेट पॉइंट्स की दीवार नहीं।',
        },
        {
          icon: '',
          title: '5. Revision Engine',
          description:
            'एक साबित शेड्यूल पर स्पेस्ड रिपिटिशन (दिन 1, 3, 7, 15, 30, 60) ताकि जो सीखा वो असल में याद रहे, एक हफ़्ते में भूले नहीं।',
        },
        {
          icon: '',
          title: '6. AI Mentor',
          description:
            'कहीं अटक गए? एक मेंटर से बात करें जो सम्मान और धैर्य के साथ समझाता है और आपके बात करने के तरीके के हिसाब से ढल जाता है।',
        },
        {
          icon: '',
          title: '7. Research',
          description:
            'जब रोडमैप काफ़ी न लगे, तो किसी भी टॉपिक में AI-सहायता से गहराई में जाकर रिसर्च करें।',
        },
        {
          icon: '',
          title: '8. Progress',
          description:
            'आपकी असल एक्टिविटी से असली आंकड़े — completion %, streak, watch time, retention, और एक mastery heatmap जो बिल्कुल दिखाता है कि आप कहां कमज़ोर हैं।',
        },
        {
          icon: '',
          title: '9. Test',
          description:
            'टाइमर और question palette के साथ NTA/JEE-स्टाइल एग्ज़ाम मोड। हाथ से टेस्ट बनाएं, सवाल bulk-paste करें, या अपनी किताब की फ़ोटो/PDF से import करें — AI सिर्फ़ फ़ोटो/PDF पढ़ने के लिए इस्तेमाल होता है।',
        },
        {
          icon: '',
          title: '10. Dictionary',
          description:
            'उच्चारण के साथ तुरंत शब्द खोजें, ऐप के अंदर ही — मतलब देखने के लिए कहीं और जाने की ज़रूरत नहीं।',
        },
      ],
    },
    onboarding: {
      stepTitles: [
        { title: 'आप कौन हैं?', subtitle: '' },
        { title: 'आपका लक्ष्य?', subtitle: '' },
        { title: 'भाषा', subtitle: '' },
        { title: 'आपका नाम', subtitle: '' },
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
        dictionary: 'शब्दकोश',
        test: 'टेस्ट',
        currentAffairs: 'करंट अफेयर्स',
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
            content: '',
          },
          {
            title: 'रिवीज़न',
            content: '',
          },
          {
            title: 'प्रगति',
            content: '',
          },
          {
            title: 'सेटिंग्स',
            content: '',
          },
        ],
        videoPickerIntro: [
          {
            title: 'ये 3 वीडियो — एक ही टॉपिक',
            content:
              '',
          },
          {
            title: 'अलग तरीका, वही कॉन्सेप्ट',
            content: '',
          },
        ],
      },
      checklist: {
        heading: 'शुरू करें',
        subheading: '',
        steps: [
          {
            title: 'अपनी लर्निंग स्टाइल सेट करें',
            subtitle: 'एक छोटा AI इंटरव्यू — बेहतर वीडियो मैच मिलेंगे',
            cta: 'शुरू करें',
          },
          {
            title: 'अपना रोडमैप बनाएं',
            subtitle: '',
            cta: 'बनाएं',
          },
          {
            title: 'पहला वीडियो देखें',
            subtitle: '',
            cta: 'देखें',
          },
        ],
      },
      home: {
        revisionBanner: {
          overdueTitle: '{0} टॉपिक का रिवीजन बाकी है — {1} ओवरड्यू!',
          dueTitle: 'आज {0} टॉपिक रिवाइज करने हैं',
          subtitle: '',
        },
        learnerFallback: 'लर्नर',
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
          subtitleReady: '',
          subtitleNotReady: '',
          detailReady: '',
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
        hint: '',
        regenerateCta: 'रोडमैप दोबारा बनाएं',
        regeneratingCta: 'बन रहा है...',
        successMsg: 'नया रोडमैप बन गया।',
        errorMsg: 'कुछ गड़बड़ हो गई, दोबारा कोशिश करें।',
      },
      learningProfileSection: {
        label: 'लर्निंग प्रोफ़ाइल रिपोर्ट',
        hint: '',
        hintBubble: '',
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
      accountSection: {
        label: 'अकाउंट',
        signedInAs: '{0} के रूप में साइन इन है',
        signOutCta: 'साइन आउट',
      },
    },
    customPlaylistModal: {
      title: 'कस्टम प्लेलिस्ट',
      topicLabel: 'टॉपिक',
      topicPlaceholder: 'जैसे, Django basics',
      hoursLabel: 'घंटे / सप्ताह',
      deadlineLabel: 'डेडलाइन',
      quickLabel: 'क्विक:',
      loadingCta: 'वीडियो ढूंढ रहा हूं...',
      noProfileHint: '',
      generateCta: 'बनाएं',
      generatingCta: 'बन रहा है...',
    },
    learningQuiz: {
      assessmentLabel: 'लर्निंग स्टाइल असेसमेंट',
      quickCheckBadge: 'क्विक चेक',
      lastOneBadge: 'आखिरी सवाल',
      hintText: 'ईमानदारी से जवाब दो — यह तय करेगा कि आपके लिए कौन से वीडियो चुने जाएं।',
      honestNote: 'कोई भी जवाब गलत नहीं है — बस ईमानदार रहो।',
      questions: [
        {
          id: 'q1_pace',
          prompt: 'एक घंटे में एग्ज़ाम के लिए एक नया टॉपिक सीखना है। कौन सा वीडियो चुनोगे?',
          options: [
            { key: 'A', text: 'मीडियम लेंथ वीडियो जो थोड़ा कॉन्टेक्स्ट देता है, फिर मुख्य बातें' },
            { key: 'B', text: '45 मिनट का डिटेल्ड वीडियो — सब कुछ समझाता है, लेकिन पूरा देखने का समय न मिले' },
            { key: 'C', text: 'तेज़ 15 मिनट का वीडियो — सीधे मुख्य बातें, डाउट आया तो क्लैरिटी नहीं मिलेगी' },
            { key: 'D', text: 'वीडियो की जगह एक छोटा लिखित सारांश पढ़ना, जल्दी खत्म' },
          ],
        },
        {
          id: 'q2_theory_practical',
          prompt: 'नया कॉन्सेप्ट सीखने के लिए कौन सा टीचर चुनोगे?',
          options: [
            { key: 'A', text: 'थोड़ी थ्योरी, फिर सीधे एक उदाहरण — दोनों का मिक्स' },
            { key: 'B', text: 'सीधे फॉर्मूला/तरीका देता है — तुरंत काम शुरू, "क्यों" खुद पता लगाना होगा' },
            { key: 'C', text: 'पहले पूरा "क्यों" समझाता है — कॉन्फिडेंस मिलेगा, शुरू होने में देर लगेगी' },
            { key: 'D', text: 'सिर्फ प्रैक्टिस प्रॉब्लम देता है, कोई एक्सप्लेनेशन नहीं — करते-करते सीखो' },
          ],
        },
        {
          id: 'q3_structure',
          prompt: 'ग्रुप स्टडी के लिए कंटेंट चुनना है।',
          options: [
            { key: 'A', text: 'फिक्स्ड-ऑर्डर प्लेलिस्ट — सबको एक ही क्रम फॉलो करना होगा, कोई फ्लेक्सिबिलिटी नहीं' },
            { key: 'B', text: 'एक लूज़ रोडमैप है, टॉपिक का क्रम थोड़ा फ्लेक्सिबल' },
            { key: 'C', text: 'सिर्फ एक प्लेलिस्ट — जो इंटरेस्टिंग लगे वही पहले देखो, कोई फिक्स्ड ऑर्डर नहीं' },
            { key: 'D', text: 'कुछ भी ऑर्गनाइज़्ड नहीं है — जहां क्यूरियोसिटी ले जाए' },
          ],
        },
        {
          id: 'q4_language',
          prompt: 'एक ही टॉपिक के लिए दो टीचर उपलब्ध हैं।',
          options: [
            { key: 'A', text: 'बिल्कुल सिंपल रोज़मर्रा की भाषा — कोई टेक्निकल टर्म नहीं' },
            { key: 'B', text: 'टेक्निकल/सटीक भाषा — एग्ज़ैक्ट है, समझने में एक्स्ट्रा मेहनत लगती है' },
            { key: 'C', text: 'सिंपल भाषा, लेकिन कभी-कभी एक टेक्निकल टर्म आता है (समझाकर)' },
            { key: 'D', text: 'जार्गन-हैवी, प्रोफेशनल/इंडस्ट्री भाषा, कम एक्सप्लेनेशन के साथ' },
          ],
        },
        {
          id: 'q5_repetition',
          prompt: 'एग्ज़ाम से पहले रिवीज़न स्ट्रेटेजी चुननी है।',
          options: [
            { key: 'A', text: 'एक बार देखा हुआ टॉपिक दोबारा नहीं छूना, जब तक कोई खास डाउट न हो' },
            { key: 'B', text: 'कम नए टॉपिक, जो देखा है उसे 2-3 बार रिवाइज़ करो पक्का करने के लिए' },
            { key: 'C', text: 'ज़्यादा नए टॉपिक कवर करो — जो एक बार देख लिया उसे रिपीट मत करो' },
            { key: 'D', text: 'हर टॉपिक को कई बार दोहराना, चाहे नए टॉपिक छूट जाएं' },
          ],
        },
        {
          id: 'q6_depth',
          prompt: 'कॉन्सेप्ट में "क्या" करना है समझ आ गया। टीचर पूछ रहा है — आगे बढ़ें या "क्यों" वाले हिस्से में जाएं?',
          options: [
            { key: 'A', text: 'थोड़ा "क्यों" देख लो, फिर आगे बढ़ो' },
            { key: 'B', text: 'आगे बढ़ो — काम हो रहा है, "क्यों" बाद में देख लेंगे' },
            { key: 'C', text: 'जब तक रूट कॉज़ समझ न आए, आगे बढ़ना ही नहीं चाहता/चाहती' },
            { key: 'D', text: '"क्यों" में इंटरेस्ट नहीं, बस रिज़ल्ट चाहिए जल्दी' },
          ],
        },
        {
          id: 'q7_storytelling',
          prompt: 'एक कॉन्सेप्ट दो तरीकों से एक्सप्लेन हो सकता है।',
          options: [
            { key: 'A', text: 'एक कहानी/केस-स्टडी के ज़रिए — कॉन्सेप्ट धीरे-धीरे रिवील होता है' },
            { key: 'B', text: 'छोटे रियल-लाइफ उदाहरण के साथ, सीधे पॉइंट पर' },
            { key: 'C', text: 'एक एनालॉजी/कहानी के साथ, जिसमें इमोशनल कनेक्ट भी हो' },
            { key: 'D', text: 'सीधे डेफिनिशन और फॉर्मूला — डायरेक्ट, कोई एक्स्ट्रा बातें नहीं' },
          ],
        },
        {
          id: 'q8_prior_knowledge',
          prompt: 'बिल्कुल नया सब्जेक्ट शुरू कर रहे हो जिसके बारे में कुछ नहीं पता।',
          options: [
            { key: 'A', text: 'थोड़ी बेसिक बैकग्राउंड पहले चाहिए होती है — पूरी ज़ीरो से नहीं' },
            { key: 'B', text: 'आमतौर पर कुछ न कुछ रिलेटेड पहले से पता होता है जिससे कनेक्ट कर लेता/लेती हूं' },
            { key: 'C', text: 'ज़ीरो से शुरू करना कम्फर्टेबल लगता है — कोई जल्दी नहीं' },
            { key: 'D', text: 'ज़्यादातर नए सब्जेक्ट्स में भी कुछ ओवरलैप मिल ही जाता है पुराने नॉलेज से' },
          ],
        },
        {
          id: 'q9_pace_check',
          prompt: 'एक ही टॉपिक के लिए दो ऑनलाइन कोर्स मिलते हैं — दोनों से एक जैसा रिज़ल्ट मिलेगा।',
          options: [
            { key: 'A', text: 'कोर्स B — 2 महीने का, थॉरो — थॉरो होना ज़्यादा ज़रूरी है' },
            { key: 'B', text: 'कोर्स A — 2 हफ्ते का, फास्ट — जल्दी खत्म करना है' },
            { key: 'C', text: 'बीच का कोई ऑप्शन चाहिए — न बहुत फास्ट, न बहुत स्लो' },
            { key: 'D', text: 'कोई भी चलेगा, जब तक कंटेंट अच्छा हो' },
          ],
        },
        {
          id: 'q10_repetition_check',
          prompt: 'क्विज़ में गलत आंसर आया किसी कॉन्सेप्ट पे जो "समझ में आ गया" लगा था।',
          options: [
            { key: 'A', text: 'रुककर वापस से पूरा कॉन्सेप्ट देखना पड़ेगा' },
            { key: 'B', text: 'बस एक गलती थी, आगे बढ़ता/बढ़ती हूं' },
            { key: 'C', text: 'सिर्फ वही स्पेसिफिक पार्ट दोबारा देख लूंगा/लूंगी, पूरा नहीं' },
            { key: 'D', text: 'किसी से पूछ लूंगा/लूंगी, खुद दोबारा नहीं देखूंगा/देखूंगी' },
          ],
        },
        {
          id: 'q11_language_check',
          prompt: 'आर्टिकल पढ़ते वक्त एक नया टेक्निकल टर्म आता है जिसका मतलब कॉन्टेक्स्ट से गेस हो सकता है।',
          options: [
            { key: 'A', text: 'थोड़ा सोचकर गेस करता/करती हूं, फिर कन्फर्म करने की कोशिश करता/करती हूं' },
            { key: 'B', text: 'गेस करके आगे बढ़ जाता/जाती हूं — फ्लो ज़रूरी है' },
            { key: 'C', text: 'रुककर एग्ज़ैक्ट मतलब ढूंढता/ढूंढती हूं पहले' },
            { key: 'D', text: 'उस आर्टिकल को छोड़ देता/देती हूं, कोई और सोर्स ढूंढता/ढूंढती हूं' },
          ],
        },
      ],
      honestyQuestion: {
        prompt: 'यह क्विज़ भरते वक्त क्या सोचा — "कौन सा आंसर मुझे ज़्यादा सीरियस/एडवांस्ड लर्नर दिखाएगा"?',
        options: [
          { value: 'A', label: 'नहीं, जो एक्चुअली फील हुआ वही चुना' },
          { value: 'B', label: 'थोड़ा सोचा, लेकिन ज़्यादातर ईमानदार रहा/रही' },
          { value: 'C', label: 'हां, थोड़ा ध्यान में था' },
          { value: 'D', label: 'आंसर नहीं देना चाहता/चाहती' },
        ],
      },
    },
    blueprintInterview: {
      headerTitle: 'AI ब्लूप्रिंट इंटरव्यू',
      progress: { complete: 'पूरा हुआ!', analyzing: 'आपके जवाबों को एनालाइज़ किया जा रहा है...', questionOf: 'सवाल {0} / {1}' },
      backCta: '← पिछला सवाल',
      analyzingText: 'आपके जवाबों को गहराई से एनालाइज़ कर रहे हैं...',
      resultSection: {
        mindMapTitle: 'आपका माइंड मैप',
        mindScoreLabel: 'माइंड स्कोर',
        reportTitle: 'आपका लर्निंग ब्लूप्रिंट',
      },
      errorRetryCta: 'फिर कोशिश करें',
      genericError: 'एनालिसिस फेल हो गया।',
      doneCta: 'पूरा हुआ',
      dimensionLabels: {
        pace: 'गति',
        practical: 'व्यावहारिक',
        structure: 'संरचना',
        depth: 'गहराई',
        language: 'भाषा',
        storytelling: 'कहानी शैली',
        repetition: 'दोहराव',
        priorKnowledge: 'पूर्व ज्ञान',
      },
      questions: [
        {
          id: 'q1',
          text: 'आपको बिल्कुल नई स्किल सीखनी है — पहले आप नैचुरली क्या करते हैं?',
          options: [
            { key: 'A', text: 'सबसे अच्छा वीडियो या रिसोर्स ढूंढता/ढूंढती हूं — विज़ुअल एक्सप्लेनेशन से सीधे समझ आ जाता है' },
            { key: 'B', text: 'सीधे एक छोटा काम try करता/करती हूं — करते-करते चीज़ें क्लियर होती हैं' },
            { key: 'C', text: 'पहले पूरा स्ट्रक्चर समझता/समझती हूं — सिस्टेमेटिकली आगे बढ़ना बेहतर लगता है' },
            { key: 'D', text: 'किसी एक्सपीरियंस्ड इंसान से बात करता/करती हूं — रियल एक्सपीरियंस से जो सीखा वो किताबों में नहीं मिलता' },
          ],
        },
        {
          id: 'q2',
          text: 'बहुत मेहनत के बाद भी रिज़ल्ट expected नहीं आया — आप क्या करते हैं?',
          options: [
            { key: 'A', text: 'डीप्ली एनालाइज़ करता/करती हूं — एग्ज़ैक्ट पॉइंट ढूंढता/ढूंढती हूं जहां चीज़ मिस हुई' },
            { key: 'B', text: 'थोड़ा स्पेस लेता/लेती हूं — क्लियर माइंड से वापस आना ज़्यादा इफेक्टिव होता है' },
            { key: 'C', text: 'तुरंत अलग अप्रोच try करता/करती हूं — मोमेंटम बनाना ज़रूरी है' },
            { key: 'D', text: 'किसी trusted इंसान से बात करता/करती हूं — बाहर का perspective मददगार होता है' },
          ],
        },
        {
          id: 'q3',
          text: 'कोई टॉपिक पढ़ते वक्त एक ऐसी चीज़ मिली जो सीधे काम नहीं आएगी — आप क्या करते हैं?',
          options: [
            { key: 'A', text: 'रुककर समझता/समझती हूं — अधूरी समझ के साथ आगे बढ़ना सूट नहीं करता' },
            { key: 'B', text: 'नोट करता/करती हूं — रिलेवेंट टाइम पे वापस आऊंगा/आऊंगी' },
            { key: 'C', text: 'उस चीज़ को गहराई से एक्सप्लोर करना शुरू करता/करती हूं — क्यूरियोसिटी मुझे ले जाती है' },
            { key: 'D', text: 'फोकस गोल पे रखता/रखती हूं — जो सीधे काम आए वो पहले' },
          ],
        },
        {
          id: 'q4',
          text: 'एक ज़रूरी फैसला लेना है और इनफॉर्मेशन इनकम्प्लीट है — आप?',
          options: [
            { key: 'A', text: 'पहले और डेटा गैदर करता/करती हूं — इन्फॉर्म्ड डिसीज़न बेहतर होता है' },
            { key: 'B', text: 'पुराने पैटर्न देखता/देखती हूं — मिलती-जुलती स्थितियों ने क्या सुझाया' },
            { key: 'C', text: 'जो भी इन्फॉर्मेशन available है उसी से डिसाइड करता/करती हूं — परफेक्ट टाइमिंग कभी नहीं आती' },
            { key: 'D', text: 'किसी trusted इंसान का perspective लेता/लेती हूं — ब्लाइंड स्पॉट्स कवर हो जाते हैं' },
          ],
        },
        {
          id: 'q5',
          text: 'कोई कॉम्प्लेक्स कॉन्सेप्ट समझ नहीं आ रहा — कौन सा अप्रोच आपके लिए काम करता है?',
          options: [
            { key: 'A', text: 'रियल लाइफ से कनेक्ट करता/करती हूं — "यह बिल्कुल ऐसा है जैसे..." से चीज़ें क्लिक करती हैं' },
            { key: 'B', text: 'विज़ुअल फ्लो बना लेता/लेती हूं — डायग्राम में देखा तो क्लियर हो जाता है' },
            { key: 'C', text: 'खुद एक्सपेरिमेंट करता/करती हूं — हैंड्स-ऑन होने के बाद थ्योरी सेटल होती है' },
            { key: 'D', text: 'कई बार पढ़ता/पढ़ती हूं — रिपीटिशन से गहरी क्लैरिटी आती है' },
          ],
        },
        {
          id: 'q6',
          text: '2 घंटे का डीप टॉपिक पढ़ रहे हैं — 45 मिनट बाद नैचुरली क्या होता है?',
          options: [
            { key: 'A', text: 'फ्लो में हूं — फोकस्ड रहना मुझे आता है, टाइम का पता नहीं चलता' },
            { key: 'B', text: 'छोटा मेंटल ब्रेक लेता/लेती हूं — रीचार्ज करके वापस आता/आती हूं, प्रोडक्टिविटी बेहतर रहती है' },
            { key: 'C', text: 'टॉपिक स्विच करता/करती हूं — वैरायटी से मेरी एनर्जी मेंटेन रहती है' },
            { key: 'D', text: 'काफी प्रोग्रेस कर चुका/चुकी हूं — एफिशिएंट पेस में काम करता/करती हूं' },
          ],
        },
        {
          id: 'q7',
          text: 'कोई नई चीज़ सीखने के लिए आपके लिए आइडियल फॉर्मेट कौन सा है?',
          options: [
            { key: 'A', text: 'फोकस्ड शॉर्ट वीडियो — कॉन्साइज़, टू द पॉइंट, टाइम का रिस्पेक्ट' },
            { key: 'B', text: 'डिटेल्ड कॉम्प्रिहेंसिव वीडियो — एक जगह पूरी पिक्चर मिलना बेहतर लगता है' },
            { key: 'C', text: 'लिखित कंटेंट — अपनी पेस पर पढ़ना मेरे लिए ज़्यादा इफेक्टिव है' },
            { key: 'D', text: 'प्रोजेक्ट-बेस्ड लर्निंग — सीधे बनाते हुए सीखना नैचुरल लगता है' },
          ],
        },
        {
          id: 'q8',
          text: 'कोई टीचर वीडियो में टेक्निकल जार्गन यूज़ कर रहा है बिना एक्सप्लेन किए — आप क्या करते हैं?',
          options: [
            { key: 'A', text: 'तुरंत रुककर वर्ड का मतलब सर्च करता/करती हूं — बिना समझे आगे बढ़ना सही नहीं लगता' },
            { key: 'B', text: 'कॉन्टेक्स्ट से ही मतलब निकाल लेता/लेती हूं और आगे बढ़ता/बढ़ती रहता/रहती हूं — जार्गन से प्रॉब्लम नहीं होती' },
            { key: 'C', text: 'सिंपलर रिसोर्स ढूंढ लेता/लेती हूं जहां आसान भाषा में समझाया हो' },
            { key: 'D', text: 'उन वर्ड्स को नोट कर लेता/लेती हूं, बाद में एक साथ सबको क्लैरिफाई करता/करती हूं' },
          ],
        },
        {
          id: 'q9',
          text: 'किसी ने एक नया कॉन्सेप्ट आपको रियल-लाइफ स्टोरी या एनालॉजी के ज़रिए समझाया — आपको कैसा लगता है?',
          options: [
            { key: 'A', text: 'बहुत हेल्पफुल — स्टोरी से कॉन्सेप्ट हमेशा के लिए याद रह जाता है' },
            { key: 'B', text: 'थोड़ा हेल्पफुल है, लेकिन मैं सीधे टेक्निकल/क्लियर डेफिनिशन प्रेफर करता/करती हूं' },
            { key: 'C', text: 'डिपेंड करता है — अगर स्टोरी genuinely रिलेवेंट है तभी काम आती है, वरना टाइम वेस्ट लगता है' },
            { key: 'D', text: 'स्टोरी याद रह जाती है लेकिन एक्चुअल कॉन्सेप्ट नहीं — इसलिए मैं ऐसी चीज़ें अवॉइड करता/करती हूं' },
          ],
        },
        {
          id: 'q10',
          text: 'एक मुश्किल कॉन्सेप्ट सीखने के एक हफ्ते बाद, आप उसे नैचुरली कितनी बार रिवाइज़ करते हैं?',
          options: [
            { key: 'A', text: 'एक बार अच्छे से समझ लिया तो दोबारा ज़रूरत नहीं पड़ती' },
            { key: 'B', text: '2-3 बार ज़रूर रिवाइज़ करता/करती हूं, तभी कॉन्फिडेंस आता है' },
            { key: 'C', text: 'सिर्फ जब एक्चुअली यूज़ करना हो तब रिवाइज़ करता/करती हूं, वरना नहीं' },
            { key: 'D', text: 'नोट्स बना लेता/लेती हूं और बीच-बीच में ग्लांस मारता/मारती रहता/रहती हूं' },
          ],
        },
        {
          id: 'q11',
          text: 'नया टॉपिक शुरू करते वक्त, अगर वो किसी पुरानी चीज़ से रिलेटेड है जो आप पहले से जानते हैं — आप क्या करते हैं?',
          options: [
            { key: 'A', text: 'तुरंत कनेक्ट करता/करती हूं — "यह तो उस जैसा ही है" — नया सीखना आसान हो जाता है' },
            { key: 'B', text: 'पुरानी नॉलेज को साइड रखकर बिल्कुल फ्रेश स्टार्ट करता/करती हूं, कन्फ्यूज़न से बचने के लिए' },
            { key: 'C', text: 'थोड़ा कनेक्ट करता/करती हूं लेकिन ज़्यादा डिपेंडेंट नहीं होता — केस बाय केस' },
            { key: 'D', text: 'मुझे पुराना कॉन्सेप्ट पहले रिवाइज़ करना पड़ता है, वरना नया समझ नहीं आता' },
          ],
        },
      ],
    },
    blueprintVerdicts: {
      pace: {
        high: 'आप फास्ट-पेस्ड लर्नर हैं — लंबी चीज़ों को स्किम करके सीधे essence पकड़ लेते हैं।',
        mid: 'आपका पेस बैलेंस्ड है — न बहुत स्लो, न बहुत फास्ट।',
        low: 'आपको थोरो, स्लो-पेस्ड कंटेंट चाहिए — जल्दी में चीज़ें छूट जाती हैं।',
      },
      theoryVsPractical: {
        high: 'आप हैंड्स-ऑन सीखते हैं — पहले करके देखना, फिर समझना आपका स्टाइल है।',
        mid: 'थ्योरी और प्रैक्टिकल दोनों का मिक्स आपके लिए काम करता है।',
        low: 'आपको पहले ठोस थ्योरी चाहिए, उसके बाद ही प्रैक्टिकल में कॉन्फिडेंस आता है।',
      },
      structureNeed: {
        high: 'आपको क्लियर, स्टेप-बाय-स्टेप स्ट्रक्चर चाहिए — फ्लेक्सिबल/रैंडम कंटेंट कन्फ्यूज़ करता है।',
        mid: 'थोड़ा स्ट्रक्चर मददगार है, लेकिन पूरी रिजिडिटी ज़रूरी नहीं।',
        low: 'आप फ्लेक्सिबल लर्नर हैं — स्ट्रक्चर की ज़्यादा ज़रूरत नहीं पड़ती।',
      },
      depth: {
        high: 'आपको रूट-कॉज़ तक जाना पसंद है — सरफेस-लेवल एक्सप्लेनेशन संतुष्ट नहीं करता।',
        mid: 'आप ज़रूरत के हिसाब से गहराई में जाते हैं, हमेशा नहीं।',
        low: 'सरफेस-लेवल समझ आपके लिए काफी है — गहराई में जाने से पेस स्लो होता है।',
      },
      languageComplexity: {
        high: 'टेक्निकल जार्गन से आपको प्रॉब्लम नहीं — कॉम्प्लेक्स वोकैबुलरी के साथ कम्फर्टेबल हैं।',
        mid: 'थोड़ा जार्गन चलता है, लेकिन बहुत टेक्निकल भाषा कन्फ्यूज़ कर सकती है।',
        low: 'आपको सिंपल, रोज़मर्रा की भाषा में समझाया जाना चाहिए — जार्गन से दूरी रखते हैं।',
      },
      storytelling: {
        high: 'रियल-लाइफ स्टोरीज़ और एनालॉजीज़ से कॉन्सेप्ट आपके दिमाग में हमेशा के लिए बैठ जाते हैं।',
        mid: 'स्टोरीज़ मदद करती हैं, लेकिन हर जगह ज़रूरी नहीं।',
        low: 'आपको डायरेक्ट, टू-द-पॉइंट एक्सप्लेनेशन पसंद है — स्टोरीज़ से डिस्ट्रैक्ट हो सकते हैं।',
      },
      repetitionNeed: {
        high: 'आपको गहरी क्लैरिटी के लिए कई बार रिवीज़न चाहिए — एक बार पढ़ना काफी नहीं।',
        mid: 'थोड़ा रिवीज़न मददगार होता है, लेकिन ज़्यादा ज़रूरत नहीं।',
        low: 'एक बार समझ लिया तो दोबारा रिवाइज़ करने की ज़रूरत कम ही पड़ती है।',
      },
      priorKnowledgeComfort: {
        high: 'नए टॉपिक्स को पुरानी नॉलेज से कनेक्ट करके आप जल्दी सीखते हैं।',
        mid: 'कभी-कभी पूर्व ज्ञान से कनेक्ट करते हैं, हमेशा नहीं।',
        low: 'आपको फ्रेश स्टार्ट पसंद है — पुरानी नॉलेज से कनेक्ट करना ज़रूरी नहीं लगता।',
      },
    },
    authErrors: {
      sessionExpired: 'सेशन नहीं मिल पा रहा, दोबारा साइन इन करें।',
      emailAlreadyInUse: 'यह ईमेल पहले से रजिस्टर्ड है — साइन इन करें।',
      weakPassword: 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।',
      invalidEmail: 'ईमेल सही फॉर्मेट में नहीं है।',
      wrongPassword: 'गलत पासवर्ड।',
      userNotFound: 'यह ईमेल रजिस्टर्ड नहीं है।',
      operationNotAllowed: 'Email/Password साइन-इन Firebase Console में enable नहीं है।',
      unauthorizedDomain: 'यह वेबसाइट डोमेन Firebase Console में authorized नहीं है।',
      popupBlocked: 'ब्राउज़र ने पॉपअप ब्लॉक कर दिया — पॉपअप allow करें और दोबारा कोशिश करें।',
      popupClosedByUser: 'Google पॉपअप बंद हो गया साइन-इन पूरा होने से पहले।',
      genericAuthError: 'कुछ गड़बड़ हो गई, दोबारा कोशिश करें।',
    },
    authScreen: {
      signOutBtn: 'साइन आउट ({0})',
      subtitleCreate: 'नया अकाउंट बनाएं',
      subtitleSignin: 'अपने अकाउंट से साइन इन करें',
      namePlaceholder: 'नाम',
      emailPlaceholder: 'ईमेल',
      passwordPlaceholder: 'पासवर्ड',
      createAccountCta: 'अकाउंट बनाएं',
      signInCta: 'साइन इन',
      orDivider: 'या',
      googleCta: 'Google से जारी रखें',
      switchToSignin: 'पहले से अकाउंट है? साइन इन करें',
      switchToCreate: 'नए यूज़र हैं? अकाउंट बनाएं',
      validationEmailPassword: 'सही ईमेल और कम से कम 6 अक्षरों का पासवर्ड डालें।',
      validationName: 'अपना नाम डालें।',
    },
    authPrompt: {
      signInButton: 'साइन इन',
      guestTitle: 'अपना फ्री अकाउंट बनाएं',
      featureTitle: '{0} इस्तेमाल करने के लिए साइन इन करें',
      subtitle: 'बस कुछ सेकंड लगते हैं। गेस्ट के रूप में आपने जो भी किया, वो सब सुरक्षित रहेगा।',
      notNow: 'अभी नहीं',
      lockedTitle: 'आगे बढ़ने के लिए साइन इन करें',
      lockedBody: '{0} के लिए फ्री अकाउंट चाहिए। आपका Mind Blueprint, वीडियो सर्च और गेस्ट के रूप में किया गया सब कुछ सुरक्षित रहेगा।',
      lockedCta: 'साइन इन करें या अकाउंट बनाएं',
      roadmapPending: 'साइन इन करते ही आपका रोडमैप बन जाएगा।',
      guestBadge: 'गेस्ट',
      guestAccountNote: 'आप Learning OS को गेस्ट के रूप में इस्तेमाल कर रहे हैं। रोडमैप, नोट्स, टेस्ट, मेंटर और बाकी सब खोलने के लिए साइन इन करें।',
    },
    errorBoundary: {
      title: 'कुछ गलत हो गया',
      body: 'ऐप में एक एरर आ गई। रीलोड try करें — अगर प्रॉब्लम बनी रहे तो लोकल डेटा क्लियर करके रीलोड करें (प्रोग्रेस/रोडमैप वापस नहीं मिलेगा, इसलिए पहले सिर्फ रीलोड try करें)।',
      reloadCta: 'रीलोड',
      clearDataCta: 'लोकल डेटा क्लियर करके रीलोड करें',
    },
    deepDiveChat: {
      badge: 'डीप डाइव · वैकल्पिक',
      questionOf: '{0} / {1}',
      answerPlaceholder: 'अपना जवाब यहां लिखें...',
      submitCta: 'सबमिट करें',
      nextCta: 'अगला',
      processingText: 'प्रोफ़ाइल अपडेट हो रही है...',
      closeCta: 'बंद करें',
      errors: {
        noResponse: 'जवाब समझ नहीं आया, फिर से कोशिश करें या स्किप करें।',
        noProfile: 'प्रोफ़ाइल उपलब्ध नहीं है।',
        generic: 'कुछ गड़बड़ हो गई।',
      },
    },
    deepDiveQuestions: [
      'कोई हाल का टॉपिक बताइए जो आपको समझने में दिक्कत हुई — एग्ज़ैक्ट प्रॉब्लम क्या थी?',
      'जब कोई कॉन्सेप्ट अच्छे से "क्लिक" हो जाता है आपके लिए, वो मोमेंट कैसा होता है? एक उदाहरण दीजिए।',
      'कल से एक बिल्कुल नया सब्जेक्ट शुरू करना हो जिसमें कुछ पता नहीं — सबसे पहला कदम क्या लेंगे?',
    ],
    tasteOnboarding: {
      badge: 'वीडियो टेस्ट · क्विज़ का विकल्प',
      formTitle: 'लर्निंग प्रोफ़ाइल',
      formSubtitle: '',
      urlPlaceholder: 'https://youtube.com/watch?v=...',
      watchedCheckbox: 'मैंने यह वीडियो पूरा देखा है',
      linkNotRecognized: '(लिंक समझ नहीं आया)',
      addAnotherCta: '+ एक और वीडियो जोड़ें',
      analyzeCta: '{0} वीडियो एनालाइज़ करें',
      validationHint: '',
      analyzingText: 'वीडियो एनालाइज़ हो रहे हैं — थोड़ा समय लगेगा...',
      videoFallbackLabel: 'वीडियो {0}',
      doneTitle: 'प्रोफ़ाइल अपडेट हो गई',
      doneSubtitle: '{0} वीडियो{1} के एनालिसिस से बनाया गया',
      doneCta: 'पूरा हुआ',
      retryCta: 'फिर कोशिश करें',
      errors: { noneAnalyzed: 'कोई भी वीडियो एनालाइज़ नहीं हो पाया। लिंक चेक करके फिर कोशिश करें।' },
    },
    revisionTasks: {
      day1: 'गहराई से पढ़ो — समझो WHY, सिर्फ WHAT नहीं',
      day3: 'इसे 3-4 अलग रियल उदाहरणों पर अप्लाई करो',
      day7: 'किसी को समझाकर सिखाओ — बिना नोट्स देखे',
      day15: 'एडवांस्ड एप्लिकेशन्स और एज केसेस ढूंढो',
      day30: 'रिलेटेड कॉन्सेप्ट्स से कनेक्ट करो, पैटर्न देखो',
      day60: 'फाइनल रिकॉल चेक — बिना देखे पूरा एक्सप्लेन करो',
      fallback: 'इस टॉपिक को रिवाइज़ करो',
    },
    roadmap: {
      header: { title: 'आपका रोडमैप', subtitle: '' },
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
      noActiveGoal: 'कोई सक्रिय लक्ष्य नहीं है।',
      generateForm: {
        label: 'क्या सीखना है?',
        placeholder: 'आप क्या सीखना चाहते हैं?',
        generateCta: 'रोडमैप बनाएं',
        generatingCta: 'रोडमैप बन रहा है...',
        examLabel: 'किसी खास परीक्षा/बोर्ड के लिए?',
        examOptional: '(वैकल्पिक)',
        examPlaceholder: 'जैसे CBSE कक्षा 10, JEE, NEET — सामान्य पढ़ाई के लिए खाली छोड़ें',
        examHint: '',
        weeklyTimeLabel: 'साप्ताहिक उपलब्ध समय',
        weeklyTimeHint: '',
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
        bridgeHint: '',
        deepDiveCta: '2 छोटे सवाल पूछूं? बेहतर मैच वाले वीडियो मिलेंगे (वैकल्पिक)',
        watchVideosCta: 'वीडियो देखें',
        searchingCta: 'ढूंढ रहा हूं...',
        savedVideoCta: 'सेव किया वीडियो',
        markCompleteCta: 'मुझे यह पहले से आता है — पूरा हुआ मार्क करें',
        challengeTitle: '',
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
        doneLabel: 'पूरा हुआ',
        doneCta: 'पूरा हुआ',
        reviewNowCta: 'अभी रिव्यू करें',
        reviewingCta: 'रिव्यू हो रहा है…',
      },
      emptyState: {
        noRevisionTitle: 'अभी कोई रिवीज़न नहीं',
        noRevisionBody: '',
        allCaughtUpTitle: 'सब कुछ पूरा हो गया!',
        allCaughtUpBody: 'इस श्रेणी में अभी कोई आइटम नहीं है।',
      },
    },
    notebook: {
      tabNotebook: "मेरी नोटबुक",
      tabAi: "AI नोट्स",
      searchPlaceholder: "टाइटल, टैग या टेक्स्ट खोजो...",
      newNote: "नया नोट",
      newFolder: "नया फोल्डर",
      untitled: "बिना नाम का नोट",
      folders: "फोल्डर",
      viewAll: "सभी नोट्स",
      viewFavorites: "पसंदीदा",
      viewArchive: "आर्काइव",
      viewTrash: "ट्रैश",
      sortRecent: "हाल में बदले",
      sortCreated: "नए बनाए हुए",
      sortTitle: "नाम A-Z",
      allTags: "सभी टैग",
      emptyTitle: "तुम्हारी नोटबुक खाली है",
      emptySubtitle: "",
      emptySearch: "खोज से कोई नोट नहीं मिला।",
      emptyTrash: "ट्रैश खाली है।",
      emptyArchive: "कोई आर्काइव नोट नहीं।",
      emptyFavorites: "अभी कोई पसंदीदा नोट नहीं।",
      emptyFolder: "इस फोल्डर में अभी कोई नोट नहीं।",
      pages: "पेज",
      edited: "बदला",
      rename: "नाम बदलो",
      duplicate: "कॉपी बनाओ",
      move: "फोल्डर में डालो",
      pin: "ऊपर पिन करो",
      unpin: "पिन हटाओ",
      favorite: "पसंदीदा में जोड़ो",
      unfavorite: "पसंदीदा से हटाओ",
      archive: "आर्काइव करो",
      unarchive: "आर्काइव से निकालो",
      editTags: "टैग बदलो",
      moveToTrash: "ट्रैश में डालो",
      restore: "वापस लाओ",
      deleteForever: "हमेशा के लिए हटाओ",
      emptyTrashBtn: "ट्रैश खाली करो",
      select: "चुनो",
      selected: "{0} चुने गए",
      cancel: "रद्द करो",
      moveHere: "यहाँ डालो",
      rootFolder: "कोई फोल्डर नहीं (सबसे ऊपर)",
      moveTitle: "कहाँ डालना है...",
      newSubfolder: "नया सब-फोल्डर",
      renameFolder: "फोल्डर का नाम बदलो",
      deleteFolder: "फोल्डर हटाओ",
      folderNamePrompt: "फोल्डर का नाम",
      renameFolderPrompt: "फोल्डर का नया नाम",
      renamePrompt: "नोट का टाइटल",
      tagsPrompt: "टैग, कॉमा से अलग करके",
      confirmDeleteForever: "हमेशा के लिए हटाना है? इसे वापस नहीं ला सकते।",
      confirmEmptyTrash: "ट्रैश की हर चीज़ हमेशा के लिए हटानी है? इसे वापस नहीं ला सकते।",
      confirmDeleteFolderWithNotes: "इस फोल्डर में {0} नोट हैं। वे हटेंगे नहीं - एक लेवल ऊपर चले जाएँगे। फोल्डर हटाना है?",
      confirmDeleteFolder: "यह फोल्डर हटाना है?",
      trashInfo: "ट्रैश के नोट 30 दिन बाद अपने आप हट जाते हैं।",
      undo: "वापस करो",
      toastTrashed: "ट्रैश में गया",
      toastMoved: "डाल दिया",
      toastArchived: "आर्काइव हुआ",
      toastUnarchived: "आर्काइव से निकला",
      toastRestored: "वापस आ गया",
      toastDuplicated: "कॉपी बन गई",
      toastFolderDeleted: "फोल्डर हटा",
      saving: "सेव हो रहा है...",
      saved: "सेव हो गया",
      savedLocal: "इस डिवाइस पर सेव है - अभी सिंक नहीं हुआ",
      offline: "ऑफलाइन - इस डिवाइस पर सेव है",
      saveError: "सेव नहीं हो पाया - स्टोरेज भरा है या बंद है",
      syncNow: "अभी सिंक करो",
      study: {
        statusNotStarted: "शुरू नहीं किया",
        statusLearning: "सीख रहा हूँ",
        statusNeedsRevision: "दोहराना है",
        statusMastered: "पक्का हो गया",
        statusLabel: "पढ़ाई की स्थिति",
        confidenceLabel: "आपको कितना भरोसा है?",
        confidenceNone: "बताया नहीं",
        examDateLabel: "परीक्षा की तारीख",
        clearDate: "तारीख हटाओ",
        details: "पढ़ाई की जानकारी",
        save: "सेव करो",
        filterAll: "सभी स्थितियाँ",
        filterExamSoon: "2 हफ़्ते में परीक्षा",
        sortExam: "परीक्षा की तारीख (सबसे पास)",
        examToday: "परीक्षा आज है",
        examTomorrow: "परीक्षा कल है",
        examInDays: "परीक्षा {0} दिन में",
        examPast: "परीक्षा {0} दिन पहले थी",
        confidenceShort: "भरोसा {0}/5",
      },
      pageOps: {
        deleteConfirm: "पेज {0} हटाना है? इसका टेक्स्ट और हैंडराइटिंग हट जाएगी। हटाने के तुरंत बाद वापस ला सकते हो।",
        deleteBtn: "पेज हटाओ",
        needOnePage: "नोट में कम से कम एक पेज रहना चाहिए।",
        toastDeleted: "पेज हट गया",
        moveUp: "पेज ऊपर करो",
        moveDown: "पेज नीचे करो",
        bookmark: "इस पेज पर बुकमार्क लगाओ",
        removeBookmark: "बुकमार्क हटाओ",
        pageOf: "पेज {0} / {1}",
        duplicatePage: "पेज की कॉपी बनाओ",
        addPageAfter: "इसके बाद पेज जोड़ो",
        panelTitle: "पेज",
        panelAdd: "पेज जोड़ो",
        template: "टेम्पलेट",
        paper: "कागज़",
        collapsePanel: "पेज पैनल छुपाओ",
        expandPanel: "पेज पैनल दिखाओ",
        tplBlank: "सादा",
        tplRuled: "लाइन वाला",
        tplDotted: "बिंदु वाला",
        tplGrid: "ग्रिड",
        tplCornell: "कॉर्नेल",
        zoomIn: "ज़ूम इन",
        zoomOut: "ज़ूम आउट",
        zoomFit: "फिट",
        pagesButton: "पेज",
        closePanel: "बंद करो",
      },
      ink: {
        modeType: "टाइप",
        modePen: "पेन",
        modeHighlighter: "हाईलाइटर",
        modeEraser: "रबर",
        penBallpoint: "बॉलपेन",
        penFountain: "फाउंटेन पेन",
        penFelt: "फेल्ट टिप",
        penPencil: "पेंसिल",
        penBrush: "ब्रश",
        penCalligraphy: "कैलिग्राफी",
        penFineliner: "फाइन लाइनर",
        penMarker: "मार्कर",
        penDotted: "बिंदु वाली लाइन",
        penType: "पेन का प्रकार",
        color: "रंग",
        colorAuto: "काला / सफ़ेद (थीम के हिसाब से)",
        customColor: "अपना रंग",
        recentColors: "हाल के रंग",
        thickness: "मोटाई",
        smoothing: "स्मूदिंग",
        favorites: "पसंदीदा पेन",
        saveFavorite: "इस पेन को पसंदीदा में रखो",
        removeFavorite: "पसंदीदा से हटाओ",
        fingerDraw: "उंगली से लिखो",
        fingerDrawOn: "उंगली से लिखना चालू",
        fingerDrawOff: "उंगली से स्क्रोल",
        more: "और",
        resetPen: "पेन सेटिंग रीसेट करो",
        eraserStroke: "पूरी लकीर",
        eraserArea: "लकीर का हिस्सा",
        targetAll: "सब कुछ",
        targetInk: "सिर्फ़ पेन",
        targetHl: "सिर्फ़ हाईलाइट",
        eraserSize: "रबर का साइज़",
        eraseAll: "पूरा पेज मिटाओ",
        eraseAllConfirm: "इस पेज की सारी हैंडराइटिंग मिटानी है? इसे वापस ला सकते हो।",
        undo: "ड्रॉइंग पीछे",
        redo: "ड्रॉइंग आगे",
        modeSelect: "चुनो",
        selLasso: "लासो",
        selRect: "चौकोर",
        selAll: "सब चुनो",
        selHint: "",
        selCount: "{0} चुने गए",
        selDelete: "हटाओ",
        selCopy: "कॉपी",
        selCut: "कट",
        selPaste: "पेस्ट",
        selDuplicate: "डुप्लिकेट",
        selColor: "रंग बदलो",
        selWidth: "मोटाई बदलो",
        selFront: "आगे लाओ",
        selBack: "पीछे भेजो",
        selNeaten: "शेप सीधे करो",
        selNeatNone: "सीधा करने लायक कोई लाइन या शेप नहीं मिली।",
        selToText: "हैंडराइटिंग से टेक्स्ट",
        shapeSnap: "रुकने पर शेप सीधी करो",
        ocrConsent: "आपकी हैंडराइटिंग पढ़ने के लिए चुनी हुई लकीरों की एक तस्वीर AI सर्विस को भेजी जाएगी। आपकी हैंडराइटिंग बदलेगी नहीं। आगे बढ़ें?",
        ocrTitle: "हैंडराइटिंग टेक्स्ट में",
        ocrLoading: "आपकी हैंडराइटिंग पढ़ी जा रही है...",
        ocrError: "हैंडराइटिंग पढ़ नहीं पाया। दोबारा कोशिश करो या कम हिस्सा चुनो।",
        ocrEmpty: "चुने हुए हिस्से में कुछ लिखा नहीं मिला।",
        ocrLowConf: "कुछ शब्द गलत हो सकते हैं ([?] = पढ़ा नहीं गया)।" ,
        ocrEdit: "",
        ocrInsert: "टेक्स्ट की तरह डालो",
        ocrInsertDelete: "डालो और हैंडराइटिंग हटाओ",
        ocrCancel: "रद्द करो",
      },
      editor: {
        back: "नोट्स पर वापस",
        titlePlaceholder: "टाइटल",
        bodyPlaceholder: "लिखना शुरू करो...",
        addPage: "पेज जोड़ो",
        pageLabel: "पेज",
        loadError: "यह नोट खुल नहीं पाया।",
        undo: "पीछे",
        redo: "आगे",
        normalText: "सामान्य टेक्स्ट",
        heading1: "हेडिंग 1",
        heading2: "हेडिंग 2",
        heading3: "हेडिंग 3",
        bold: "बोल्ड",
        italic: "इटैलिक",
        underline: "अंडरलाइन",
        strike: "कटा हुआ",
        textColor: "टेक्स्ट का रंग",
        resetColor: "सामान्य रंग",
        highlight: "हाईलाइट",
        removeHighlight: "हाईलाइट हटाओ",
        superscript: "ऊपर छोटा (सुपरस्क्रिप्ट)",
        subscript: "नीचे छोटा (सबस्क्रिप्ट)",
        bulletList: "बुलेट लिस्ट",
        numberedList: "नंबर वाली लिस्ट",
        checklist: "चेकलिस्ट",
        quote: "कोट",
        codeBlock: "कोड ब्लॉक",
        inlineCode: "इनलाइन कोड",
        link: "लिंक",
        linkPrompt: "लिंक का पता (https://...)",
        removeLink: "लिंक हटाओ",
        table: "टेबल जोड़ो",
        addRow: "पंक्ति जोड़ो",
        addColumn: "कॉलम जोड़ो",
        deleteRow: "पंक्ति हटाओ",
        deleteColumn: "कॉलम हटाओ",
        deleteTable: "टेबल हटाओ",
        divider: "लाइन",
        alignLeft: "बाएँ",
        alignCenter: "बीच में",
        alignRight: "दाएँ",
        clearFormat: "फॉर्मैट हटाओ",
        fontSize: "टेक्स्ट साइज़",
        sizeSmall: "छोटा",
        sizeNormal: "सामान्य",
        sizeLarge: "बड़ा",
        sizeHuge: "बहुत बड़ा",
        find: "खोजो और बदलो",
        findPlaceholder: "खोजो...",
        replacePlaceholder: "इससे बदलो...",
        replace: "बदलो",
        replaceAll: "सब बदलो",
        noMatches: "कुछ नहीं मिला",
        matchCount: "{1} में से {0}",
        next: "अगला",
        prev: "पिछला",
        close: "बंद करो",
        words: "{0} शब्द",
        chars: "{0} अक्षर",
        readTime: "{0} मिनट में पढ़ें",
        focusMode: "फोकस मोड",
        exitFocus: "फोकस मोड बंद करो",
        readAloud: "पढ़कर सुनाओ",
        stopReading: "पढ़ना रोको",
        shortcuts: "कीबोर्ड शॉर्टकट",
        shortcutsTitle: "शॉर्टकट",
        pageHint: "पेज",
      },
    },
    notes: {
      header: { title: 'डीप लर्निंग नोट्स', subtitle: '' },
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
      sectionUnavailable: 'यह सेक्शन अभी उपलब्ध नहीं है।',
      sourceVideoLink: 'मूल वीडियो देखें',
      transcriptSourceNote: 'ये नोट्स वीडियो की ट्रांसक्रिप्ट से बनाए गए हैं',
      metadataSourceNote: 'ट्रांसक्रिप्ट उपलब्ध नहीं थी — सिर्फ टाइटल/डिस्क्रिप्शन से बनाए गए',
      emptyState: {
        title: 'अभी नोट्स नहीं हैं',
        subtitle: '',
      },
    },
    videos: {
      header: { title: 'वीडियो', subtitle: '' },
      searchPlaceholder: 'वीडियो खोजें...',
      searchCta: 'खोजें',
      noResultsYet: 'अभी कोई नतीजा नहीं',
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
      selectVideoPrompt: '',
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
      header: { title: 'AI मेंटर', subtitle: '' },
      welcomeMessage: 'नमस्ते! आज क्या सीखना है?',
      suggestedPrompts: [
        { icon: '', label: 'आसानी से समझाओ', prompt: 'यह कॉन्सेप्ट आसान भाषा में समझाओ' },
        { icon: '', label: 'गहराई से', prompt: 'इसे उदाहरणों के साथ विस्तार से समझाओ' },
        { icon: '', label: 'असल मिसाल', prompt: 'मुझे इसकी असल दुनिया की मिसाल दो' },
        { icon: '', label: 'क्विज़ लो', prompt: 'इस टॉपिक पर एक क्विज़ बनाओ' },
        { icon: '', label: 'प्रोजेक्ट आइडिया', prompt: 'एक छोटा प्रोजेक्ट सुझाओ' },
        { icon: '', label: 'गलती पकड़ो', prompt: 'इसमें आम गलतियां क्या होती हैं?' },
      ],
      youLabel: 'आप',
      mentorLabel: 'मेंटर',
      inputPlaceholder: 'कुछ भी पूछें...',
      sendCta: 'भेजें',
      errors: {
        generic: 'कुछ गड़बड़ हो गई ({0})। थोड़ी देर में फिर कोशिश करें।',
        noResponse: 'जवाब नहीं मिल पाया, फिर से कोशिश करें।',
        truncatedSuffix: '\n\n_( जवाब लंबा था और बीच में कट गया — "गहराई से" की जगह छोटा सवाल पूछें)_',
        network: 'नेटवर्क में गड़बड़ आई। इंटरनेट जांचें और फिर कोशिश करें।',
      },
    },
    progress: {
      header: { title: 'प्रगति', subtitle: '' },
      stats: { completion: 'पूर्णता', streak: 'स्ट्रीक', totalWatchTime: 'कुल वॉच टाइम', retention: 'रिटेंशन' },
      completionBar: { topicsDone: '{0}/{1} टॉपिक पूरे', inProgress: '{0} जारी हैं' },
      emptyState: {
        title: 'अभी ट्रैक करने को कुछ नहीं है',
        body: '',
      },
      timeTracking: { title: 'टाइम ट्रैकिंग', last7Days: 'पिछले 7 दिन: {0} मिनट' },
      masteryHeatmap: { title: 'महारत हीटमैप', legendWeak: 'कमजोर', legendOk: 'ठीक', legendStrong: 'मजबूत' },
      retentionDetail: { title: 'रिटेंशन', dueToday: 'आज देय', overdue: 'बकाया', mastered: 'महारत' },
      weakAreas: { title: 'कमजोर टॉपिक', noneFound: 'कोई कमजोर टॉपिक नहीं मिला — सब कुछ ठीक चल रहा है।' },
    },
    research: {
      header: { title: 'रिसर्च', subtitle: '' },
      searchPlaceholder: 'क्या जानना है?',
      searchCta: 'खोजें',
      notGroundedNote: 'इस बार लाइव सर्च सोर्स नहीं मिला — नीचे दिया जवाब सामान्य जानकारी से है, हाल की किसी बात के लिए दोबारा जांच लें',
      genericError: 'रिसर्च नहीं हो पाई',
      embedded: { title: 'रिसर्च (वीडियो के साथ-साथ)', hint: '' },
      closeAria: 'रिसर्च पैनल बंद करें',
      emptyState: { title: 'अभी कोई नतीजा नहीं', subtitle: '' },
    },
    currentAffairs: {
      title: 'करंट अफेयर्स',
      subtitle: '',
      streak: '{0} दिन की स्ट्रीक',
      previousDays: 'पिछले दिन',
      today: 'आज',
      loading: 'आज के करंट अफेयर्स तैयार हो रहे हैं…',
      retry: 'फिर कोशिश करें',
      dayNotAvailable: 'यह दिन उपलब्ध नहीं है।',
      tabs: { all: 'सभी', national: 'राष्ट्रीय', international: 'अंतरराष्ट्रीय', economy: 'अर्थव्यवस्था', sports: 'खेल', scitech: 'विज्ञान और तकनीक' },
      sourceLabel: 'स्रोत',
      aiNote: 'यह सार्वजनिक खबरों से AI द्वारा संक्षेप में तैयार किया गया है। ज़रूरी बात के लिए मूल स्रोत ज़रूर देखें।',
      quizTitle: 'क्विक क्विज़',
      quizSubtitle: 'आज के पॉइंट्स से 5 सवाल',
      correct: 'सही!',
      wrong: 'सही नहीं।',
      scoreLine: 'आपका स्कोर {0} / {1}',
      streakDone: 'आज के करंट अफेयर्स पूरे',
      mistakesTitle: 'जो सवाल छूट गए',
      correctAnswerLabel: 'सही उत्तर',
    },
    channelDigest: {
      switchNews: 'अखबार',
      switchChannels: 'YouTube चैनल',
      subtitle: '',
      addPlaceholder: 'चैनल का लिंक, @handle या नाम',
      addButton: 'चैनल जोड़ें',
      adding: 'जोड़ रहे हैं…',
      limitReached: 'आप अधिकतम {0} चैनल जोड़ सकते हैं।',
      noChannels: 'कोई YouTube चैनल जोड़ें और कल के उसके सभी वीडियो का लिखित सार पाएँ।',
      removeAria: '{0} हटाएँ',
      dayLabel: 'कल ({0}) — रात 12 से रात 12 तक के सभी वीडियो',
      loading: 'कल के वीडियो ढूँढे जा रहे हैं…',
      retry: 'फिर कोशिश करें',
      noVideos: 'इस चैनल ने कल कोई वीडियो नहीं डाला।',
      progress: '{1} में से {0} वीडियो कवर हुए',
      summarising: 'सार बन रहा है…',
      videoFailed: 'इस वीडियो का सार नहीं बन पाया।',
      retryFailed: '{0} असफल वाले फिर से करें',
      videosTitle: 'वीडियो',
      noTranscript: 'सिर्फ़ टाइटल और डिस्क्रिप्शन से संक्षेप बनाया गया — ट्रांसक्रिप्ट उपलब्ध नहीं था।',
      watch: 'देखें',
      tabs: { all: 'सभी', national: 'राष्ट्रीय', international: 'अंतरराष्ट्रीय', economy: 'अर्थव्यवस्था', sports: 'खेल', scitech: 'विज्ञान और तकनीक', other: 'अन्य' },
      aiNote: 'यह चैनल के अपने वीडियो से AI द्वारा लिखा गया है। इसमें वही है जो चैनल ने कहा, पुष्ट तथ्य नहीं — ज़रूरी बात के लिए वीडियो ज़रूर देखें।',
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
      subtitle: 'Learning OS jo bhi karta hai, ek hi jagah',
      startCta: 'Shuru Karo →',
      dashboardCta: 'Dashboard →',
      steps: [
        {
          icon: '',
          title: '1. Batao tum kaun ho',
          description:
            'Ek chhota onboarding tumhara role, goal, pasandida bhasha aur naam poochta hai.',
        },
        {
          icon: '',
          title: '2. Apne hisaab se roadmap pao',
          description:
            'Generic course list ke bajaye, tumhe apne goal ke hisaab se bana topic sequence milta hai — ek "WHY layer" ke saath jo batata hai har topic kyun zaroori hai, aur JEE ya board jaisi exam prep ke liye exam-weightage badges bhi.',
        },
        {
          icon: '',
          title: '3. Video Intel',
          description:
            'Har topic ke curated videos mein se pick karo ya apna video lock karo. Deep Notes transcript ko section-by-section breakdown mein badal deta hai taaki dobara dekhne ki zaroorat na pade.',
        },
        {
          icon: '',
          title: '4. Notes',
          description:
            'Tumne jo asal mein dekha usse bane auto-generated notes — insaan jaisi likhavat, AI bullet points ki deewar nahi.',
        },
        {
          icon: '',
          title: '5. Revision Engine',
          description:
            'Ek proven schedule pe spaced repetition (Day 1, 3, 7, 15, 30, 60) taaki jo seekha wo asal mein yaad rahe, ek hafte mein bhoole nahi.',
        },
        {
          icon: '',
          title: '6. AI Mentor',
          description:
            'Kahin atak gaye? Ek mentor se baat karo jo respect aur patience ke saath samjhata hai aur tumhare baat karne ke tarike ke hisaab se dhal jata hai.',
        },
        {
          icon: '',
          title: '7. Research',
          description:
            'Jab roadmap kaafi na lage, toh kisi bhi topic mein AI-assisted deep-dive research karo.',
        },
        {
          icon: '',
          title: '8. Progress',
          description:
            'Tumhari asal activity se real numbers — completion %, streak, watch time, retention, aur ek mastery heatmap jo bilkul dikhata hai tum kahan weak ho.',
        },
        {
          icon: '',
          title: '9. Test',
          description:
            'Timer aur question palette ke saath NTA/JEE-style exam mode. Haath se test banao, questions bulk-paste karo, ya apni textbook ke photo/PDF se import karo — AI sirf photo/PDF padhne ke liye use hota hai.',
        },
        {
          icon: '',
          title: '10. Dictionary',
          description:
            'Pronunciation ke saath instant word lookup, app ke andar hi — matlab dekhne ke liye kahin aur jaane ki zaroorat nahi.',
        },
      ],
    },
    onboarding: {
      stepTitles: [
        { title: 'Tum kaun ho?', subtitle: '' },
        { title: 'Tumhara goal?', subtitle: '' },
        { title: 'Language', subtitle: '' },
        { title: 'Tumhara naam', subtitle: '' },
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
        dictionary: 'Dictionary',
        test: 'Test',
        currentAffairs: 'Current Affairs',
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
            content: '',
          },
          {
            title: 'Revision',
            content: '',
          },
          {
            title: 'Progress',
            content: '',
          },
          {
            title: 'Settings',
            content: '',
          },
        ],
        videoPickerIntro: [
          {
            title: 'Ye 3 videos — same topic hai',
            content:
              '',
          },
          {
            title: 'Alag style, wahi concept',
            content: '',
          },
        ],
      },
      checklist: {
        heading: 'Shuru karo',
        subheading: '',
        steps: [
          {
            title: 'Apna learning style set karo',
            subtitle: '',
            cta: 'Start',
          },
          {
            title: 'Apna roadmap banao',
            subtitle: '',
            cta: 'Generate',
          },
          {
            title: 'Pehla video dekho',
            subtitle: '',
            cta: 'Watch',
          },
        ],
      },
      home: {
        revisionBanner: {
          overdueTitle: '{0} topics ka revision baaki hai — {1} overdue!',
          dueTitle: 'Aaj {0} topics revise karne hain',
          subtitle: '',
        },
        learnerFallback: 'Learner',
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
          subtitleReady: '',
          subtitleNotReady: '',
          detailReady: '',
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
        hint: '',
        regenerateCta: 'Regenerate Roadmap',
        regeneratingCta: 'Regenerating...',
        successMsg: 'Naya roadmap ban gaya.',
        errorMsg: 'Kuch gadbad ho gayi, dobara try karo.',
      },
      learningProfileSection: {
        label: 'Learning Profile Report',
        hint: '',
        hintBubble: '',
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
      accountSection: {
        label: 'Account',
        signedInAs: 'Signed in as {0}',
        signOutCta: 'Sign Out',
      },
    },
    customPlaylistModal: {
      title: 'Custom Playlist',
      topicLabel: 'Topic',
      topicPlaceholder: 'e.g., Django basics',
      hoursLabel: 'Hours / week',
      deadlineLabel: 'Deadline',
      quickLabel: 'Quick:',
      loadingCta: 'Dhundh raha hoon...',
      noProfileHint: '',
      generateCta: 'Generate',
      generatingCta: 'Generating...',
    },
    learningQuiz: {
      assessmentLabel: 'Learning Style Assessment',
      quickCheckBadge: 'Quick check',
      lastOneBadge: 'Last one',
      hintText: 'Answer honestly — this shapes which videos we pick for you.',
      honestNote: 'Koi bhi answer galat nahi hai — bas honest raho.',
      questions: [
        {
          id: 'q1_pace',
          prompt: 'Ek hi ghante mein ek naya topic seekhna hai exam ke liye. Kaunsa video choose karoge?',
          options: [
            { key: 'A', text: 'Medium-length video jo thoda context deta hai, phir core points' },
            { key: 'B', text: 'Detailed 45-min video — sab kuch samjhata hai, lekin poora dekhne ka time na mile' },
            { key: 'C', text: 'Fast 15-min video — seedha core points, doubt aaya toh clarity nahi milegi' },
            { key: 'D', text: 'Video ke bajaye ek chhota written summary padhna, jaldi khatam' },
          ],
        },
        {
          id: 'q2_theory_practical',
          prompt: 'Naya concept seekhne ke liye kaunsa teacher choose karoge?',
          options: [
            { key: 'A', text: 'Thoda theory, phir seedha ek example — dono ka mix' },
            { key: 'B', text: 'Seedha formula/method deta hai — turant kaam shuru, "kyun" khud figure out karna hoga' },
            { key: 'C', text: 'Pehle poora "kyun" explain karta hai — confidence milega, shuru hone mein der lagegi' },
            { key: 'D', text: 'Sirf practice problems deta hai, koi explanation nahi — trial and error se seekho' },
          ],
        },
        {
          id: 'q3_structure',
          prompt: 'Group study ke liye content choose karna hai.',
          options: [
            { key: 'A', text: 'Fixed-order playlist — sabko same sequence follow karna hoga, koi flexibility nahi' },
            { key: 'B', text: 'Ek loose roadmap hai, topics ka order thoda flexible' },
            { key: 'C', text: 'Sirf ek playlist — jo interesting lage wahi pehle dekho, koi fixed order nahi' },
            { key: 'D', text: 'Kuch bhi organized nahi hai — jahan curiosity le jaaye' },
          ],
        },
        {
          id: 'q4_language',
          prompt: 'Do teachers available hain same topic ke liye.',
          options: [
            { key: 'A', text: 'Bilkul simple everyday language — koi technical term nahi' },
            { key: 'B', text: 'Technical/precise language — exact hai, extra effort lagta hai samajhne mein' },
            { key: 'C', text: 'Simple language, lekin kabhi-kabhi ek technical term aata hai (explain karke)' },
            { key: 'D', text: 'Jargon-heavy, professional/industry language, kam explanation ke saath' },
          ],
        },
        {
          id: 'q5_repetition',
          prompt: 'Exam se pehle revision strategy choose karni hai.',
          options: [
            { key: 'A', text: 'Ek baar dekha hua topic dobara nahi chhuna, jab tak koi specific doubt na ho' },
            { key: 'B', text: 'Kam naye topics, jo dekha hai usse 2-3 baar revise karo pakka karne ke liye' },
            { key: 'C', text: 'Naye topics zyada cover karo — repeat mat karo jo ek baar dekh liya' },
            { key: 'D', text: 'Har topic ko kai baar dohrana, chahe naye topics chhoot jaayein' },
          ],
        },
        {
          id: 'q6_depth',
          prompt: 'Concept samajh aa gaya "kya" karna hai. Teacher pooch raha hai — aage badhein ya "kyun" wale part mein jaayein?',
          options: [
            { key: 'A', text: 'Thoda "kyun" dekh lo, phir aage badho' },
            { key: 'B', text: 'Aage badho — kaam ho raha hai, "kyun" baad mein dekh lenge' },
            { key: 'C', text: 'Jab tak root cause samajh na aaye, aage badhna hi nahi chahta/chahti' },
            { key: 'D', text: '"Kyun" mein interest nahi, bas result chahiye jaldi' },
          ],
        },
        {
          id: 'q7_storytelling',
          prompt: 'Ek concept do tarike se explain ho sakta hai.',
          options: [
            { key: 'A', text: 'Ek kahani/case-study ke through — concept dheere-dheere reveal hota hai' },
            { key: 'B', text: 'Chhota real-life example ke saath, seedha point pe' },
            { key: 'C', text: 'Ek analogy/story ke saath, jisme emotional connect bhi ho' },
            { key: 'D', text: 'Seedha definition aur formula — direct, koi extra baatein nahi' },
          ],
        },
        {
          id: 'q8_prior_knowledge',
          prompt: 'Bilkul naya subject start kar rahe ho jiske baare mein kuch nahi pata.',
          options: [
            { key: 'A', text: 'Thodi basic background pehle chahiye hoti hai — poori zero se nahi' },
            { key: 'B', text: 'Generally kuch na kuch related pehle se pata hota hai jisse connect kar leta/leti hoon' },
            { key: 'C', text: 'Zero se start karna comfortable lagta hai — koi jaldi nahi' },
            { key: 'D', text: 'Zyadatar naye subjects mein bhi kuch overlap mil hi jaata hai purane knowledge se' },
          ],
        },
        {
          id: 'q9_pace_check',
          prompt: '2 online courses milte hain same topic ke — dono se same result milega.',
          options: [
            { key: 'A', text: 'Course B — 2 mahine ka, thorough — thorough hona zyada important hai' },
            { key: 'B', text: 'Course A — 2 hafte ka, fast — jaldi khatam karna hai' },
            { key: 'C', text: 'Beech ka koi option chahiye — na bahut fast, na bahut slow' },
            { key: 'D', text: 'Koi bhi chalega, jab tak content achha ho' },
          ],
        },
        {
          id: 'q10_repetition_check',
          prompt: 'Quiz mein galat answer aaya kisi concept pe jo "samajh mein aa gaya" laga tha.',
          options: [
            { key: 'A', text: 'Ruk ke wapas se poora concept dekhna padega' },
            { key: 'B', text: 'Bas ek galti thi, aage badhta/badhti hoon' },
            { key: 'C', text: 'Sirf wahi specific part dobara dekh lunga/lungi, poora nahi' },
            { key: 'D', text: 'Kisi se puchh lunga/lungi, khud dobara nahi dekhunga/dekhungi' },
          ],
        },
        {
          id: 'q11_language_check',
          prompt: 'Article padhte waqt ek naya technical term aata hai jiska matlab context se guess ho sakta hai.',
          options: [
            { key: 'A', text: 'Thoda soch ke guess karta/karti hoon, phir confirm karne ki koshish karta/karti hoon' },
            { key: 'B', text: 'Guess karke aage badh jaata/jaati hoon — flow important hai' },
            { key: 'C', text: 'Ruk ke exact meaning dhoondta/dhoondti hoon pehle' },
            { key: 'D', text: 'Us article ko chhod deta/deti hoon, koi aur source dhoondta/dhoondti hoon' },
          ],
        },
      ],
      honestyQuestion: {
        prompt: 'Is quiz ko bharte waqt kya socha: "kaunsa answer mujhe zyada serious/advanced learner dikhayega"?',
        options: [
          { value: 'A', label: 'Nahi, jo actually feel hua wahi choose kiya' },
          { value: 'B', label: 'Thoda socha, lekin zyada tar honest raha' },
          { value: 'C', label: 'Haan, thoda dhyaan mein tha' },
          { value: 'D', label: 'Answer nahi dena chahta/chahti' },
        ],
      },
    },
    blueprintInterview: {
      headerTitle: 'AI Blueprint Interview',
      progress: { complete: 'Complete!', analyzing: 'Analyzing your answers...', questionOf: 'Sawaal {0} / {1}' },
      backCta: '← Pichla sawaal',
      analyzingText: 'Aapke jawabon ko deeply analyze kar rahe hain...',
      resultSection: {
        mindMapTitle: 'Your Mind Map',
        mindScoreLabel: 'Mind Score',
        reportTitle: 'Aapka Learning Blueprint',
      },
      errorRetryCta: 'Phir try karein',
      genericError: 'Analysis fail ho gaya.',
      doneCta: 'Done',
      dimensionLabels: {
        pace: 'Pace',
        practical: 'Practical',
        structure: 'Structure',
        depth: 'Depth',
        language: 'Language',
        storytelling: 'Storytelling',
        repetition: 'Repetition',
        priorKnowledge: 'Prior Knowledge',
      },
      questions: [
        {
          id: 'q1',
          text: 'Koi bilkul nayi skill sikhni hai — pehle aap naturally kya karte hain?',
          options: [
            { key: 'A', text: 'Best video ya resource dhundta/dhundti hoon — visual explanation se seedha samajh aata hai' },
            { key: 'B', text: 'Seedha ek chota kaam try karta/karti hoon — karte karte cheezein clear hoti hain' },
            { key: 'C', text: 'Poora structure samajhta/samajhti hoon pehle — systematically move karna better lagta hai' },
            { key: 'D', text: 'Kisi experienced insaan se baat karta/karti hoon — real experience se jo seekha woh books mein nahi milta' },
          ],
        },
        {
          id: 'q2',
          text: 'Bahut mehnat ke baad bhi result expected nahi aaya — aap kya karte hain?',
          options: [
            { key: 'A', text: 'Deeply analyze karta/karti hoon — exact point dhundta/dhundti hoon jahan cheez miss hui' },
            { key: 'B', text: 'Thoda space leta/leti hoon — clear mind se wapas aana zyada effective hota hai' },
            { key: 'C', text: 'Immediately different approach try karta/karti hoon — momentum banana zaroori hai' },
            { key: 'D', text: 'Trusted insaan se baat karta/karti hoon — outside perspective helpful hota hai' },
          ],
        },
        {
          id: 'q3',
          text: 'Koi topic padhte waqt ek aisi cheez mili jo seedha kaam nahi aayegi — aap kya karte hain?',
          options: [
            { key: 'A', text: 'Ruk ke samajhta/samajhti hoon — adhoori samajh ke saath aage badhna suit nahi karta' },
            { key: 'B', text: 'Note karta/karti hoon — relevant time pe wapas aaunga/aaungi' },
            { key: 'C', text: 'Us cheez ko deeper explore karna shuru karta/karti hoon — curiosity mujhe le jaati hai' },
            { key: 'D', text: 'Focus goal pe rakhta/rakhti hoon — jo seedha kaam aaye woh pehle' },
          ],
        },
        {
          id: 'q4',
          text: 'Important decision lena ho aur information incomplete ho — aap?',
          options: [
            { key: 'A', text: 'Pehle aur data gather karta/karti hoon — informed decision better hota hai' },
            { key: 'B', text: 'Past patterns dekhta/dekhti hoon — similar situations ne kya suggest kiya' },
            { key: 'C', text: 'Best available information se decide karta/karti hoon — perfect timing kabhi nahi aata' },
            { key: 'D', text: 'Kisi trusted insaan ka perspective leta/leti hoon — blind spots cover hote hain' },
          ],
        },
        {
          id: 'q5',
          text: 'Koi complex concept samajh nahi aa raha — kaunsa approach aapke liye kaam karta hai?',
          options: [
            { key: 'A', text: 'Real life se connect karta/karti hoon — "yeh bilkul aise hai jaise..." se cheezein click karti hain' },
            { key: 'B', text: 'Visual flow bana leta/leti hoon — diagram mein dekha toh clear ho jaata hai' },
            { key: 'C', text: 'Khud experiment karta/karti hoon — hands-on hone ke baad theory settle hoti hai' },
            { key: 'D', text: 'Multiple baar padhta/padhti hoon — repetition se deep clarity aati hai' },
          ],
        },
        {
          id: 'q6',
          text: '2 ghante ka deep topic padh rahe hain — 45 minute baad naturally kya hota hai?',
          options: [
            { key: 'A', text: 'Flow mein hoon — focused rehna mujhe aata hai, time pata nahi chalta' },
            { key: 'B', text: 'Short mental break leta/leti hoon — recharge karke wapas aata/aati hoon, productivity better rehti hai' },
            { key: 'C', text: 'Topic switch karta/karti hoon — variety se energy maintain rehti hai meri' },
            { key: 'D', text: 'Kaafi progress kar chuka/chuki hoon — efficient pace mein kaam karta/karti hoon' },
          ],
        },
        {
          id: 'q7',
          text: 'Koi nayi cheez seekhne ke liye ideal format kaunsa hai aapke liye?',
          options: [
            { key: 'A', text: 'Focused short videos — concise, to the point, time ki respect' },
            { key: 'B', text: 'Detailed comprehensive video — ek jagah poora picture milna better lagta hai' },
            { key: 'C', text: 'Written content — apni pace pe padhna zyada effective hai mere liye' },
            { key: 'D', text: 'Project-based learning — seedha banate hue sikhna natural lagta hai' },
          ],
        },
        {
          id: 'q8',
          text: 'Koi teacher video mein technical jargon use kar raha hai bina explain kiye — aap kya karte hain?',
          options: [
            { key: 'A', text: 'Turant ruk ke word ka matlab search karta/karti hoon — bina samjhe aage badhna sahi nahi lagta' },
            { key: 'B', text: 'Context se hi matlab nikal leta/leti hoon aur aage badhta/badhti rehta/rehti hoon — jargon se problem nahi hoti' },
            { key: 'C', text: 'Simpler resource dhoondh leta/leti hoon jahan easy language mein samjhaya ho' },
            { key: 'D', text: 'Un words ko note kar leta/leti hoon, baad mein ek saath sabko clarify karta/karti hoon' },
          ],
        },
        {
          id: 'q9',
          text: 'Kisi ne ek naya concept aapko real-life story ya analogy ke through samjhaya — aapko kaisa lagta hai?',
          options: [
            { key: 'A', text: 'Bahut helpful — story se concept hamesha ke liye yaad reh jaata hai' },
            { key: 'B', text: 'Thoda helpful hai, lekin main directly technical/clear definition prefer karta/karti hoon' },
            { key: 'C', text: 'Depends — agar story genuinely relevant hai tabhi kaam aati hai, warna time waste lagta hai' },
            { key: 'D', text: 'Story yaad reh jaati hai lekin actual concept nahi — isliye main aisi cheezein avoid karta/karti hoon' },
          ],
        },
        {
          id: 'q10',
          text: 'Ek mushkil concept seekhne ke ek hafte baad, aap usse naturally kitni baar revise karte hain?',
          options: [
            { key: 'A', text: 'Ek baar acche se samajh liya toh dobara zaroorat nahi padti' },
            { key: 'B', text: '2-3 baar zaroor revise karta/karti hoon, tabhi confidence aata hai' },
            { key: 'C', text: 'Sirf jab actually use karna ho tab revise karta/karti hoon, warna nahi' },
            { key: 'D', text: 'Notes bana leta/leti hoon aur beech-beech mein glance maarta/maarti rehta/rehti hoon' },
          ],
        },
        {
          id: 'q11',
          text: 'Naya topic start karte waqt, agar wo kisi purani cheez se related hai jo aap already jaante hain — aap kya karte hain?',
          options: [
            { key: 'A', text: 'Turant connect karta/karti hoon — "yeh toh us jaisa hi hai" — naya seekhna aasaan ho jaata hai' },
            { key: 'B', text: 'Purani knowledge ko side rakh ke bilkul fresh start karta/karti hoon, confusion se bachne ke liye' },
            { key: 'C', text: 'Thoda connect karta/karti hoon lekin zyada dependent nahi hota — case by case' },
            { key: 'D', text: 'Mujhe purana concept pehle revise karna padta hai, warna naya samajh nahi aata' },
          ],
        },
      ],
    },
    blueprintVerdicts: {
      pace: {
        high: 'Aap fast-paced learner hain — lambi cheezein skim karke seedha essence pakadte hain.',
        mid: 'Aapka pace balanced hai — na bahut slow, na bahut fast.',
        low: 'Aapko thorough, slow-paced content chahiye — jaldi mein cheezein miss ho jaati hain.',
      },
      theoryVsPractical: {
        high: 'Aap hands-on seekhte hain — pehle karke dekhna, phir samajhna aapka style hai.',
        mid: 'Theory aur practical dono ka mix aapke liye kaam karta hai.',
        low: 'Aapko pehle solid theory chahiye, uske baad hi practical mein confidence aata hai.',
      },
      structureNeed: {
        high: 'Aapko clear, step-by-step structure chahiye — flexible/random content confuse karta hai.',
        mid: 'Thoda structure helpful hai, lekin poori rigidity zaroori nahi.',
        low: 'Aap flexible learner hain — structure ki zyada zaroorat nahi padti.',
      },
      depth: {
        high: 'Aapko root-cause tak jaana pasand hai — surface-level explanation satisfy nahi karta.',
        mid: 'Aap zaroorat ke hisaab se depth mein jaate hain, hamesha nahi.',
        low: 'Surface-level understanding aapke liye kaafi hai — deep-diving se pace slow hoti hai.',
      },
      languageComplexity: {
        high: 'Technical jargon se aapko problem nahi — comfortable hain complex vocabulary ke saath.',
        mid: 'Kuch jargon chalta hai, lekin bahut technical language confuse kar sakti hai.',
        low: 'Aapko simple, everyday language mein samjhaya jaana chahiye — jargon se dooriyan.',
      },
      storytelling: {
        high: 'Real-life stories aur analogies se concepts aapke mind mein permanently baith jaate hain.',
        mid: 'Stories help karti hain, lekin zaroori nahi har jagah.',
        low: 'Aapko direct, to-the-point explanation pasand hai — stories se distract ho sakte hain.',
      },
      repetitionNeed: {
        high: 'Aapko multiple revisions chahiye deep clarity ke liye — ek baar padhna kaafi nahi.',
        mid: 'Thoda revision helpful hota hai, lekin zyada zaroorat nahi.',
        low: 'Ek baar samajh liya to dobara revise karne ki zaroorat kam hi padti hai.',
      },
      priorKnowledgeComfort: {
        high: 'Naye topics ko purani knowledge se connect karke aap jaldi seekhte hain.',
        mid: 'Kabhi kabhi prior knowledge se connect karte hain, hamesha nahi.',
        low: 'Aapko fresh start pasand hai — purani knowledge se connect karna zaroori nahi lagta.',
      },
    },
    authErrors: {
      sessionExpired: 'Session mil nahi rahi, dobara sign in karo.',
      emailAlreadyInUse: 'Ye email pehle se registered hai — sign in karo.',
      weakPassword: 'Password kam se kam 6 characters ka hona chahiye.',
      invalidEmail: 'Email sahi format me nahi hai.',
      wrongPassword: 'Galat password.',
      userNotFound: 'Ye email registered nahi hai.',
      operationNotAllowed: 'Email/Password sign-in Firebase Console me enable nahi hai.',
      unauthorizedDomain: 'Ye website domain Firebase Console me authorized nahi hai.',
      popupBlocked: 'Browser ne popup block kar diya — popup allow karo aur dobara try karo.',
      popupClosedByUser: 'Google popup band ho gaya sign-in complete hone se pehle.',
      genericAuthError: 'Kuch gadbad ho gayi, dobara try karo.',
    },
    authScreen: {
      signOutBtn: 'Sign out ({0})',
      subtitleCreate: 'Naya account banao',
      subtitleSignin: 'Apne account se sign in karo',
      namePlaceholder: 'Naam',
      emailPlaceholder: 'Email',
      passwordPlaceholder: 'Password',
      createAccountCta: 'Create Account',
      signInCta: 'Sign In',
      orDivider: 'OR',
      googleCta: 'Continue with Google',
      switchToSignin: 'Pehle se account hai? Sign in karo',
      switchToCreate: 'Naya user ho? Account banao',
      validationEmailPassword: 'Sahi email aur kam se kam 6-character password daalo.',
      validationName: 'Apna naam daalo.',
    },
    authPrompt: {
      signInButton: 'Sign in',
      guestTitle: 'Apna free account banao',
      featureTitle: '{0} use karne ke liye sign in karo',
      subtitle: 'Bas kuch second lagte hain. Guest ke roop mein jo bhi kiya, sab safe rahega.',
      notNow: 'Abhi nahi',
      lockedTitle: 'Aage badhne ke liye sign in karo',
      lockedBody: '{0} ke liye free account chahiye. Tumhara Mind Blueprint, video search aur guest ke roop mein kiya hua sab kuch safe rahega.',
      lockedCta: 'Sign in karo ya account banao',
      roadmapPending: 'Sign in karte hi tumhara roadmap ban jayega.',
      guestBadge: 'Guest',
      guestAccountNote: 'Tum Learning OS guest ke roop mein use kar rahe ho. Roadmap, notes, tests, mentor aur baaki sab kholne ke liye sign in karo.',
    },
    errorBoundary: {
      title: 'Kuch galat ho gaya',
      body: 'App mein ek error aa gaya. Reload try karo — agar problem rahe toh local data clear karke reload karo (progress/roadmap wapas nahi milega, isliye pehle sirf reload try karo).',
      reloadCta: 'Reload',
      clearDataCta: 'Local data clear karke reload karo',
    },
    deepDiveChat: {
      badge: 'Deep Dive · Optional',
      questionOf: 'Sawaal {0} / {1}',
      answerPlaceholder: 'Apna jawab yahan likho...',
      submitCta: 'Submit',
      nextCta: 'Next',
      processingText: 'Profile update ho raha hai...',
      closeCta: 'Close',
      errors: {
        noResponse: 'Response samajh nahi aaya, phir se try karo ya skip karo.',
        noProfile: 'Profile unavailable.',
        generic: 'Kuch gadbad ho gayi.',
      },
    },
    deepDiveQuestions: [
      'Koi recent topic bataiye jo aapko samajhne mein dikkat hui — kya problem thi exactly?',
      'Jab koi concept achhe se "click" ho jaata hai aapke liye, wo moment kaisa hota hai? Ek example dijiye.',
      'Kal se ek bilkul naya subject start karna ho jisme kuch pata nahi — sabse pehla step kya lenge?',
    ],
    tasteOnboarding: {
      badge: 'Video Taste · Alternative to quiz',
      formTitle: 'Learning Profile',
      formSubtitle: '',
      urlPlaceholder: 'https://youtube.com/watch?v=...',
      watchedCheckbox: 'Maine yeh video pura dekha hai',
      linkNotRecognized: '(link samajh nahi aaya)',
      addAnotherCta: '+ Ek aur video add karo',
      analyzeCta: 'Analyze {0} Videos',
      validationHint: '',
      analyzingText: 'Videos analyze ho rahe hain — thoda time lagega...',
      videoFallbackLabel: 'Video {0}',
      doneTitle: 'Profile update ho gaya',
      doneSubtitle: '{0} video{1} ke analysis se banaya gaya',
      doneCta: 'Done',
      retryCta: 'Phir Try Karo',
      errors: { noneAnalyzed: 'Koi bhi video analyze nahi ho paaya. Links check karke phir try karo.' },
    },
    revisionTasks: {
      day1: 'Deep read karo — samjho WHY, sirf WHAT nahi',
      day3: 'Isse 3-4 alag real examples pe apply karo',
      day7: 'Kisi ko explain karke sikhao — bina notes dekhe',
      day15: 'Advanced applications aur edge cases dhundo',
      day30: 'Related concepts se connect karo, pattern dekho',
      day60: 'Final recall check — bina dekhe pura explain karo',
      fallback: 'Is topic ko revise karo',
    },
    roadmap: {
      header: { title: 'Your Roadmap', subtitle: '' },
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
      noActiveGoal: 'Koi active goal nahi hai.' ,
      generateForm: {
        label: 'Kya seekhna hai?',
        placeholder: 'Aap kya seekhna chahte ho?',
        generateCta: 'Generate Roadmap',
        generatingCta: 'Roadmap ban raha hai...',
        examLabel: 'Kisi specific exam/board ke liye?',
        examOptional: '(optional)',
        examPlaceholder: 'jaise CBSE Class 10, JEE, NEET — khaali chhodo agar general learning hai',
        examHint: '',
        weeklyTimeLabel: 'Weekly time available',
        weeklyTimeHint: '',
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
        bridgeHint: '',
        deepDiveCta: '2 quick sawaal poochu? Better matched videos milenge (optional)',
        watchVideosCta: 'Watch videos',
        searchingCta: 'Dhundh raha hoon...',
        savedVideoCta: 'Saved video',
        markCompleteCta: 'Maine ye already seekh liya — mark as complete',
        challengeTitle: '',
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
        doneLabel: 'Done',
        doneCta: 'Done',
        reviewNowCta: 'Review Now',
        reviewingCta: 'Reviewing…',
      },
      emptyState: {
        noRevisionTitle: 'Abhi koi revision nahi',
        noRevisionBody: '',
        allCaughtUpTitle: 'All caught up!',
        allCaughtUpBody: 'No items in this category right now.',
      },
    },
    notebook: {
      tabNotebook: "Meri notebook",
      tabAi: "AI notes",
      searchPlaceholder: "Title, tag ya text dhundo...",
      newNote: "Naya note",
      newFolder: "Naya folder",
      untitled: "Bina naam ka note",
      folders: "Folders",
      viewAll: "Saare notes",
      viewFavorites: "Favorites",
      viewArchive: "Archive",
      viewTrash: "Trash",
      sortRecent: "Haal mein badle",
      sortCreated: "Naye bane hue",
      sortTitle: "Naam A-Z",
      allTags: "Saare tags",
      emptyTitle: "Tumhari notebook khaali hai",
      emptySubtitle: "",
      emptySearch: "Search se koi note nahi mila.",
      emptyTrash: "Trash khaali hai.",
      emptyArchive: "Koi archived note nahi.",
      emptyFavorites: "Abhi koi favorite note nahi.",
      emptyFolder: "Is folder mein abhi koi note nahi.",
      pages: "pages",
      edited: "Badla",
      rename: "Naam badlo",
      duplicate: "Copy banao",
      move: "Folder mein daalo",
      pin: "Upar pin karo",
      unpin: "Pin hatao",
      favorite: "Favorites mein jodo",
      unfavorite: "Favorites se hatao",
      archive: "Archive karo",
      unarchive: "Archive se nikalo",
      editTags: "Tags badlo",
      moveToTrash: "Trash mein daalo",
      restore: "Wapas lao",
      deleteForever: "Hamesha ke liye hatao",
      emptyTrashBtn: "Trash khaali karo",
      select: "Chuno",
      selected: "{0} chune gaye",
      cancel: "Cancel",
      moveHere: "Yahan daalo",
      rootFolder: "Koi folder nahi (sabse upar)",
      moveTitle: "Kahan daalna hai...",
      newSubfolder: "Naya subfolder",
      renameFolder: "Folder ka naam badlo",
      deleteFolder: "Folder hatao",
      folderNamePrompt: "Folder ka naam",
      renameFolderPrompt: "Folder ka naya naam",
      renamePrompt: "Note ka title",
      tagsPrompt: "Tags, comma se alag karke",
      confirmDeleteForever: "Hamesha ke liye hatana hai? Isse wapas nahi la sakte.",
      confirmEmptyTrash: "Trash ki har cheez hamesha ke liye hatani hai? Isse wapas nahi la sakte.",
      confirmDeleteFolderWithNotes: "Is folder mein {0} note hain. Woh hatenge nahi - ek level upar chale jayenge. Folder hatana hai?",
      confirmDeleteFolder: "Yeh folder hatana hai?",
      trashInfo: "Trash ke notes 30 din baad apne aap hat jaate hain.",
      undo: "Wapas karo",
      toastTrashed: "Trash mein gaya",
      toastMoved: "Daal diya",
      toastArchived: "Archive hua",
      toastUnarchived: "Archive se nikla",
      toastRestored: "Wapas aa gaya",
      toastDuplicated: "Copy ban gayi",
      toastFolderDeleted: "Folder hata",
      saving: "Save ho raha hai...",
      saved: "Save ho gaya",
      savedLocal: "Is device par save hai - abhi sync nahi hua",
      offline: "Offline - is device par save hai",
      saveError: "Save nahi ho paya - storage bhara hai ya band hai",
      syncNow: "Abhi sync karo",
      study: {
        statusNotStarted: "Shuru nahi kiya",
        statusLearning: "Seekh raha hoon",
        statusNeedsRevision: "Dohrana hai",
        statusMastered: "Pakka ho gaya",
        statusLabel: "Padhai ki sthiti",
        confidenceLabel: "Aapko kitna bharosa hai?",
        confidenceNone: "Bataya nahi",
        examDateLabel: "Exam ki date",
        clearDate: "Date hatao",
        details: "Padhai ki jaankari",
        save: "Save karo",
        filterAll: "Saari sthitiyan",
        filterExamSoon: "2 hafte mein exam",
        sortExam: "Exam date (sabse paas)",
        examToday: "Exam aaj hai",
        examTomorrow: "Exam kal hai",
        examInDays: "Exam {0} din mein",
        examPast: "Exam {0} din pehle tha",
        confidenceShort: "Bharosa {0}/5",
      },
      pageOps: {
        deleteConfirm: "Page {0} hatana hai? Iska text aur handwriting hat jayegi. Hatane ke turant baad wapas la sakte ho.",
        deleteBtn: "Page hatao",
        needOnePage: "Note mein kam se kam ek page rehna chahiye.",
        toastDeleted: "Page hat gaya",
        moveUp: "Page upar karo",
        moveDown: "Page neeche karo",
        bookmark: "Is page par bookmark lagao",
        removeBookmark: "Bookmark hatao",
        pageOf: "Page {0} / {1}",
        duplicatePage: "Page ki copy banao",
        addPageAfter: "Iske baad page jodo",
        panelTitle: "Pages",
        panelAdd: "Page jodo",
        template: "Template",
        paper: "Kaagaz",
        collapsePanel: "Pages panel chhupao",
        expandPanel: "Pages panel dikhao",
        tplBlank: "Saada",
        tplRuled: "Line wala",
        tplDotted: "Bindu wala",
        tplGrid: "Grid",
        tplCornell: "Cornell",
        zoomIn: "Zoom in",
        zoomOut: "Zoom out",
        zoomFit: "Fit",
        pagesButton: "Pages",
        closePanel: "Band karo",
      },
      ink: {
        modeType: "Type",
        modePen: "Pen",
        modeHighlighter: "Highlighter",
        modeEraser: "Rubber",
        penBallpoint: "Ballpen",
        penFountain: "Fountain pen",
        penFelt: "Felt tip",
        penPencil: "Pencil",
        penBrush: "Brush",
        penCalligraphy: "Calligraphy",
        penFineliner: "Fine liner",
        penMarker: "Marker",
        penDotted: "Dotted line",
        penType: "Pen ka type",
        color: "Rang",
        colorAuto: "Kaala / safed (theme ke hisaab se)",
        customColor: "Apna rang",
        recentColors: "Haal ke rang",
        thickness: "Motai",
        smoothing: "Smoothing",
        favorites: "Favourite pens",
        saveFavorite: "Is pen ko favourite mein rakho",
        removeFavorite: "Favourite se hatao",
        fingerDraw: "Ungli se likho",
        fingerDrawOn: "Ungli se likhna chalu",
        fingerDrawOff: "Ungli se scroll",
        more: "Aur",
        resetPen: "Pen settings reset karo",
        eraserStroke: "Poori line",
        eraserArea: "Line ka hissa",
        targetAll: "Sab kuch",
        targetInk: "Sirf pen",
        targetHl: "Sirf highlight",
        eraserSize: "Rubber ka size",
        eraseAll: "Poora page mitao",
        eraseAllConfirm: "Is page ki saari handwriting mitani hai? Isse wapas la sakte ho.",
        undo: "Drawing undo",
        redo: "Drawing redo",
        modeSelect: "Chuno",
        selLasso: "Lasso",
        selRect: "Rectangle",
        selAll: "Sab chuno",
        selHint: "",
        selCount: "{0} chune gaye",
        selDelete: "Hatao",
        selCopy: "Copy",
        selCut: "Cut",
        selPaste: "Paste",
        selDuplicate: "Duplicate",
        selColor: "Rang badlo",
        selWidth: "Motai badlo",
        selFront: "Aage lao",
        selBack: "Peeche bhejo",
        selNeaten: "Shapes seedhi karo",
        selNeatNone: "Seedhi karne layak koi line ya shape nahi mili.",
        selToText: "Handwriting se text",
        shapeSnap: "Ruknay par shape seedhi karo",
        ocrConsent: "Aapki handwriting padhne ke liye chuni hui lines ki ek tasveer AI service ko bheji jayegi. Aapki handwriting badlegi nahi. Aage badhein?",
        ocrTitle: "Handwriting text mein",
        ocrLoading: "Aapki handwriting padhi ja rahi hai...",
        ocrError: "Handwriting padh nahi paya. Dobara try karo ya kam hissa chuno.",
        ocrEmpty: "Chune hue hisse mein kuch likha nahi mila.",
        ocrLowConf: "कुछ शब्द गलत हो सकते हैं ([?] = पढ़ा नहीं गया)।" ,
        ocrEdit: "",
        ocrInsert: "Text ki tarah daalo",
        ocrInsertDelete: "Daalo aur handwriting hatao",
        ocrCancel: "Cancel",
      },
      editor: {
        back: "Notes par wapas",
        titlePlaceholder: "Title",
        bodyPlaceholder: "Likhna shuru karo...",
        addPage: "Page jodo",
        pageLabel: "Page",
        loadError: "Yeh note khul nahi paya.",
        undo: "Undo",
        redo: "Redo",
        normalText: "Normal text",
        heading1: "Heading 1",
        heading2: "Heading 2",
        heading3: "Heading 3",
        bold: "Bold",
        italic: "Italic",
        underline: "Underline",
        strike: "Kata hua",
        textColor: "Text ka rang",
        resetColor: "Normal rang",
        highlight: "Highlight",
        removeHighlight: "Highlight hatao",
        superscript: "Upar chhota (superscript)",
        subscript: "Neeche chhota (subscript)",
        bulletList: "Bullet list",
        numberedList: "Number wali list",
        checklist: "Checklist",
        quote: "Quote",
        codeBlock: "Code block",
        inlineCode: "Inline code",
        link: "Link",
        linkPrompt: "Link ka address (https://...)",
        removeLink: "Link hatao",
        table: "Table jodo",
        addRow: "Row jodo",
        addColumn: "Column jodo",
        deleteRow: "Row hatao",
        deleteColumn: "Column hatao",
        deleteTable: "Table hatao",
        divider: "Line",
        alignLeft: "Left",
        alignCenter: "Beech mein",
        alignRight: "Right",
        clearFormat: "Formatting hatao",
        fontSize: "Text size",
        sizeSmall: "Chhota",
        sizeNormal: "Normal",
        sizeLarge: "Bada",
        sizeHuge: "Bahut bada",
        find: "Dhundo aur badlo",
        findPlaceholder: "Dhundo...",
        replacePlaceholder: "Isse badlo...",
        replace: "Badlo",
        replaceAll: "Sab badlo",
        noMatches: "Kuch nahi mila",
        matchCount: "{1} mein se {0}",
        next: "Agla",
        prev: "Pichla",
        close: "Band karo",
        words: "{0} words",
        chars: "{0} characters",
        readTime: "{0} min mein padho",
        focusMode: "Focus mode",
        exitFocus: "Focus mode band karo",
        readAloud: "Padhkar sunao",
        stopReading: "Padhna roko",
        shortcuts: "Keyboard shortcuts",
        shortcutsTitle: "Shortcuts",
        pageHint: "Page",
      },
    },
    notes: {
      header: { title: 'Deep Learning Notes', subtitle: '' },
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
      sourceVideoLink: 'Source video dekho',
      transcriptSourceNote: 'Video transcript se banaye gaye notes',
      metadataSourceNote: 'Transcript available nahi thi — sirf title/description se banaye gaye',
      emptyState: {
        title: 'Enter a topic for comprehensive, deep learning notes',
        subtitle: 'Goes beyond basics - covers WHY, HOW, and WHERE',
      },
    },
    videos: {
      header: { title: 'Videos', subtitle: '' },
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
      selectVideoPrompt: '',
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
      header: { title: 'AI Mentor', subtitle: '' },
      welcomeMessage: 'Namaste! Aaj kya seekhna hai?',
      suggestedPrompts: [
        { icon: '', label: 'Explain simply', prompt: 'Explain this concept simply' },
        { icon: '', label: 'Deep dive', prompt: 'Explain this in depth with examples' },
        { icon: '', label: 'Real analogy', prompt: 'Give me a real-world analogy' },
        { icon: '', label: 'Quiz me', prompt: 'Generate a quiz on this topic' },
        { icon: '', label: 'Project idea', prompt: 'Suggest a mini project' },
        { icon: '', label: 'Find mistake', prompt: 'What are common mistakes?' },
      ],
      youLabel: 'You',
      mentorLabel: 'Mentor',
      inputPlaceholder: 'Ask anything...',
      sendCta: 'Send',
      errors: {
        generic: 'Kuch gadbad ho gayi ({0}). Thodi der mein phir try karein.',
        noResponse: 'Response nahi mil paaya, phir se try karein.',
        truncatedSuffix:
          '\n\n_( Response lambi thi aur beech mein kat gayi — "Deep dive" ki jagah chhota sawaal poochhein)_',
        network: 'Network error aaya. Internet check karein aur phir try karein.',
      },
    },
    progress: {
      header: { title: 'Progress', subtitle: '' },
      stats: { completion: 'Completion', streak: 'Streak', totalWatchTime: 'Total Watch Time', retention: 'Retention' },
      completionBar: { topicsDone: '{0}/{1} topics done', inProgress: '{0} in progress' },
      emptyState: {
        title: 'Abhi kuch track karne ko nahi hai',
        body: '',
      },
      timeTracking: { title: 'Time Tracking', last7Days: 'Last 7 days: {0} min' },
      masteryHeatmap: { title: 'Mastery Heatmap', legendWeak: 'Weak', legendOk: 'OK', legendStrong: 'Strong' },
      retentionDetail: { title: 'Retention', dueToday: 'Due Today', overdue: 'Overdue', mastered: 'Mastered' },
      weakAreas: { title: 'Weak Areas', noneFound: 'Koi weak topic nahi mila — sab theek chal raha hai.' },
    },
    research: {
      header: { title: 'Research', subtitle: '' },
      searchPlaceholder: 'Kya jaanna hai?',
      searchCta: 'Search',
      notGroundedNote:
        'Live search source nahi mila is baar — neeche wala jawab general knowledge se hai, current cheezon ke liye double-check kar lena',
      genericError: 'Research failed',
      embedded: { title: 'Research (video ke saath saath)', hint: '' },
      closeAria: 'Close research panel',
      emptyState: { title: 'Abhi koi result nahi', subtitle: '' },
    },
    currentAffairs: {
      title: 'Current Affairs',
      subtitle: '',
      streak: '{0} din ki streak',
      previousDays: 'Pichhle din',
      today: 'Aaj',
      loading: 'Aaj ka Current Affairs ban raha hai…',
      retry: 'Phir se try karo',
      dayNotAvailable: 'Ye din available nahi hai.',
      tabs: { all: 'Sab', national: 'National', international: 'International', economy: 'Economy', sports: 'Sports', scitech: 'Sci & Tech' },
      sourceLabel: 'Source',
      aiNote: 'Ye public news se AI ne short mein banaya hai. Zaroori baat ke liye original source zaroor check karo.',
      quizTitle: 'Quick quiz',
      quizSubtitle: 'Aaj ke points se 5 sawaal',
      correct: 'Sahi!',
      wrong: 'Sahi nahi.',
      scoreLine: 'Tumhara score {0} / {1}',
      streakDone: 'Aaj ka Current Affairs complete',
      mistakesTitle: 'Jo sawaal chhoot gaye',
      correctAnswerLabel: 'Sahi jawab',
    },
    channelDigest: {
      switchNews: 'Newspapers',
      switchChannels: 'YouTube channels',
      subtitle: '',
      addPlaceholder: 'Channel link, @handle ya naam',
      addButton: 'Channel add karo',
      adding: 'Add ho raha hai…',
      limitReached: 'Tum maximum {0} channels add kar sakte ho.',
      noChannels: 'Koi YouTube channel add karo aur kal ke uske saare videos ka written summary pao.',
      removeAria: '{0} hatao',
      dayLabel: 'Kal ({0}) — raat 12 se raat 12 tak ke saare videos',
      loading: 'Kal ke videos dhundhe ja rahe hain…',
      retry: 'Phir se try karo',
      noVideos: 'Is channel ne kal koi video nahi dala.',
      progress: '{1} mein se {0} videos cover hue',
      summarising: 'Summary ban rahi hai…',
      videoFailed: 'Is video ki summary nahi ban payi.',
      retryFailed: '{0} failed wale phir se karo',
      videosTitle: 'Videos',
      noTranscript: 'Sirf title aur description se summary bani — transcript available nahi tha.',
      watch: 'Dekho',
      tabs: { all: 'Sab', national: 'National', international: 'International', economy: 'Economy', sports: 'Sports', scitech: 'Sci & Tech', other: 'Other' },
      aiNote: 'Ye channel ke apne videos se AI ne likha hai. Isme wahi hai jo channel ne kaha, verified facts nahi — zaroori baat ke liye video zaroor dekho.',
    },
  },
};
