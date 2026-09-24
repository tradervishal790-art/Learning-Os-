// src/testBulkImport.ts
//
// Turns a plain-text block of questions into TestQuestion[] in one shot —
// this is the "give me all the questions and I'll add them" path, made
// self-serve: paste a stack of questions once instead of clicking
// "Add Question" for every single one. No AI, just a line-based parser.
//
// Format (one block per question, separated by a line containing only "---"):
//
//   Q: What is the powerhouse of the cell?
//   A: Nucleus
//   B: Mitochondria
//   C: Ribosome
//   D: Golgi body
//   CORRECT: B
//   MARKS: 4
//   NEGATIVE: 1
//   EXPLANATION: Mitochondria generate ATP through respiration.
//   ---
//   Q: Explain Newton's second law in your own words.
//   ANSWER: Force equals mass times acceleration (F = ma) — the greater
//   the mass or acceleration, the greater the force needed.
//   MARKS: 5
//   EXPLANATION: Tests whether the learner can restate F=ma with intuition.
//
// A question is treated as MCQ if it has an "ANSWER:" line, or subjective if it
// A/B/C/D lines are present (MCQ), or subjective if an ANSWER: line is present
// instead. MARKS/NEGATIVE/EXPLANATION are optional (default 4/1/'').
import type { TestQuestion, MCQQuestion, SubjectiveQuestion } from './types';

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `q_${Date.now()}_${Math.random().toString(36).slice(2)}`;

interface ParsedFields {
  Q?: string;
  A?: string;
  B?: string;
  C?: string;
  D?: string;
  CORRECT?: string;
  ANSWER?: string;
  MARKS?: string;
  NEGATIVE?: string;
  EXPLANATION?: string;
}

const FIELD_KEYS = ['Q', 'A', 'B', 'C', 'D', 'CORRECT', 'ANSWER', 'MARKS', 'NEGATIVE', 'EXPLANATION'] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

function parseBlock(block: string): ParsedFields {
  const fields: ParsedFields = {};
  let currentKey: FieldKey | null = null;

  for (const rawLine of block.split('\n')) {
    const line = rawLine.trimEnd();
    const match = line.match(/^([A-Z]+):\s?(.*)$/);
    if (match && FIELD_KEYS.includes(match[1] as FieldKey)) {
      currentKey = match[1] as FieldKey;
      fields[currentKey] = match[2];
    } else if (currentKey && line.trim()) {
      // Continuation of a multi-line value (e.g. a long ANSWER or EXPLANATION).
      fields[currentKey] = `${fields[currentKey] ?? ''}\n${line}`.trim();
    }
  }
  return fields;
}

export interface BulkImportResult {
  questions: TestQuestion[];
  errors: string[]; // one per skipped block, e.g. "Block 3: missing question text"
}

export function parseBulkQuestions(raw: string): BulkImportResult {
  const blocks = raw
    .split(/\n\s*---\s*\n?/)
    .map((b) => b.trim())
    .filter(Boolean);

  const questions: TestQuestion[] = [];
  const errors: string[] = [];

  blocks.forEach((block, i) => {
    const label = `Block ${i + 1}`;
    const fields = parseBlock(block);

    if (!fields.Q?.trim()) {
      errors.push(`${label}: missing "Q:" question text — skipped.`);
      return;
    }

    const marks = Number(fields.MARKS) || 4;
    const explanation = fields.EXPLANATION?.trim() ?? '';

    if (fields.ANSWER?.trim()) {
      const q: SubjectiveQuestion = {
        id: newId(),
        type: 'subjective',
        question: fields.Q.trim(),
        modelAnswer: fields.ANSWER.trim(),
        explanation,
        marks,
      };
      questions.push(q);
      return;
    }

    const options = [fields.A, fields.B, fields.C, fields.D];
    if (options.some((o) => !o?.trim())) {
      errors.push(`${label}: MCQ needs all of A/B/C/D filled (or use "ANSWER:" for a subjective question) — skipped.`);
      return;
    }
    const correctLetter = fields.CORRECT?.trim().toUpperCase();
    const correctIndex = correctLetter ? 'ABCD'.indexOf(correctLetter) : -1;
    if (correctIndex === -1) {
      errors.push(`${label}: "CORRECT:" must be A, B, C, or D — skipped.`);
      return;
    }

    const q: MCQQuestion = {
      id: newId(),
      type: 'mcq',
      question: fields.Q.trim(),
      options: options.map((o) => o!.trim()),
      correctIndex,
      explanation,
      marks,
      negativeMarks: Number(fields.NEGATIVE) || 1,
    };
    questions.push(q);
  });

  return { questions, errors };
}

export const BULK_IMPORT_EXAMPLE = `Q: What is the powerhouse of the cell?
A: Nucleus
B: Mitochondria
C: Ribosome
D: Golgi body
CORRECT: B
MARKS: 4
NEGATIVE: 1
EXPLANATION: Mitochondria generate ATP through cellular respiration.
---
Q: Explain Newton's second law in your own words.
ANSWER: Force equals mass times acceleration (F = ma).
MARKS: 5
EXPLANATION: Tests whether the learner can restate F=ma with intuition.`;
