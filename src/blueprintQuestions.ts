// src/blueprintQuestions.ts
//
// Static question bank for the AI Blueprint Interview.
// Design goals (per product decision):
// 1. Every question maps to 2-3 of the 8 LearningProfile dimensions at once
//    (dense signal per question, so we don't need 15+ questions).
// 2. Key dimensions get a SECOND, independently-worded question later in
//    the set (see `crossChecks`) so contradictory answers can be caught —
//    this feeds the reliabilityScore / selfReportedHonesty fields Gemini
//    returns, instead of trusting every answer at face value.
// 3. All 12 questions are answered locally in the browser with ZERO
//    Gemini calls — only ONE Gemini call happens at the very end, with
//    all 12 Q&A pairs bundled into a single prompt. This is the main
//    token-saving change vs the old "ask Gemini live, one call per
//    question" version.
//
// IMPORTANT — i18n: the displayed `text` for each question/option below
// comes from translations.ts (t.blueprintInterview.questions[i], same
// order/ids) via getBlueprintQuestions(t) — NOT hardcoded English. This
// module has no React context, so the caller (BlueprintInterview.tsx)
// passes `t` in. Unlike LearningQuiz.tsx, this text is NOT purely
// cosmetic: the actual displayed+selected text is bundled verbatim into
// the Gemini prompt in api/blueprint-interview.ts for AI-based scoring —
// so whichever locale's text the user actually saw and picked is exactly
// what must be sent (Gemini is multilingual and scores it correctly
// either way), never the English original translated back.
import type { TranslationShape } from './i18n/translations';

export interface BlueprintOption {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface BlueprintQuestion {
  id: string;
  text: string;
  options: BlueprintOption[];
  /** Which dimensions this question primarily signals — for our own docs/debugging, not sent to Gemini. */
  dimensions: string[];
  /** id of an earlier question this one cross-validates, if any. */
  crossChecks?: string;
}

// Scoring/debugging metadata only — dimensions + crossChecks never change
// across locale, only the displayed text does (see getBlueprintQuestions).
const BLUEPRINT_QUESTIONS_META: { id: string; dimensions: string[]; crossChecks?: string }[] = [
  { id: 'q1', dimensions: ['theoryVsPractical', 'structureNeed'] },
  { id: 'q2', dimensions: ['depth', 'pace'] },
  { id: 'q3', dimensions: ['depth', 'structureNeed', 'pace'] },
  { id: 'q4', dimensions: ['pace', 'depth', 'priorKnowledgeComfort'] },
  { id: 'q5', dimensions: ['storytelling', 'structureNeed', 'theoryVsPractical', 'repetitionNeed'] },
  { id: 'q6', dimensions: ['pace', 'depth'] },
  { id: 'q7', dimensions: ['pace', 'depth', 'theoryVsPractical'] },
  { id: 'q8', dimensions: ['languageComplexity', 'structureNeed', 'pace'] },
  { id: 'q9', dimensions: ['storytelling'], crossChecks: 'q5' },
  { id: 'q10', dimensions: ['repetitionNeed'], crossChecks: 'q5' },
  { id: 'q11', dimensions: ['priorKnowledgeComfort'], crossChecks: 'q4' },
];

export function getBlueprintQuestions(t: TranslationShape): BlueprintQuestion[] {
  return BLUEPRINT_QUESTIONS_META.map((meta, i) => ({
    ...meta,
    text: t.blueprintInterview.questions[i].text,
    options: t.blueprintInterview.questions[i].options as BlueprintOption[],
  }));
}
