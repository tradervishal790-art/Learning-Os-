// src/testImport.ts
//
// Client-side helpers for "import questions / answers from photos"
// (PhotoImport.tsx → api/extract-questions.ts). Everything the AI returns
// is only a DRAFT dropped into the test builder for review.
import { auth } from './firebase';
import type { TestQuestion, MCQQuestion, SubjectiveQuestion } from './types';
import { normalizeAnswer } from './testGrading';

export const MAX_IMPORT_PHOTOS = 4; // max files per import (photos and/or PDFs)
export const MAX_PDF_PAGES = 30; // per PDF, to keep AI cost bounded
const MAX_PDF_BYTES = 2_400_000; // raw bytes per request (≈3.2 MB base64, under the server's limit)

export interface PhotoPayload {
  mimeType: string;
  data: string; // base64, no data: prefix
}

export interface ExtractedQuestion {
  type: 'mcq' | 'subjective';
  question: string;
  options: string[];
  incomplete: boolean;
}

export interface ExtractedAnswer {
  number: number | null;
  answer: string;
  explanation: string;
}

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `q_${Date.now()}_${Math.random().toString(36).slice(2)}`);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(binary);
}

/** Splits a PDF into page ranges that each fit under maxBytes (in page order). A PDF already under the limit is returned as-is. */
export async function splitPdfIntoChunks(bytes: Uint8Array, maxBytes = MAX_PDF_BYTES, maxPages = MAX_PDF_PAGES): Promise<Uint8Array[]> {
  if (bytes.length <= maxBytes) return [bytes];
  const { PDFDocument } = await import('pdf-lib');
  let src;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    throw new Error('Could not open this PDF — it may be password-protected or damaged.');
  }
  const pageCount = src.getPageCount();
  if (pageCount > maxPages) throw new Error(`This PDF has ${pageCount} pages — the limit is ${maxPages} per PDF. Split it and upload in parts.`);

  // Measure each page on its own, then group consecutive pages while the (over-)estimated size stays under the limit.
  const sizes: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    const one = await PDFDocument.create();
    const [page] = await one.copyPages(src, [i]);
    one.addPage(page);
    const size = (await one.save()).length;
    if (size > maxBytes) throw new Error(`Page ${i + 1} of this PDF is too large — try a lower-quality scan.`);
    sizes.push(size);
  }
  const groups: number[][] = [];
  let current: number[] = [];
  let total = 0;
  sizes.forEach((size, i) => {
    if (current.length > 0 && total + size > maxBytes) {
      groups.push(current);
      current = [];
      total = 0;
    }
    current.push(i);
    total += size;
  });
  if (current.length > 0) groups.push(current);

  const chunks: Uint8Array[] = [];
  for (const indices of groups) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    chunks.push(await out.save());
  }
  return chunks;
}

/** Turns a chosen file (photo or PDF) into one or more upload payloads, in order. */
export async function prepareUpload(file: File): Promise<PhotoPayload[]> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const chunks = await splitPdfIntoChunks(bytes);
    return chunks.map((c) => ({ mimeType: 'application/pdf', data: bytesToBase64(c) }));
  }
  return [await compressPhoto(file)];
}

/** Downscales + re-encodes a photo so the upload stays small (long edge ≤ 1800px, JPEG). */
export async function compressPhoto(file: File): Promise<PhotoPayload> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the photo.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 3_000_000 && quality > 0.4) {
    quality -= 0.15;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] };
}

async function callExtract<T>(mode: 'questions' | 'answers', image: PhotoPayload): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Please sign in to import from photos.');
  const response = await fetch('/api/extract-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode, image }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Photo reading failed (${response.status})`);
  return data as T;
}

export async function extractQuestionsFromPhoto(image: PhotoPayload): Promise<ExtractedQuestion[]> {
  const data = await callExtract<{ questions: ExtractedQuestion[] }>('questions', image);
  return data.questions ?? [];
}

export async function extractAnswersFromPhoto(image: PhotoPayload): Promise<ExtractedAnswer[]> {
  const data = await callExtract<{ answers: ExtractedAnswer[] }>('answers', image);
  return data.answers ?? [];
}

const DEFAULT_MARKS = 4;
const DEFAULT_NEGATIVE = 1;

/** Turns extracted questions into builder questions. MCQ correct answer is left UNSET (-1) until an answer is supplied. No count limit. */
export function toBuilderQuestions(extracted: ExtractedQuestion[]): { questions: TestQuestion[]; warnings: string[] } {
  const warnings: string[] = [];
  const questions = extracted.map((e, i): TestQuestion => {
    if (e.type === 'mcq') {
      let options = e.options.slice(0, 4);
      if (e.options.length > 4) warnings.push(`Photo question ${i + 1}: had ${e.options.length} options, only the first 4 were kept — check it.`);
      while (options.length < 4) options = [...options, ''];
      if (e.options.length < 4) warnings.push(`Photo question ${i + 1}: had only ${e.options.length} options — fill the missing ones.`);
      if (e.incomplete) warnings.push(`Photo question ${i + 1}: looked cut off — check the text.`);
      const q: MCQQuestion = { id: newId(), type: 'mcq', question: e.question, options, correctIndex: -1, explanation: '', marks: DEFAULT_MARKS, negativeMarks: DEFAULT_NEGATIVE };
      return q;
    }
    if (e.incomplete) warnings.push(`Photo question ${i + 1}: looked cut off — check the text.`);
    const q: SubjectiveQuestion = { id: newId(), type: 'subjective', question: e.question, modelAnswer: '', explanation: '', marks: DEFAULT_MARKS };
    return q;
  });
  return { questions, warnings };
}

const LETTER_INDEX: Record<string, number> = {
  a: 0, b: 1, c: 2, d: 3,
  '1': 0, '2': 1, '3': 2, '4': 3,
  // Hindi option labels — both common sets
  अ: 0, ब: 1, स: 2, द: 3,
  क: 0, ख: 1, ग: 2, घ: 3,
};

/** Maps a raw MCQ answer ("B", "(c)", "2", "ख", or the option's own text) to an option index, or -1. */
export function parseMcqAnswer(raw: string, options: string[]): number {
  const s = raw.trim();
  if (!s) return -1;
  const norm = normalizeAnswer(s);
  const byText = options.findIndex((o) => o.trim() && normalizeAnswer(o) === norm);
  if (byText >= 0) return byText;
  if (s.length > 8) return -1; // long text that isn't an option — don't guess a letter from its first character
  const m = s.match(/^[([]?\s*([A-Da-d1-4अबसदकखगघ])\s*[)\].:\-–]?(\s|$)/);
  if (m) {
    const key = m[1].toLowerCase();
    return key in LETTER_INDEX ? LETTER_INDEX[key] : -1;
  }
  return -1;
}

/** Applies an answer sheet to questions BY SEQUENCE (1st answer → 1st question, ...). */
export function applyAnswersInSequence(questions: TestQuestion[], answers: ExtractedAnswer[]): { questions: TestQuestion[]; warnings: string[]; applied: number } {
  const warnings: string[] = [];
  if (answers.length !== questions.length) {
    warnings.push(
      `${questions.length} questions but ${answers.length} answers were read — matched the first ${Math.min(questions.length, answers.length)} in order. Please check the rest.`
    );
  }
  let applied = 0;
  const next = questions.map((q, i): TestQuestion => {
    const a = answers[i];
    if (!a) return q;
    if (q.type === 'mcq') {
      const idx = parseMcqAnswer(a.answer, q.options);
      if (idx < 0) {
        warnings.push(`Q${i + 1}: could not understand the answer "${a.answer || '(blank)'}" — select it manually.`);
        return q.explanation || !a.explanation ? q : { ...q, explanation: a.explanation };
      }
      applied++;
      return { ...q, correctIndex: idx, explanation: a.explanation || q.explanation };
    }
    if (!a.answer) {
      warnings.push(`Q${i + 1}: answer was unreadable — type it manually.`);
      return q;
    }
    applied++;
    return { ...q, modelAnswer: a.answer, explanation: a.explanation || q.explanation };
  });
  return { questions: next, warnings, applied };
}
