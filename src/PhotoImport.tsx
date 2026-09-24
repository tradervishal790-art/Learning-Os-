import { useState } from 'react';
import { Camera, FileCheck2, Loader2 } from 'lucide-react';
import type { TestQuestion } from './types';
import {
  MAX_IMPORT_PHOTOS,
  MAX_PDF_PAGES,
  prepareUpload,
  extractQuestionsFromPhoto,
  extractAnswersFromPhoto,
  toBuilderQuestions,
  applyAnswersInSequence,
  type ExtractedAnswer,
  type ExtractedQuestion,
} from './testImport';

// ============================================================
// PhotoImport.tsx
// Optional helpers inside the test builder ("My tests" only):
//   1. Add questions from up to 4 photos — every question found is added, no count limit.
//   2. Add answers from up to 4 photos of an answer sheet — a SEPARATE
//      section; answers are matched to questions strictly by sequence.
// The instruction panel language (हिन्दी / English) is the user's choice
// and only affects this panel's own text — never the test content.
// ============================================================

type Lang = 'en' | 'hi';
const LANG_KEY = 'learning_os_import_lang';

const TEXT = {
  en: {
    title: 'Add from photos or PDF (optional)',
    qTitle: '1. Add questions from photos or PDF',
    qHelp: `Choose up to ${MAX_IMPORT_PHOTOS} files: clear, straight photos and/or PDFs (up to ${MAX_PDF_PAGES} pages each) of your question paper. Select them in order. Every question found is added — no limit. Nothing is saved until you press Save Test.`,
    qButton: 'Read questions',
    aTitle: '2. Add answers (answer sheet — photo or PDF)',
    aInstructionTitle: 'Answer sheet instructions',
    aInstruction: [
      'The answer sheet must be in the SAME SEQUENCE as the questions: 1st answer → Question 1, 2nd answer → Question 2, and so on.',
      'Write MCQ answers as a letter (A / B / C / D) or a number (1–4).',
      "Don't skip any question — if one answer is missing, all the answers after it shift by one place.",
      `Up to ${MAX_IMPORT_PHOTOS} files (clear photos and/or PDFs), selected in order. You can also write an explanation next to each answer.`,
    ],
    aButton: 'Read answers & match',
    needQuestions: 'Add questions first, then add their answers.',
    reading: (i: number, n: number) => `Reading file ${i} of ${n}…`,
    addedQ: (n: number) => `${n} question(s) added below. Please check them, then add answers.`,
    addedA: (a: number, n: number) => `${a} of ${n} answers matched. Please review below.`,
    tooMany: (n: number) => `Only the first ${n} files will be used.`,
    none: 'No questions could be read from these files — try clearer ones.',
    noneA: 'No answers could be read from these files — try clearer ones.',
    chooseFiles: 'Choose files',
    filesChosen: (n: number) => `${n} file(s) selected`,
  },
  hi: {
    title: 'फोटो या PDF से जोड़ें (वैकल्पिक)',
    qTitle: '1. फोटो या PDF से सवाल जोड़ें',
    qHelp: `अपने प्रश्न-पत्र की ज़्यादा से ज़्यादा ${MAX_IMPORT_PHOTOS} फाइलें चुनें: साफ़, सीधी फोटो और/या PDF (हर PDF में ज़्यादा से ज़्यादा ${MAX_PDF_PAGES} पेज), और उन्हें क्रम से चुनें। इनमें जितने भी सवाल होंगे सब जुड़ जाएँगे — कोई सीमा नहीं। "Save Test" दबाने तक कुछ सेव नहीं होता।`,
    qButton: 'सवाल पढ़ें',
    aTitle: '2. जवाब जोड़ें (आंसर शीट — फोटो या PDF)',
    aInstructionTitle: 'आंसर शीट के निर्देश',
    aInstruction: [
      'आंसर शीट सवालों के उसी क्रम (sequence) में होनी चाहिए: पहला उत्तर → सवाल 1, दूसरा उत्तर → सवाल 2, और इसी तरह आगे।',
      'MCQ के उत्तर अक्षर (A / B / C / D) या संख्या (1–4) में लिखें।',
      'कोई सवाल न छोड़ें — अगर एक भी उत्तर छूट गया तो उसके बाद के सारे उत्तर एक जगह खिसक जाएँगे।',
      `ज़्यादा से ज़्यादा ${MAX_IMPORT_PHOTOS} फाइलें (साफ़ फोटो और/या PDF), क्रम से चुनी हुई। चाहें तो हर उत्तर के साथ उसकी व्याख्या भी लिख सकते हैं।`,
    ],
    aButton: 'जवाब पढ़ें और मिलाएँ',
    needQuestions: 'पहले सवाल जोड़ें, फिर उनके जवाब जोड़ें।',
    reading: (i: number, n: number) => `फाइल ${i} / ${n} पढ़ी जा रही है…`,
    addedQ: (n: number) => `${n} सवाल नीचे जुड़ गए। कृपया जाँच लें, फिर जवाब जोड़ें।`,
    addedA: (a: number, n: number) => `${n} में से ${a} जवाब मिलाए गए। कृपया नीचे जाँच लें।`,
    tooMany: (n: number) => `सिर्फ़ पहली ${n} फाइलें इस्तेमाल होंगी।`,
    none: 'इन फाइलों से कोई सवाल नहीं पढ़ा जा सका — ज़्यादा साफ़ फाइल लें।',
    noneA: 'इन फाइलों से कोई जवाब नहीं पढ़ा जा सका — ज़्यादा साफ़ फाइल लें।',
    chooseFiles: 'फाइलें चुनें',
    filesChosen: (n: number) => `${n} फाइलें चुनी गईं`,
  },
} as const;

function loadLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

interface PhotoImportProps {
  questions: TestQuestion[];
  onAppendQuestions: (qs: TestQuestion[]) => void;
  onReplaceQuestions: (qs: TestQuestion[]) => void;
}

export default function PhotoImport({ questions, onAppendQuestions, onReplaceQuestions }: PhotoImportProps) {
  const [lang, setLang] = useState<Lang>(loadLang);
  const t = TEXT[lang];
  const [qFiles, setQFiles] = useState<File[]>([]);
  const [aFiles, setAFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<'q' | 'a' | null>(null);
  const [progress, setProgress] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  const changeLang = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // Non-critical.
    }
  };

  const pick = (list: FileList | null, set: (f: File[]) => void) => {
    const files = Array.from(list ?? []);
    set(files.slice(0, MAX_IMPORT_PHOTOS));
    setInfo(files.length > MAX_IMPORT_PHOTOS ? t.tooMany(MAX_IMPORT_PHOTOS) : '');
  };

  const readQuestions = async () => {
    if (qFiles.length === 0) return;
    setBusy('q');
    setError('');
    setInfo('');
    setWarnings([]);
    try {
      const all: ExtractedQuestion[] = [];
      for (let i = 0; i < qFiles.length; i++) {
        setProgress(t.reading(i + 1, qFiles.length));
        for (const part of await prepareUpload(qFiles[i])) {
          all.push(...(await extractQuestionsFromPhoto(part)));
        }
      }
      if (all.length === 0) {
        setError(t.none);
      } else {
        const { questions: qs, warnings: w } = toBuilderQuestions(all);
        onAppendQuestions(qs);
        setWarnings(w);
        setInfo(t.addedQ(qs.length));
        setQFiles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo reading failed.');
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  const readAnswers = async () => {
    if (aFiles.length === 0 || questions.length === 0) return;
    setBusy('a');
    setError('');
    setInfo('');
    setWarnings([]);
    try {
      const all: ExtractedAnswer[] = [];
      for (let i = 0; i < aFiles.length; i++) {
        setProgress(t.reading(i + 1, aFiles.length));
        for (const part of await prepareUpload(aFiles[i])) {
          all.push(...(await extractAnswersFromPhoto(part)));
        }
      }
      if (all.length === 0) {
        setError(t.noneA);
      } else {
        const { questions: qs, warnings: w, applied } = applyAnswersInSequence(questions, all);
        onReplaceQuestions(qs);
        setWarnings(w);
        setInfo(t.addedA(applied, questions.length));
        setAFiles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo reading failed.');
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  const btn =
    'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-semibold transition disabled:opacity-40';
  const fileInput =
    'block w-full text-sm text-gray-500 dark:text-white/60 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-gray-100 dark:file:bg-white/10 file:text-black dark:file:text-white file:text-sm file:font-medium';

  return (
    <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{t.title}</h2>
        <div className="flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden text-xs font-medium">
          {(['en', 'hi'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => changeLang(l)}
              className={`px-3 py-1.5 transition ${lang === l ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-100 dark:hover:bg-white/10'}`}
            >
              {l === 'en' ? 'English' : 'हिन्दी'}
            </button>
          ))}
        </div>
      </div>

      {/* 1 — questions */}
      <div className="mb-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-1.5">
          <Camera className="w-4 h-4" /> {t.qTitle}
        </h3>
        <p className="text-xs text-gray-500 dark:text-white/60 mb-3">{t.qHelp}</p>
        <input type="file" accept="image/*,application/pdf,.pdf" multiple onChange={(e) => pick(e.target.files, setQFiles)} disabled={busy !== null} className={`${fileInput} mb-3`} />
        <button onClick={readQuestions} disabled={busy !== null || qFiles.length === 0} className={btn}>
          {busy === 'q' && <Loader2 className="w-4 h-4 animate-spin" />}
          {busy === 'q' ? progress : qFiles.length > 0 ? `${t.qButton} (${t.filesChosen(qFiles.length)})` : t.qButton}
        </button>
      </div>

      {/* 2 — answers (separate section) */}
      <div className="border-t border-gray-200 dark:border-white/10 pt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
          <FileCheck2 className="w-4 h-4" /> {t.aTitle}
        </h3>
        <div className="rounded-xl border border-yellow-300 dark:border-yellow-500/40 bg-yellow-50 dark:bg-yellow-500/10 p-4 mb-3">
          <p className="text-xs font-semibold mb-2">{t.aInstructionTitle}</p>
          <ul className="list-disc pl-4 space-y-1 text-xs text-gray-700 dark:text-white/80">
            {t.aInstruction.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        {questions.length === 0 && <p className="text-xs text-gray-400 dark:text-white/40 mb-3">{t.needQuestions}</p>}
        <input
          type="file"
          accept="image/*,application/pdf,.pdf"
          multiple
          onChange={(e) => pick(e.target.files, setAFiles)}
          disabled={busy !== null || questions.length === 0}
          className={`${fileInput} mb-3`}
        />
        <button onClick={readAnswers} disabled={busy !== null || aFiles.length === 0 || questions.length === 0} className={btn}>
          {busy === 'a' && <Loader2 className="w-4 h-4 animate-spin" />}
          {busy === 'a' ? progress : aFiles.length > 0 ? `${t.aButton} (${t.filesChosen(aFiles.length)})` : t.aButton}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      {info && <p className="text-emerald-600 dark:text-emerald-400 text-sm mt-4">{info}</p>}
      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-yellow-700 dark:text-yellow-400 list-disc pl-4">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
