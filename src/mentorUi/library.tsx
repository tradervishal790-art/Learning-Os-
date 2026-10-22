// OpenUI component library for the Mentor chat. The AI may only use the components defined here.
// Prompt for the server is generated from this file: `npm run gen:mentor-ui` (writes api/_lib/mentorUiPrompt.ts).
import { useState } from 'react';
import { defineComponent, createLibrary } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { useTranslation } from '../i18n/LanguageContext';
import { format } from '../i18n/format';

/** **bold** only — same tiny subset the plain Mentor text supports. */
function Bold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
      )}
    </>
  );
}

const TextBlock = defineComponent({
  name: 'TextBlock',
  description: 'A short paragraph of plain text. Use **bold** only for key terms. Max 60 words.',
  props: z.object({ text: z.string().max(600) }),
  component: ({ props }) => (
    <p className="text-sm leading-relaxed">
      <Bold text={props.text} />
    </p>
  ),
});

const StepList = defineComponent({
  name: 'StepList',
  description: 'A numbered list of steps or a short plan. 2 to 6 short steps, one sentence each.',
  props: z.object({
    title: z.string().max(80).describe('Short heading'),
    steps: z.array(z.string().max(200)).min(2).max(6),
  }),
  component: ({ props }) => (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
      <div className="text-xs font-bold mb-2 opacity-70">{props.title}</div>
      <ol className="space-y-2">
        {props.steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-semibold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span>
              <Bold text={s} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  ),
});

const Quiz = defineComponent({
  name: 'Quiz',
  description:
    'ONE multiple-choice question. 2 to 4 options. answerIndex is the 0-based index of the correct option. Put several Quiz components in a Stack for a longer quiz (max 5).',
  props: z.object({
    question: z.string().max(300),
    options: z.array(z.string().max(120)).min(2).max(4),
    answerIndex: z.number().int().min(0).max(3),
    explanation: z.string().max(300).describe('Why the answer is correct, one or two sentences'),
  }),
  component: function QuizCard({ props }) {
    const t = useTranslation();
    const [picked, setPicked] = useState<number | null>(null);
    const answered = picked !== null;
    const correct = Math.min(Math.max(props.answerIndex, 0), props.options.length - 1);
    return (
      <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 space-y-2">
        <div className="text-sm font-semibold leading-snug">
          <Bold text={props.question} />
        </div>
        <div className="space-y-1.5">
          {props.options.map((o, i) => {
            const isRight = answered && i === correct;
            const isWrong = answered && i === picked && i !== correct;
            return (
              <button
                key={i}
                type="button"
                disabled={answered}
                onClick={() => setPicked(i)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition ${
                  isRight
                    ? 'border-green-500 bg-green-500/10'
                    : isWrong
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
                } disabled:cursor-default`}
              >
                {o}
              </button>
            );
          })}
        </div>
        {answered && (
          <div className="text-xs leading-relaxed opacity-90">
            <span className="font-semibold">{picked === correct ? t.mentor.cards.correct : t.mentor.cards.notQuite}</span>{' '}
            <Bold text={props.explanation} />
          </div>
        )}
      </div>
    );
  },
});

const FlashcardDeck = defineComponent({
  name: 'FlashcardDeck',
  description:
    'A deck of 3 to 8 flashcards the student taps to flip. Each card is an object {front: "short question or term", back: "short answer"}.',
  props: z.object({
    cards: z.array(z.object({ front: z.string().max(160), back: z.string().max(240) })).min(1).max(8),
  }),
  component: function Deck({ props }) {
    const t = useTranslation();
    const [i, setI] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const cards = props.cards.filter((c) => c.front || c.back);
    if (cards.length === 0) return null;
    const idx = Math.min(i, cards.length - 1);
    const card = cards[idx];
    const go = (n: number) => {
      setI(n);
      setFlipped(false);
    };
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="w-full min-h-[110px] rounded-xl border border-gray-200 dark:border-white/10 p-4 text-left hover:bg-gray-100 dark:hover:bg-white/10 transition"
        >
          <div className="text-[11px] uppercase tracking-wide opacity-60 mb-1">{flipped ? t.mentor.cards.answer : t.mentor.cards.question}</div>
          <div className="text-sm leading-relaxed">{flipped ? card.back : card.front}</div>
          <div className="text-[11px] opacity-50 mt-2">{t.mentor.cards.tapToFlip}</div>
        </button>
        <div className="flex items-center justify-between text-xs">
          <button type="button" disabled={idx === 0} onClick={() => go(idx - 1)} className="px-3 h-8 rounded-full card disabled:opacity-30">
            {t.mentor.cards.prev}
          </button>
          <span className="opacity-60">{format(t.mentor.cards.counter, idx + 1, cards.length)}</span>
          <button type="button" disabled={idx === cards.length - 1} onClick={() => go(idx + 1)} className="px-3 h-8 rounded-full card disabled:opacity-30">
            {t.mentor.cards.next}
          </button>
        </div>
      </div>
    );
  },
});

const BarChart = defineComponent({
  name: 'BarChart',
  description: 'A simple bar chart comparing 2 to 8 numbers. labels and values must have the same length. Use only for real numbers the student gave or that are well known.',
  props: z.object({
    title: z.string().max(80),
    labels: z.array(z.string().max(30)).min(2).max(8),
    values: z.array(z.number()).min(2).max(8),
    unit: z.string().max(12).optional().describe('Optional unit such as % or marks'),
  }),
  component: ({ props }) => {
    const n = Math.min(props.labels.length, props.values.length);
    const vals = props.values.slice(0, n);
    const max = Math.max(...vals.map((v) => Math.abs(v)), 1);
    return (
      <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
        <div className="text-xs font-bold mb-2 opacity-70">{props.title}</div>
        <div className="space-y-1.5">
          {vals.map((v, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-20 flex-shrink-0 truncate">{props.labels[i]}</span>
              <div className="flex-1 h-4 rounded bg-gray-100 dark:bg-white/10 overflow-hidden">
                <div className="h-full bg-indigo-600 rounded" style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
              </div>
              <span className="w-14 text-right tabular-nums">
                {v}
                {props.unit ?? ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  },
});

const Stack = defineComponent({
  name: 'Stack',
  description: 'Vertical container. The root of every reply. Children are shown top to bottom.',
  props: z.object({
    children: z.array(z.union([TextBlock.ref, StepList.ref, Quiz.ref, FlashcardDeck.ref, BarChart.ref])).min(1).max(8),
  }),
  component: ({ props, renderNode }) => <div className="space-y-3">{renderNode(props.children)}</div>,
});

export const mentorLibrary = createLibrary({
  components: [Stack, TextBlock, StepList, Quiz, FlashcardDeck, BarChart],
  root: 'Stack',
});
