// Label keys used (all optional, English fallbacks built in):
//   play, pause, seek, speed, addBookmark, removeBookmark, bookmarks, loadError
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bookmark, Pause, Play, X } from 'lucide-react';

interface Props {
  src: Blob | string;
  bookmarks: number[];
  onBookmarksChange(next: number[]): void;
  labels: Record<string, string>;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

const formatTime = (sec: number): string => {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function AudioPlayer({ src, bookmarks, onBookmarksChange, labels }: Props) {
  const t = (key: string, fallback: string): string => labels[key] ?? fallback;
  const audioRef = useRef<HTMLAudioElement>(null);
  const fixingRef = useRef(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState<number>(1);
  const [failed, setFailed] = useState(false);

  // Object URL lives exactly as long as this effect; always revoked.
  useEffect(() => {
    if (typeof src === 'string') { setBlobUrl(null); return; }
    const url = URL.createObjectURL(src);
    setBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setBlobUrl(null);
    };
  }, [src]);

  const url = typeof src === 'string' ? src : blobUrl;

  useEffect(() => {
    fixingRef.current = false;
    setPlaying(false); setCurrent(0); setDuration(0); setFailed(false);
  }, [url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, url]);

  const el = (): HTMLAudioElement | null => audioRef.current;

  const toggle = (): void => {
    const a = el();
    if (!a) return;
    if (a.paused) a.play().catch(() => setFailed(true));
    else a.pause();
  };

  const seekTo = (sec: number): void => {
    const a = el();
    if (!a) return;
    a.currentTime = sec;
    setCurrent(sec);
  };

  const addHere = (): void => {
    const a = el();
    if (!a) return;
    const at = Math.round(a.currentTime * 10) / 10;
    if (bookmarks.some((b) => Math.abs(b - at) < 0.1)) return;
    onBookmarksChange([...bookmarks, at].sort((x, y) => x - y));
  };

  const sorted = [...bookmarks].sort((a, b) => a - b);
  const ready = duration > 0 && !failed;
  const btn = 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full font-medium transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <audio
        ref={audioRef}
        src={url ?? undefined}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const a = e.currentTarget;
          a.playbackRate = rate;
          if (Number.isFinite(a.duration)) setDuration(a.duration);
          else { fixingRef.current = true; a.currentTime = 1e101; } // MediaRecorder WebM reports Infinity: force the real duration
        }}
        onDurationChange={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (fixingRef.current) {
            if (Number.isFinite(a.duration)) { fixingRef.current = false; setDuration(a.duration); a.currentTime = 0; setCurrent(0); }
            return;
          }
          setCurrent(a.currentTime);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => { if (url) setFailed(true); }}
      />

      {failed && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{t('loadError', 'This audio could not be loaded.')}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" className={`${btn} h-12 w-12 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50`} onClick={toggle} disabled={!url || failed} aria-label={playing ? t('pause', 'Pause') : t('play', 'Play')}>
          {playing ? <Pause className="h-6 w-6" aria-hidden /> : <Play className="h-6 w-6" aria-hidden />}
        </button>
        <input
          type="range"
          className="h-9 min-w-0 flex-1 accent-indigo-600"
          min={0}
          max={duration > 0 ? duration : 1}
          step={0.1}
          value={Math.min(current, duration > 0 ? duration : 1)}
          disabled={!ready}
          aria-label={t('seek', 'Seek')}
          onChange={(e) => seekTo(Number(e.target.value))}
        />
        <span className="w-24 shrink-0 text-right text-sm tabular-nums text-slate-600 dark:text-slate-300">
          {formatTime(current)} / {formatTime(duration)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('speed', 'Speed')}>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={rate === s}
            onClick={() => setRate(s)}
            className={`${btn} px-3 text-sm ${rate === s ? 'bg-indigo-600 text-white' : 'border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'}`}
          >
            {s}×
          </button>
        ))}
        <button type="button" className={`${btn} ml-auto gap-2 border border-slate-300 px-4 text-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800`} onClick={addHere} disabled={!ready}>
          <Bookmark className="h-5 w-5" aria-hidden /> {t('addBookmark', 'Add bookmark here')}
        </button>
      </div>

      {sorted.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t('bookmarks', 'Bookmarks')}>
          {sorted.map((b) => (
            <li key={b} className="flex items-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-600">
              <button type="button" className="min-h-[40px] px-3 text-sm tabular-nums hover:bg-slate-100 focus:outline-none focus-visible:bg-slate-100 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800" onClick={() => seekTo(b)}>
                {formatTime(b)}
              </button>
              <button type="button" className="flex min-h-[40px] min-w-[40px] items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:bg-red-50 dark:hover:bg-red-950" aria-label={`${t('removeBookmark', 'Remove bookmark')} ${formatTime(b)}`} onClick={() => onBookmarksChange(bookmarks.filter((x) => x !== b))}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
