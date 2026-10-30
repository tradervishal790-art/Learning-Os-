import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { getIndex, loadNoteContent, pageToHtml } from './notebookStore';
import { addMistake, getMistakes, removeMistake, type Mistake } from './mistakeStore';
import { extractHighlights, itemsToText, type HighlightItem, type HighlightKind } from './revisionExtract';
import { askConfirm } from './dialogApi';

// ============================================================
// RevisionSheet.tsx — every highlight of one note on a single screen,
// grouped by meaning (yellow important, pink doubt, blue example, green understood).
// "Only my doubts" = tap the Doubts chip.
// ============================================================

const KINDS: HighlightKind[] = ['important', 'doubt', 'example', 'understood', 'other'];

export default function RevisionSheet({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useTranslation().notebook.rsheet;
  const [items, setItems] = useState<HighlightItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<'all' | HighlightKind>('all');
  const [copied, setCopied] = useState(false);
  // Recall: every line is covered until tapped (nothing is saved).
  const [tab, setTab] = useState<'highlights' | 'mistakes'>('highlights');
  const [mistakes, setMistakes] = useState<Mistake[]>(() => getMistakes().filter((m) => m.noteId === id));
  const refreshMistakes = () => setMistakes(getMistakes().filter((m) => m.noteId === id));
  const [recall, setRecall] = useState(false);
  const [shownKeys, setShownKeys] = useState<Set<string>>(new Set());
  const meta = getIndex().notes.find((n) => n.id === id);

  useEffect(() => {
    let alive = true;
    void loadNoteContent(id).then((c) => {
      if (!alive) return;
      if (!c) return setFailed(true);
      setItems(extractHighlights(c.pages.map((p) => ({ id: p.id, html: pageToHtml(p) }))));
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const kindLabel: Record<HighlightKind, string> = useMemo(
    () => ({ important: t.kindImportant, doubt: t.kindDoubt, example: t.kindExample, understood: t.kindUnderstood, other: t.kindOther }),
    [t]
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (items ?? []).forEach((i) => (c[i.kind] = (c[i.kind] ?? 0) + 1));
    return c;
  }, [items]);
  const shown = (items ?? []).filter((i) => filter === 'all' || i.kind === filter);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(itemsToText(shown, { kinds: kindLabel, page: t.page }));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: nothing to do
    }
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs border ${
      active ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70'
    }`;

  if (failed)
    return (
      <div className="py-10 text-center text-sm text-gray-500 dark:text-white/60">
        <p className="mb-3">{t.loadError}</p>
        <button onClick={onBack} className="underline">{t.back}</button>
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white">
          <ArrowLeft size={16} /> {t.back}
        </button>
        {shown.length > 0 && (
          <button
            onClick={() => {
              setRecall((r) => !r);
              setShownKeys(new Set());
            }}
            aria-pressed={recall}
            className={`h-9 px-3 rounded-lg border text-xs flex items-center gap-1.5 ml-auto mr-2 ${recall ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'border-gray-200 dark:border-white/10'}`}
          >
            {recall ? <EyeOff size={14} /> : <Eye size={14} />} {t.recall}
          </button>
        )}
        {shown.length > 0 && (
          <button onClick={() => void copyAll()} className="h-9 px-3 rounded-lg border border-gray-200 dark:border-white/10 text-xs flex items-center gap-1.5">
            <Copy size={14} /> {copied ? t.copied : t.copyAll}
          </button>
        )}
      </div>
      <h2 className="text-xl font-bold">{t.title}</h2>
      <p className="text-sm text-gray-500 dark:text-white/60 mb-3">
        {meta?.title ? `${meta.title} · ` : ''}
        {format(t.summary, items?.length ?? 0)}
      </p>

      <div className="flex gap-2 mb-4">
        <button className={chip(tab === 'highlights')} onClick={() => setTab('highlights')}>{t.tabHighlights}</button>
        <button className={chip(tab === 'mistakes')} onClick={() => setTab('mistakes')}>{t.tabMistakes} ({mistakes.length})</button>
      </div>

      {tab === 'mistakes' && <MistakeList noteId={id} mistakes={mistakes} onChange={refreshMistakes} labels={t} />}

      {tab === 'highlights' && items && items.length === 0 && (
        <div className="py-12 text-center">
          <p className="font-medium">{t.empty}</p>
          <p className="text-sm text-gray-500 dark:text-white/60 mt-1">{t.emptyHint}</p>
        </div>
      )}

      {tab === 'highlights' && items && items.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <button className={chip(filter === 'all')} onClick={() => setFilter('all')}>
              {t.all} ({items.length})
            </button>
            {KINDS.filter((k) => counts[k]).map((k) => (
              <button key={k} className={chip(filter === k)} onClick={() => setFilter(k)}>
                {kindLabel[k]} ({counts[k]})
              </button>
            ))}
          </div>
          <ul className="space-y-2">
            {shown.map((i) => (
              <li
                key={i.key}
                onClick={() => recall && setShownKeys((cur) => { const n = new Set(cur); if (n.has(i.key)) n.delete(i.key); else n.add(i.key); return n; })}
                className={`rounded-xl border border-gray-200 dark:border-white/10 p-3 flex gap-3 ${recall ? 'cursor-pointer' : ''}`}
              >
                <span className="w-1.5 shrink-0 rounded-full" style={{ background: i.color }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm whitespace-pre-wrap break-words ${recall && !shownKeys.has(i.key) ? 'text-transparent select-none rounded' : ''}`} style={recall && !shownKeys.has(i.key) ? { background: i.color } : undefined}>{i.text}</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-white/40">
                    {kindLabel[i.kind]} · {t.page} {i.pages.map((p) => p.pageNumber).join(', ')}
                    {i.count > 1 ? ` · ×${i.count}` : ''}
                  </p>
                  {i.kind === 'doubt' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (addMistake({ text: i.text, noteId: id })) refreshMistakes();
                      }}
                      className="mt-2 text-xs underline text-gray-600 dark:text-white/70"
                    >
                      {t.addFromDoubt}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MistakeList({ noteId, mistakes, onChange, labels: t }: { noteId: string; mistakes: Mistake[]; onChange: () => void; labels: Record<string, string> }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [fix, setFix] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [err, setErr] = useState(false);
  const field = 'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-transparent p-2 text-sm outline-none';

  const save = () => {
    if (!addMistake({ text, fix, noteId })) return setErr(true);
    setText('');
    setFix('');
    setErr(false);
    setAdding(false);
    onChange();
  };

  return (
    <div>
      {adding ? (
        <div className="mb-4 space-y-2 rounded-xl border border-gray-200 dark:border-white/10 p-3">
          <label className="block text-xs text-gray-500 dark:text-white/60">{t.mistakeLabel}
            <textarea value={text} onChange={(e) => { setText(e.target.value); setErr(false); }} rows={2} className={`${field} mt-1`} />
          </label>
          <label className="block text-xs text-gray-500 dark:text-white/60">{t.fixLabel}
            <textarea value={fix} onChange={(e) => setFix(e.target.value)} rows={2} className={`${field} mt-1`} />
          </label>
          {err && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t.needText}</p>}
          <div className="flex gap-2">
            <button onClick={save} className="h-9 px-3 rounded-lg bg-black text-white dark:bg-white dark:text-black text-xs font-medium">{t.save}</button>
            <button onClick={() => setAdding(false)} className="h-9 px-3 rounded-lg border border-gray-200 dark:border-white/10 text-xs">{t.cancel}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mb-4 h-9 px-3 rounded-lg border border-gray-200 dark:border-white/10 text-xs flex items-center gap-1.5">
          <Plus size={14} /> {t.addMistake}
        </button>
      )}
      {mistakes.length === 0 ? (
        <div className="py-10 text-center">
          <p className="font-medium">{t.emptyMistakes}</p>
          <p className="text-sm text-gray-500 dark:text-white/60 mt-1">{t.emptyMistakesHint}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {mistakes.map((m) => {
            const shown = open.has(m.id);
            return (
              <li key={m.id} className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
                <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                {m.fix && (
                  <button
                    onClick={() => setOpen((cur) => { const n = new Set(cur); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })}
                    className={`mt-2 block w-full rounded-lg p-2 text-left text-sm ${shown ? 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100' : 'bg-gray-200 text-transparent dark:bg-white/20'}`}
                    aria-label={shown ? undefined : t.tapFix}
                  >
                    {shown ? m.fix : m.fix.replace(/\S/g, '•')}
                  </button>
                )}
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => { void askConfirm(t.removeConfirm, { danger: true }).then((ok) => { if (ok) { removeMistake(m.id); onChange(); } }); }}
                    aria-label={t.remove}
                    title={t.remove}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
