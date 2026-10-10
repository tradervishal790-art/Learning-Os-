import { useState, type ReactNode } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import { fetchPersonalityReport } from './personalityReportApi';
import { TRAITS, type Trait } from './personalityQuestions';
import type { PersonalityProfile, PersonalityReport } from './personalityScoring';
import { TRAIT_LABELS, ZONE_TEXT, ZoneBar } from './PersonalityResult';

// Personality Check result + AI report, in the same structure as the Mind Map report:
//   archetype header  ->  tap-to-expand trait rows  ->  "Deep analysis" (markdown sections)
// Without a report it shows the plain rows plus a "Get AI report" button (button press only).

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

function TraitRow({ trait, profile, note }: { trait: Trait; profile: PersonalityProfile; note?: string }) {
  const [open, setOpen] = useState(false);
  const r = profile.traits[trait];
  const meaning = r.unsure ? 'Not clear yet. Your tests and practice will show this one.' : ZONE_TEXT[trait][r.zone];
  return (
    <button
      onClick={() => setOpen((v) => !v)}
      className="w-full text-left rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2.5"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-medium w-32 flex-shrink-0 text-gray-700 dark:text-white/70">{TRAIT_LABELS[trait]}</span>
        <ZoneBar zone={r.zone} unsure={r.unsure} />
        <span className="text-gray-400 dark:text-white/30 text-xs">{open ? '▴' : '▾'}</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-white/50 mt-1.5">{meaning}</p>
      {open && note && <p className="text-xs text-gray-700 dark:text-white/70 mt-2 leading-relaxed">{note}</p>}
    </button>
  );
}

export default function PersonalityReportCard({
  profile,
  onReport,
}: {
  profile: PersonalityProfile;
  onReport: (report: PersonalityReport) => void;
}) {
  const { locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const report = profile.report;

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

  const rows = (
    <div className="space-y-1.5">
      {TRAITS.map((t) => (
        <TraitRow key={t} trait={t} profile={profile} note={report?.traitNotes?.[TRAIT_LABELS[t]]} />
      ))}
      {report && <p className="text-[11px] text-center text-gray-400 dark:text-white/30 pt-1">tap any row to expand</p>}
    </div>
  );

  if (!report) {
    return (
      <div className="space-y-4">
        {rows}
        <div className="rounded-xl border border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/5 p-4">
          <p className="text-sm font-semibold">Get your deep analysis</p>
          <p className="text-xs text-gray-500 dark:text-white/50 mt-1">
            AI reads the answers you chose and writes your report: who you are as a learner, how you handle pressure, your strengths, growth edges and a study blueprint. Your answers are sent to AI only when you press the button.
          </p>
          <button
            onClick={generate}
            disabled={loading}
            className="mt-3 px-4 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-semibold disabled:opacity-50 transition active:scale-[0.98]"
          >
            {loading ? 'Writing your report…' : 'Get AI report'}
          </button>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/5 p-4">
        <p className="text-[11px] uppercase tracking-widest text-purple-500">Your learning archetype</p>
        <p className="text-xl font-semibold mt-1">{report.archetype}</p>
        <p className="text-xs text-gray-500 dark:text-white/50 mt-1">
          <span className="text-purple-500 font-medium">{report.dominantArea}</span> dominant · <span className="text-purple-500 font-medium">{report.growthArea}</span> growth area
        </p>
      </div>
      {rows}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-4">
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
