// src/useYouTubePlayer.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export type PlayerState = 'unstarted' | 'playing' | 'paused' | 'ended' | 'buffering' | 'error';
export type PlayerError = 'not-embeddable' | 'not-found' | 'network' | 'unknown';

export interface UseYouTubePlayerOptions {
  videoId: string;
  startAt?: number;
  onTime?: (seconds: number) => void;
}

export interface YouTubePlayerApi {
  ready: boolean;
  state: PlayerState;
  error: PlayerError | null;
  duration: number;
  getTime(): number;
  seekTo(sec: number): void;
  play(): void;
  pause(): void;
  setRate(r: number): void;
  retry(): void;
}

/* ---- minimal typings for the part of the IFrame API we use (no @types dependency) ---- */

interface YTPlayer {
  destroy(): void;
  getIframe(): HTMLIFrameElement;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  setPlaybackRate(rate: number): void;
  cueVideoById(args: { videoId: string; startSeconds?: number }): void;
}
interface YTEvent {
  target: YTPlayer;
}
interface YTDataEvent extends YTEvent {
  data: number;
}
interface YTPlayerOptions {
  host: string;
  width: string;
  height: string;
  videoId: string;
  playerVars: { rel: 0 | 1; modestbranding: 0 | 1; playsinline: 0 | 1; origin: string; start?: number };
  events: {
    onReady(event: YTEvent): void;
    onStateChange(event: YTDataEvent): void;
    onError(event: YTDataEvent): void;
  };
}
interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer;
}
type YTWindow = Window & { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

/* ------------------------- one shared script load per page ------------------------- */

const API_SRC = 'https://www.youtube.com/iframe_api';
const API_TIMEOUT_MS = 15_000;
let apiPromise: Promise<YTNamespace> | null = null;

function getReadyApi(): YTNamespace | null {
  const w = window as YTWindow;
  return w.YT !== undefined && typeof w.YT.Player === 'function' ? w.YT : null;
}

function loadYouTubeApi(): Promise<YTNamespace> {
  const existing = getReadyApi();
  if (existing) return Promise.resolve(existing);
  if (apiPromise) return apiPromise;

  const w = window as YTWindow;
  const promise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = w.onYouTubeIframeAPIReady;
    let settled = false;
    let timeoutId = 0;
    let script: HTMLScriptElement | null = null;

    function fail(reason: string): void {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (w.onYouTubeIframeAPIReady === onReady) w.onYouTubeIframeAPIReady = previous;
      script?.remove(); // so that a later retry can inject a fresh <script>
      reject(new Error(reason));
    }

    function onReady(): void {
      try {
        previous?.(); // keep any other listener on the page working
      } catch {
        /* not our problem */
      }
      if (settled) return;
      const api = getReadyApi();
      if (!api) {
        fail('YouTube API loaded without a Player');
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(api);
    }

    w.onYouTubeIframeAPIReady = onReady;
    timeoutId = window.setTimeout(() => fail('YouTube API timed out'), API_TIMEOUT_MS);

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      script = document.createElement('script');
      script.src = API_SRC;
      script.async = true;
      script.addEventListener('error', () => fail('YouTube API failed to load'), { once: true });
      document.head.appendChild(script);
    }
  });

  apiPromise = promise;
  promise.catch(() => {
    if (apiPromise === promise) apiPromise = null; // allow retry()
  });
  return promise;
}

/* ------------------------------------ mapping ------------------------------------ */

function mapState(code: number): PlayerState {
  switch (code) {
    case 0:
      return 'ended';
    case 1:
      return 'playing';
    case 2:
      return 'paused';
    case 3:
      return 'buffering';
    default:
      return 'unstarted'; // -1 (unstarted) and 5 (cued)
  }
}

function mapError(code: number): PlayerError {
  switch (code) {
    case 100:
      return 'not-found';
    case 101:
    case 150:
      return 'not-embeddable';
    default:
      return 'unknown'; // 2 (bad parameter), 5 (HTML5 player error), anything new
  }
}

function safeDuration(player: YTPlayer): number {
  try {
    const d = player.getDuration();
    return Number.isFinite(d) && d > 0 ? d : 0;
  } catch {
    return 0;
  }
}

function toStartSeconds(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/* ------------------------------------- hook ------------------------------------- */

interface Latest {
  videoId: string;
  startAt: number | undefined;
  onTime: ((seconds: number) => void) | undefined;
}

/**
 * `containerRef` must point at an element that React renders EMPTY and that this hook owns
 * (the YouTube API swaps its target for an <iframe>, so we mount into our own inner <div>
 * and never touch React's nodes).
 */
export function useYouTubePlayer(
  containerRef: RefObject<HTMLElement | null>,
  opts: UseYouTubePlayerOptions,
): YouTubePlayerApi {
  const { videoId, startAt, onTime } = opts;

  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PlayerState>('unstarted');
  const [error, setError] = useState<PlayerError | null>(null);
  const [duration, setDuration] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const errorRef = useRef<PlayerError | null>(null);
  const timerRef = useRef<number | null>(null);
  const aliveRef = useRef(false);
  const rateRef = useRef(1);
  const loadedIdRef = useRef<string | null>(null);
  const latest = useRef<Latest>({ videoId, startAt, onTime });

  // Declared first, so it runs before every other effect of the same commit.
  useEffect(() => {
    latest.current = { videoId, startAt, onTime };
  });

  // StrictMode-safe "mounted" flag: no setState / onTime after unmount.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /** Runs fn on the player; returns `fallback` when it isn't ready or the call throws. */
  const call = useCallback(<T>(fallback: T, fn: (player: YTPlayer) => T): T => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return fallback;
    try {
      return fn(player);
    } catch {
      return fallback;
    }
  }, []);

  const readTime = useCallback(
    (): number =>
      call(0, (player) => {
        const t = player.getCurrentTime();
        return Number.isFinite(t) && t > 0 ? t : 0;
      }),
    [call],
  );

  const emitTime = useCallback((seconds: number): void => {
    if (!aliveRef.current) return;
    latest.current.onTime?.(seconds);
  }, []);

  const stopTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((): void => {
    if (timerRef.current !== null) return;
    timerRef.current = window.setInterval(() => emitTime(readTime()), 1000);
  }, [emitTime, readTime]);

  /* ---- create / destroy the player (mount, retry) ---- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let cancelled = false;
    let mount: HTMLDivElement | null = null;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;

        const { videoId: initialId, startAt: initialStart } = latest.current;
        loadedIdRef.current = initialId;

        const target = document.createElement('div');
        mount = target;
        container.appendChild(target);

        const playerVars: YTPlayerOptions['playerVars'] = {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          origin: window.location.origin,
        };
        const start = toStartSeconds(initialStart);
        if (start > 0) playerVars.start = start;

        playerRef.current = new YT.Player(target, {
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          videoId: initialId,
          playerVars,
          events: {
            onReady: (event) => {
              if (cancelled) return;
              readyRef.current = true;
              if (rateRef.current !== 1) {
                try {
                  event.target.setPlaybackRate(rateRef.current);
                } catch {
                  /* ignore */
                }
              }
              setDuration(safeDuration(event.target));
              setReady(true);
            },
            onStateChange: (event) => {
              if (cancelled || errorRef.current !== null) return;
              const next = mapState(event.data);
              setState(next);
              setDuration(safeDuration(event.target));
              if (next === 'playing') startTimer();
              else stopTimer();
            },
            onError: (event) => {
              if (cancelled) return;
              const mapped = mapError(event.data);
              errorRef.current = mapped;
              stopTimer();
              setError(mapped);
              setState('error');
            },
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        errorRef.current = 'network';
        setError('network');
        setState('error');
      });

    return () => {
      cancelled = true;
      stopTimer();
      readyRef.current = false;
      const player = playerRef.current;
      playerRef.current = null;
      if (player) {
        let iframe: HTMLIFrameElement | null = null;
        try {
          iframe = player.getIframe();
        } catch {
          /* player was not fully built yet */
        }
        try {
          player.destroy();
        } catch {
          /* already gone */
        }
        iframe?.remove();
      }
      mount?.remove();
    };
  }, [attempt, containerRef, startTimer, stopTimer]);

  /* ---- videoId changed: reuse the same iframe ---- */
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player || loadedIdRef.current === videoId) return;
    loadedIdRef.current = videoId;
    errorRef.current = null;
    stopTimer();
    setError(null);
    setState('unstarted');
    setDuration(0);
    try {
      // cue (not load): same behaviour as the first video — the student presses play, no surprise autoplay.
      player.cueVideoById({ videoId, startSeconds: toStartSeconds(latest.current.startAt) });
      if (rateRef.current !== 1) player.setPlaybackRate(rateRef.current);
    } catch {
      /* player torn down mid-call */
    }
  }, [videoId, ready, stopTimer]);

  /* ---- public methods: stable identity, no-ops until ready ---- */
  const seekTo = useCallback(
    (sec: number): void => {
      if (!Number.isFinite(sec)) return;
      const target = Math.max(0, sec);
      const done = call(false, (player) => {
        player.seekTo(target, true);
        return true;
      });
      if (done) emitTime(target); // one tick right after a seek, even while paused
    },
    [call, emitTime],
  );

  const play = useCallback((): void => {
    call<void>(undefined, (player) => player.playVideo());
  }, [call]);

  const pause = useCallback((): void => {
    call<void>(undefined, (player) => player.pauseVideo());
  }, [call]);

  const setRate = useCallback(
    (r: number): void => {
      if (!Number.isFinite(r) || r <= 0) return;
      const rate = Math.min(2, Math.max(0.25, r));
      rateRef.current = rate; // re-applied after ready / after a new video is cued
      call<void>(undefined, (player) => player.setPlaybackRate(rate));
    },
    [call],
  );

  const retry = useCallback((): void => {
    if (!aliveRef.current) return;
    errorRef.current = null;
    setError(null);
    setState('unstarted');
    setReady(false);
    setDuration(0);
    setAttempt((n) => n + 1); // re-runs the create effect: old player destroyed, new one built
  }, []);

  return { ready, state, error, duration, getTime: readTime, seekTo, play, pause, setRate, retry };
}
