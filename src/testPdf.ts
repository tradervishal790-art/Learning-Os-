// src/testPdf.ts
//
// Builds a downloadable PDF report for a completed TestAttempt — marks
// summary + every question with the learner's answer, the correct
// answer, marks obtained, and the explanation. Runs entirely client-side
// (jsPDF), no server round-trip since everything it needs is already in
// the attempt object.
import { jsPDF } from 'jspdf';
import type { TestAttempt, MCQQuestion, SubjectiveQuestion } from './types';

const PAGE_WIDTH = 210; // A4 mm
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PAGE_HEIGHT = 297;

export function downloadTestResultPdf(attempt: TestAttempt): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const writeWrapped = (text: string, x: number, maxWidth: number, lineHeight = 5.2) => {
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    }
  };

  // ── Header ──────────────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  writeWrapped(attempt.testTitle || attempt.topic, MARGIN, CONTENT_WIDTH, 7);
  y += 1;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Completed: ${new Date(attempt.completedAt).toLocaleString()}`, MARGIN, y);
  y += 6;
  if (attempt.timeTakenSeconds > 0) {
    const mins = Math.floor(attempt.timeTakenSeconds / 60);
    const secs = attempt.timeTakenSeconds % 60;
    doc.text(`Time taken: ${mins}m ${secs}s`, MARGIN, y);
    y += 6;
  }

  const correctCount = attempt.results.filter((r) => r.isCorrect === true).length;
  const pendingCount = attempt.results.filter((r) => r.isCorrect === null).length;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(`Score: ${attempt.obtainedMarks} / ${attempt.totalMarks} marks (${attempt.scorePercent}%)`, MARGIN, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(
    `${correctCount}/${attempt.results.length} correct${pendingCount > 0 ? `  •  ${pendingCount} not yet self-graded` : ''}`,
    MARGIN,
    y
  );
  y += 8;

  doc.setDrawColor(210);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  // ── Per-question breakdown ──────────────────────────────────────────
  const resultsById = new Map(attempt.results.map((r) => [r.questionId, r]));
  const answersById = new Map(attempt.answers.map((a) => [a.questionId, a]));

  attempt.questions.forEach((q, i) => {
    const result = resultsById.get(q.id);
    const answer = answersById.get(q.id);
    ensureSpace(14);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    writeWrapped(`Q${i + 1}. ${q.question}  [${q.marks} marks]`, MARGIN, CONTENT_WIDTH, 5.6);
    y += 1;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (q.type === 'mcq') {
      const mcq = q as MCQQuestion;
      const selected = answer && answer.type === 'mcq' ? answer.selectedIndex : null;
      mcq.options.forEach((opt, oi) => {
        const isCorrectOpt = oi === mcq.correctIndex;
        const isSelected = oi === selected;
        const marker = isCorrectOpt ? '[correct] ' : isSelected ? '[your answer] ' : '';
        if (isCorrectOpt) doc.setTextColor(20, 130, 20);
        else if (isSelected && !isCorrectOpt) doc.setTextColor(190, 30, 30);
        else doc.setTextColor(70);
        writeWrapped(`${String.fromCharCode(65 + oi)}. ${marker}${opt}`, MARGIN + 4, CONTENT_WIDTH - 4, 5);
      });
      doc.setTextColor(70);
    } else {
      const sub = q as SubjectiveQuestion;
      doc.setTextColor(70);
      writeWrapped(
        `Your answer: ${answer && answer.type === 'subjective' && answer.text.trim() ? answer.text.trim() : '(left blank)'}`,
        MARGIN + 4,
        CONTENT_WIDTH - 4,
        5
      );
      y += 0.5;
      doc.setTextColor(20, 130, 20);
      writeWrapped(`Model answer: ${sub.modelAnswer}`, MARGIN + 4, CONTENT_WIDTH - 4, 5);
    }

    y += 0.5;
    doc.setFont('helvetica', 'italic');
    const status = result?.isCorrect === true ? `Correct (+${result.marksObtained})` : result?.isCorrect === false ? `Incorrect (${result.marksObtained})` : 'Not yet self-graded';
    const color = result?.isCorrect === true ? [20, 130, 20] : result?.isCorrect === false ? [190, 30, 30] : [150, 120, 20];
    doc.setTextColor(color[0], color[1], color[2]);
    writeWrapped(`${status} — ${q.explanation}`, MARGIN + 4, CONTENT_WIDTH - 4, 5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    y += 5;
  });

  const fileTopic = (attempt.testTitle || attempt.topic).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'test';
  doc.save(`test-results-${fileTopic}.pdf`);
}
