import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy, FileCode2, FileText, History, Printer, Share2, X } from 'lucide-react';
import { format } from './i18n/format';
import type { NotePage, NoteVideo } from './notebookStore';
import { downloadBlob, fileName, hasText, noteToBackupJson, noteToHtml, noteToMarkdown, noteToText } from './noteExport';
import { getVersion, listVersions, saveVersion, type VersionData, type VersionMeta } from './noteVersions';

// Dialogs of the note screen (Part 10): Export & share, Version history, Keyboard shortcuts.

type L = Record<string, string>;

function Dialog({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // keep Tab inside the dialog
      if (e.key === 'Tab' && box.current) {
        const f = Array.from(box.current.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input,select,textarea'));
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full sm:max-w-md max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-4 shadow-xl"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label={closeLabel} title={closeLabel} className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const row =
  'w-full min-h-12 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500';

export function ExportDialog({
  title, pages, video, labels: t, onClose, onMessage,
}: { title: string; pages: NotePage[]; video?: NoteVideo | null; labels: L; onClose: () => void; onMessage: (m: string) => void }) {
  const text = hasText(pages);
  const md = () => noteToMarkdown(title, pages);

  const save = (ext: string, body: string, type: string) => {
    try {
      downloadBlob(fileName(title, ext), new Blob([body], { type }));
      onMessage(t.exportDone);
      onClose();
    } catch {
      onMessage(t.exportFail);
    }
  };
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return onMessage(t.popupBlocked);
    w.document.open();
    w.document.write(noteToHtml(title, pages));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
    onClose();
  };
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: title || undefined, text: noteToText(title, pages) });
        onClose();
      } else {
        await navigator.clipboard.writeText(noteToText(title, pages));
        onMessage(t.copied);
        onClose();
      }
    } catch {
      // the student closed the share sheet: nothing to do
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(noteToText(title, pages));
      onMessage(t.copied);
      onClose();
    } catch {
      onMessage(t.exportFail);
    }
  };

  const Item = ({ icon, name, hint, onClick, disabled }: { icon: ReactNode; name: string; hint: string; onClick: () => void; disabled?: boolean }) => (
    <button className={row} onClick={onClick} disabled={disabled}>
      <span className="shrink-0 text-gray-600 dark:text-white/70">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{name}</span>
        <span className="block text-xs text-gray-500 dark:text-white/60">{hint}</span>
      </span>
    </button>
  );

  return (
    <Dialog title={t.exportTitle} closeLabel={t.close} onClose={onClose}>
      {!text && <p className="mb-2 text-xs text-gray-500 dark:text-white/60">{t.emptyNote}</p>}
      <div className="space-y-2">
        <Item icon={<FileText size={18} />} name={t.expMd} hint={t.expMdHint} disabled={!text} onClick={() => save('md', md(), 'text/markdown')} />
        <Item icon={<FileText size={18} />} name={t.expTxt} hint={t.expTxtHint} disabled={!text} onClick={() => save('txt', noteToText(title, pages), 'text/plain')} />
        <Item icon={<Printer size={18} />} name={t.expHtml} hint={t.expHtmlHint} disabled={!text} onClick={print} />
        <Item icon={<FileCode2 size={18} />} name={t.expJson} hint={t.expJsonHint} onClick={() => save('json', noteToBackupJson(title, pages, video), 'application/json')} />
        <Item icon={<Share2 size={18} />} name={t.share} hint={t.shareHint} disabled={!text} onClick={() => void share()} />
        <Item icon={<Copy size={18} />} name={t.copyText} hint="" disabled={!text} onClick={() => void copy()} />
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-white/60">{t.exportInkNote}</p>
    </Dialog>
  );
}

const kindName = (k: VersionMeta['kind'], t: L) => (k === 'manual' ? t.versionManual : k === 'before-restore' ? t.versionBefore : t.versionAuto);

export function VersionsDialog({
  noteId, getCurrent, labels: t, locale, onClose, onRestore, onMessage,
}: {
  noteId: string;
  getCurrent: () => VersionData;
  labels: L;
  locale: string;
  onClose: () => void;
  onRestore: (v: VersionData) => void;
  onMessage: (m: string) => void;
}) {
  const [list, setList] = useState<VersionMeta[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = () =>
    listVersions(noteId)
      .then((l) => setList(l))
      .catch(() => setFailed(true));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const saveNow = async () => {
    try {
      await saveVersion(noteId, getCurrent(), 'manual');
      onMessage(t.versionSaved);
      void load();
    } catch {
      onMessage(t.versionError);
    }
  };
  const restore = async (m: VersionMeta) => {
    if (!window.confirm(t.restoreConfirm)) return;
    try {
      const data = await getVersion(m.key);
      if (!data) return onMessage(t.versionError);
      await saveVersion(noteId, getCurrent(), 'before-restore').catch(() => null);
      onRestore(data);
      onMessage(t.restored);
      onClose();
    } catch {
      onMessage(t.versionError);
    }
  };
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <Dialog title={t.versionsTitle} closeLabel={t.close} onClose={onClose}>
      <button onClick={() => void saveNow()} className="mb-3 h-10 sm:h-9 px-3 rounded-lg border border-gray-200 dark:border-white/10 text-xs flex items-center gap-1.5">
        <History size={14} /> {t.saveNow}
      </button>
      {failed && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t.versionError}</p>}
      {list && list.length === 0 && <p className="text-sm text-gray-500 dark:text-white/60">{t.versionsEmpty}</p>}
      {list && list.length > 0 && (
        <ul className="space-y-2">
          {list.map((m) => (
            <li key={m.key} className="rounded-xl border border-gray-200 dark:border-white/10 p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{when(m.at)}</p>
                <p className="text-xs text-gray-500 dark:text-white/60">
                  {kindName(m.kind, t)} · {format(t.versionMeta, m.pages, m.chars)}
                </p>
              </div>
              <button onClick={() => void restore(m)} className="h-10 sm:h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium shrink-0">
                {t.restore}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-gray-500 dark:text-white/60">{t.versionsHint}</p>
    </Dialog>
  );
}

export function ShortcutsDialog({ labels: t, onClose }: { labels: L; onClose: () => void }) {
  const mac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  const mod = mac ? '⌘' : 'Ctrl';
  const rows: [string, string][] = [
    ['T', t.scType], ['P', t.scPen], ['H', t.scHl], ['E', t.scEraser], ['S', t.scSelect], ['L', t.scLaser],
    [`${mod}+Z`, t.scUndo], [`${mod}+Shift+Z`, t.scRedo], [`${mod}+S`, t.scSave],
    [`${mod}+C / X / V`, t.scCopy], ['Delete', t.scDelete], ['?', t.scHelp],
  ];
  return (
    <Dialog title={t.shortcutsTitle} closeLabel={t.close} onClose={onClose}>
      <dl className="divide-y divide-gray-100 dark:divide-white/10">
        {rows.map(([k, label]) => (
          <div key={k} className="flex items-center justify-between py-2 text-sm">
            <dt>{label}</dt>
            <dd><kbd className="rounded-md border border-gray-300 dark:border-white/20 px-1.5 py-0.5 text-xs font-mono">{k}</kbd></dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
