import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy } from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { getIndex, loadNoteContent, pageToHtml } from './notebookStore';
import { extractHighlights, itemsToText, type HighlightItem, type HighlightKind } from './revisionExtract';

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

      {items && items.length === 0 && (
        <div className="py-12 text-center">
          <p className="font-medium">{t.empty}</p>
          <p className="text-sm text-gray-500 dark:text-white/60 mt-1">{t.emptyHint}</p>
        </div>
      )}

      {items && items.length > 0 && (
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
              <li key={i.key} className="rounded-xl border border-gray-200 dark:border-white/10 p-3 flex gap-3">
                <span className="w-1.5 shrink-0 rounded-full" style={{ background: i.color }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm whitespace-pre-wrap break-words">{i.text}</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-white/40">
                    {kindLabel[i.kind]} · {t.page} {i.pages.map((p) => p.pageNumber).join(', ')}
                    {i.count > 1 ? ` · ×${i.count}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
