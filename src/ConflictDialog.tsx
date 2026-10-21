// ============================================================
// ConflictDialog.tsx — a note was changed on this device AND on another device (Part 10).
// Shows both versions side by side. Nothing is lost silently: before any choice that overwrites a
// version, both versions are saved to the note's version history (best effort; if that fails the
// student is told and must confirm).
// ============================================================
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Cloud, Copy, GitMerge, LoaderCircle, Minus, Pencil, Plus, Smartphone, TriangleAlert, X } from 'lucide-react';
import { format } from './i18n/format';
import { mergePages, mergeVideo, type ConflictChoice, type ConflictInfo } from './conflict';
import type { NoteSnapshot } from './noteTypes';
import { saveVersion, type VersionData } from './noteVersions';
import { diffPages, type PageChange } from './textDiff';

type L = Record<string, string>;

const toVersion = (s: NoteSnapshot): VersionData => ({ title: s.title, pages: s.pages, ...(s.video ? { video: s.video } : {}) });

function when(iso: string, locale: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

function KindIcon({ kind }: { kind: PageChange['kind'] }) {
  if (kind === 'added') return <Plus size={13} className="shrink-0" aria-hidden="true" />;
  if (kind === 'removed') return <Minus size={13} className="shrink-0" aria-hidden="true" />;
  return <Pencil size={13} className="shrink-0" aria-hidden="true" />;
}

function SideCard({ heading, icon, snap, changes, pageNo, t, locale }: {
  heading: string;
  icon: ReactNode;
  snap: NoteSnapshot;
  changes: PageChange[];
  pageNo: (id: string) => number;
  t: L;
  locale: string;
}) {
  const shown = changes.slice(0, 10);
  return (
    <section className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {heading}
      </h3>
      <p className="mt-1 break-words text-base font-medium">{snap.title || t.untitled}</p>
      <p className="mt-0.5 text-xs text-gray-600 dark:text-white/70">{format(t.updated, when(snap.updatedAt, locale))}</p>
      <p className="text-xs text-gray-600 dark:text-white/70">{format(t.pages, snap.pages.length)}</p>
      <p className="mt-2 text-xs font-semibold">{t.changedPages}</p>
      {changes.length === 0 ? (
        <p className="text-xs text-gray-600 dark:text-white/70">{t.noChanges}</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {shown.map((c) => (
            <li key={c.pageId} className="inline-flex items-center gap-1 rounded-full border border-gray-300 dark:border-white/20 px-2 py-1 text-xs">
              <KindIcon kind={c.kind} />
              <span>{format(t.pageN, pageNo(c.pageId))}</span>
              <span className="text-gray-600 dark:text-white/70">{c.kind === 'added' ? t.kindAdded : c.kind === 'removed' ? t.kindRemoved : t.kindChanged}</span>
            </li>
          ))}
        </ul>
      )}
      {changes.length > shown.length && <p className="mt-1 text-xs text-gray-600 dark:text-white/70">{format(t.moreN, changes.length - shown.length)}</p>}
    </section>
  );
}

export default function ConflictDialog({ info, labels: t, locale = 'en-IN', onResolve, onCancel }: {
  info: ConflictInfo;
  labels: L;
  locale?: string;
  onResolve: (choice: ConflictChoice) => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const mergeNoteId = `${uid}-merge-note`;

  const { merged, conflictingPageIds } = useMemo(() => mergePages(info.local, info.remote, info.base), [info]);
  const videoMerge = useMemo(() => mergeVideo(info.local, info.remote, info.base), [info]);
  const canMerge = conflictingPageIds.length === 0 && !videoMerge.conflict;
  const changed = (a: NoteSnapshot, b: NoteSnapshot) => diffPages(a.pages, b.pages).filter((c) => c.kind !== 'same');
  const localChanges = useMemo(() => (info.base ? changed(info.base, info.local) : changed(info.remote, info.local)), [info]);
  const remoteChanges = useMemo(() => (info.base ? changed(info.base, info.remote) : changed(info.local, info.remote)), [info]);

  const [busy, setBusy] = useState(false);
  const [backupFail, setBackupFail] = useState<{ choice: ConflictChoice; message: string } | null>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const pageNo = (id: string): number => {
    for (const snap of [info.local, info.remote, info.base]) {
      if (!snap) continue;
      const i = snap.pages.findIndex((p) => p.id === id);
      if (i >= 0) return i + 1;
    }
    return 0;
  };

  const choose = async (choice: ConflictChoice) => {
    if (busy) return;
    if (choice.type === 'both') {
      onResolve(choice); // nothing is overwritten
      return;
    }
    setBusy(true);
    setBackupFail(null);
    try {
      await saveVersion(info.local.id, toVersion(info.local), 'before-restore');
      await saveVersion(info.local.id, toVersion(info.remote), 'before-restore');
    } catch (e) {
      setBusy(false);
      setBackupFail({ choice, message: e instanceof Error ? e.message : String(e) });
      return;
    }
    setBusy(false);
    onResolve(choice);
  };

  const option =
    'flex min-h-14 w-full flex-col items-start gap-0.5 rounded-xl border border-gray-300 dark:border-white/20 p-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50';
  const small =
    'inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full sm:max-w-3xl max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-4 shadow-xl"
      >
        <div className="flex items-start gap-2">
          <TriangleAlert size={20} className="mt-1 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <h2 id={titleId} className="text-lg font-semibold">{t.conflictTitle}</h2>
            <p className="mt-1 text-sm text-gray-700 dark:text-white/80">{t.conflictIntro}</p>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            aria-label={t.decideLater}
            title={t.decideLater}
            className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <SideCard heading={t.thisDevice} icon={<Smartphone size={16} aria-hidden="true" />} snap={info.local} changes={localChanges} pageNo={pageNo} t={t} locale={locale} />
          <SideCard heading={t.otherDevice} icon={<Cloud size={16} aria-hidden="true" />} snap={info.remote} changes={remoteChanges} pageNo={pageNo} t={t} locale={locale} />
        </div>

        {(conflictingPageIds.length > 0 || videoMerge.conflict) && (
          <div className="mt-3 space-y-1 rounded-lg border border-amber-400 bg-amber-50 p-2 text-sm text-amber-950 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-50">
            {conflictingPageIds.length > 0 && (
              <p className="flex items-start gap-2">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{format(t.conflictsHeading, conflictingPageIds.map((id) => pageNo(id) || '?').join(', '))}</span>
              </p>
            )}
            {videoMerge.conflict && (
              <p className="flex items-start gap-2">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{t.videoConflict}</span>
              </p>
            )}
          </div>
        )}
        {!info.base && <p className="mt-2 text-xs text-gray-600 dark:text-white/70">{t.noBase}</p>}

        {backupFail && (
          <div role="alert" className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100">
            <p>{format(t.backupWarn, backupFail.message)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => setBackupFail(null)} className={`${small} border-rose-400 dark:border-rose-600`}>{t.back}</button>
              <button onClick={() => onResolve(backupFail.choice)} className={`${small} border-rose-700 bg-rose-700 text-white`}>{t.continueAnyway}</button>
            </div>
          </div>
        )}
        {busy && (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm text-gray-600 dark:text-white/70">
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
            {t.working}
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button ref={firstRef} disabled={busy} onClick={() => void choose({ type: 'mine' })} className={option}>
            <span className="flex items-center gap-2 text-sm font-semibold"><Smartphone size={16} aria-hidden="true" />{t.keepMine}</span>
            <span className="text-xs text-gray-600 dark:text-white/70">{t.keepMineHint}</span>
          </button>
          <button disabled={busy} onClick={() => void choose({ type: 'theirs' })} className={option}>
            <span className="flex items-center gap-2 text-sm font-semibold"><Cloud size={16} aria-hidden="true" />{t.keepTheirs}</span>
            <span className="text-xs text-gray-600 dark:text-white/70">{t.keepTheirsHint}</span>
          </button>
          <button
            disabled={busy || !canMerge}
            aria-describedby={canMerge ? undefined : mergeNoteId}
            onClick={() => void choose({ type: 'merged', pages: merged, ...(videoMerge.video ? { video: videoMerge.video } : {}) })}
            className={option}
          >
            <span className="flex items-center gap-2 text-sm font-semibold"><GitMerge size={16} aria-hidden="true" />{t.merge}</span>
            <span id={mergeNoteId} className="text-xs text-gray-600 dark:text-white/70">{canMerge ? t.mergeHint : t.mergeDisabled}</span>
          </button>
          <button disabled={busy} onClick={() => void choose({ type: 'both' })} className={option}>
            <span className="flex items-center gap-2 text-sm font-semibold"><Copy size={16} aria-hidden="true" />{t.keepBoth}</span>
            <span className="text-xs text-gray-600 dark:text-white/70">{t.keepBothHint}</span>
          </button>
        </div>

        <div className="mt-3 flex justify-end">
          <button onClick={onCancel} disabled={busy} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-white/80 dark:hover:bg-white/10">
            {t.decideLater}
          </button>
        </div>
      </div>
    </div>
  );
}
