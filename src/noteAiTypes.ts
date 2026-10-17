// Shared by the server handler (api/_lib/noteAi.ts) and the client (noteAiClient.ts, NoteAiPanel.tsx).

export type NoteAiOp =
  | 'summarize' | 'explain' | 'rewrite' | 'grammar' | 'bullets' | 'extract' | 'examples'
  | 'flashcards' | 'quiz' | 'questions' | 'contradictions' | 'gaps' | 'conceptMap' | 'answer' | 'translate';

export type NoteLang = 'en' | 'hi' | 'hinglish'; // hi = Devanagari, hinglish = Hindi in Roman letters

export interface NoteAiRequest {
  op: NoteAiOp;
  text?: string; // <= 12000 chars
  language?: NoteLang; // language of the OUTPUT (default: same language/script as the notes)
  level?: 'beginner' | 'intermediate' | 'advanced'; // for 'explain'
  difficulty?: 'easy' | 'medium' | 'hard'; // for 'quiz' and 'questions'
  count?: number; // flashcards / quiz / questions: 1..15, default 5
  question?: string; // for 'answer' (<= 500 chars)
  sources?: { id: string; title: string; text: string }[]; // for 'answer': <= 8 sources, each <= 6000 chars
}

export type NoteAiResult =
  | { kind: 'text'; text: string }
  | {
      kind: 'extract';
      definitions: { term: string; meaning: string }[];
      formulas: string[];
      dates: { when: string; what: string }[];
      facts: string[];
    }
  | { kind: 'flashcards'; cards: { front: string; back: string }[] }
  | {
      kind: 'quiz';
      questions: { question: string; options: string[]; answerIndex: number; explanation: string }[];
    }
  | {
      kind: 'questions';
      questions: { question: string; difficulty: 'easy' | 'medium' | 'hard'; modelAnswer: string }[];
    }
  | { kind: 'issues'; items: { quote: string; problem: string; suggestion: string }[] }
  | {
      kind: 'conceptMap';
      nodes: { id: string; label: string }[];
      edges: { from: string; to: string; label: string }[];
    }
  | {
      kind: 'answer';
      answer: string;
      sources: { id: string; quote: string }[];
      enoughInfo: boolean;
    };

export type NoteAiErrorCode =
  | 'too-large'
  | 'rate-limited'
  | 'account-required'
  | 'unavailable'
  | 'bad-reply'
  | 'network'
  | 'aborted'
  | 'bad-request';

export const NOTE_AI_LIMITS = {
  maxText: 12000,
  maxQuestion: 500,
  maxSources: 8,
  maxSourceText: 6000,
  maxCount: 15,
  defaultCount: 5,
} as const;
