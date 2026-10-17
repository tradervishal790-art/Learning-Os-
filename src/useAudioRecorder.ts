import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'denied' | 'unsupported' | 'error';
export interface RecordingResult { blob: Blob; mime: string; durationSec: number; bookmarks: number[] }

/** Elapsed time excluding paused time. Pure: the caller passes the clock reading. */
export class ElapsedClock {
  private accumulated = 0;
  private startedAt: number | null = null;
  private began = false;

  start(nowMs: number): void {
    this.accumulated = 0;
    this.startedAt = nowMs;
    this.began = true;
  }
  pause(nowMs: number): void {
    if (this.startedAt === null) return;
    this.accumulated += Math.max(0, nowMs - this.startedAt);
    this.startedAt = null;
  }
  resume(nowMs: number): void {
    if (!this.began || this.startedAt !== null) return;
    this.startedAt = nowMs;
  }
  elapsedMs(nowMs: number): number {
    return this.accumulated + (this.startedAt !== null ? Math.max(0, nowMs - this.startedAt) : 0);
  }
}

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function pickMime(isSupported: (m: string) => boolean): string | null {
  for (const m of MIME_CANDIDATES) {
    try {
      if (isSupported(m)) return m;
    } catch {
      /* treat as unsupported */
    }
  }
  return null;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const errName = (e: unknown): string => (e instanceof Error ? e.name : typeof e === 'object' && e !== null && 'name' in e ? String((e as { name: unknown }).name) : '');

export function useAudioRecorder(): {
  state: RecorderState; elapsedSec: number; bookmarks: number[]; interrupted: boolean; error: string | null;
  start(): Promise<void>; pause(): void; resume(): void; stop(): Promise<RecordingResult | null>;
  addBookmark(): void; discard(): void;
} {
  const [state, setStateValue] = useState<RecorderState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [interrupted, setInterrupted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef<RecorderState>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clockRef = useRef<ElapsedClock>(new ElapsedClock());
  const mimeRef = useRef('audio/webm');
  const bookmarksRef = useRef<number[]>([]);
  const timerRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const userStopRef = useRef(false);
  const resultRef = useRef<RecordingResult | null>(null);
  const waitersRef = useRef<Array<(r: RecordingResult | null) => void>>([]);
  const tokenRef = useRef(0);
  const mountedRef = useRef(true);

  const setState = useCallback((s: RecorderState) => {
    stateRef.current = s;
    if (mountedRef.current) setStateValue(s);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (stopTimeoutRef.current !== null) { window.clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = null; }
  }, []);

  const releaseStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => { t.onended = null; t.stop(); });
      streamRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setElapsedSec(round1(clockRef.current.elapsedMs(performance.now()) / 1000));
    }, 250);
  }, []);

  const detach = (rec: MediaRecorder): void => {
    rec.ondataavailable = null;
    rec.onstop = null;
    rec.onerror = null;
  };

  const resolveWaiters = (r: RecordingResult | null): void => {
    waitersRef.current.splice(0).forEach((w) => w(r));
  };

  /** Idempotent: builds the result from the chunks recorded so far. */
  const finish = useCallback((wasInterrupted: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const now = performance.now();
    clockRef.current.pause(now);
    clearTimer();
    releaseStream();
    const rec = recorderRef.current;
    const mime = (rec && rec.mimeType) || mimeRef.current;
    const blob = new Blob(chunksRef.current, { type: mime });
    const durationSec = round1(clockRef.current.elapsedMs(now) / 1000);
    const result: RecordingResult | null = blob.size > 0 ? { blob, mime, durationSec, bookmarks: [...bookmarksRef.current] } : null;
    resultRef.current = result;
    if (mountedRef.current) {
      setElapsedSec(durationSec);
      if (wasInterrupted) setInterrupted(true);
      if (!result) setError(wasInterrupted ? 'The recording was interrupted before any audio was captured.' : 'Nothing was recorded.');
    }
    setState(result ? 'stopped' : 'error');
    resolveWaiters(result);
  }, [clearTimer, releaseStream, setState]);

  const start = useCallback(async (): Promise<void> => {
    const cur = stateRef.current;
    if (cur === 'requesting' || cur === 'recording' || cur === 'paused') return;
    const old = recorderRef.current;
    if (old) { detach(old); if (old.state !== 'inactive') { try { old.stop(); } catch { /* ignore */ } } recorderRef.current = null; }
    releaseStream();
    clearTimer();
    const token = ++tokenRef.current;
    chunksRef.current = [];
    bookmarksRef.current = [];
    resultRef.current = null;
    finishedRef.current = false;
    userStopRef.current = false;
    clockRef.current = new ElapsedClock();
    setBookmarks([]); setInterrupted(false); setError(null); setElapsedSec(0);

    if (typeof MediaRecorder === 'undefined' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }
    const mime = pickMime((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) { setState('unsupported'); return; }
    mimeRef.current = mime;
    setState('requesting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      if (token !== tokenRef.current) return;
      const name = errName(e);
      if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
        setError('Microphone permission was denied.');
        setState('denied');
      } else {
        setError(name === 'NotFoundError' ? 'No microphone was found.' : 'Could not access the microphone.');
        setState('error');
      }
      return;
    }
    if (token !== tokenRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }

    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setError('Recording is not supported with this microphone.');
      setState('error');
      return;
    }
    streamRef.current = stream;
    recorderRef.current = rec;
    rec.ondataavailable = (ev: BlobEvent) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
    rec.onstop = () => finish(!userStopRef.current);
    rec.onerror = () => {
      setError('The recording failed.');
      if (rec.state !== 'inactive') { try { rec.stop(); return; } catch { /* fall through */ } }
      finish(true);
    };
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        // microphone vanished (unplugged, permission revoked, OS took it)
        if (recorderRef.current === rec && rec.state !== 'inactive') {
          try { rec.stop(); } catch { finish(true); }
        } else {
          finish(true);
        }
      };
    });
    try {
      rec.start(1000);
    } catch {
      detach(rec); recorderRef.current = null; releaseStream();
      setError('Could not start recording.');
      setState('error');
      return;
    }
    clockRef.current.start(performance.now());
    setState('recording');
    startTimer();
  }, [clearTimer, finish, releaseStream, setState, startTimer]);

  const pause = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'recording') return;
    try { rec.pause(); } catch { return; }
    const now = performance.now();
    clockRef.current.pause(now);
    clearTimer();
    setElapsedSec(round1(clockRef.current.elapsedMs(now) / 1000));
    setState('paused');
  }, [clearTimer, setState]);

  const resume = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'paused') return;
    try { rec.resume(); } catch { return; }
    clockRef.current.resume(performance.now());
    setState('recording');
    startTimer();
  }, [setState, startTimer]);

  const stop = useCallback((): Promise<RecordingResult | null> => {
    if (finishedRef.current) return Promise.resolve(resultRef.current); // also covers "interrupted, then stop()"
    const rec = recorderRef.current;
    if (!rec) return Promise.resolve(null);
    userStopRef.current = true;
    return new Promise<RecordingResult | null>((resolve) => {
      waitersRef.current.push(resolve);
      if (rec.state === 'inactive') { finish(false); return; }
      stopTimeoutRef.current = window.setTimeout(() => finish(false), 3000); // safety net if onstop never fires
      try { rec.stop(); } catch { finish(false); }
    });
  }, [finish]);

  const addBookmark = useCallback(() => {
    const st = stateRef.current;
    if (st !== 'recording' && st !== 'paused') return;
    const t = round1(clockRef.current.elapsedMs(performance.now()) / 1000);
    bookmarksRef.current = [...bookmarksRef.current, t];
    setBookmarks(bookmarksRef.current);
  }, []);

  const discard = useCallback(() => {
    tokenRef.current++; // cancels a pending getUserMedia
    const rec = recorderRef.current;
    if (rec) { detach(rec); if (rec.state !== 'inactive') { try { rec.stop(); } catch { /* ignore */ } } }
    recorderRef.current = null;
    releaseStream();
    clearTimer();
    chunksRef.current = [];
    bookmarksRef.current = [];
    resultRef.current = null;
    finishedRef.current = false;
    userStopRef.current = false;
    resolveWaiters(null);
    setElapsedSec(0); setBookmarks([]); setInterrupted(false); setError(null);
    setState('idle');
  }, [clearTimer, releaseStream, setState]);

  // iOS/Android may stop the recorder silently while the tab is in the background.
  useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return;
      const rec = recorderRef.current;
      const st = stateRef.current;
      if (rec && rec.state === 'inactive' && !finishedRef.current && (st === 'recording' || st === 'paused')) finish(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [finish]);

  // Unmount: always stop tracks.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      tokenRef.current++;
      const rec = recorderRef.current;
      if (rec) { detach(rec); if (rec.state !== 'inactive') { try { rec.stop(); } catch { /* ignore */ } } }
      recorderRef.current = null;
      releaseStream();
      clearTimer();
      resolveWaiters(null);
    };
  }, [clearTimer, releaseStream]);

  return { state, elapsedSec, bookmarks, interrupted, error, start, pause, resume, stop, addBookmark, discard };
}
