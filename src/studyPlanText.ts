import type { Locale } from './i18n/translations';

// Static copy for the "My files" boxes plan (no AI). en / hi / hinglish.
export interface StudyPlanText {
  tabRoadmap: string;
  tabFiles: string;
  subtitle: string;
  todayTitle: string;
  newTopic: string;
  revisions: string;
  overdue: string;
  dueToday: string;
  daysLate: string; // {0}
  revisionDay: string; // {0}
  open: string;
  done: string;
  doneToday: string;
  nothingNew: string;
  allClear: string;
  upcoming: string;
  finished: string; // {0}
  boxesTitle: string;
  boxEmpty: string;
  boxReady: string;
  boxLearned: string; // {0} date
  boxProgress: string; // {0}/4
  addFiles: string;
  uploadHere: string;
  removeFile: string;
  removeBox: string;
  confirmRemoveBox: string;
  addBox: string; // {0} = T number
  splitLabel: string;
  splitBtn: string;
  parts: string; // {0}
  addSubject: string;
  subjectPlaceholder: string;
  save: string;
  maxSubjects: string;
  boxLimit: string;
  addFailed: string;
  splitFailed: string;
  cleared: string; // {0} = T numbers
  clearedUnseen: string; // {0} = T numbers, {1} = unseen count
  boxEnds: string; // {0} date
  close: string;
  fileMissing: string;
  onDevice: string;
  defaultSubject: string;
}

export const studyPlanText: Record<Locale, StudyPlanText> = {
  en: {
    tabRoadmap: 'Roadmap topics',
    tabFiles: 'My files',
    subtitle: 'Put your files in a box. Each topic comes back on Day +1, +3, +7 and +15, then the box clears itself on its last date.',
    todayTitle: "Today's plan",
    newTopic: 'New topic',
    revisions: 'Revise',
    overdue: 'Overdue',
    dueToday: 'Today',
    daysLate: '{0} day(s) late',
    revisionDay: 'Day +{0}',
    open: 'Open',
    done: 'Done',
    doneToday: 'Learned today',
    nothingNew: 'No new topic yet. Add files to a box below.',
    allClear: 'Nothing to revise today.',
    upcoming: 'Coming up',
    finished: '{0} boxes ended',
    boxesTitle: 'Your boxes',
    boxEmpty: 'Empty',
    boxReady: 'Ready to learn',
    boxLearned: 'Learned {0}',
    boxProgress: 'Revised {0}/4',
    addFiles: 'Add photos / PDFs',
    uploadHere: 'Add anything here: photos, PDFs',
    removeFile: 'Remove',
    removeBox: 'Delete box',
    confirmRemoveBox: 'Delete this box and its files?',
    addBox: 'Add T{0}',
    splitLabel: 'Split this PDF into',
    splitBtn: 'Split',
    parts: '{0} parts',
    addSubject: '+ Subject',
    subjectPlaceholder: 'Subject name',
    save: 'Save',
    maxSubjects: 'You can study 2 subjects at a time.',
    boxLimit: 'Box limit reached.',
    addFailed: 'Could not add the files. Storage may be full.',
    splitFailed: 'Could not split this PDF.',
    cleared: '{0} ended and was cleared. The number is free for a new topic.',
    clearedUnseen: '{0} ended and was cleared. {1} revision(s) were unseen.',
    boxEnds: 'Ends {0}',
    close: 'Close',
    fileMissing: 'This file is not on this device.',
    onDevice: 'Files are saved on this device only.',
    defaultSubject: 'My topics',
  },
  hi: {
    tabRoadmap: 'रोडमैप टॉपिक',
    tabFiles: 'मेरी फ़ाइलें',
    subtitle: 'अपनी फ़ाइलें एक बॉक्स में रखें। हर टॉपिक दिन +1, +3, +7 और +15 पर लौटता है, फिर बॉक्स अपने आप खाली हो जाता है।',
    todayTitle: 'आज की योजना',
    newTopic: 'नया टॉपिक',
    revisions: 'दोहराएँ',
    overdue: 'बाकी (पुराना)',
    dueToday: 'आज',
    daysLate: '{0} दिन देरी',
    revisionDay: 'दिन +{0}',
    open: 'खोलें',
    done: 'हो गया',
    doneToday: 'आज पढ़ा',
    nothingNew: 'अभी कोई नया टॉपिक नहीं। नीचे किसी बॉक्स में फ़ाइलें जोड़ें।',
    allClear: 'आज दोहराने के लिए कुछ नहीं।',
    upcoming: 'आगे आने वाले',
    finished: '{0} पूरे हुए',
    boxesTitle: 'आपके बॉक्स',
    boxEmpty: 'खाली',
    boxReady: 'पढ़ने के लिए तैयार',
    boxLearned: '{0} को पढ़ा',
    boxProgress: 'दोहराया {0}/4',
    addFiles: 'फ़ोटो / PDF जोड़ें',
    uploadHere: 'यहाँ कुछ भी डालें: फ़ोटो, PDF',
    removeFile: 'हटाएँ',
    removeBox: 'बॉक्स हटाएँ',
    confirmRemoveBox: 'यह बॉक्स और उसकी फ़ाइलें हटाएँ?',
    addBox: 'T{0} जोड़ें',
    splitLabel: 'इस PDF को बाँटें',
    splitBtn: 'बाँटें',
    parts: '{0} भाग',
    addSubject: '+ विषय',
    subjectPlaceholder: 'विषय का नाम',
    save: 'सेव',
    maxSubjects: 'आप एक समय में 2 विषय पढ़ सकते हैं।',
    boxLimit: 'बॉक्स की सीमा पूरी हो गई।',
    addFailed: 'फ़ाइलें नहीं जुड़ सकीं। स्टोरेज भरा हो सकता है।',
    splitFailed: 'यह PDF बाँटी नहीं जा सकी।',
    cleared: '{0} की अवधि पूरी हुई और हट गया। नंबर अब नए टॉपिक के लिए खाली है।',
    clearedUnseen: '{0} की अवधि पूरी हुई और हट गया। {1} रिवीज़न देखे नहीं गए।',
    boxEnds: 'खत्म: {0}',
    close: 'बंद करें',
    fileMissing: 'यह फ़ाइल इस डिवाइस पर नहीं है।',
    onDevice: 'फ़ाइलें सिर्फ़ इसी डिवाइस पर सेव रहती हैं।',
    defaultSubject: 'मेरे टॉपिक',
  },
  hinglish: {
    tabRoadmap: 'Roadmap topics',
    tabFiles: 'Meri files',
    subtitle: 'Apni files ek box me rakho. Har topic Day +1, +3, +7 aur +15 par wapas aata hai, phir box apne aap clear ho jata hai.',
    todayTitle: 'Aaj ka plan',
    newTopic: 'Naya topic',
    revisions: 'Revise karo',
    overdue: 'Overdue',
    dueToday: 'Aaj',
    daysLate: '{0} din late',
    revisionDay: 'Day +{0}',
    open: 'Kholo',
    done: 'Ho gaya',
    doneToday: 'Aaj padha',
    nothingNew: 'Abhi koi naya topic nahi. Neeche kisi box me files add karo.',
    allClear: 'Aaj revise karne ko kuch nahi.',
    upcoming: 'Aage aane wale',
    finished: '{0} complete hue',
    boxesTitle: 'Tumhare boxes',
    boxEmpty: 'Khali',
    boxReady: 'Padhne ke liye ready',
    boxLearned: '{0} ko padha',
    boxProgress: 'Revise kiya {0}/4',
    addFiles: 'Photos / PDFs add karo',
    uploadHere: 'Yahan kuch bhi daalo: photos, PDFs',
    removeFile: 'Hatao',
    removeBox: 'Box hatao',
    confirmRemoveBox: 'Ye box aur uski files hatani hain?',
    addBox: 'T{0} add karo',
    splitLabel: 'Is PDF ko baanto',
    splitBtn: 'Baanto',
    parts: '{0} parts',
    addSubject: '+ Subject',
    subjectPlaceholder: 'Subject ka naam',
    save: 'Save',
    maxSubjects: 'Aap ek time par 2 subjects padh sakte ho.',
    boxLimit: 'Box limit poori ho gayi.',
    addFailed: 'Files add nahi hui. Storage full ho sakta hai.',
    splitFailed: 'Ye PDF baanti nahi ja saki.',
    cleared: '{0} ki date poori hui aur clear ho gaya. Number ab naye topic ke liye khali hai.',
    clearedUnseen: '{0} ki date poori hui aur clear ho gaya. {1} revision dekhe nahi gaye.',
    boxEnds: 'Khatam: {0}',
    close: 'Band karo',
    fileMissing: 'Ye file is device par nahi hai.',
    onDevice: 'Files sirf isi device par saved rehti hain.',
    defaultSubject: 'Mere topics',
  },
};
