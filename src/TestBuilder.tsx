import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, ChevronUp, ChevronDown, ListChecks, PenLine, ClipboardPaste, X } from 'lucide-react';
import type { TestPaper, TestQuestion, MCQQuestion, SubjectiveQuestion } from './types';
import PhotoImport from './PhotoImport';
import { parseBulkQuestions, BULK_IMPORT_EXAMPLE } from './testBulkImport';

// ============================================================
// TestBuilder.tsx
// The "author a test paper by hand" form — this is what replaces AI
// generation. Vishal types every question himself: MCQs (4 options,
// correct answer, marks, negative marking) or subjective questions
// (model answer + marks), in whatever order and quantity he wants.
// Used for both creating a new TestPaper and editing an existing one
// (Test.tsx passes `initialPaper` for edit mode).
// ============================================================

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `q_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const blankMCQ = (): MCQQuestion => ({
  id: newId(),
  type: 'mcq',
  question: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  explanation: '',
  marks: 4,
  negativeMarks: 1,
});

/** Editable fields across both question types — a plain shape (not an
 *  intersection of the two discriminated variants) so patches don't
 *  collapse to `never` on the fields that only exist on one variant. */
interface QuestionPatch {
  question?: string;
  options?: string[];
  correctIndex?: number;
  modelAnswer?: string;
  explanation?: string;
  marks?: number;
  negativeMarks?: number;
}

const blankSubjective = (): SubjectiveQuestion => ({
  id: newId(),
  type: 'subjective',
  question: '',
  modelAnswer: '',
  explanation: '',
  marks: 4,
});

interface TestBuilderProps {
  initialPaper: TestPaper | null;
  onSave: (paper: TestPaper) => void;
  onCancel: () => void;
}

export default function TestBuilder({ initialPaper, onSave, onCancel }: TestBuilderProps) {
  const [title, setTitle] = useState(initialPaper?.title ?? '');
  const [topic, setTopic] = useState(initialPaper?.topic ?? '');
  const [durationMinutes, setDurationMinutes] = useState(initialPaper?.durationMinutes ?? 30);
  const [questions, setQuestions] = useState<TestQuestion[]>(initialPaper?.questions ?? []);
  const [error, setError] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);

  // No cap on the number of questions.
  const addMCQ = () => setQuestions((qs) => [...qs, blankMCQ()]);
  const addSubjective = () => setQuestions((qs) => [...qs, blankSubjective()]);
  const removeQuestion = (id: string) => setQuestions((qs) => qs.filter((q) => q.id !== id));
  const moveQuestion = (index: number, dir: -1 | 1) =>
    setQuestions((qs) => {
      const next = [...qs];
      const target = index + dir;
      if (target < 0 || target >= next.length) return qs;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const updateQuestion = (id: string, patch: QuestionPatch) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? ({ ...q, ...patch } as TestQuestion) : q)));

  const handleBulkImport = (parsed: TestQuestion[]) => {
    setQuestions((qs) => [...qs, ...parsed]);
    setShowBulkImport(false);
  };

  const handleSave = () => {
    if (!title.trim()) return setError('Give the test a title.');
    if (!topic.trim()) return setError('Give the test a topic/subject.');
    if (questions.length === 0) return setError('Add at least one question.');
    for (const [i, q] of questions.entries()) {
      if (!q.question.trim()) return setError(`Question ${i + 1} is empty.`);
      if (q.type === 'mcq' && q.options.some((o) => !o.trim())) return setError(`Question ${i + 1}: fill all 4 options.`);
      if (q.type === 'mcq' && (q.correctIndex < 0 || q.correctIndex > 3)) return setError(`Question ${i + 1}: select the correct option (or add the answer sheet).`);
      if (q.type === 'subjective' && !q.modelAnswer.trim()) return setError(`Question ${i + 1}: add a model answer.`);
    }

    const now = new Date().toISOString();
    onSave({
      id: initialPaper?.id ?? newId(),
      title: title.trim(),
      topic: topic.trim(),
      durationMinutes: Math.max(0, Math.round(durationMinutes)),
      questions,
      createdAt: initialPaper?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 mb-6">
        <div className="grid md:grid-cols-3 gap-4 mb-1">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1.5 text-gray-600 dark:text-white/70">Test title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unit 3 Mock Test"
              className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-600 dark:text-white/70">Duration (min, 0 = no timer)</label>
            <input
              type="number"
              min={0}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 0)}
              className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium mb-1.5 text-gray-600 dark:text-white/70">Topic / Subject</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Organic Chemistry"
            className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-black dark:focus:border-white"
          />
        </div>
      </div>

      <PhotoImport
        questions={questions}
        onAppendQuestions={(qs) => setQuestions((prev) => [...prev, ...qs])}
        onReplaceQuestions={setQuestions}
      />

      <div className="space-y-4 mb-6">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            index={i}
            total={questions.length}
            question={q}
            onChange={(patch) => updateQuestion(q.id, patch)}
            onRemove={() => removeQuestion(q.id)}
            onMove={(dir) => moveQuestion(i, dir)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={addMCQ}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-sm font-medium transition"
        >
          <ListChecks className="w-4 h-4" /> Add MCQ Question
        </button>
        <button
          onClick={addSubjective}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-sm font-medium transition"
        >
          <PenLine className="w-4 h-4" /> Add Subjective Question
        </button>
        <button
          onClick={() => setShowBulkImport(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-sm font-medium transition"
        >
          <ClipboardPaste className="w-4 h-4" /> Bulk Import
        </button>
      </div>

      {showBulkImport && <BulkImportPanel onImport={handleBulkImport} onClose={() => setShowBulkImport(false)} />}

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <button onClick={handleSave} className="px-6 py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold transition">
          {initialPaper ? 'Save Changes' : 'Save Test'}
        </button>
        <button onClick={onCancel} className="px-6 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 font-medium transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

function BulkImportPanel({ onImport, onClose }: { onImport: (questions: TestQuestion[]) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [showExample, setShowExample] = useState(false);

  const handleImport = () => {
    const { questions, errors: parseErrors } = parseBulkQuestions(text);
    setErrors(parseErrors);
    if (questions.length > 0) onImport(questions);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold">Bulk Import</p>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10" aria-label="Close bulk import">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-white/60 mb-3">
        Paste as many questions as you want, one after another, separated by a line with just <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-white/10">---</code>.{' '}
        <button onClick={() => setShowExample((s) => !s)} className="underline">
          {showExample ? 'Hide' : 'Show'} format example
        </button>
      </p>
      {showExample && (
        <pre className="text-xs bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 mb-3 overflow-x-auto whitespace-pre-wrap">{BULK_IMPORT_EXAMPLE}</pre>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your questions here..."
        rows={10}
        className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 mb-3 font-mono text-sm resize-none focus:outline-none focus:border-black dark:focus:border-white"
      />
      {errors.length > 0 && (
        <div className="mb-3 text-sm text-amber-600 dark:text-amber-400 space-y-1">
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={handleImport} disabled={!text.trim()} className="px-5 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-30 text-sm font-semibold transition">
          Import Questions
        </button>
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-sm font-medium transition">
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

function QuestionCard({
  index,
  total,
  question,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  total: number;
  question: TestQuestion;
  onChange: (patch: QuestionPatch) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">
          Q{index + 1} · {question.type === 'mcq' ? 'MCQ' : 'Subjective'}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30" aria-label="Move up">
            <ChevronUp className="w-4 h-4" />
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30" aria-label="Move down">
            <ChevronDown className="w-4 h-4" />
          </button>
          <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/10 text-red-500" aria-label="Remove question">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <textarea
        value={question.question}
        onChange={(e) => onChange({ question: e.target.value })}
        placeholder="Question text"
        rows={2}
        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 mb-3 resize-none focus:outline-none focus:border-black dark:focus:border-white"
      />

      {question.type === 'mcq' ? (
        <div className="space-y-2 mb-3">
          {(question as MCQQuestion).options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input
                type="radio"
                checked={(question as MCQQuestion).correctIndex === oi}
                onChange={() => onChange({ correctIndex: oi })}
                aria-label={`Mark option ${oi + 1} correct`}
              />
              <input
                value={opt}
                onChange={(e) => {
                  const options = [...(question as MCQQuestion).options];
                  options[oi] = e.target.value;
                  onChange({ options });
                }}
                placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black dark:focus:border-white"
              />
            </div>
          ))}
          <p className="text-xs text-gray-400 dark:text-white/40 pl-6">Select the radio button next to the correct option.</p>
        </div>
      ) : (
        <textarea
          value={(question as SubjectiveQuestion).modelAnswer}
          onChange={(e) => onChange({ modelAnswer: e.target.value })}
          placeholder="Model answer (shown to you after you submit, for self-grading)"
          rows={3}
          className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 mb-3 resize-none focus:outline-none focus:border-black dark:focus:border-white"
        />
      )}

      <textarea
        value={question.explanation}
        onChange={(e) => onChange({ explanation: e.target.value })}
        placeholder="Explanation (optional, shown in results)"
        rows={2}
        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 mb-3 resize-none focus:outline-none focus:border-black dark:focus:border-white text-sm"
      />

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/60">
          Marks
          <input
            type="number"
            value={question.marks}
            onChange={(e) => onChange({ marks: Number(e.target.value) || 0 })}
            className="w-16 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black dark:focus:border-white"
          />
        </label>
        {question.type === 'mcq' && (
          <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/60">
            Negative marks
            <input
              type="number"
              value={(question as MCQQuestion).negativeMarks}
              onChange={(e) => onChange({ negativeMarks: Number(e.target.value) || 0 })}
              className="w-16 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black dark:focus:border-white"
            />
          </label>
        )}
      </div>
    </motion.div>
  );
}
