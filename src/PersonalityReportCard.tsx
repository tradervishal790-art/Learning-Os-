import { useState } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import { fetchPersonalityReport } from './personalityReportApi';
import type { PersonalityProfile, PersonalityReport } from './personalityScoring';

// AI report for the Personality Check. Shows the saved report, or a button that asks
// the AI to write one (button press only). Used on the quiz result screen and in Settings.
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

  if (!report) {
    return (
      <div className="rounded-xl border border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/5 p-4">
        <p className="text-sm font-semibold">Get your personal report</p>
        <p className="text-xs text-gray-500 dark:text-white/50 mt-1">
          AI reads the answers you chose and writes how you learn, your strengths, and small steps to grow. It sends your answers to AI only when you press the button.
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
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold mb-1">How you learn</p>
        <p className="text-sm text-gray-700 dark:text-white/80 leading-relaxed">{report.summary}</p>
      </div>
      {report.strengths.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-1">Your strengths</p>
          <ul className="space-y-1">
            {report.strengths.map((s, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-white/80 flex gap-2">
                <span className="text-green-500">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.growthEdges.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-1">Your growth edges</p>
          <div className="space-y-2">
            {report.growthEdges.map((g, i) => (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
                <p className="text-sm font-semibold">{g.title}</p>
                <p className="text-xs text-gray-500 dark:text-white/50 mt-1">{g.why}</p>
                <p className="text-sm text-gray-700 dark:text-white/80 mt-2">
                  <span className="font-medium">Try:</span> {g.tryThis}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {report.studyTips.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-1">How to study best</p>
          <ul className="space-y-1">
            {report.studyTips.map((s, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-white/80 flex gap-2">
                <span className="text-purple-500">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={generate} disabled={loading} className="text-xs text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 transition disabled:opacity-50">
        {loading ? 'Writing a new report…' : 'Write a new report'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
