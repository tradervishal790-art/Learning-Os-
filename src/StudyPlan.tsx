import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { studyPlanText } from './studyPlanText';
import {
  MAX_SUBJECTS,
  addTopics,
  buildToday,
  isMastered,
  loadPlan,
  markLearned,
  markReviewed,
  removeTopic,
  savePlan,
  type StudyPlanState,
  type StudyTopic,
} from './studyPlanStore';
import { getStudyFile, deleteStudyFile } from './studyFiles';
import { buildImageTopics, buildPdfTopics, type NewTopicItem } from './studyPlanFiles';

const card = 'p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border';
const btnPrimary = `${btn} bg-black text-white dark:bg-white dark:text-black border-transparent hover:opacity-80`;
const btnGhost = `${btn} border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10`;
const input =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-sm text-black dark:text-white';

type Viewing = { topic: StudyTopic; action: { type: 'learn' } | { type: 'revise'; day: number } };

export default function StudyPlan() {
  const { locale } = useLanguage();
  const s = studyPlanText[locale];
  const [plan, setPlan] = useState<StudyPlanState>(() => loadPlan());
  const [viewing, setViewing] = useState<Viewing | null>(null);

  const [subject, setSubject] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [pdfParts, setPdfParts] = useState(1);
  const [photoMode, setPhotoMode] = useState<'each' | number>('each');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const today = useMemo(() => buildToday(plan), [plan]);
  const hasPdf = files.some((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  const hasPhotos = files.some((f) => f.type.startsWith('image/'));

  const commit = (next: StudyPlanState) => {
    savePlan(next);
    setPlan(next);
  };

  const handleAdd = async () => {
    setError('');
    const name = subject.trim();
    if (!name) return setError(s.needSubject);
    if (files.length === 0) return setError(s.needFiles);
    if (!plan.subjects.includes(name) && plan.subjects.length >= MAX_SUBJECTS) return setError(s.maxSubjects);
    setBusy(true);
    const created: NewTopicItem[] = [];
    try {
      const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      const photos = files.filter((f) => f.type.startsWith('image/'));
      for (const f of pdfs) created.push(...(await buildPdfTopics(f, pdfParts)));
      if (photos.length) created.push(...(await buildImageTopics(photos, photoMode, name)));
      const next = addTopics(plan, name, created);
      if (!savePlan(next)) throw new Error('save failed');
      setPlan(next);
      setFiles([]);
      setPdfParts(1);
      setPhotoMode('each');
    } catch {
      await Promise.all(created.flatMap((c) => c.fileKeys).map(deleteStudyFile));
      setError(s.addFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (t: StudyTopic) => {
    if (!window.confirm(s.confirmRemove)) return;
    await Promise.all(t.fileKeys.map(deleteStudyFile));
    commit(removeTopic(plan, t.id));
  };

  const finish = () => {
    if (!viewing) return;
    const { topic, action } = viewing;
    commit(action.type === 'learn' ? markLearned(plan, topic.id) : markReviewed(plan, topic.id, action.day));
    setViewing(null);
  };

  const label = (t: StudyTopic) => `${plan.subjects.length > 1 ? `${t.subject} · ` : ''}T${t.number} · ${t.title}`;

  return (
    <div className="space-y-6">
      {/* Today */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-xl font-bold">{s.todayTitle}</h2>
          {today.masteredCount > 0 && (
            <span className="text-xs text-gray-500 dark:text-white/60">{format(s.mastered, today.masteredCount)}</span>
          )}
        </div>

        {plan.topics.length === 0 ? (
          <div className={`${card} text-center py-10`}>
            <h3 className="font-semibold mb-1">{s.emptyTitle}</h3>
            <p className="text-sm text-gray-500 dark:text-white/60">{s.emptyBody}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* New topics */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">{s.newTopic}</div>
              <div className="space-y-2">
                {today.newTopics.map((t) => (
                  <div key={t.id} className={`${card} flex items-center gap-3`}>
                    <div className="flex-1 min-w-0 font-semibold truncate">{label(t)}</div>
                    <button className={btnPrimary} onClick={() => setViewing({ topic: t, action: { type: 'learn' } })}>
                      {s.open}
                    </button>
                  </div>
                ))}
                {today.doneToday.map((t) => (
                  <div key={t.id} className={`${card} flex items-center gap-3 opacity-60`}>
                    <div className="flex-1 min-w-0 truncate">{label(t)}</div>
                    <span className="text-xs">{s.doneToday}</span>
                  </div>
                ))}
                {today.newTopics.length === 0 && today.doneToday.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-white/60">{s.nothingNew}</p>
                )}
              </div>
            </div>

            {/* Revisions */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">{s.revisions}</div>
              <div className="space-y-2">
                {today.revisions.map((r) => (
                  <div key={`${r.topic.id}-${r.day}`} className={`${card} flex items-center gap-3`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{label(r.topic)}</div>
                      <div className="text-xs text-gray-500 dark:text-white/60 flex gap-2 flex-wrap mt-0.5">
                        <span className="uppercase tracking-wider">{r.state === 'overdue' ? s.overdue : s.dueToday}</span>
                        <span>{format(s.revisionDay, r.day)}</span>
                        {r.state === 'overdue' && <span>{format(s.daysLate, r.daysLate)}</span>}
                      </div>
                    </div>
                    <button className={btnPrimary} onClick={() => setViewing({ topic: r.topic, action: { type: 'revise', day: r.day } })}>
                      {s.open}
                    </button>
                  </div>
                ))}
                {today.revisions.length === 0 && <p className="text-sm text-gray-500 dark:text-white/60">{s.allClear}</p>}
              </div>
            </div>

            {today.upcoming.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-white/40 mb-2">{s.upcoming}</div>
                <div className="space-y-1">
                  {today.upcoming.slice(0, 4).map((u) => (
                    <div key={`${u.topic.id}-${u.day}`} className="text-xs text-gray-500 dark:text-white/60 flex gap-2">
                      <span>{u.dueDate}</span>
                      <span>T{u.topic.number}</span>
                      <span>{format(s.revisionDay, u.day)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Add files */}
      <section className={card}>
        <h3 className="font-semibold mb-1">{s.addTitle}</h3>
        <p className="text-xs text-gray-500 dark:text-white/60 mb-3">{s.addHint}</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-white/60">{s.subject}</label>
            <input
              className={input}
              list="study-subjects"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={s.subjectPlaceholder}
              disabled={busy}
            />
            <datalist id="study-subjects">
              {plan.subjects.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </div>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf,.pdf"
            disabled={busy}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-xs text-gray-500 dark:text-white/60"
            aria-label={s.pickFiles}
          />
          {hasPdf && (
            <div>
              <label className="text-xs text-gray-500 dark:text-white/60">{s.splitPdf}</label>
              <select className={input} value={pdfParts} onChange={(e) => setPdfParts(Number(e.target.value))} disabled={busy}>
                <option value={1}>{s.wholePdf}</option>
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {format(s.parts, n)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {hasPhotos && (
            <select
              className={input}
              value={String(photoMode)}
              onChange={(e) => setPhotoMode(e.target.value === 'each' ? 'each' : Number(e.target.value))}
              disabled={busy}
            >
              <option value="each">{s.photosEach}</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {format(s.photosGroup, n)}
                </option>
              ))}
            </select>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center gap-3">
            <button className={btnPrimary} onClick={handleAdd} disabled={busy}>
              {busy ? s.adding : s.add}
            </button>
            <span className="text-[11px] text-gray-400 dark:text-white/40">{s.onDevice}</span>
          </div>
        </div>
      </section>

      {/* All topics */}
      {plan.topics.length > 0 && (
        <section>
          <h3 className="font-semibold mb-2">{s.allTopics}</h3>
          <div className="space-y-1">
            {plan.topics.map((t) => (
              <div key={t.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-100 dark:border-white/5">
                <span className="flex-1 min-w-0 truncate">{label(t)}</span>
                <span className="text-xs text-gray-400 dark:text-white/40">
                  {isMastered(t) ? '✓' : t.learnedOn ? `${t.reviewed.length}/4` : '–'}
                </span>
                <button className="text-xs text-gray-400 hover:text-black dark:hover:text-white" onClick={() => handleRemove(t)}>
                  {s.remove}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {viewing && <FileViewer topic={viewing.topic} title={label(viewing.topic)} onDone={finish} onClose={() => setViewing(null)} />}
    </div>
  );
}

function FileViewer({ topic, title, onDone, onClose }: { topic: StudyTopic; title: string; onDone: () => void; onClose: () => void }) {
  const { locale } = useLanguage();
  const s = studyPlanText[locale];
  const [urls, setUrls] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    (async () => {
      const blobs = await Promise.all(topic.fileKeys.map((k) => getStudyFile(k).catch(() => null)));
      const ok = blobs.filter((b): b is Blob => !!b).map((b) => URL.createObjectURL(b));
      made.push(...ok);
      if (!cancelled) setUrls(ok);
    })();
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [topic]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-black text-black dark:text-white">
      <div className="flex items-center gap-3 p-3 border-b border-gray-200 dark:border-white/10">
        <div className="flex-1 min-w-0 font-semibold truncate">{title}</div>
        <button className={btnGhost} onClick={onClose}>
          {s.close}
        </button>
        <button className={btnPrimary} onClick={onDone}>
          {s.done}
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {urls === null ? null : urls.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-white/60">{s.fileMissing}</p>
        ) : topic.kind === 'pdf' ? (
          <iframe src={urls[0]} title={title} className="w-full h-full border-0" />
        ) : (
          <div className="max-w-3xl mx-auto p-3 space-y-3">
            {urls.map((u, i) => (
              <img key={u} src={u} alt={`${title} ${i + 1}`} className="w-full rounded-lg" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
