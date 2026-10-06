import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, RotateCw, ExternalLink, Tv } from 'lucide-react';
import { useTranslation, useLanguage } from './i18n/LanguageContext';
import { format } from './i18n/format';
import {
  MAX_CHANNELS,
  addChannel,
  digestDate,
  hydrateChannelsFromCloud,
  loadChannels,
  loadDayVideos,
  loadVideoSummary,
  removeChannel,
} from './channelDigestStore';
import type { DayVideo, DigestCategory, SavedChannel, VideoSummary } from './channelDigestStore';

type Tab = 'all' | DigestCategory;
const TAB_ORDER: Tab[] = ['all', 'national', 'international', 'economy', 'sports', 'scitech', 'other'];
const CONCURRENCY = 3; // videos summarised at the same time

function formatDateLabel(date: string, locale: string): string {
  try {
    const intl = locale === 'en' ? 'en-IN' : 'hi-IN';
    return new Date(`${date}T00:00:00Z`).toLocaleDateString(intl, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    return date;
  }
}

export default function ChannelDigest() {
  const t = useTranslation();
  const { locale } = useLanguage();
  const c = t.channelDigest;

  const [channels, setChannels] = useState<SavedChannel[]>(() => loadChannels());
  const [selectedId, setSelectedId] = useState<string>(() => loadChannels()[0]?.channelId ?? '');
  const [date] = useState(digestDate); // always yesterday (IST): the latest completed day

  const [videos, setVideos] = useState<DayVideo[] | null>(null);
  const [summaries, setSummaries] = useState<Record<string, VideoSummary>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Bumped whenever the channel changes, so a slow run of the old channel can't write into the new one.
  const runIdRef = useRef(0);

  // New phone / browser: pull the saved channel list from the account.
  useEffect(() => {
    void hydrateChannelsFromCloud().then(() => {
      const list = loadChannels();
      setChannels(list);
      setSelectedId((cur) => cur || list[0]?.channelId || '');
    });
  }, []);

  const selected = useMemo(() => channels.find((ch) => ch.channelId === selectedId) ?? null, [channels, selectedId]);

  /** Summarises the given videos one by one (CONCURRENCY at a time); each result appears as soon as it is ready. */
  const summariseMany = useCallback(
    async (ids: string[], runId: number) => {
      let next = 0;
      const worker = async () => {
        while (next < ids.length && runIdRef.current === runId) {
          const id = ids[next++];
          try {
            const s = await loadVideoSummary(id, date, locale);
            if (runIdRef.current !== runId) return;
            setSummaries((prev) => ({ ...prev, [id]: s }));
          } catch (err) {
            if (runIdRef.current !== runId) return;
            setFailed((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'Something went wrong' }));
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
    },
    [date, locale]
  );

  const start = useCallback(async () => {
    const runId = ++runIdRef.current;
    setVideos(null);
    setSummaries({});
    setFailed({});
    setListError('');
    setTab('all');
    if (!selected) {
      setListLoading(false);
      return;
    }
    setListLoading(true);
    let list: DayVideo[];
    try {
      list = await loadDayVideos(selected, date);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setListError(err instanceof Error ? err.message : 'Something went wrong');
      setListLoading(false);
      return;
    }
    if (runIdRef.current !== runId) return;
    setVideos(list);
    setListLoading(false);
    await summariseMany(
      list.map((v) => v.videoId),
      runId
    );
  }, [selected, date, summariseMany]);

  // Cancels whatever is still running for the previous channel (its results are then ignored).
  const cancelRun = useCallback(() => {
    runIdRef.current++;
  }, []);

  useEffect(() => {
    void start();
    return cancelRun;
  }, [start, cancelRun]);

  function retryFailed() {
    const ids = Object.keys(failed);
    if (ids.length === 0) return;
    setFailed({});
    void summariseMany(ids, runIdRef.current);
  }

  async function onAdd() {
    const value = input.trim();
    if (!value || adding) return;
    setAdding(true);
    setAddError('');
    try {
      const list = await addChannel(value);
      setChannels(list);
      setInput('');
      // Jump to the channel that was just added (nothing changes if it was already in the list).
      const had = new Set(channels.map((ch) => ch.channelId));
      const added = list.find((ch) => !had.has(ch.channelId));
      if (added) setSelectedId(added.channelId);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAdding(false);
    }
  }

  function onRemove(channelId: string) {
    const list = removeChannel(channelId);
    setChannels(list);
    if (channelId === selectedId) setSelectedId(list[0]?.channelId ?? '');
  }

  // All points of the videos done so far, in upload order.
  const allPoints = useMemo(
    () =>
      (videos ?? []).flatMap((v) =>
        (summaries[v.videoId]?.points ?? []).map((p) => ({ ...p, videoId: v.videoId, url: v.url, videoTitle: v.title }))
      ),
    [videos, summaries]
  );
  const presentTabs = useMemo(() => {
    const set = new Set(allPoints.map((p) => p.category));
    return TAB_ORDER.filter((x) => x === 'all' || set.has(x));
  }, [allPoints]);
  // Topic-wise: group the visible points by category, in the tab order.
  const grouped = useMemo(() => {
    const visible = allPoints.filter((p) => tab === 'all' || p.category === tab);
    return TAB_ORDER.filter((x) => x !== 'all')
      .map((cat) => ({ cat: cat as DigestCategory, points: visible.filter((p) => p.category === cat) }))
      .filter((g) => g.points.length > 0);
  }, [allPoints, tab]);

  const total = videos?.length ?? 0;
  const done = Object.keys(summaries).length;
  const failedCount = Object.keys(failed).length;

  return (
    <div className="mt-6">
      <p className="text-sm text-gray-500 dark:text-white/50">{c.subtitle}</p>

      {/* Add a channel */}
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onAdd();
          }}
          placeholder={c.addPlaceholder}
          disabled={adding || channels.length >= MAX_CHANNELS}
          className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-transparent outline-none focus:border-gray-400 dark:focus:border-white/30"
        />
        <button
          onClick={() => void onAdd()}
          disabled={adding || !input.trim() || channels.length >= MAX_CHANNELS}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-black text-white dark:bg-white dark:text-black disabled:opacity-40 transition"
        >
          <Plus className="w-4 h-4" />
          {adding ? c.adding : c.addButton}
        </button>
      </div>
      {channels.length >= MAX_CHANNELS && <p className="mt-2 text-xs text-gray-500 dark:text-white/50">{format(c.limitReached, MAX_CHANNELS)}</p>}
      {addError && <p className="mt-2 text-sm text-red-500">{addError}</p>}

      {channels.length === 0 && <p className="mt-8 text-gray-500 dark:text-white/50">{c.noChannels}</p>}

      {channels.length > 0 && (
        <>
          {/* Channel chips */}
          <div className="mt-5 flex flex-wrap gap-2">
            {channels.map((ch) => (
              <span
                key={ch.channelId}
                className={`inline-flex items-center gap-1 pl-3 pr-1 py-1 text-sm rounded-full border transition ${
                  ch.channelId === selectedId
                    ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                    : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
                }`}
              >
                <button onClick={() => setSelectedId(ch.channelId)} className="inline-flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5" />
                  {ch.title}
                </button>
                <button
                  onClick={() => onRemove(ch.channelId)}
                  aria-label={format(c.removeAria, ch.title)}
                  className="p-1 rounded-full opacity-60 hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          <p className="mt-4 text-sm font-medium">{format(c.dayLabel, formatDateLabel(date, locale))}</p>

          {listLoading && <p className="mt-6 text-gray-500 dark:text-white/50 animate-pulse">{c.loading}</p>}

          {!listLoading && listError && (
            <div className="mt-6">
              <p className="text-gray-500 dark:text-white/60">{listError}</p>
              <button
                onClick={() => void start()}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                <RotateCw className="w-4 h-4" />
                {c.retry}
              </button>
            </div>
          )}

          {!listLoading && videos && videos.length === 0 && <p className="mt-6 text-gray-500 dark:text-white/50">{c.noVideos}</p>}

          {!listLoading && videos && videos.length > 0 && (
            <>
              {/* Progress: every video is covered one by one */}
              <div className="mt-3">
                <p className="text-xs text-gray-500 dark:text-white/50">{format(c.progress, done, total)}</p>
                <div className="mt-1.5 h-1 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                  <div className="h-full bg-gray-900 dark:bg-white transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                </div>
                {failedCount > 0 && (
                  <button
                    onClick={retryFailed}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    {format(c.retryFailed, failedCount)}
                  </button>
                )}
              </div>

              {/* Topic-wise written news, like the newspaper tab (grows as videos finish) */}
              {allPoints.length > 0 && (
                <>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {presentTabs.map((x) => (
                      <button
                        key={x}
                        onClick={() => setTab(x)}
                        className={`px-3 py-1 text-xs rounded-full transition ${
                          tab === x ? 'bg-gray-900 text-white dark:bg-white dark:text-black' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60'
                        }`}
                      >
                        {c.tabs[x]}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 space-y-6">
                    {grouped.map((g) => (
                      <section key={g.cat}>
                        {tab === 'all' && <h3 className="text-sm font-semibold text-gray-500 dark:text-white/50 mb-2">{c.tabs[g.cat]}</h3>}
                        <ul className="space-y-3">
                          {g.points.map((p, i) => (
                            <li key={`${g.cat}-${p.videoId}-${i}`} className="border border-gray-200 dark:border-white/10 rounded-lg p-4">
                              <p className="leading-relaxed">{p.text}</p>
                              <p className="mt-2 text-xs text-gray-500 dark:text-white/50">
                                <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline hover:text-black dark:hover:text-white">
                                  <ExternalLink className="w-3 h-3" />
                                  {p.videoTitle || c.watch}
                                </a>
                              </p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </>
              )}

              {/* One card per video: gist, or its current status */}
              <h2 className="mt-10 text-lg font-semibold">{c.videosTitle}</h2>
              <ul className="mt-3 space-y-3">
                {videos.map((v) => {
                  const s = summaries[v.videoId];
                  return (
                    <li key={v.videoId} className="border border-gray-200 dark:border-white/10 rounded-lg p-4">
                      <a href={v.url} target="_blank" rel="noopener noreferrer" className="font-medium inline-flex items-start gap-1.5 hover:underline">
                        <ExternalLink className="w-4 h-4 mt-1 shrink-0" />
                        <span>{v.title}</span>
                      </a>
                      {s && s.gist && <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-white/70">{s.gist}</p>}
                      {s && !s.hasTranscript && <p className="mt-2 text-xs text-gray-400 dark:text-white/30">{c.noTranscript}</p>}
                      {!s && failed[v.videoId] && <p className="mt-2 text-sm text-red-500">{c.videoFailed}</p>}
                      {!s && !failed[v.videoId] && <p className="mt-2 text-sm text-gray-400 dark:text-white/30 animate-pulse">{c.summarising}</p>}
                    </li>
                  );
                })}
              </ul>

              <p className="mt-4 text-xs text-gray-400 dark:text-white/30">{c.aiNote}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
