import { useEffect, useState } from 'react';
import { loadTimeline, segmentIndexAt, type ConceptSegment } from './conceptTimeline';

interface PlayerHandle {
  current: {
    getCurrentTime?: () => number;
    seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
    playVideo?: () => void;
  } | null;
}

function formatChapterTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

/** Reuses the Focus Player's cached creator/AI chapter timeline in Video Intelligence. */
export default function VideoChapterNavigator({
  videoId,
  title,
  playerRef,
}: {
  videoId: string;
  title: string;
  playerRef: PlayerHandle;
}) {
  const [segments, setSegments] = useState<ConceptSegment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSegments(null);
    setLoading(true);
    setExpanded(false);
    setActiveIndex(0);
    void loadTimeline(videoId, title).then((result) => {
      if (cancelled) return;
      setSegments(result.segments);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [videoId, title]);

  useEffect(() => {
    if (!segments?.length) return;
    const timer = setInterval(() => {
      const currentTime = playerRef.current?.getCurrentTime?.();
      if (typeof currentTime === 'number' && Number.isFinite(currentTime)) {
        setActiveIndex(segmentIndexAt(segments, currentTime));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [segments, playerRef]);

  const seekTo = (seconds: number) => {
    playerRef.current?.seekTo?.(seconds, true);
    playerRef.current?.playVideo?.();
  };

  return (
    <section className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] p-3 md:p-4">
      {loading ? (
        <p role="status" className="text-sm text-gray-500 dark:text-white/50">Finding this lesson’s chapters…</p>
      ) : !segments?.length ? (
        <p className="text-sm text-gray-500 dark:text-white/50">Chapter navigation isn’t available for this video yet.</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">Now learning</p>
              <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">{segments[activeIndex]?.title ?? segments[0].title}</p>
              {segments[activeIndex]?.summary && (
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-white/60">{segments[activeIndex].summary}</p>
              )}
            </div>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`video-chapters-${videoId}`}
              onClick={() => setExpanded((value) => !value)}
              className="los-btn los-btn-secondary shrink-0"
            >
              {expanded ? 'Hide chapters' : `Chapters · ${segments.length}`}
            </button>
          </div>
          {expanded && (
            <div id={`video-chapters-${videoId}`} className="mt-3 max-h-56 overflow-y-auto border-t border-gray-200 pt-2 dark:border-white/10">
              {segments.map((segment, index) => (
                <button
                  key={`${segment.start}-${index}`}
                  type="button"
                  aria-current={index === activeIndex ? 'step' : undefined}
                  onClick={() => seekTo(segment.start)}
                  className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-gray-100 dark:hover:bg-white/5 ${index === activeIndex ? 'font-semibold text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-white/75'}`}
                >
                  <span className="w-12 shrink-0 tabular-nums text-xs opacity-60">{formatChapterTime(segment.start)}</span>
                  <span className="min-w-0">{segment.title}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
