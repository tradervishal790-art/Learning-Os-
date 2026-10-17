import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Mic, RotateCw, Trash2 } from 'lucide-react';
import type { PageAttachment } from './notebookStore';
import { deleteImage, getImage, newAttachId, putImage } from './attachStore';
import { deleteAudio, getAudio, putAudio, updateBookmarks, type AudioMeta } from './audioStore';
import { ImageError, compressImage, cropRotateFlip, scanFilter } from './imageTools';
import AudioRecorder from './AudioRecorder';
import AudioPlayer from './AudioPlayer';

// ============================================================
// PageAttachments.tsx — photos + voice recordings under a page's text.
// Files are stored on this device; the page only keeps a small reference.
// ============================================================

const BTN =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 px-2.5 text-xs text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-40';

function errorKey(e: unknown): string {
  if (e instanceof ImageError) {
    return { 'too-large': 'errTooLarge', 'not-image': 'errNotImage', 'decode-failed': 'errDecode', unsupported: 'errUnsupported' }[e.code];
  }
  return 'errStorage';
}

export default function PageAttachments({
  attachments,
  onChange,
  labels,
}: {
  attachments: PageAttachment[];
  onChange: (next: PageAttachment[]) => void;
  labels: Record<string, string>;
}) {
  const t = (k: string) => labels[k] ?? k;
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  // Always the latest list, so two quick additions never overwrite each other.
  const listRef = useRef(attachments);
  useEffect(() => {
    listRef.current = attachments;
  }, [attachments]);

  const push = (a: PageAttachment) => {
    listRef.current = [...listRef.current, a];
    onChange(listRef.current);
  };

  const addImage = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const { blob } = await compressImage(file);
      const id = newAttachId('im');
      await putImage(id, blob, file.name);
      push({ id, kind: 'image', name: file.name });
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const remove = (a: PageAttachment) => {
    if (!window.confirm(t('removeConfirm'))) return;
    listRef.current = listRef.current.filter((x) => x.id !== a.id);
    onChange(listRef.current);
    void (a.kind === 'image' ? deleteImage(a.id) : deleteAudio(a.id)).catch(() => undefined);
  };

  const saveRecording = async (r: { blob: Blob; mime: string; durationSec: number; bookmarks: number[] }) => {
    setError('');
    try {
      const id = newAttachId('au');
      await putAudio(id, r.blob, { mime: r.mime, durationSec: r.durationSec, bookmarks: r.bookmarks, createdAt: new Date().toISOString() });
      push({ id, kind: 'audio', name: t('audioName') });
      setRecording(false);
    } catch {
      setError(t('errStorage'));
    }
  };

  return (
    <div className="relative z-10 mt-3 border-t border-dashed border-gray-200 dark:border-white/10 pt-2">
      {attachments.length > 0 && (
        <div className="mb-2 space-y-3">
          {attachments.map((a) =>
            a.kind === 'image' ? (
              <ImageCard key={a.id} a={a} labels={labels} onRemove={() => remove(a)} />
            ) : (
              <AudioCard key={a.id} a={a} labels={labels} onRemove={() => remove(a)} />
            )
          )}
        </div>
      )}
      {recording && (
        <div className="mb-2">
          <AudioRecorder onDone={(r) => void saveRecording(r)} onCancel={() => setRecording(false)} labels={labels} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={BTN} disabled={busy} onClick={() => fileRef.current?.click()}>
          <ImageIcon size={14} /> {t('addPhoto')}
        </button>
        <button type="button" className={BTN} disabled={busy} onClick={() => camRef.current?.click()}>
          <Camera size={14} /> {t('takePhoto')}
        </button>
        <button type="button" className={BTN} disabled={recording} onClick={() => setRecording(true)}>
          <Mic size={14} /> {t('record')}
        </button>
        {error && (
          <span role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void addImage(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addImage(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

function ImageCard({ a, labels, onRemove }: { a: PageAttachment; labels: Record<string, string>; onRemove: () => void }) {
  const t = (k: string) => labels[k] ?? k;
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [rev, setRev] = useState(0); // bump to reload after rotate / filter
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void getImage(a.id)
      .then((blob) => {
        if (!alive) return;
        if (!blob) return setMissing(true);
        made = URL.createObjectURL(blob);
        setUrl(made);
        setMissing(false);
      })
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made); // no leaked blob: URLs
    };
  }, [a.id, rev]);

  const edit = useCallback(
    async (fn: (b: Blob) => Promise<Blob>) => {
      setWorking(true);
      setErr('');
      try {
        const blob = await getImage(a.id);
        if (!blob) throw new Error('missing');
        await putImage(a.id, await fn(blob), a.name);
        setRev((r) => r + 1);
      } catch (e) {
        setErr(t(errorKey(e)));
      } finally {
        setWorking(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.id, a.name, labels]
  );

  return (
    <figure className="rounded-xl border border-gray-200 dark:border-white/10 p-2">
      {missing ? (
        <p className="py-6 text-center text-xs text-gray-500 dark:text-white/50">{t('notHere')}</p>
      ) : url ? (
        <img src={url} alt={t('imageAlt')} className="mx-auto max-h-[70vh] max-w-full rounded-lg bg-white" />
      ) : (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
      )}
      <figcaption className="mt-2 flex flex-wrap items-center gap-1.5">
        {!missing && (
          <>
            <button type="button" className={BTN} disabled={working} onClick={() => void edit((b) => cropRotateFlip(b, { rotate: 90 }))}>
              <RotateCw size={14} /> {t('rotate')}
            </button>
            <button type="button" className={BTN} disabled={working} onClick={() => void edit((b) => scanFilter(b, 'bw'))}>
              {t('scanBw')}
            </button>
            <button type="button" className={BTN} disabled={working} onClick={() => void edit((b) => scanFilter(b, 'gray'))}>
              {t('scanGray')}
            </button>
            <button type="button" className={BTN} disabled={working} onClick={() => void edit((b) => scanFilter(b, 'boost'))}>
              {t('scanBoost')}
            </button>
          </>
        )}
        <button type="button" className={`${BTN} ml-auto`} onClick={onRemove} aria-label={t('remove')} title={t('remove')}>
          <Trash2 size={14} />
        </button>
        {err && (
          <span role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
            {err}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function AudioCard({ a, labels, onRemove }: { a: PageAttachment; labels: Record<string, string>; onRemove: () => void }) {
  const t = (k: string) => labels[k] ?? k;
  const [clip, setClip] = useState<{ blob: Blob; meta: AudioMeta } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    void getAudio(a.id)
      .then((c) => {
        if (!alive) return;
        if (c) setClip(c);
        else setMissing(true);
      })
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, [a.id]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 p-2">
      {missing ? (
        <p className="py-4 text-center text-xs text-gray-500 dark:text-white/50">{t('notHere')}</p>
      ) : clip ? (
        <AudioPlayer
          src={clip.blob}
          bookmarks={clip.meta.bookmarks}
          labels={labels}
          onBookmarksChange={(next) => {
            setClip({ ...clip, meta: { ...clip.meta, bookmarks: next } });
            void updateBookmarks(a.id, next).catch(() => undefined);
          }}
        />
      ) : (
        <div className="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
      )}
      <div className="mt-2 flex justify-end">
        <button type="button" className={BTN} onClick={onRemove} aria-label={t('remove')} title={t('remove')}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
