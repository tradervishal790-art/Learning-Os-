// Label keys used (all optional, English fallbacks built in):
//   record, pause, resume, stop, bookmark, discard, cancel, recording, paused, requesting,
//   denied, unsupported, interrupted, error, saveInterrupted, bookmarksCount
import { AlertTriangle, Bookmark, Mic, Pause, Play, Square, Trash2, X } from 'lucide-react';
import { useAudioRecorder } from './useAudioRecorder';

interface Props {
  onDone(result: { blob: Blob; mime: string; durationSec: number; bookmarks: number[] }): void;
  onCancel?(): void;
  labels: Record<string, string>;
}

const formatTime = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const base = 'inline-flex min-h-[56px] min-w-[56px] items-center justify-center gap-2 rounded-full px-6 text-base font-medium transition active:scale-95 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-offset-slate-900';
const small = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

export default function AudioRecorder({ onDone, onCancel, labels }: Props) {
  const rec = useAudioRecorder();
  const t = (key: string, fallback: string): string => labels[key] ?? fallback;
  const { state } = rec;
  const live = state === 'recording' || state === 'paused';

  const finishNow = async (): Promise<void> => {
    const result = await rec.stop();
    if (result) onDone(result);
  };

  let message: string | null = null;
  if (state === 'denied') message = t('denied', 'Microphone access was denied. Allow it in your browser settings and try again.');
  else if (state === 'unsupported') message = t('unsupported', 'Audio recording is not supported in this browser.');
  else if (rec.interrupted) message = t('interrupted', 'The recording was interrupted. You can save what was captured so far.');
  else if (state === 'error') message = rec.error ?? t('error', 'Something went wrong while recording.');

  return (
    <div className="flex w-full flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex flex-col items-center gap-1" aria-live="off">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {state === 'recording' && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />}
          <span role="status">
            {state === 'recording' ? t('recording', 'Recording') : state === 'paused' ? t('paused', 'Paused') : state === 'requesting' ? t('requesting', 'Waiting for microphone…') : '\u00A0'}
          </span>
        </div>
        <div className="text-5xl font-semibold tabular-nums">{formatTime(rec.elapsedSec)}</div>
        {rec.bookmarks.length > 0 && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t('bookmarksCount', 'Bookmarks')}: {rec.bookmarks.length}
          </div>
        )}
      </div>

      {message && (
        <div role="alert" className="flex w-full items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{message}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {(state === 'idle' || state === 'denied' || state === 'error' || state === 'requesting') && (
          <button type="button" className={`${base} bg-red-600 text-white hover:bg-red-700`} onClick={() => void rec.start()} disabled={state === 'requesting'}>
            <Mic className="h-6 w-6" aria-hidden /> {t('record', 'Record')}
          </button>
        )}
        {state === 'recording' && (
          <button type="button" className={`${base} bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600`} onClick={rec.pause}>
            <Pause className="h-6 w-6" aria-hidden /> {t('pause', 'Pause')}
          </button>
        )}
        {state === 'paused' && (
          <button type="button" className={`${base} bg-red-600 text-white hover:bg-red-700`} onClick={rec.resume}>
            <Play className="h-6 w-6" aria-hidden /> {t('resume', 'Resume')}
          </button>
        )}
        {live && (
          <button type="button" className={`${base} bg-indigo-600 text-white hover:bg-indigo-700`} onClick={() => void finishNow()}>
            <Square className="h-6 w-6" aria-hidden /> {t('stop', 'Stop')}
          </button>
        )}
        {state === 'stopped' && (
          <button type="button" className={`${base} bg-indigo-600 text-white hover:bg-indigo-700`} onClick={() => void finishNow()}>
            {t('saveInterrupted', 'Save recording')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {live && (
          <button type="button" className={`${small} border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800`} onClick={rec.addBookmark}>
            <Bookmark className="h-5 w-5" aria-hidden /> {t('bookmark', 'Bookmark')}
          </button>
        )}
        {(live || state === 'stopped') && (
          <button type="button" className={`${small} text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950`} onClick={rec.discard}>
            <Trash2 className="h-5 w-5" aria-hidden /> {t('discard', 'Discard')}
          </button>
        )}
        {onCancel && !live && state !== 'stopped' && (
          <button type="button" className={`${small} hover:bg-slate-100 dark:hover:bg-slate-800`} onClick={onCancel}>
            <X className="h-5 w-5" aria-hidden /> {t('cancel', 'Cancel')}
          </button>
        )}
      </div>
    </div>
  );
}
