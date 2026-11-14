import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCw, Minimize2 } from 'lucide-react';
import { useImmersive } from './immersive';
import { useDock, setDockHost, getDockSlot, dockPlay, dockPause, dockSeekBy, dockNext, dockPrev, dockUndismiss, resetDock } from './miniPlayer';

/**
 * The one element the YouTube iframe lives in. Mounted once, above every page, so the video keeps
 * playing when the learner switches screens.
 *
 *  - inline    : laid exactly over the Videos page's player slot (follows it while scrolling)
 *  - mini      : floating, draggable card (video + title + play/pause, open, close)
 *  - landscape : phone turned sideways on the Videos page -> the player fills the whole screen
 *  - rotated   : learner tapped the landscape button on a phone held upright and the browser can't lock
 *                orientation (iPhone) -> the frame is turned 90deg so the video still fills the screen
 */

type Mode = 'inline' | 'mini' | 'landscape' | 'rotated';
type Forced = 'off' | 'native' | 'rotated';

const POS_KEY = 'los_mini_player_pos';
const NAV_CLEAR = 76; // default resting spot sits above the bottom nav (dragging is NOT limited by it)
const FOOTER_H = 56;
const EDGE = 12;

interface Pos {
  xr: number; // 0..1 across the allowed area
  yr: number;
  custom: boolean; // false until the learner drags it: rests bottom-right above the nav
}

function loadPos(): Pos {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null') as Pos | null;
    if (p && Number.isFinite(p.xr) && Number.isFinite(p.yr)) {
      return { xr: Math.min(1, Math.max(0, p.xr)), yr: Math.min(1, Math.max(0, p.yr)), custom: p.custom === true };
    }
  } catch {
    /* ignore */
  }
  return { xr: 1, yr: 1, custom: false }; // bottom-right, like YouTube
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export default function PlayerHost({ onExpand, onBack }: { onExpand: () => void; onBack: () => void }) {
  const dock = useDock();
  const immersive = useImmersive();
  const hasVideo = dock.video !== null;

  const frameRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('mini');

  const posRef = useRef<Pos>(loadPos());
  const geoRef = useRef({ xMin: 0, xMax: 0, yMin: 0, yMax: 0, x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null);
  const lastTapRef = useRef(0);
  // Touch zones over the middle of the video (top/bottom strips stay free so YouTube's seek bar
  // and buttons keep working):
  //   left  : double-tap = -10s   (keep tapping to keep seeking)
  //   right : double-tap = +10s
  //   centre: single = play/pause, double = back to the previous page
  type Zone = 'left' | 'center' | 'right';
  const tapRef = useRef<{ zone: Zone; timer: number } | null>(null);
  const seekRef = useRef<{ zone: Zone; total: number; timer: number } | null>(null);
  const [seekFlash, setSeekFlash] = useState<{ zone: Zone; total: number } | null>(null);
  const playingRef = useRef(false);
  useEffect(() => {
    playingRef.current = dock.playing;
  });

  const doSeek = (zone: 'left' | 'right') => {
    const prev = seekRef.current;
    if (prev) window.clearTimeout(prev.timer);
    const total = (prev && prev.zone === zone ? prev.total : 0) + 10;
    dockSeekBy(zone === 'left' ? -10 : 10);
    const timer = window.setTimeout(() => {
      seekRef.current = null;
      setSeekFlash(null);
    }, 700);
    seekRef.current = { zone, total, timer };
    setSeekFlash({ zone, total });
  };

  const onZoneClick = (zone: Zone) => {
    // Already seeking on this side: every further tap adds another 10s.
    if (seekRef.current && seekRef.current.zone === zone && zone !== 'center') {
      doSeek(zone);
      return;
    }
    const pending = tapRef.current;
    if (pending && pending.zone === zone) {
      window.clearTimeout(pending.timer);
      tapRef.current = null;
      if (zone === 'center') {
        if (mode === 'inline') onBack();
      } else {
        doSeek(zone);
      }
      return;
    }
    if (pending) window.clearTimeout(pending.timer);
    const timer = window.setTimeout(() => {
      tapRef.current = null;
      if (playingRef.current) dockPause();
      else dockPlay();
    }, 260);
    tapRef.current = { zone, timer };
  };

  const liveRef = useRef({ immersive, dismissed: dock.dismissed });
  useEffect(() => {
    liveRef.current = { immersive, dismissed: dock.dismissed };
  });

  // Tap-to-landscape (phone held upright): native fullscreen + orientation lock where supported
  // (Android Chrome), otherwise rotate the frame with CSS (iPhone).
  const [forced, setForcedState] = useState<Forced>('off');
  const forcedRef = useRef<Forced>('off');
  const setForced = (v: Forced) => {
    forcedRef.current = v;
    setForcedState(v);
  };
  const [coarse] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);

  const enterLandscape = async () => {
    const frame = frameRef.current;
    if (!frame) return;
    try {
      if (!frame.requestFullscreen) throw new Error('no fullscreen');
      await frame.requestFullscreen();
      const orientation = screen.orientation as unknown as { lock?: (o: string) => Promise<void> };
      if (!orientation?.lock) throw new Error('no orientation lock');
      await orientation.lock('landscape');
      setForced('native');
    } catch {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          /* ignore */
        }
      }
      setForced('rotated');
    }
  };

  const exitLandscape = () => {
    const was = forcedRef.current;
    setForced('off');
    if (was === 'native') {
      try {
        (screen.orientation as unknown as { unlock?: () => void })?.unlock?.();
      } catch {
        /* ignore */
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    }
  };
  const exitRef = useRef(exitLandscape);
  useEffect(() => {
    exitRef.current = exitLandscape;
  });
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && forcedRef.current === 'native') exitRef.current();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // YouTube's own fullscreen button (inside the video) is the way to go landscape on a phone.
  // Make sure it really turns the screen sideways, and turns it back on exit.
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return undefined;
    const orientation = screen.orientation as unknown as { lock?: (o: string) => Promise<void>; unlock?: () => void };
    const onFs = () => {
      const fs = document.fullscreenElement;
      if (fs && frameRef.current?.contains(fs)) {
        orientation.lock?.('landscape').catch(() => undefined);
      } else {
        try {
          orientation.unlock?.();
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Publish the iframe's home so the page's player can portal into it.
  useLayoutEffect(() => {
    setDockHost(boxRef.current);
    return () => {
      setDockHost(null);
      resetDock();
    };
  }, []);

  // A timed test takes the whole screen: stop the audio, hide the card.
  useEffect(() => {
    if (immersive) dockPause();
  }, [immersive]);

  // Place the frame every animation frame (cheap: one rect read + a transform write).
  useLayoutEffect(() => {
    if (!hasVideo) return undefined;
    const frame = frameRef.current;
    const box = boxRef.current;
    const probe = probeRef.current;
    if (!frame || !box) return undefined;

    const sideways = window.matchMedia('(orientation: landscape) and (max-height: 520px) and (pointer: coarse)');
    let raf = 0;
    let last: Mode | '' = '';
    let animUntil = 0;
    let sig = '';
    let boxPointer = '';

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rect = getDockSlot()?.getBoundingClientRect();
      const hasSlot = !!rect && rect.width > 0 && rect.height > 0;
      const shown = hasSlot ? (Math.min(rect.bottom, vh) - Math.max(rect.top, 0)) / rect.height : 0;
      const wasInline = last === 'inline' || last === 'landscape';

      if (forcedRef.current !== 'off' && (!hasSlot || (forcedRef.current === 'rotated' && sideways.matches))) {
        exitRef.current(); // left the Videos page, or the phone was really turned sideways
      }
      const forcedNow = forcedRef.current;

      let m: Mode;
      if (hasSlot && forcedNow === 'rotated') m = 'rotated';
      else if (hasSlot && (sideways.matches || forcedNow === 'native')) m = 'landscape';
      else if (hasSlot && shown > (wasInline ? 0.15 : 0.5)) m = 'inline';
      else m = 'mini';

      if (m === 'inline' && liveRef.current.dismissed) dockUndismiss();

      const now = performance.now();
      if (m !== last) {
        if (last !== '') animUntil = now + 260;
        last = m;
        setMode(m);
      }
      const animating = !dragRef.current && now < animUntil;

      let x: number, y: number, w: number, h: number, boxH: number, radius: number, z: number;
      if (m === 'rotated') {
        x = vw; y = 0; w = vh; h = vw; boxH = vw; radius = 0; z = 70;
      } else if (m === 'landscape') {
        x = 0; y = 0; w = vw; h = vh; boxH = vh; radius = 0; z = 70;
      } else if (m === 'inline' && rect) {
        x = rect.left; y = rect.top; w = rect.width; h = rect.height; boxH = rect.height; radius = 16; z = 20;
      } else {
        w = vw < 480 ? Math.min(vw - EDGE * 2, 300) : 320;
        boxH = Math.round((w * 9) / 16);
        h = boxH + FOOTER_H;
        const safeBottom = probe ? probe.offsetHeight : 0;
        const bottomClear = liveRef.current.immersive ? EDGE : NAV_CLEAR + safeBottom;
        const xMin = EDGE;
        const xMax = Math.max(xMin, vw - w - EDGE);
        const yMin = EDGE;
        const yMax = Math.max(yMin, vh - h - EDGE); // full screen: top to bottom
        const rest = Math.max(yMin, vh - h - bottomClear);
        const pos = posRef.current;
        x = xMin + pos.xr * (xMax - xMin);
        y = pos.custom ? yMin + pos.yr * (yMax - yMin) : rest;
        geoRef.current = { xMin, xMax, yMin, yMax, x, y };
        radius = 14; z = 45;
      }

      const next = [x, y, w, h, boxH].map(Math.round).join('|') + `|${radius}|${z}|${m}|${animating ? 1 : 0}`;
      if (next !== sig) {
        sig = next;
        frame.style.transition = animating
          ? 'transform .24s ease, width .24s ease, height .24s ease, border-radius .24s ease'
          : 'none';
        frame.style.transformOrigin = '0 0';
        frame.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)${m === 'rotated' ? ' rotate(90deg)' : ''}`;
        frame.style.width = `${Math.round(w)}px`;
        frame.style.height = `${Math.round(h)}px`;
        frame.style.borderRadius = `${radius}px`;
        frame.style.zIndex = String(z);
        frame.style.boxShadow = m === 'mini' ? '0 12px 32px rgba(0,0,0,.5)' : 'none';
        box.style.height = `${Math.round(boxH)}px`;
      }
      frame.style.visibility = m === 'mini' && liveRef.current.dismissed ? 'hidden' : 'visible';

      // While dragging, the iframe must not swallow the pointer.
      const wantPointer = dragRef.current ? 'none' : '';
      if (wantPointer !== boxPointer) {
        boxPointer = wantPointer;
        box.style.pointerEvents = wantPointer;
      }
    };

    tick(); // place before first paint
    return () => cancelAnimationFrame(raf);
  }, [hasVideo]);

  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const g = geoRef.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, x: g.x, y: g.y, moved: false };
  };

  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 6) d.moved = true;
    const { xMin, xMax, yMin, yMax } = geoRef.current;
    const x = Math.min(xMax, Math.max(xMin, d.x + e.clientX - d.startX));
    const y = Math.min(yMax, Math.max(yMin, d.y + e.clientY - d.startY));
    posRef.current = {
      xr: xMax > xMin ? clamp01((x - xMin) / (xMax - xMin)) : 1,
      yr: yMax > yMin ? clamp01((y - yMin) / (yMax - yMin)) : 1,
      custom: true,
    };
  };

  const onDragEnd = () => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    // Double-tap / double-click anywhere on the card (not on a button) -> back to the Videos page.
    if (!d.moved) {
      const now = performance.now();
      if (now - lastTapRef.current < 350) {
        lastTapRef.current = 0;
        onExpand();
        return;
      }
      lastTapRef.current = now;
      return;
    }
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(posRef.current));
    } catch {
      /* best effort */
    }
  };

  const iconBtn = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 active:bg-white/20';

  return (
    <>
      <div
        ref={probeRef}
        aria-hidden
        className="pointer-events-none invisible fixed bottom-0 left-0 w-0"
        style={{ height: 'env(safe-area-inset-bottom, 0px)' }}
      />
      <div
        ref={frameRef}
        role="region"
        aria-label="Video player"
        className="fixed left-0 top-0 overflow-hidden bg-black will-change-transform"
        style={{ display: hasVideo && !immersive ? 'block' : 'none', visibility: 'hidden' }}
      >
        {/* The YouTube iframe is portaled in here by the Videos page. */}
        <div ref={boxRef} className="w-full bg-black" />

        {(mode === 'inline' || mode === 'landscape' || mode === 'rotated') && (
          <div className="absolute inset-x-0 flex" style={{ top: '18%', bottom: '24%' }} aria-hidden>
            {(['left', 'center', 'right'] as const).map((zone) => (
              <div
                key={zone}
                className="relative h-full"
                style={{ width: zone === 'center' ? '30%' : '35%' }}
                onClick={() => onZoneClick(zone)}
              >
                {seekFlash?.zone === zone && (
                  <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white">
                    {zone === 'left' ? '\u23EA' : '\u23E9'} {zone === 'left' ? '-' : '+'}{seekFlash.total}s
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {(forced !== 'off' || (coarse && mode === 'inline')) && (
          <button
            type="button"
            className="absolute right-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm active:bg-black/75"
            style={{ bottom: '25%' }}
            aria-label={forced === 'off' ? 'Watch in landscape' : 'Exit landscape'}
            onClick={(e) => {
              e.stopPropagation();
              if (forced === 'off') void enterLandscape();
              else exitLandscape();
            }}
          >
            {forced === 'off' ? <RotateCw className="h-[18px] w-[18px]" /> : <Minimize2 className="h-[18px] w-[18px]" />}
          </button>
        )}

        {mode === 'mini' && dock.video && (
          <>
            {/* Shield: YouTube's own overlay (title, share, CC, settings…) never gets a hover/tap.
                While not playing, a plain thumbnail covers the paused/ended YouTube screen. */}
            <div
              className="absolute inset-x-0 top-0 aspect-video cursor-grab touch-none active:cursor-grabbing"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              style={{
                background: dock.playing ? 'transparent' : `#000 url(https://i.ytimg.com/vi/${dock.video.id}/hqdefault.jpg) center / cover no-repeat`,
              }}
            />
            <div
              className="flex h-14 cursor-grab touch-none select-none items-center gap-0.5 bg-[#0f1420] pl-3 pr-1 text-white active:cursor-grabbing"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            >
              <div className="min-w-0 flex-1 text-left" title={`${dock.video.title} — double-click to open`}>
                <p className="truncate text-[13px] font-semibold leading-tight">{dock.video.title}</p>
                <p className="truncate text-[11px] text-white/60">{dock.video.channel}</p>
              </div>
              <button type="button" className={`${iconBtn} disabled:opacity-30`} aria-label="Previous video" disabled={!dock.video.canPrev} onClick={dockPrev}>
                <SkipBack className="h-5 w-5" fill="currentColor" />
              </button>
              <button type="button" className={iconBtn} aria-label={dock.playing ? 'Pause' : 'Play'} onClick={() => (dock.playing ? dockPause() : dockPlay())}>
                {dock.playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
              </button>
              <button type="button" className={iconBtn} aria-label="Next video" onClick={dockNext}>
                <SkipForward className="h-5 w-5" fill="currentColor" />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
