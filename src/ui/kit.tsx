// Shared building blocks for the dark, glowing "mission" look.
// RULE: nothing in this file contains a user-facing word. Every label comes from
// the caller (i18n strings or the student's own data).
import { localDayKey } from '../progressMetrics';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';

/** Pointer-follow glow: sets --mx/--my on the element so a radial gradient can track the cursor. */
function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const onPointerMove = (event: ReactPointerEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    el.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };
  return { ref, onPointerMove };
}

function Glow({ accent }: { accent: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:hidden"
      style={{ background: `radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), ${accent}26, transparent 70%)` }}
    />
  );
}

const PANEL_BASE = 'group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035]';

export function GlassPanel({ children, className = '', accent = '#67e8f9' }: { children: ReactNode; className?: string; accent?: string }) {
  const { ref, onPointerMove } = useSpotlight<HTMLDivElement>();
  return (
    <div ref={ref} onPointerMove={onPointerMove} className={`${PANEL_BASE} ${className}`}>
      <Glow accent={accent} />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/** A whole-surface button with the same glow, lift on hover and a visible focus ring. */
export function GlassButton({ children, onClick, className = '', accent = '#67e8f9', label, disabled = false }: {
  children: ReactNode; onClick: () => void; className?: string; accent?: string; label?: string; disabled?: boolean;
}) {
  const { ref, onPointerMove } = useSpotlight<HTMLButtonElement>();
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onPointerMove={onPointerMove}
      aria-label={label}
      disabled={disabled}
      className={`${PANEL_BASE} text-left transition-[transform,border-color] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${className}`}
      style={{ ['--tw-ring-color' as string]: accent }}
    >
      <Glow accent={accent} />
      <span className="relative block h-full">{children}</span>
    </button>
  );
}

export function ProgressRing({ value, size = 112, stroke = 9, color = '#67e8f9', children }: {
  value: number; size?: number; stroke?: number; color?: string; children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const [shown, setShown] = useState(reduce ? pct : 0);
  useEffect(() => {
    if (reduce) { setShown(pct); return; }
    const id = requestAnimationFrame(() => setShown(pct)); // next frame so the sweep animates from 0
    return () => cancelAnimationFrame(id);
  }, [pct, reduce]);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - shown / 100)}
          style={{ transition: reduce ? 'none' : 'stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)', filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Reads the app's own list of active days (ISO date keys, written by the Dashboard streak tracker). */
const ACTIVE_DAYS_KEY = 'learning_os_active_days'; // same key as Dashboard.tsx
export function readActiveDays(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(ACTIVE_DAYS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

const LEVEL_ALPHA = ['', '55', '99', 'ff'];

/** Week-by-week activity grid. Brighter cells = part of a longer run of consecutive active days. */
export function Heatmap({ days, weeks = 12, color = '#6ee7b7', compact = false }: { days: string[]; weeks?: number; color?: string; compact?: boolean }) {
  const cells = useMemo(() => {
    const active = new Set(days);
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (weeks - 1) * 7 - today.getDay()); // begin on the first column's Sunday
    const list: { key: string; label: string; level: number; isToday: boolean }[] = [];
    const cursor = new Date(start);
    const runLength = (from: Date) => {
      let n = 0;
      const probe = new Date(from);
      while (active.has(localDayKey(probe))) { n += 1; probe.setDate(probe.getDate() - 1); }
      return n;
    };
    const todayKey = localDayKey(today);
    while (cursor <= today) {
      const key = localDayKey(cursor);
      const run = active.has(key) ? runLength(cursor) : 0;
      list.push({
        key,
        label: cursor.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        level: run === 0 ? 0 : run >= 4 ? 3 : run >= 2 ? 2 : 1,
        isToday: key === todayKey,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return list;
  }, [days, weeks]);

  return (
    <div
      role="img"
      aria-label={`${days.length}`}
      className={compact ? 'grid w-fit gap-[3px]' : 'grid w-full gap-1'}
      style={compact
        ? { gridTemplateRows: 'repeat(7, 10px)', gridAutoFlow: 'column', gridTemplateColumns: `repeat(${weeks}, 10px)` }
        : { gridTemplateRows: 'repeat(7, minmax(0, 1fr))', gridAutoFlow: 'column', gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
    >
      {cells.map((cell) => (
        <span
          key={cell.key}
          title={cell.label}
          className={`${compact ? '' : 'aspect-square'} rounded-[3px] transition-transform duration-150 hover:scale-125 motion-reduce:transition-none ${cell.level === 0 ? 'bg-white/[0.06]' : ''} ${cell.isToday ? 'ring-1 ring-white/60' : ''}`}
          style={cell.level > 0 ? { backgroundColor: `${color}${LEVEL_ALPHA[cell.level]}`, boxShadow: cell.level === 3 ? `0 0 8px ${color}66` : undefined } : undefined}
        />
      ))}
    </div>
  );
}

/** The little "less → more" scale under a heatmap. Labels are passed in. */
export function HeatmapLegend({ less, more, color = '#6ee7b7' }: { less: string; more: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
      <span>{less}</span>
      <span className="h-2.5 w-2.5 rounded-[3px] bg-white/[0.06]" />
      {LEVEL_ALPHA.slice(1).map((alpha) => <span key={alpha} className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: `${color}${alpha}` }} />)}
      <span>{more}</span>
    </div>
  );
}
