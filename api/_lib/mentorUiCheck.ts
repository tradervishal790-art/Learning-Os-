// api/_lib/mentorUiCheck.ts
//
// Server-side check of a Mentor reply that may contain an OpenUI Lang "card program"
// (see src/mentorUi/library.tsx). The client only renders a program that passed this check;
// anything else is shown as plain text, so a model that ignores the format (e.g. the MiniMax
// fallback) can never put raw code on the student's screen.

import { createParser } from '@openuidev/lang-core';
import { MENTOR_UI_ROOT, MENTOR_UI_SCHEMA } from './mentorUiPrompt.js';

const ROOT_LINE = /^[ \t]*root[ \t]*=/m;

/** True when the reply looks like a card program (has a `root = ...` statement). */
export function looksLikeProgram(text: string): boolean {
  return ROOT_LINE.test(text);
}

/** Removes code fences and any chatter before the `root =` line. */
export function extractProgram(text: string): string {
  const unfenced = text.replace(/```[a-zA-Z-]*[ \t]*\r?\n?/g, '').trim();
  const m = ROOT_LINE.exec(unfenced);
  return (m ? unfenced.slice(m.index) : unfenced).trim();
}

export interface ProgramCheck {
  ok: boolean;
  reason?: string;
}

export function validateProgram(program: string): ProgramCheck {
  try {
    const parser = createParser(MENTOR_UI_SCHEMA as never, MENTOR_UI_ROOT);
    const result = parser.parse(program);
    if (!result.root) return { ok: false, reason: 'no-root' };
    if (result.root.typeName !== MENTOR_UI_ROOT) return { ok: false, reason: 'wrong-root' };
    if (result.meta.incomplete) return { ok: false, reason: 'incomplete' };
    if (result.meta.unresolved.length > 0) return { ok: false, reason: 'unresolved' };
    if (result.meta.errors.length > 0) return { ok: false, reason: `error:${result.meta.errors[0].code}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'parser-threw' };
  }
}
