// ============================================================
// mentorUiLibrary.tsx
//
// OpenUI (https://github.com/thesysdev/openui, MIT) component library for the
// AI Mentor. In "interactive" mode (e.g. the "Quiz me" button) the model answers
// in OpenUI Lang instead of plain text, and <Renderer> turns that into the real
// components below — clickable quiz options, tables, callouts.
//
// Styling is plain Tailwind (same look as the rest of the app) — we use only
// @openuidev/react-lang, not its prebuilt react-ui kit.
//
// The server needs the prompt that teaches the model this library. It is generated
// from THIS file by `npm run gen:mentor-ui` into api/_lib/mentorUiPrompt.ts —
// re-run it after changing any component or prop here.
// ============================================================

import { useState } from 'react';
import { createLibrary, defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import MentorText from './MentorText';

const Text = defineComponent({
  name: 'Text',
  description: 'A short paragraph. Supports **bold** and simple "- " bullet lines.',
  props: z.object({ text: z.string() }),
  component: ({ props }) => <MentorText text={props.text} />,
});

const CALLOUT_STYLE: Record<string, string> = {
  tip: 'border-emerald-300 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-400/10',
  warning: 'border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10',
  note: 'border-indigo-300 bg-indigo-50 dark:border-indigo-400/30 dark:bg-indigo-400/10',
};

const Callout = defineComponent({
  name: 'Callout',
  description: 'Highlighted box for a key idea, tip or common mistake.',
  props: z.object({
    variant: z.enum(['tip', 'warning', 'note']),
    text: z.string(),
  }),
  component: ({ props }) => (
    <div className={`rounded-xl border px-3 py-2 ${CALLOUT_STYLE[props.variant] ?? CALLOUT_STYLE.note}`}>
      <MentorText text={props.text} />
    </div>
  ),
});

const Table = defineComponent({
  name: 'Table',
  description: 'Comparison table. Each row must have the same number of cells as headers.',
  props: z.object({
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
  component: ({ props }) => (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 dark:bg-white/5">
          <tr>
            {props.headers.map((h, i) => (
              <th key={i} className="px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, r) => (
            <tr key={r} className="border-t border-gray-200 dark:border-white/10">
              {row.map((cell, c) => (
                <td key={c} className="px-3 py-2 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
});

const Question = defineComponent({
  name: 'Question',
  description:
    'One multiple-choice question. "answer" is the 0-based index of the correct option in "options". Give 3-4 options.',
  props: z.object({
    question: z.string(),
    options: z.array(z.string()),
    answer: z.number(),
    explanation: z.string().describe('One or two sentences on why the answer is correct'),
  }),
  component: ({ props }) => <QuestionCard {...props} />,
});

function QuestionCard({
  question, options, answer, explanation,
}: { question: string; options: string[]; answer: number; explanation: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
      <div className="text-sm font-medium mb-2">{question}</div>
      <div className="space-y-2">
        {options.map((opt, i) => {
          const isRight = i === answer;
          const isPicked = i === picked;
          let tone = 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10';
          if (done && isRight) tone = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-400/10';
          else if (done && isPicked) tone = 'border-red-500 bg-red-50 dark:bg-red-400/10';
          return (
            <button
              key={i}
              disabled={done}
              onClick={() => setPicked(i)}
              className={`w-full text-left text-sm rounded-lg border px-3 py-2 transition disabled:cursor-default ${tone}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {done && <div className="mt-2 text-sm text-gray-600 dark:text-white/70">{explanation}</div>}
    </div>
  );
}

const Quiz = defineComponent({
  name: 'Quiz',
  description: 'A short interactive quiz. Use 3-5 Question items.',
  props: z.object({ questions: z.array(Question.ref) }),
  component: ({ props, renderNode }) => <div className="space-y-3">{renderNode(props.questions)}</div>,
});

const Stack = defineComponent({
  name: 'Stack',
  description: 'Vertical container. Always the root. Put short intro Text first, then the main component.',
  props: z.object({
    children: z.array(z.union([Text.ref, Callout.ref, Table.ref, Quiz.ref])),
  }),
  component: ({ props, renderNode }) => <div className="space-y-3">{renderNode(props.children)}</div>,
});

export const mentorUiLibrary = createLibrary({
  root: 'Stack',
  components: [Stack, Text, Callout, Table, Quiz, Question],
});

export const MENTOR_UI_PROMPT_OPTIONS = {
  preamble:
    'You are a patient AI learning mentor for students in India. Answer by building a small interactive UI from the components below instead of plain text.',
  additionalRules: [
    'Keep every text short (max 2 sentences). Write all visible text in the requested reply language only.',
    'For a quiz request: root = Stack([Text(intro), Quiz([...3 to 5 Question(...)])]). Make wrong options plausible.',
    'Use Table only for real comparisons, Callout for one key idea or common mistake.',
    'Never invent links, video titles or channel names. Output OpenUI Lang only, no markdown fences.',
  ],
  examples: [
    `root = Stack([intro, quiz])
intro = Text("Quick check — pick the best answer.")
quiz = Quiz([q1, q2])
q1 = Question("What does a variable store?", ["A value", "A color", "A file name"], 0, "A variable holds a value you can reuse later.")
q2 = Question("Which is a loop?", ["if", "for", "return"], 1, "for repeats a block of code.")`,
  ],
};
