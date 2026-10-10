import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { studyPlanText } from './studyPlanText';
import {
  MAX_BOXES,
  MAX_SUBJECTS,
  addBox,
  addFilesToBox,
  addSubject,
  buildToday,
  loadPlan,
  markLearned,
  markReviewed,
  nextFreeNumber,
  removeBox,
  removeFileFromBox,
  replaceFiles,
  savePlan,
  sweepExpired,
  endDate,
  type ExpiredBox,
  type StudyPlanState,
  type StudyTopic,
} from './studyPlanStore';
import { deleteStudyFile, getStudyFile } from './studyFiles';
import { splitPdfBlob, storeFiles } from './studyPlanFiles';

const card = 'p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border';
const btnPrimary = `${btn} bg-black text-white dark:bg-white dark:text-black border-transparent hover:opacity-80`;
const btnGhost = `${btn} border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10`;
const inputCls =
  'px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-sm text-black dark:text-white';

function describeExpired(list: ExpiredBox[], s: (typeof studyPlanText)['en']): string {
  if (list.length === 0) return '';
  const names = list.map((e) => `T${e.topic.number}`).join(', ');
  const unseen = list.reduce((n, e) => n + e.unseen, 0);
  return unseen > 0 ? format(s.clearedUnseen, names, unseen) : format(s.cleared, names);
}

type Viewing = { topic: StudyTopic; action: { type: 'learn' } | { type: 'revise'; day: number } };

export default function StudyPlan() {
  const { locale } = useLanguage();
  const s = studyPlanText[locale];
  // Expired boxes (original end date passed) are cleared as soon as the page opens; their files are
  // deleted from IndexedDB in the effect below.
  const expiredOnLoad = useRef<ExpiredBox[]>([]);
  const [plan, setPlan] = useState<StudyPlanState>(() => {
    const swept = sweepExpired(loadPlan());
    expiredOnLoad.current = swept.expired;
    let p = swept.state;
    if (swept.expired.length > 0) savePlan(p);
    // First visit: start with one subject and an empty T1 box, ready for files.
    if (p.subjects.length === 0) {
      const name = studyPlanText[locale].defaultSubject;
      p = addBox(addSubject(p, name), name);
      savePlan(p);
    }
    return p;
  });
  const [activeSubject, setActiveSubject] = useState(() => plan.subjects[0]);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [notice, setNotice] = useState(() => describeExpired(expiredOnLoad.current, studyPlanText[locale]));
  const [error, setError] = useState('');
  const [busyBox, setBusyBox] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState<string | null>(null);

  useEffect(() => {
    const files = expiredOnLoad.current.flatMap((e) => e.topic.files);
    if (files.length) void Promise.all(files.map((f) => deleteStudyFile(f.key)));
    expiredOnLoad.current = [];
  }, []);

  const today = useMemo(() => buildToday(plan), [plan]);
  const boxes = plan.topics.filter((t) => t.subject === activeSubject).sort((a, b) => a.number - b.number);
  const multi = plan.subjects.length > 1;

  const commit = (next: StudyPlanState): boolean => {
    const ok = savePlan(next);
    setPlan(next);
    return ok;
  };

  const label = (t: StudyTopic) => `${multi ? `${t.subject} · ` : ''}T${t.number}`;

  const handleAddBox = () => {
    setError('');
    if (plan.topics.length >= MAX_BOXES) return setError(s.boxLimit);
    commit(addBox(plan, activeSubject));
  };

  const handleUpload = async (box: StudyTopic, list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    setError('');
    setBusyBox(box.id);
    try {
      const stored = await storeFiles(picked);
      if (!commit(addFilesToBox(plan, box.id, stored))) throw new Error('save failed');
    } catch {
      setError(s.addFailed);
    } finally {
      setBusyBox(null);
    }
  };

  const handleRemoveFile = async (box: StudyTopic, key: string) => {
    await deleteStudyFile(key);
    commit(removeFileFromBox(plan, box.id, key));
  };

  const handleRemoveBox = async (box: StudyTopic) => {
    if (!window.confirm(s.confirmRemoveBox)) return;
    await Promise.all(box.files.map((f) => deleteStudyFile(f.key)));
    commit(removeBox(plan, box.id));
  };

  // Split the box's single PDF: part 1 stays here, the other parts go into the next free boxes.
  const handleSplit = async (box: StudyTopic, parts: number) => {
    const file = box.files[0];
    setError('');
    setBusyBox(box.id);
    let made: Awaited<ReturnType<typeof splitPdfBlob>> = [];
    try {
      const blob = await getStudyFile(file.key);
      if (!blob) throw new Error('missing');
      made = await splitPdfBlob(blob, file.name, parts);
      let next = replaceFiles(plan, box.id, [made[0]]);
      for (const part of made.slice(1)) next = addBox(next, box.subject, [part]);
      if (!savePlan(next)) throw new Error('save failed');
      setPlan(next);
      await deleteStudyFile(file.key);
    } catch {
      await Promise.all(made.map((m) => deleteStudyFile(m.key)));
      setError(s.splitFailed);
    } finally {
      setBusyBox(null);
    }
  };

  const handleSubjectSave = () => {
    const name = (newSubject ?? '').trim();
    setNewSubject(null);
    if (!name || plan.subjects.includes(name)) return;
    if (plan.subjects.length >= MAX_SUBJECTS) return setError(s.maxSubjects);
    const next = addBox(addSubject(plan, name), name);
    commit(next);
    setActiveSubject(name);
  };

  // Marks the open topic done. Clearing never happens here — boxes clear on their original end date.
  const finish = () => {
    if (!viewing) return;
    const { topic, action } = viewing;
    setViewing(null);
    commit(action.type === 'learn' ? markLearned(plan, topic.id) : markReviewed(plan, topic.id, action.day));
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className={`${card} flex items-center gap-3 text-sm`}>
          <span className="flex-1">{notice}</span>
          <button className={btnGhost} onClick={() => setNotice('')}>
            {s.close}
          </button>
        </div>
      )}

      {/* Today */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-xl font-bold">{s.todayTitle}</h2>
          {plan.completed > 0 && <span className="text-xs text-gray-500 dark:text-white/60">{format(s.finished, plan.completed)}</span>}
        </div>
        <div className="space-y-4">
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
                    <span>{label(u.topic)}</span>
                    <span>{format(s.revisionDay, u.day)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Boxes */}
      <section>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <h2 className="text-xl font-bold mr-2">{s.boxesTitle}</h2>
          {multi &&
            plan.subjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setActiveSubject(sub)}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  sub === activeSubject
                    ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                    : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/60'
                }`}
              >
                {sub}
              </button>
            ))}
          {plan.subjects.length < MAX_SUBJECTS &&
            (newSubject === null ? (
              <button className={btnGhost} onClick={() => setNewSubject('')}>
                {s.addSubject}
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <input
                  autoFocus
                  className={`${inputCls} py-1 text-xs`}
                  value={newSubject}
                  placeholder={s.subjectPlaceholder}
                  onChange={(e) => setNewSubject(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubjectSave()}
                />
                <button className={btnPrimary} onClick={handleSubjectSave}>
                  {s.save}
                </button>
              </span>
            ))}
        </div>

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {boxes.map((box) => (
            <BoxCard
              key={box.id}
              box={box}
              busy={busyBox === box.id}
              onUpload={(l) => handleUpload(box, l)}
              onRemoveFile={(k) => handleRemoveFile(box, k)}
              onRemoveBox={() => handleRemoveBox(box)}
              onSplit={(n) => handleSplit(box, n)}
              onOpen={() => setViewing({ topic: box, action: { type: 'learn' } })}
            />
          ))}

          <button
            onClick={handleAddBox}
            className="p-4 rounded-2xl border border-dashed border-gray-300 dark:border-white/20 text-sm font-medium text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10 min-h-[8rem]"
          >
            + {format(s.addBox, nextFreeNumber(plan, activeSubject))}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-white/40 mt-3">{s.onDevice}</p>
      </section>

      {viewing && <FileViewer topic={viewing.topic} title={label(viewing.topic)} onDone={finish} onClose={() => setViewing(null)} />}
    </div>
  );
}

function BoxCard({
  box,
  busy,
  onUpload,
  onRemoveFile,
  onRemoveBox,
  onSplit,
  onOpen,
}: {
  box: StudyTopic;
  busy: boolean;
  onUpload: (l: FileList | null) => void;
  onRemoveFile: (key: string) => void;
  onRemoveBox: () => void;
  onSplit: (parts: number) => void;
  onOpen: () => void;
}) {
  const { locale } = useLanguage();
  const s = studyPlanText[locale];
  const inputRef = useRef<HTMLInputElement>(null);
  const [parts, setParts] = useState(2);
  const learned = !!box.learnedOn;
  const status = learned
    ? `${format(s.boxLearned, box.learnedOn ?? '')} · ${format(s.boxProgress, box.reviewed.length)} · ${format(s.boxEnds, endDate(box) ?? '')}`
    : box.files.length === 0
      ? s.boxEmpty
      : s.boxReady;
  const canSplit = !learned && box.files.length === 1 && box.files[0].kind === 'pdf';

  return (
    <div className={`${card} flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <div className="text-2xl font-bold">T{box.number}</div>
        <div className="flex-1 text-xs text-gray-500 dark:text-white/60">{status}</div>
        {!learned && (
          <button className="text-xs text-gray-400 hover:text-black dark:hover:text-white" onClick={onRemoveBox}>
            {s.removeBox}
          </button>
        )}
      </div>

      {box.files.length > 0 && (
        <ul className="space-y-1">
          {box.files.map((f) => (
            <li key={f.key} className="flex items-center gap-2 text-xs">
              <span className="flex-1 min-w-0 truncate">{f.name}</span>
              {!learned && (
                <button className="text-gray-400 hover:text-black dark:hover:text-white" onClick={() => onRemoveFile(f.key)}>
                  {s.removeFile}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!learned && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              onUpload(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            className={`rounded-xl border border-dashed border-gray-300 dark:border-white/20 py-4 text-xs text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 ${
              box.files.length === 0 ? 'min-h-[5rem]' : ''
            }`}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? '…' : box.files.length === 0 ? s.uploadHere : s.addFiles}
          </button>
        </>
      )}

      {canSplit && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-white/60 flex-wrap">
          <span>{s.splitLabel}</span>
          <select className={`${inputCls} py-1 text-xs`} value={parts} onChange={(e) => setParts(Number(e.target.value))} disabled={busy}>
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {format(s.parts, n)}
              </option>
            ))}
          </select>
          <button className={btnGhost} onClick={() => onSplit(parts)} disabled={busy}>
            {s.splitBtn}
          </button>
        </div>
      )}

      {box.files.length > 0 && (
        <button className={btnGhost} onClick={onOpen}>
          {s.open}
        </button>
      )}
    </div>
  );
}

function FileViewer({ topic, title, onDone, onClose }: { topic: StudyTopic; title: string; onDone: () => void; onClose: () => void }) {
  const { locale } = useLanguage();
  const s = studyPlanText[locale];
  const [items, setItems] = useState<{ url: string; kind: 'pdf' | 'image'; name: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    (async () => {
      const out: { url: string; kind: 'pdf' | 'image'; name: string }[] = [];
      for (const f of topic.files) {
        const blob = await getStudyFile(f.key).catch(() => null);
        if (blob) {
          const url = URL.createObjectURL(blob);
          made.push(url);
          out.push({ url, kind: f.kind, name: f.name });
        }
      }
      if (!cancelled) setItems(out);
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
        {items === null ? null : items.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-white/60">{s.fileMissing}</p>
        ) : (
          <div className="max-w-4xl mx-auto p-3 space-y-3">
            {items.map((it) =>
              it.kind === 'pdf' ? (
                <iframe key={it.url} src={it.url} title={it.name} className="w-full rounded-lg border-0" style={{ height: '85vh' }} />
              ) : (
                <img key={it.url} src={it.url} alt={it.name} className="w-full rounded-lg" />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
