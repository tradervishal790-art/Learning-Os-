import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import { fetchPersonalityReport } from './personalityReportApi';
import type { PersonalityProfile, PersonalityReport } from './personalityScoring';

// Personality Check AI report. The trait scores/zones are backend-only (they pick the
// personality type data sent to the AI) and are NOT shown to the learner.
//   archetype header  ->  "Deep analysis" (markdown sections)
// After the quiz (autoGenerate) the report is written straight away; elsewhere it is a button.

/** Tiny markdown renderer: # / ## headings, ---, **bold**, *italic*, paragraphs. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function MiniMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length === 0) return;
    blocks.push(
      <p key={blocks.length} className="text-sm leading-relaxed text-gray-700 dark:text-white/80">
        {para.map((l, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {inline(l)}
          </span>
        ))}
      </p>,
    );
    para = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) flush();
    else if (/^-{3,}$/.test(line)) {
      flush();
      blocks.push(<hr key={blocks.length} className="border-gray-200 dark:border-white/10" />);
    } else if (line.startsWith('## ')) {
      flush();
      blocks.push(<h4 key={blocks.length} className="text-base font-semibold pt-1">{line.slice(3)}</h4>);
    } else if (line.startsWith('# ')) {
      flush();
      blocks.push(<h3 key={blocks.length} className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/40">{line.slice(2)}</h3>);
    } else para.push(line);
  }
  flush();
  return <div className="space-y-3">{blocks}</div>;
}

export default function PersonalityReportCard({
  profile,
  onReport,
  autoGenerate = false,
}: {
  profile: PersonalityProfile;
  onReport: (report: PersonalityReport) => void;
  /** Write the report as soon as this card appears (used right after the quiz). */
  autoGenerate?: boolean;
}) {
  const { locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const report = profile.report;
  const started = useRef(false);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      onReport(await fetchPersonalityReport(profile, locale));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get the report — please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoGenerate && !report && !started.current) {
      started.current = true;
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!report) {
    return (
      <div className="los-panel los-panel-accent">
        {loading ? (
          <>
            <p className="text-sm font-semibold">Writing your report…</p>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-1">This takes a few seconds.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold">Get your deep analysis</p>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-1">
              AI reads the answers you chose and writes your report: who you are as a learner, how you handle pressure, your strengths, growth edges and a study blueprint. Your answers are sent to AI only when the report is written.
            </p>
            <button
              onClick={generate}
              className="los-btn los-btn-primary mt-3"
            >
              {error ? 'Try again' : 'Get AI report'}
            </button>
          </>
        )}
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="los-panel los-panel-accent">
        <p className="text-[11px] uppercase tracking-widest text-purple-500">Your learning archetype</p>
        <p className="text-xl font-semibold mt-1">{report.archetype}</p>
        <p className="text-xs text-gray-500 dark:text-white/50 mt-1">
          <span className="text-purple-500 font-medium">{report.dominantArea}</span> dominant · <span className="text-purple-500 font-medium">{report.growthArea}</span> growth area
        </p>
      </div>
      <div className="los-panel">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/40 mb-3">Deep analysis</p>
        <MiniMarkdown text={report.report} />
      </div>
      <button onClick={generate} disabled={loading} className="text-xs text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 transition disabled:opacity-50">
        {loading ? 'Writing a new report…' : 'Write a new report'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
