/*
 * Label keys used (all values come from the `labels` prop; a missing key renders as the key itself):
 *
 * panelTitle, scopeLabel, scopeSelection, scopePage, scopeNote, answerScopeHint, currentNote, untitledNote,
 * toolsLabel, op_summarize, op_explain, op_rewrite, op_grammar, op_bullets, op_extract, op_examples,
 * op_flashcards, op_quiz, op_questions, op_contradictions, op_gaps, op_conceptMap, op_answer, op_translate,
 * optionsLabel, levelLabel, level_beginner, level_intermediate, level_advanced,
 * outLangLabel, lang_same, lang_en, lang_hi, lang_hinglish, targetLangLabel,
 * difficultyLabel, difficulty_mixed, difficulty_easy, difficulty_medium, difficulty_hard,
 * countLabel, countLess, countMore, questionLabel, questionPlaceholder,
 * run, noTextHint, tooLongHint,
 * privacyTitle, privacyBody, privacyConfirm, privacyDecline,
 * loading, cancel, retry,
 * err_too-large, err_rate-limited, err_account-required, err_unavailable, err_bad-reply, err_network,
 * err_aborted, err_bad-request,
 * aiBadge, aiNotice, regenerate, copy, copied, insert, inserted,
 * replace, replacePreviewTitle, replaceOld, replaceNew, replaceApply, replaceCancel, replaced, undo, undone,
 * definitions, formulas, dates, facts, nothingFound,
 * cardFront, cardBack, createFlashcards, createQuiz, created,
 * showAnswer, hideAnswer, correct, explanation, modelAnswer, showModelAnswer, hideModelAnswer,
 * quote, problem, suggestion, noIssues,
 * answerHeading, sourcesHeading, notEnoughInfo, mapHint, mapRepeat
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle, ArrowLeftRight, BookOpen, Check, ClipboardCheck, Copy, Eye, EyeOff, FileText,
  Languages, Layers, Lightbulb, List, ListChecks, Loader2, MessageCircleQuestion, MessageSquareText,
  Network, Pencil, Plus, RefreshCw, Search, ShieldCheck, Sparkles, SpellCheck, Undo2, X, Minus,
} from 'lucide-react';
import { NoteAiError, runNoteAi } from './noteAiClient';
import type {
  NoteAiErrorCode, NoteAiOp, NoteAiRequest, NoteAiResult, NoteLang,
} from './noteAiTypes';
import { NOTE_AI_LIMITS } from './noteAiTypes';

/* ------------------------------------------------------------------ types */

type Scope = 'selection' | 'page' | 'note';
type Translate = (key: string) => string;
type Difficulty = NonNullable<NoteAiRequest['difficulty']>;
type Level = NonNullable<NoteAiRequest['level']>;
type QuizQuestions = Extract<NoteAiResult, { kind: 'quiz' }>['questions'];
type FlashCards = Extract<NoteAiResult, { kind: 'flashcards' }>['cards'];

interface Props {
  getSource(): { selectedText: string; pageText: string; noteText: string };
  getOtherNotes(): { id: string; title: string; text: string }[];
  onInsertText(text: string): void;
  onReplaceSelection(text: string): void;
  onCreateFlashcards?(cards: FlashCards): void;
  onCreateQuiz?(questions: QuizQuestions): void;
  labels: Record<string, string>;
}

interface Job {
  req: NoteAiRequest;
  scope: Scope | null; // null for 'answer'
  original: string; // exact scope text at run time (used for Replace / Undo)
}

type RunState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; code: NoteAiErrorCode }
  | { status: 'done'; seq: number; result: NoteAiResult; job: Job };

/* -------------------------------------------------------------- constants */

const CONSENT_KEY = 'learning_os_note_ai_ok';
const CURRENT_NOTE_ID = '__current_note__';

const TOOLS: { op: NoteAiOp; Icon: LucideIcon }[] = [
  { op: 'summarize', Icon: FileText },
  { op: 'explain', Icon: Lightbulb },
  { op: 'rewrite', Icon: Pencil },
  { op: 'grammar', Icon: SpellCheck },
  { op: 'bullets', Icon: List },
  { op: 'extract', Icon: ListChecks },
  { op: 'examples', Icon: BookOpen },
  { op: 'flashcards', Icon: Layers },
  { op: 'quiz', Icon: ClipboardCheck },
  { op: 'questions', Icon: MessageCircleQuestion },
  { op: 'contradictions', Icon: AlertTriangle },
  { op: 'gaps', Icon: Search },
  { op: 'conceptMap', Icon: Network },
  { op: 'answer', Icon: MessageSquareText },
  { op: 'translate', Icon: Languages },
];

const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
const LANGS: NoteLang[] = ['en', 'hi', 'hinglish'];
const COUNT_OPS: NoteAiOp[] = ['flashcards', 'quiz', 'questions'];

const BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50';
const BTN_PRIMARY = `${BTN} bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800`;
const BTN_GHOST = `${BTN} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`;
const CARD =
  'rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900';
const MUTED = 'text-xs text-slate-500 dark:text-slate-400';

/* ---------------------------------------------------------------- helpers */

function readConsent(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

function writeConsent(): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, '1');
  } catch {
    /* storage unavailable: consent lasts for this session only */
  }
}

/** Current note first, then the other notes that share the most words with the question (max 8 total). */
function rankSources(
  question: string,
  noteText: string,
  currentTitle: string,
  others: { id: string; title: string; text: string }[],
): { id: string; title: string; text: string }[] {
  const words = question
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((w) => w.length >= 3);
  const score = (text: string): number => {
    const lower = text.toLowerCase();
    return words.reduce((n, w) => (lower.includes(w) ? n + 1 : n), 0);
  };
  const clamp = (t: string) => t.trim().slice(0, NOTE_AI_LIMITS.maxSourceText);
  const list: { id: string; title: string; text: string }[] = [];
  if (noteText.trim()) list.push({ id: CURRENT_NOTE_ID, title: currentTitle, text: clamp(noteText) });
  const ranked = others
    .filter((o) => o.id !== CURRENT_NOTE_ID && o.text.trim())
    .map((o) => ({ o, s: score(o.text) }))
    .sort((a, b) => b.s - a.s)
    .map(({ o }) => ({ id: o.id, title: o.title, text: clamp(o.text) }));
  return [...list, ...ranked].slice(0, NOTE_AI_LIMITS.maxSources);
}

interface TreeNode {
  id: string;
  label: string;
  via?: string;
  repeat: boolean;
  children: TreeNode[];
}

function buildTree(
  nodes: { id: string; label: string }[],
  edges: { from: string; to: string; label: string }[],
): TreeNode[] {
  const labels = new Map(nodes.map((n) => [n.id, n.label] as const));
  const out = new Map<string, { to: string; label: string }[]>();
  const hasIncoming = new Set<string>();
  for (const e of edges) {
    hasIncoming.add(e.to);
    const entry = { to: e.to, label: e.label };
    const list = out.get(e.from);
    if (list) list.push(entry);
    else out.set(e.from, [entry]);
  }
  const expanded = new Set<string>();
  const make = (id: string, via?: string): TreeNode => {
    const node: TreeNode = { id, label: labels.get(id) ?? id, via, repeat: false, children: [] };
    if (expanded.has(id)) {
      node.repeat = true; // already shown elsewhere (shared child or cycle)
      return node;
    }
    expanded.add(id);
    for (const e of out.get(id) ?? []) node.children.push(make(e.to, e.label));
    return node;
  };
  const roots = nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => make(n.id));
  for (const n of nodes) if (!expanded.has(n.id)) roots.push(make(n.id)); // pure cycles
  return roots;
}

/* ------------------------------------------------------- small UI pieces */

function Segmented<V extends string>(props: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={props.ariaLabel} className="flex flex-wrap gap-2">
      {props.options.map((o) => {
        const active = o.value === props.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => props.onChange(o.value)}
            className={`${BTN} border ${
              active
                ? 'border-indigo-600 bg-indigo-50 text-indigo-800 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-200'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {props.label}
      </div>
      {props.children}
    </div>
  );
}

function AiBadge({ t }: { t: Translate }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        {t('aiBadge')}
      </span>
      <span className={MUTED}>{t('aiNotice')}</span>
    </div>
  );
}

function Revealable(props: {
  showLabel: string;
  hideLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className={BTN_GHOST} aria-expanded={open}>
        {open ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        {open ? props.hideLabel : props.showLabel}
      </button>
      {open ? props.children : null}
    </div>
  );
}

function TreeList({ nodes, t }: { nodes: TreeNode[]; t: Translate }) {
  return (
    <ul className="space-y-1.5 border-l border-slate-300 pl-3 dark:border-slate-600">
      {nodes.map((n, i) => (
        <li key={`${n.id}-${i}`} className="text-sm text-slate-800 dark:text-slate-100">
          {n.via ? (
            <span className="mr-1 text-xs italic text-slate-500 dark:text-slate-400">{n.via} →</span>
          ) : null}
          <span className="font-medium">{n.label}</span>
          {n.repeat ? (
            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
              ({t('mapRepeat')})
            </span>
          ) : null}
          {n.children.length > 0 ? (
            <div className="mt-1.5">
              <TreeList nodes={n.children} t={t} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------- result views */

function TextResult(props: {
  text: string;
  job: Job;
  t: Translate;
  onInsertText: (s: string) => void;
  onReplaceSelection: (s: string) => void;
}) {
  const { text, job, t } = props;
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);
  const [rep, setRep] = useState<'idle' | 'preview' | 'applied' | 'undone'>('idle');
  const canReplace = job.scope === 'selection' && job.original.length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-3">
      <div className={`${CARD} whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-900 dark:text-slate-100`}>
        {text}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_GHOST} onClick={() => void copy()}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? t('copied') : t('copy')}
        </button>
        <button
          type="button"
          className={BTN_GHOST}
          onClick={() => {
            props.onInsertText(text);
            setInserted(true);
          }}
        >
          {inserted ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          {inserted ? t('inserted') : t('insert')}
        </button>
        {canReplace && rep === 'idle' ? (
          <button type="button" className={BTN_GHOST} onClick={() => setRep('preview')}>
            <ArrowLeftRight className="h-4 w-4" aria-hidden />
            {t('replace')}
          </button>
        ) : null}
      </div>

      {canReplace && rep === 'preview' ? (
        <div className={`${CARD} space-y-3`}>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('replacePreviewTitle')}</div>
          <div className="space-y-1">
            <div className={MUTED}>{t('replaceOld')}</div>
            <div className="whitespace-pre-wrap break-words rounded-lg bg-red-50 p-2 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-100">
              {job.original}
            </div>
          </div>
          <div className="space-y-1">
            <div className={MUTED}>{t('replaceNew')}</div>
            <div className="whitespace-pre-wrap break-words rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              {text}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => {
                props.onReplaceSelection(text);
                setRep('applied');
              }}
            >
              <Check className="h-4 w-4" aria-hidden />
              {t('replaceApply')}
            </button>
            <button type="button" className={BTN_GHOST} onClick={() => setRep('idle')}>
              {t('replaceCancel')}
            </button>
          </div>
        </div>
      ) : null}

      {canReplace && rep === 'applied' ? (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <span className="text-sm text-slate-700 dark:text-slate-200">{t('replaced')}</span>
          <button
            type="button"
            className={BTN_GHOST}
            onClick={() => {
              props.onReplaceSelection(job.original);
              setRep('undone');
            }}
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            {t('undo')}
          </button>
        </div>
      ) : null}
      {canReplace && rep === 'undone' ? (
        <div className="text-sm text-slate-700 dark:text-slate-200" role="status">
          {t('undone')}
        </div>
      ) : null}
    </div>
  );
}

function ExtractResult({
  result, t,
}: {
  result: Extract<NoteAiResult, { kind: 'extract' }>;
  t: Translate;
}) {
  const empty =
    !result.definitions.length && !result.formulas.length && !result.dates.length && !result.facts.length;
  if (empty) return <p className="text-sm text-slate-600 dark:text-slate-300">{t('nothingFound')}</p>;
  const Heading = ({ children }: { children: ReactNode }) => (
    <h4 className="mb-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">{children}</h4>
  );
  return (
    <div className="space-y-4">
      {result.definitions.length > 0 && (
        <section className={CARD}>
          <Heading>{t('definitions')}</Heading>
          <dl className="space-y-2">
            {result.definitions.map((d, i) => (
              <div key={i}>
                <dt className="text-sm font-medium text-slate-900 dark:text-slate-100">{d.term}</dt>
                <dd className="text-sm text-slate-700 dark:text-slate-300">{d.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {result.formulas.length > 0 && (
        <section className={CARD}>
          <Heading>{t('formulas')}</Heading>
          <ul className="space-y-1.5">
            {result.formulas.map((f, i) => (
              <li key={i} className="overflow-x-auto rounded-lg bg-slate-100 px-2 py-1 font-mono text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                {f}
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.dates.length > 0 && (
        <section className={CARD}>
          <Heading>{t('dates')}</Heading>
          <ul className="space-y-1.5">
            {result.dates.map((d, i) => (
              <li key={i} className="text-sm text-slate-800 dark:text-slate-200">
                <span className="font-medium">{d.when}</span> — {d.what}
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.facts.length > 0 && (
        <section className={CARD}>
          <Heading>{t('facts')}</Heading>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-200">
            {result.facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FlashcardsResult(props: {
  cards: FlashCards;
  t: Translate;
  onCreate?: (cards: FlashCards) => void;
}) {
  const { cards, t } = props;
  const [created, setCreated] = useState(false);
  if (!cards.length) return <p className="text-sm text-slate-600 dark:text-slate-300">{t('nothingFound')}</p>;
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {cards.map((c, i) => (
          <li key={i} className={`${CARD} space-y-2`}>
            <div>
              <div className={MUTED}>{t('cardFront')}</div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{c.front}</div>
            </div>
            <div>
              <div className={MUTED}>{t('cardBack')}</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">{c.back}</div>
            </div>
          </li>
        ))}
      </ul>
      {props.onCreate ? (
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={created}
          onClick={() => {
            props.onCreate?.(cards);
            setCreated(true);
          }}
        >
          {created ? <Check className="h-4 w-4" aria-hidden /> : <Layers className="h-4 w-4" aria-hidden />}
          {created ? t('created') : t('createFlashcards')}
        </button>
      ) : null}
    </div>
  );
}

function QuizResult(props: {
  questions: QuizQuestions;
  t: Translate;
  onCreate?: (q: QuizQuestions) => void;
}) {
  const { questions, t } = props;
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [created, setCreated] = useState(false);
  if (!questions.length) return <p className="text-sm text-slate-600 dark:text-slate-300">{t('nothingFound')}</p>;

  const toggle = (i: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {questions.map((q, i) => {
          const show = revealed.has(i);
          return (
            <li key={i} className={`${CARD} space-y-2`}>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {i + 1}. {q.question}
              </div>
              <ul className="space-y-1.5">
                {q.options.map((o, j) => {
                  const isCorrect = j === q.answerIndex;
                  const isPicked = picked[i] === j;
                  let cls =
                    'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
                  if (show && isCorrect) {
                    cls = 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-100';
                  } else if (show && isPicked) {
                    cls = 'border-red-500 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950/40 dark:text-red-100';
                  } else if (isPicked) {
                    cls = 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-100';
                  }
                  return (
                    <li key={j}>
                      <button
                        type="button"
                        aria-pressed={isPicked}
                        disabled={show}
                        onClick={() => setPicked((p) => ({ ...p, [i]: j }))}
                        className={`flex min-h-[44px] w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${cls}`}
                      >
                        <span className="font-semibold">{'ABCD'[j]}.</span>
                        <span>{o}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className={BTN_GHOST} onClick={() => toggle(i)} aria-expanded={show}>
                {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                {show ? t('hideAnswer') : t('showAnswer')}
              </button>
              {show ? (
                <div className="space-y-1 rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800">
                  <div className="font-medium text-emerald-700 dark:text-emerald-300">
                    {t('correct')}: {'ABCD'[q.answerIndex]}. {q.options[q.answerIndex]}
                  </div>
                  {q.explanation ? (
                    <div className="text-slate-700 dark:text-slate-300">
                      <span className="font-medium">{t('explanation')}: </span>
                      {q.explanation}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {props.onCreate ? (
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={created}
          onClick={() => {
            props.onCreate?.(questions);
            setCreated(true);
          }}
        >
          {created ? <Check className="h-4 w-4" aria-hidden /> : <ClipboardCheck className="h-4 w-4" aria-hidden />}
          {created ? t('created') : t('createQuiz')}
        </button>
      ) : null}
    </div>
  );
}

function QuestionsResult({
  result, t,
}: {
  result: Extract<NoteAiResult, { kind: 'questions' }>;
  t: Translate;
}) {
  if (!result.questions.length) return <p className="text-sm text-slate-600 dark:text-slate-300">{t('nothingFound')}</p>;
  return (
    <ol className="space-y-3">
      {result.questions.map((q, i) => (
        <li key={i} className={`${CARD} space-y-2`}>
          <div className="flex items-start gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {t(`difficulty_${q.difficulty}`)}
            </span>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {i + 1}. {q.question}
            </span>
          </div>
          <Revealable showLabel={t('showModelAnswer')} hideLabel={t('hideModelAnswer')}>
            <div className="rounded-lg bg-slate-50 p-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              <div className={MUTED}>{t('modelAnswer')}</div>
              {q.modelAnswer}
            </div>
          </Revealable>
        </li>
      ))}
    </ol>
  );
}

function IssuesResult({
  result, t,
}: {
  result: Extract<NoteAiResult, { kind: 'issues' }>;
  t: Translate;
}) {
  if (!result.items.length) return <p className="text-sm text-slate-600 dark:text-slate-300">{t('noIssues')}</p>;
  return (
    <ul className="space-y-3">
      {result.items.map((it, i) => (
        <li key={i} className={`${CARD} space-y-2`}>
          <div>
            <div className={MUTED}>{t('quote')}</div>
            <blockquote className="border-l-4 border-amber-400 pl-2 text-sm italic text-slate-800 dark:text-slate-200">
              {it.quote}
            </blockquote>
          </div>
          <div className="text-sm text-slate-800 dark:text-slate-200">
            <span className="font-medium">{t('problem')}: </span>
            {it.problem}
          </div>
          {it.suggestion ? (
            <div className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-medium">{t('suggestion')}: </span>
              {it.suggestion}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ConceptMapResult({
  result, t,
}: {
  result: Extract<NoteAiResult, { kind: 'conceptMap' }>;
  t: Translate;
}) {
  const tree = useMemo(() => buildTree(result.nodes, result.edges), [result]);
  if (!result.nodes.length) return <p className="text-sm text-slate-600 dark:text-slate-300">{t('nothingFound')}</p>;
  return (
    <div className={`${CARD} space-y-2`}>
      <p className={MUTED}>{t('mapHint')}</p>
      <TreeList nodes={tree} t={t} />
    </div>
  );
}

function AnswerResult({
  result, job, t,
}: {
  result: Extract<NoteAiResult, { kind: 'answer' }>;
  job: Job;
  t: Translate;
}) {
  const titleOf = (id: string): string => {
    const s = job.req.sources?.find((x) => x.id === id);
    if (!s) return id;
    return s.title || (id === CURRENT_NOTE_ID ? t('currentNote') : t('untitledNote'));
  };
  if (!result.enoughInfo) {
    return (
      <div
        role="status"
        className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <div className="font-semibold">{t('notEnoughInfo')}</div>
        {result.answer ? <div>{result.answer}</div> : null}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <section className={`${CARD} space-y-1`}>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('answerHeading')}</h4>
        <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">{result.answer}</p>
      </section>
      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('sourcesHeading')}</h4>
        <ul className="space-y-2">
          {result.sources.map((s, i) => (
            <li key={i} className={CARD}>
              <div className={MUTED}>{titleOf(s.id)}</div>
              <blockquote className="border-l-4 border-indigo-400 pl-2 text-sm italic text-slate-800 dark:text-slate-200">
                {s.quote}
              </blockquote>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ResultView(props: {
  result: NoteAiResult;
  job: Job;
  t: Translate;
  onRegenerate: () => void;
  onInsertText: (s: string) => void;
  onReplaceSelection: (s: string) => void;
  onCreateFlashcards?: (cards: FlashCards) => void;
  onCreateQuiz?: (q: QuizQuestions) => void;
}) {
  const { result, job, t } = props;
  let body: ReactNode;
  switch (result.kind) {
    case 'text':
      body = (
        <TextResult
          text={result.text}
          job={job}
          t={t}
          onInsertText={props.onInsertText}
          onReplaceSelection={props.onReplaceSelection}
        />
      );
      break;
    case 'extract':
      body = <ExtractResult result={result} t={t} />;
      break;
    case 'flashcards':
      body = <FlashcardsResult cards={result.cards} t={t} onCreate={props.onCreateFlashcards} />;
      break;
    case 'quiz':
      body = <QuizResult questions={result.questions} t={t} onCreate={props.onCreateQuiz} />;
      break;
    case 'questions':
      body = <QuestionsResult result={result} t={t} />;
      break;
    case 'issues':
      body = <IssuesResult result={result} t={t} />;
      break;
    case 'conceptMap':
      body = <ConceptMapResult result={result} t={t} />;
      break;
    case 'answer':
      body = <AnswerResult result={result} job={job} t={t} />;
      break;
  }
  return (
    <section className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AiBadge t={t} />
        <button type="button" className={BTN_GHOST} onClick={props.onRegenerate}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          {t('regenerate')}
        </button>
      </div>
      {body}
    </section>
  );
}

/* ------------------------------------------------------------------ panel */

export default function NoteAiPanel(props: Props) {
  const {
    getSource, getOtherNotes, onInsertText, onReplaceSelection, onCreateFlashcards, onCreateQuiz, labels,
  } = props;
  const t: Translate = useCallback((k: string) => labels[k] ?? k, [labels]);

  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const lastJobRef = useRef<Job | null>(null);

  const [src, setSrc] = useState(() => getSource());
  const [scopePref, setScopePref] = useState<Scope | null>(null);
  const [op, setOp] = useState<NoteAiOp>('summarize');
  const [level, setLevel] = useState<Level>('intermediate');
  const [outLang, setOutLang] = useState<'same' | NoteLang>('same');
  const [targetLang, setTargetLang] = useState<NoteLang>('en');
  const [difficulty, setDifficulty] = useState<Difficulty | 'mixed'>('medium');
  const [count, setCount] = useState<number>(NOTE_AI_LIMITS.defaultCount);
  const [question, setQuestion] = useState('');
  const [consent, setConsent] = useState<boolean>(readConsent);
  const [gateOpen, setGateOpen] = useState(false);
  const [run, setRun] = useState<RunState>({ status: 'idle' });

  /* ---- keep the source texts fresh (selection can change at any time) ---- */
  const refresh = useCallback(() => {
    const next = getSource();
    // Tapping a button in this panel can collapse the editor selection; keep the last one while focus is here.
    const focusInPanel = !!rootRef.current && rootRef.current.contains(document.activeElement);
    setSrc((prev) => {
      const selectedText =
        next.selectedText.trim() === '' && focusInPanel ? prev.selectedText : next.selectedText;
      if (
        prev.selectedText === selectedText &&
        prev.pageText === next.pageText &&
        prev.noteText === next.noteText
      ) {
        return prev;
      }
      return { selectedText, pageText: next.pageText, noteText: next.noteText };
    });
  }, [getSource]);

  useEffect(() => {
    refresh();
    document.addEventListener('selectionchange', refresh);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 2500);
    return () => {
      document.removeEventListener('selectionchange', refresh);
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [refresh]);

  useEffect(
    () => () => {
      runIdRef.current += 1; // ignore anything that is still in flight
      abortRef.current?.abort();
    },
    [],
  );

  /* ---- scope ---- */
  const scopeText: Record<Scope, string> = {
    selection: src.selectedText,
    page: src.pageText,
    note: src.noteText,
  };
  const available = (s: Scope) => scopeText[s].trim().length > 0;
  const scope: Scope =
    scopePref && available(scopePref)
      ? scopePref
      : (['selection', 'page', 'note'] as const).find(available) ?? 'page';

  const isAnswer = op === 'answer';
  const usesCount = COUNT_OPS.includes(op);
  const text = scopeText[scope];
  const tooLong = !isAnswer && text.trim().length > NOTE_AI_LIMITS.maxText;
  // `src` is a deliberate dependency: the notes list is re-read whenever the editor content refreshes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const otherNotes = useMemo(() => (isAnswer ? getOtherNotes() : []), [isAnswer, getOtherNotes, src]);
  const answerSources = useMemo(
    () => (isAnswer ? rankSources(question, src.noteText, t('currentNote'), otherNotes) : []),
    [isAnswer, question, src.noteText, otherNotes, t],
  );
  const canRun = isAnswer
    ? question.trim().length > 0 && answerSources.length > 0
    : text.trim().length > 0 && !tooLong;

  /* ---- running ---- */
  const execute = useCallback(async (job: Job) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++runIdRef.current;
    lastJobRef.current = job;
    setRun({ status: 'loading' });
    try {
      const result = await runNoteAi(job.req, { signal: controller.signal });
      if (id !== runIdRef.current) return;
      setRun({ status: 'done', seq: id, result, job });
    } catch (e) {
      if (id !== runIdRef.current) return;
      const code: NoteAiErrorCode = e instanceof NoteAiError ? e.code : 'network';
      setRun(code === 'aborted' ? { status: 'idle' } : { status: 'error', code });
    }
  }, []);

  const buildJob = (): Job | null => {
    const req: NoteAiRequest = { op };
    if (isAnswer) {
      if (!question.trim() || answerSources.length === 0) return null;
      req.question = question.trim();
      req.sources = answerSources;
    } else {
      if (!text.trim() || tooLong) return null;
      req.text = text.trim();
    }
    if (op === 'translate') req.language = targetLang;
    else if (outLang !== 'same') req.language = outLang;
    if (op === 'explain') req.level = level;
    if (op === 'quiz') req.difficulty = difficulty === 'mixed' ? 'medium' : difficulty;
    if (op === 'questions' && difficulty !== 'mixed') req.difficulty = difficulty;
    if (usesCount) req.count = count;
    return { req, scope: isAnswer ? null : scope, original: isAnswer ? '' : text };
  };

  const onRun = () => {
    const job = buildJob();
    if (!job) return;
    if (!consent) {
      setGateOpen(true); // nothing is sent before the student confirms
      return;
    }
    void execute(job);
  };

  const onConfirmConsent = () => {
    writeConsent();
    setConsent(true);
    setGateOpen(false);
    const job = buildJob();
    if (job) void execute(job);
  };

  const rerun = () => {
    const job = lastJobRef.current;
    if (job) void execute(job);
  };

  const cancel = () => {
    abortRef.current?.abort(); // runNoteAi rejects with code 'aborted' -> state returns to idle
  };

  const loading = run.status === 'loading';
  const shownDifficulty: Difficulty | 'mixed' = op === 'quiz' && difficulty === 'mixed' ? 'medium' : difficulty;

  return (
    <div
      ref={rootRef}
      className="flex h-full flex-col gap-4 overflow-y-auto p-3 text-slate-900 dark:text-slate-100"
    >
      <h2 className="text-base font-semibold">{t('panelTitle')}</h2>

      {/* Scope */}
      {isAnswer ? (
        <p className={MUTED}>{t('answerScopeHint')}</p>
      ) : (
        <Field label={t('scopeLabel')}>
          <div role="group" aria-label={t('scopeLabel')} className="grid grid-cols-3 gap-2">
            {(
              [
                ['selection', 'scopeSelection'],
                ['page', 'scopePage'],
                ['note', 'scopeNote'],
              ] as const
            ).map(([s, key]) => {
              const active = scope === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  disabled={!available(s)}
                  onClick={() => setScopePref(s)}
                  className={`${BTN} border ${
                    active
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-800 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-200'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {t(key)}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {/* Tools */}
      <Field label={t('toolsLabel')}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {TOOLS.map(({ op: o, Icon }) => {
            const active = op === o;
            return (
              <button
                key={o}
                type="button"
                aria-pressed={active}
                onClick={() => setOp(o)}
                className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-xs font-medium leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  active
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-800 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-200'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{t(`op_${o}`)}</span>
              </button>
            );
          })}
        </div>
      </Field>

      {/* Options: only what the chosen tool uses */}
      <div className="space-y-3" aria-label={t('optionsLabel')}>
        {op === 'explain' && (
          <Field label={t('levelLabel')}>
            <Segmented
              ariaLabel={t('levelLabel')}
              value={level}
              onChange={setLevel}
              options={LEVELS.map((l) => ({ value: l, label: t(`level_${l}`) }))}
            />
          </Field>
        )}
        {op === 'translate' ? (
          <Field label={t('targetLangLabel')}>
            <Segmented
              ariaLabel={t('targetLangLabel')}
              value={targetLang}
              onChange={setTargetLang}
              options={LANGS.map((l) => ({ value: l, label: t(`lang_${l}`) }))}
            />
          </Field>
        ) : (
          <Field label={t('outLangLabel')}>
            <Segmented<'same' | NoteLang>
              ariaLabel={t('outLangLabel')}
              value={outLang}
              onChange={setOutLang}
              options={[
                { value: 'same', label: t('lang_same') },
                ...LANGS.map((l) => ({ value: l, label: t(`lang_${l}`) })),
              ]}
            />
          </Field>
        )}
        {(op === 'quiz' || op === 'questions') && (
          <Field label={t('difficultyLabel')}>
            <Segmented<Difficulty | 'mixed'>
              ariaLabel={t('difficultyLabel')}
              value={shownDifficulty}
              onChange={setDifficulty}
              options={[
                ...(op === 'questions' ? [{ value: 'mixed' as const, label: t('difficulty_mixed') }] : []),
                { value: 'easy' as const, label: t('difficulty_easy') },
                { value: 'medium' as const, label: t('difficulty_medium') },
                { value: 'hard' as const, label: t('difficulty_hard') },
              ]}
            />
          </Field>
        )}
        {usesCount && (
          <Field label={t('countLabel')}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={BTN_GHOST}
                aria-label={t('countLess')}
                disabled={count <= 1}
                onClick={() => setCount((c) => Math.max(1, c - 1))}
              >
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <span className="min-w-[2ch] text-center text-base font-semibold" aria-live="polite">
                {count}
              </span>
              <button
                type="button"
                className={BTN_GHOST}
                aria-label={t('countMore')}
                disabled={count >= NOTE_AI_LIMITS.maxCount}
                onClick={() => setCount((c) => Math.min(NOTE_AI_LIMITS.maxCount, c + 1))}
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </Field>
        )}
        {isAnswer && (
          <Field label={t('questionLabel')}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={NOTE_AI_LIMITS.maxQuestion}
              rows={2}
              placeholder={t('questionPlaceholder')}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </Field>
        )}
      </div>

      {/* Hints */}
      {!canRun && !isAnswer && tooLong ? (
        <p className="text-sm text-amber-700 dark:text-amber-300" role="status">{t('tooLongHint')}</p>
      ) : null}
      {!canRun && !isAnswer && !tooLong && !text.trim() ? (
        <p className={MUTED} role="status">{t('noTextHint')}</p>
      ) : null}

      {/* Privacy gate or run button */}
      {gateOpen ? (
        <div className={`${CARD} space-y-3`} role="dialog" aria-label={t('privacyTitle')}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden />
            {t('privacyTitle')}
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300">{t('privacyBody')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} onClick={onConfirmConsent}>
              <Check className="h-4 w-4" aria-hidden />
              {t('privacyConfirm')}
            </button>
            <button type="button" className={BTN_GHOST} onClick={() => setGateOpen(false)}>
              {t('privacyDecline')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={BTN_PRIMARY} disabled={!canRun || loading} onClick={onRun}>
          <Sparkles className="h-4 w-4" aria-hidden />
          {t('run')}
        </button>
      )}

      {/* Status */}
      {run.status === 'loading' && (
        <div className={`${CARD} flex items-center justify-between gap-3`} role="status" aria-live="polite">
          <span className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('loading')}
          </span>
          <button type="button" className={BTN_GHOST} onClick={cancel}>
            <X className="h-4 w-4" aria-hidden />
            {t('cancel')}
          </button>
        </div>
      )}

      {run.status === 'error' && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-100"
        >
          <p>{t(`err_${run.code}`)}</p>
          <button type="button" className={BTN_GHOST} onClick={rerun}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t('retry')}
          </button>
        </div>
      )}

      {/* Result (keyed so per-result UI state resets on every new result) */}
      {run.status === 'done' && (
        <ResultView
          key={run.seq}
          result={run.result}
          job={run.job}
          t={t}
          onRegenerate={rerun}
          onInsertText={onInsertText}
          onReplaceSelection={onReplaceSelection}
          onCreateFlashcards={onCreateFlashcards}
          onCreateQuiz={onCreateQuiz}
        />
      )}
    </div>
  );
}
