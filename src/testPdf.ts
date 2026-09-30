// src/testPdf.ts
//
// Builds the downloadable result report for a completed TestAttempt.
// It is rendered as HTML and handed to the browser's own print engine
// ("Save as PDF"), NOT drawn with a PDF library. Reason: the questions,
// options, answers and explanations can be in ANY language/script that
// the test author used (Hindi, English, Hinglish, ...). Libraries like
// jsPDF cannot shape Devanagari and ship only Latin fonts, so the text
// would come out broken; the browser renders every script correctly with
// the user's system fonts. Everything shown is exactly what the author
// wrote — nothing is translated or altered.
import type { TestAttempt, MCQQuestion, SubjectiveQuestion } from './types';
import type { LiveRow } from './liveTest';

const esc = (s: string): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Noto Sans', 'Noto Sans Devanagari', 'Nirmala UI', 'Mangal', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; color: #111; font-size: 11pt; line-height: 1.5; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4px; }
  .meta { color: #666; font-size: 9.5pt; }
  .score { font-size: 13pt; font-weight: 700; margin: 10px 0 2px; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 12px 0; }
  .q { margin-bottom: 14px; page-break-inside: avoid; }
  .qt { font-weight: 700; white-space: pre-wrap; }
  .opt, .ans { margin-left: 14px; white-space: pre-wrap; color: #444; }
  .ok { color: #148214; }
  .bad { color: #be1e1e; }
  .pend { color: #96780f; }
  .exp { margin: 3px 0 0 14px; font-style: italic; white-space: pre-wrap; }
`;

function buildHtml(attempt: TestAttempt): string {
  const correctCount = attempt.results.filter((r) => r.isCorrect === true).length;
  const pendingCount = attempt.results.filter((r) => r.isCorrect === null).length;
  const resultsById = new Map(attempt.results.map((r) => [r.questionId, r]));
  const answersById = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const time =
    attempt.timeTakenSeconds > 0 ? ` &nbsp;•&nbsp; Time taken: ${Math.floor(attempt.timeTakenSeconds / 60)}m ${attempt.timeTakenSeconds % 60}s` : '';

  const questions = attempt.questions
    .map((q, i) => {
      const result = resultsById.get(q.id);
      const answer = answersById.get(q.id);
      let body = '';

      if (q.type === 'mcq') {
        const mcq = q as MCQQuestion;
        const selected = answer && answer.type === 'mcq' ? answer.selectedIndex : null;
        body = mcq.options
          .map((opt, oi) => {
            const isCorrectOpt = oi === mcq.correctIndex;
            const isSelected = oi === selected;
            const cls = isCorrectOpt ? 'ok' : isSelected ? 'bad' : '';
            const tag = isCorrectOpt ? ' [correct]' : isSelected ? ' [your answer]' : '';
            return `<div class="opt ${cls}">${String.fromCharCode(65 + oi)}. ${esc(opt)}${tag}</div>`;
          })
          .join('');
      } else {
        const sub = q as SubjectiveQuestion;
        const text = answer && answer.type === 'subjective' && answer.text.trim() ? answer.text.trim() : '(left blank)';
        body = `<div class="ans">Your answer: ${esc(text)}</div><div class="ans ok">Model answer: ${esc(sub.modelAnswer)}</div>`;
      }

      const status =
        result?.isCorrect === true
          ? { cls: 'ok', text: `Correct (+${result.marksObtained})` }
          : result?.isCorrect === false
            ? { cls: 'bad', text: `Incorrect (${result.marksObtained})` }
            : { cls: 'pend', text: 'Not yet self-graded' };

      return `<div class="q">
        <div class="qt">Q${i + 1}. ${esc(q.question)} &nbsp;[${q.marks} marks]</div>
        ${body}
        <div class="exp ${status.cls}">${status.text}${q.explanation ? ' — ' + esc(q.explanation) : ''}</div>
      </div>`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(attempt.testTitle || attempt.topic)}</title><style>${CSS}</style></head><body>
    <h1>${esc(attempt.testTitle || attempt.topic)}</h1>
    <div class="meta">Completed: ${esc(new Date(attempt.completedAt).toLocaleString())}${time}</div>
    <div class="score">Score: ${attempt.obtainedMarks} / ${attempt.totalMarks} marks (${attempt.scorePercent}%)</div>
    <div class="meta">${correctCount}/${attempt.results.length} correct${pendingCount > 0 ? ` &nbsp;•&nbsp; ${pendingCount} not yet self-graded` : ''}</div>
    <hr>${questions}
  </body></html>`;
}

/** Renders HTML in a hidden iframe and opens the browser's print dialog ("Save as PDF"). */
function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  win.addEventListener('afterprint', cleanup);
  // Give fonts/layout a moment, then print.
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
}

/** Opens the browser's print dialog for the report — choose "Save as PDF". */
export function downloadTestResultPdf(attempt: TestAttempt): void {
  printHtml(buildHtml(attempt));
}

// ---------- Live Test leaderboard (all participants, ranked by marks) ----------

const LB_CSS = `
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5pt; }
  thead { display: table-header-group; }
  th { text-align: left; background: #f1f1f1; padding: 6px 8px; border-bottom: 2px solid #999; }
  td { padding: 5px 8px; border-bottom: 1px solid #e3e3e3; }
  tr { page-break-inside: avoid; }
  td.n, th.n { text-align: right; white-space: nowrap; }
  tr.top td { font-weight: 700; background: #fff8e1; }
  tr.absent td { color: #888; }
`;

const fmtTime = (sec: number): string => (sec > 0 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : '—');

function buildLeaderboardHtml(title: string, rows: LiveRow[], totalMarks: number, joined: number, enrolled: number): string {
  const submitted = rows.filter((r) => r.submitted);
  const highest = submitted.length ? Math.max(...submitted.map((r) => r.obtained)) : 0;
  const avg = submitted.length ? submitted.reduce((s, r) => s + r.obtained, 0) / submitted.length : 0;
  const body = rows
    .map(
      (r) => `<tr class="${!r.submitted ? 'absent' : r.rank !== null && r.rank <= 3 ? 'top' : ''}">
        <td class="n">${r.rank ?? '—'}</td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.phone)}</td>
        <td class="n">${r.submitted ? `${r.obtained} / ${r.total}` : 'Not submitted'}</td>
        <td class="n">${r.submitted ? r.percent + '%' : '—'}</td>
        <td class="n">${r.submitted ? r.correct : '—'}</td>
        <td class="n">${r.submitted ? r.wrong : '—'}</td>
        <td class="n">${r.submitted ? fmtTime(r.timeTakenSeconds) : '—'}</td>
      </tr>`
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} — Ranking</title><style>${CSS}${LB_CSS}</style></head><body>
    <h1>${esc(title)} — Ranking</h1>
    <div class="meta">Generated: ${esc(new Date().toLocaleString())}</div>
    <div class="meta">Enrolled: ${enrolled} &nbsp;•&nbsp; Joined: ${joined} &nbsp;•&nbsp; Submitted: ${submitted.length} &nbsp;•&nbsp; Total marks: ${totalMarks} &nbsp;•&nbsp; Highest: ${highest} &nbsp;•&nbsp; Average: ${avg.toFixed(1)}</div>
    <table>
      <thead><tr><th class="n">Rank</th><th>Name</th><th>Phone</th><th class="n">Marks</th><th class="n">%</th><th class="n">Correct</th><th class="n">Wrong</th><th class="n">Time</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </body></html>`;
}

/** Ranking sheet for a Live Test — every participant, highest marks first. */
export function downloadLeaderboardPdf(title: string, rows: LiveRow[], totalMarks: number, joined: number, enrolled: number): void {
  printHtml(buildLeaderboardHtml(title, rows, totalMarks, joined, enrolled));
}
