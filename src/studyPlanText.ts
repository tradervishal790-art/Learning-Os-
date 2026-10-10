import type { Locale } from './i18n/translations';

// Static copy for the "My Files" study plan (no AI). en / hi / hinglish.
export interface StudyPlanText {
  tabRoadmap: string;
  tabFiles: string;
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
  mastered: string; // {0}
  addTitle: string;
  addHint: string;
  subject: string;
  subjectPlaceholder: string;
  pickFiles: string;
  splitPdf: string;
  wholePdf: string;
  parts: string; // {0}
  photosEach: string;
  photosGroup: string; // {0}
  add: string;
  adding: string;
  maxSubjects: string;
  needSubject: string;
  needFiles: string;
  addFailed: string;
  allTopics: string;
  remove: string;
  confirmRemove: string;
  close: string;
  fileMissing: string;
  onDevice: string;
  emptyTitle: string;
  emptyBody: string;
}

export const studyPlanText: Record<Locale, StudyPlanText> = {
  en: {
    tabRoadmap: 'Roadmap topics',
    tabFiles: 'My files',
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
    nothingNew: 'No new topic left. Add more files.',
    allClear: 'Nothing to revise today.',
    upcoming: 'Coming up',
    mastered: '{0} mastered',
    addTitle: 'Add your files',
    addHint: 'Each photo or PDF becomes a topic (T1, T2, T3…). Files stay on this device.',
    subject: 'Subject',
    subjectPlaceholder: 'e.g. Maths',
    pickFiles: 'Choose photos / PDFs',
    splitPdf: 'Split each PDF',
    wholePdf: 'Keep as one topic',
    parts: '{0} parts',
    photosEach: 'Each photo = 1 topic',
    photosGroup: 'Group photos into {0} topics',
    add: 'Add',
    adding: 'Adding…',
    maxSubjects: 'You can study 2 subjects at a time.',
    needSubject: 'Enter a subject name.',
    needFiles: 'Choose at least one file.',
    addFailed: 'Could not add the files. Storage may be full.',
    allTopics: 'All topics',
    remove: 'Remove',
    confirmRemove: 'Remove this topic and its file?',
    close: 'Close',
    fileMissing: 'This file is not on this device.',
    onDevice: 'Saved on this device only',
    emptyTitle: 'Add your first file',
    emptyBody: 'Upload photos or PDFs and the app will tell you every day what to read and what to revise.',
  },
  hi: {
    tabRoadmap: 'रोडमैप टॉपिक',
    tabFiles: 'मेरी फ़ाइलें',
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
    nothingNew: 'कोई नया टॉपिक नहीं बचा। और फ़ाइलें जोड़ें।',
    allClear: 'आज दोहराने के लिए कुछ नहीं।',
    upcoming: 'आगे आने वाले',
    mastered: '{0} पक्के हुए',
    addTitle: 'अपनी फ़ाइलें जोड़ें',
    addHint: 'हर फ़ोटो या PDF एक टॉपिक बनेगा (T1, T2, T3…)। फ़ाइलें इसी डिवाइस पर रहती हैं।',
    subject: 'विषय',
    subjectPlaceholder: 'जैसे गणित',
    pickFiles: 'फ़ोटो / PDF चुनें',
    splitPdf: 'हर PDF को बाँटें',
    wholePdf: 'एक ही टॉपिक रखें',
    parts: '{0} भाग',
    photosEach: 'हर फ़ोटो = 1 टॉपिक',
    photosGroup: 'फ़ोटो को {0} टॉपिक में बाँटें',
    add: 'जोड़ें',
    adding: 'जोड़ रहे हैं…',
    maxSubjects: 'आप एक समय में 2 विषय पढ़ सकते हैं।',
    needSubject: 'विषय का नाम लिखें।',
    needFiles: 'कम से कम एक फ़ाइल चुनें।',
    addFailed: 'फ़ाइलें नहीं जुड़ सकीं। स्टोरेज भरा हो सकता है।',
    allTopics: 'सभी टॉपिक',
    remove: 'हटाएँ',
    confirmRemove: 'यह टॉपिक और उसकी फ़ाइल हटाएँ?',
    close: 'बंद करें',
    fileMissing: 'यह फ़ाइल इस डिवाइस पर नहीं है।',
    onDevice: 'सिर्फ़ इसी डिवाइस पर सेव',
    emptyTitle: 'पहली फ़ाइल जोड़ें',
    emptyBody: 'फ़ोटो या PDF डालें, ऐप रोज़ बताएगा क्या पढ़ना है और क्या दोहराना है।',
  },
  hinglish: {
    tabRoadmap: 'Roadmap topics',
    tabFiles: 'Meri files',
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
    nothingNew: 'Koi naya topic nahi bacha. Aur files add karo.',
    allClear: 'Aaj revise karne ko kuch nahi.',
    upcoming: 'Aage aane wale',
    mastered: '{0} pakke hue',
    addTitle: 'Apni files add karo',
    addHint: 'Har photo ya PDF ek topic banega (T1, T2, T3…). Files isi device par rehti hain.',
    subject: 'Subject',
    subjectPlaceholder: 'jaise Maths',
    pickFiles: 'Photos / PDFs chuno',
    splitPdf: 'Har PDF ko baanto',
    wholePdf: 'Ek hi topic rakho',
    parts: '{0} parts',
    photosEach: 'Har photo = 1 topic',
    photosGroup: 'Photos ko {0} topics me baanto',
    add: 'Add karo',
    adding: 'Add ho raha hai…',
    maxSubjects: 'Aap ek time par 2 subjects padh sakte ho.',
    needSubject: 'Subject ka naam likho.',
    needFiles: 'Kam se kam ek file chuno.',
    addFailed: 'Files add nahi hui. Storage full ho sakta hai.',
    allTopics: 'Saare topics',
    remove: 'Hatao',
    confirmRemove: 'Ye topic aur uski file hatani hai?',
    close: 'Band karo',
    fileMissing: 'Ye file is device par nahi hai.',
    onDevice: 'Sirf isi device par saved',
    emptyTitle: 'Pehli file add karo',
    emptyBody: 'Photos ya PDFs daalo, app roz batayega kya padhna hai aur kya revise karna hai.',
  },
};
