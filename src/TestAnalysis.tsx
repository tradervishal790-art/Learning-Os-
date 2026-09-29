import { useMemo, useState } from 'react';
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { TestAttempt } from './types';
import { analyzeAttempt, analyzeHistory, buildInsightPayload, type Finding } from './testAnalytics';
import { fetchTestSuggestion } from './testInsightApi';
import { useLanguage } from './i18n/LanguageContext';

// ============================================================
// TestAnalysis.tsx — shown under the score on the results screen.
//   1. "This test"        — computed on-device, no AI
//   2. "Across your tests" — patterns over all earlier tests, no AI
//   3. "Suggestion for your next test" — ONE AI suggestion, only when the
//      learner presses the button; saved on the attempt.
// ============================================================

const sevIcon = (s: Finding['severity']) =>
  s === 'good' ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" /> : s === 'warn' ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" /> : <Info className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" />;

function FindingList({ items }: { items: Finding[] }) {
  return (
    <ul className="space-y-2">
      {items.map((f, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-white/80">
          {sevIcon(f.severity)}
          <span>{f.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-2 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-white/50">{label}</p>
    </div>
  );
}

export default function TestAnalysis({
  attempt,
  allAttempts,
  onSaveInsight,
}: {
  attempt: TestAttempt;
  allAttempts: TestAttempt[];
  onSaveInsight: (text: string) => void;
}) {
  const { locale } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const a = useMemo(() => analyzeAttempt(attempt), [attempt]);
  const h = useMemo(() => analyzeHistory(attempt, allAttempts), [attempt, allAttempts]);

  const getSuggestion = async () => {
    setBusy(true);
    setError('');
    try {
      const text = await fetchTestSuggestion(buildInsightPayload(attempt, a, h), locale);
      if (!text) throw new Error('No suggestion came back — please try again.');
      onSaveInsight(text);
    } catch (e: any) {
      setError(e?.message || 'Could not get a suggestion — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const TrendIcon = h.trend === 'improving' ? TrendingUp : h.trend === 'declining' ? TrendingDown : Minus;
  const card = 'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 mb-4';

  return (
    <div className="mb-8">
      {/* 1 — this test */}
      <div className={card}>
        <h3 className="font-semibold mb-3">This test</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <Stat label="Correct" value={a.correct} />
          <Stat label="Wrong" value={a.wrong} />
          <Stat label="Left blank" value={a.skipped} />
          <Stat label="Accuracy (attempted)" value={a.attempted > 0 ? `${a.accuracy}%` : '—'} />
        </div>
        {a.findings.length > 0 ? <FindingList items={a.findings} /> : <p className="text-sm text-gray-500 dark:text-white/50">Nothing unusual stands out in this test.</p>}
      </div>

      {/* 2 — across tests */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Across your tests</h3>
          {h.trend && (
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-white/50">
              <TrendIcon className="w-4 h-4" /> {h.trend}
            </span>
          )}
        </div>
        {h.attempts < 2 ? (
          <p className="text-sm text-gray-500 dark:text-white/50">Take a few more tests — patterns (weak topics, repeated mistakes, habits) show up once there are 2 or more.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Stat label="Tests taken" value={h.attempts} />
              <Stat label="Average score" value={`${h.avgScore}%`} />
              <Stat label="Avg accuracy" value={`${h.avgAccuracy}%`} />
            </div>
            {h.findings.length > 0 ? <FindingList items={h.findings} /> : <p className="text-sm text-gray-500 dark:text-white/50">No repeating problems found so far — keep going.</p>}
            {h.repeatedMisses.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold mb-2 text-gray-600 dark:text-white/60">Questions you keep missing</p>
                <ul className="space-y-1.5">
                  {h.repeatedMisses.map((m, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-white/80">
                      • {m.question} <span className="text-xs text-gray-400 dark:text-white/40">(missed {m.missed} of {m.seen}{m.sameWrongOption ? ', same wrong option' : ''})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {h.topics.length >= 2 && (
              <div className="mt-4">
                <p className="text-xs font-semibold mb-2 text-gray-600 dark:text-white/60">Topics (weakest first)</p>
                <div className="space-y-1.5">
                  {h.topics.slice(0, 6).map((t) => (
                    <div key={t.topic} className="flex items-center gap-3 text-sm">
                      <span className="flex-1 truncate">{t.topic}</span>
                      <div className="w-24 h-1.5 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                        <div className={`h-full ${t.avgScore >= 80 ? 'bg-emerald-500' : t.avgScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.max(3, t.avgScore)}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs text-gray-500 dark:text-white/50">{t.avgScore}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3 — one AI suggestion */}
      <div className={card}>
        <h3 className="flex items-center gap-2 font-semibold mb-2">
          <Sparkles className="w-4 h-4" /> Suggestion for your next test
        </h3>
        {attempt.insight ? (
          <p className="text-sm text-gray-700 dark:text-white/80 leading-relaxed">{attempt.insight}</p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-white/50 mb-3">One clear thing to work on, based on this test and your earlier ones.</p>
        )}
        <button
          onClick={getSuggestion}
          disabled={busy}
          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-xs font-semibold transition disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {busy ? 'Thinking…' : attempt.insight ? 'Get a new suggestion' : 'Get AI suggestion'}
        </button>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>
    </div>
  );
}
