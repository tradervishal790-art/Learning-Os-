import { useEffect, useRef, useState } from 'react';
import { Pipette, Plus } from 'lucide-react';

// ============================================================
// ColorPicker.tsx — the "Edit colors" window (like Windows Paint).
//
//   [ colour square ]  [preview] [brightness bar]   hex / RGB / HSV boxes
//     left -> right = the colour family (rainbow)
//     top  -> bottom = vivid -> white            (this square never changes)
//   The brightness bar on the right is THAT colour's own range: the colour at full
//   brightness at the top, fading to black at the bottom — so every colour has its own spectrum.
//   Basic colours (fixed), Custom colours (the student's own, "+" adds the current one), OK / Cancel.
// ============================================================

type Hsv = { h: number; s: number; v: number };

export function hexToHsv(hex: string): Hsv {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const x = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(x * 255).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((x) => Math.min(255, Math.max(0, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;

/** The 4 x 12 "Basic colors" grid. */
export const BASIC_COLORS = [
  '#f4817f', '#e9382a', '#7a4b4b', '#8f3d38', '#3d0a08', '#8ff3ff', '#55f0fa', '#3a86f0', '#0a1ef0', '#0b1aa0', '#1f4a8a', '#070c8a',
  '#fff67f', '#fff04a', '#f09b5a', '#f0813a', '#7a4a15', '#8a8a2a', '#7f87f5', '#7a2ef0', '#3a7fb8', '#0a0a5a', '#5a1a7a', '#3a0a4a',
  '#a0f58a', '#a0f04a', '#6af04a', '#8cf05a', '#7af08a', '#8a8a4a', '#f08ab8', '#f088f0', '#f02af0', '#f02a7a', '#7a7ab8', '#7a1a4a',
  '#3a7a1a', '#3a7a4a', '#3a7a7a', '#4a7a7a', '#1a3a0a', '#1a4a4a', '#7a1a7a', '#3a1a7a', '#000000', '#7f7f7f', '#c0c0c0', '#ffffff',
];
export const CUSTOM_SLOTS = 24;

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const field =
  'w-full h-9 px-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-sm';

export default function ColorDialog({
  value, custom, onAddCustom, onOk, onCancel, labels,
}: {
  value: string;
  custom: string[];
  onAddCustom: (hex: string) => void;
  onOk: (hex: string) => void;
  onCancel: () => void;
  labels: Record<string, string>;
}) {
  const t = (k: string) => labels[k] ?? k;
  const start = /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '#000000';
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(start));
  const [text, setText] = useState(start);
  const [mode, setMode] = useState<'rgb' | 'hsv'>('rgb');
  const sqRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const drag = useRef<'sq' | 'bar' | null>(null);
  const Eye = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

  const hex = hsvToHex(hsv);
  const full = hsvToHex({ ...hsv, v: 1 }); // this colour at full brightness: the top of its own spectrum
  const [r, g, b] = hexToRgb(hex);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const apply = (next: Hsv) => {
    setHsv(next);
    setText(hsvToHex(next));
  };
  const setHex = (v: string) => {
    setText(v);
    if (/^#[0-9a-f]{6}$/i.test(v)) setHsv(hexToHsv(v));
  };

  const fromSq = (e: React.PointerEvent) => {
    const rc = sqRef.current!.getBoundingClientRect();
    apply({ ...hsv, h: clamp(((e.clientX - rc.left) / rc.width) * 360, 0, 359.9), s: 1 - clamp((e.clientY - rc.top) / rc.height, 0, 1) });
  };
  const fromBar = (e: React.PointerEvent) => {
    const rc = barRef.current!.getBoundingClientRect();
    apply({ ...hsv, v: 1 - clamp((e.clientY - rc.top) / rc.height, 0, 1) });
  };
  const down = (which: 'sq' | 'bar') => (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = which;
    (which === 'sq' ? fromSq : fromBar)(e);
  };
  const move = (which: 'sq' | 'bar') => (e: React.PointerEvent) => {
    if (drag.current === which) (which === 'sq' ? fromSq : fromBar)(e);
  };
  const up = () => { drag.current = null; };

  const setRgb = (i: 0 | 1 | 2, n: number) => {
    const c: [number, number, number] = [r, g, b];
    c[i] = clamp(n, 0, 255);
    setHex(rgbToHex(...c));
  };
  const setHsvField = (k: 'h' | 's' | 'v', n: number) => {
    if (k === 'h') apply({ ...hsv, h: clamp(n, 0, 359) });
    else apply({ ...hsv, [k]: clamp(n, 0, 100) / 100 });
  };

  const pickScreen = async () => {
    if (!Eye) return;
    try {
      setHex((await new Eye().open()).sRGBHex);
    } catch {
      // Esc: nothing changes
    }
  };

  const num = (label: string, val: number, max: number, on: (n: number) => void) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="number" min={0} max={max} value={val} onChange={(e) => on(Number(e.target.value) || 0)} className={`${field} w-20`} />
      <span className="text-gray-600 dark:text-white/70">{label}</span>
    </label>
  );

  const Swatch = ({ c }: { c: string }) => (
    <button
      type="button"
      onClick={() => setHex(c)}
      aria-label={c}
      title={c}
      className={`h-7 w-7 rounded-full border border-black/15 dark:border-white/25 shrink-0 ${c === hex ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900' : ''}`}
      style={{ background: c }}
    />
  );

  const rows: string[][] = [];
  for (let i = 0; i < BASIC_COLORS.length; i += 12) rows.push(BASIC_COLORS.slice(i, i + 12));
  const slots = Array.from({ length: CUSTOM_SLOTS }, (_, i) => custom[i]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-3" onClick={onCancel}>
      <div
        role="dialog"
        aria-label={t('editColors')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[600px] max-h-[94vh] overflow-y-auto rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-5"
      >
        <div className="text-xl font-semibold mb-3">{t('editColors')}</div>

        <div className="flex flex-wrap gap-4">
          {/* the colour square: family across, vivid -> white down. It never changes. */}
          <div
            ref={sqRef}
            className="relative w-full max-w-[256px] aspect-square rounded-md cursor-crosshair shrink-0"
            style={{
              touchAction: 'none',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0), #fff), linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
            }}
            onPointerDown={down('sq')}
            onPointerMove={move('sq')}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <span
              className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white ring-1 ring-black/50 pointer-events-none"
              style={{ left: `${(hsv.h / 360) * 100}%`, top: `${(1 - hsv.s) * 100}%` }}
            />
          </div>

          <div className="flex gap-3 h-[256px]">
            <div className="w-11 rounded-md border border-black/10 dark:border-white/20" style={{ background: hex }} aria-label={hex} />
            {/* this colour's own spectrum: full brightness at the top, black at the bottom */}
            <div
              ref={barRef}
              className="relative w-3 rounded-full cursor-pointer"
              style={{ touchAction: 'none', background: `linear-gradient(to bottom, ${full}, #000)` }}
              onPointerDown={down('bar')}
              onPointerMove={move('bar')}
              onPointerUp={up}
              onPointerCancel={up}
            >
              <span
                className="absolute left-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white ring-1 ring-black/50 pointer-events-none"
                style={{ top: `${(1 - hsv.v) * 100}%`, background: full }}
              />
            </div>
          </div>

          <div className="space-y-2 min-w-[160px] flex-1">
            <div className="flex items-center gap-2">
              <input value={text} onChange={(e) => setHex(e.target.value)} maxLength={7} spellCheck={false} aria-label="Hex" className={`${field} font-mono uppercase`} />
              {Eye && (
                <button type="button" onClick={() => void pickScreen()} title={t('eyedropper')} aria-label={t('eyedropper')} className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center bg-gray-900 text-white dark:bg-white dark:text-black">
                  <Pipette size={16} />
                </button>
              )}
            </div>
            <select value={mode} onChange={(e) => setMode(e.target.value as 'rgb' | 'hsv')} className={field} aria-label="Colour model">
              <option value="rgb">RGB</option>
              <option value="hsv">HSV</option>
            </select>
            {mode === 'rgb' ? (
              <>
                {num(t('chRed'), r, 255, (n) => setRgb(0, n))}
                {num(t('chGreen'), g, 255, (n) => setRgb(1, n))}
                {num(t('chBlue'), b, 255, (n) => setRgb(2, n))}
              </>
            ) : (
              <>
                {num(t('chHue'), Math.round(hsv.h), 359, (n) => setHsvField('h', n))}
                {num(t('chSat'), Math.round(hsv.s * 100), 100, (n) => setHsvField('s', n))}
                {num(t('chVal'), Math.round(hsv.v * 100), 100, (n) => setHsvField('v', n))}
              </>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
          <div>
            <div className="text-sm mb-2">{t('basicColors')}</div>
            <div className="space-y-1.5">
              {rows.map((row, i) => (
                <div key={i} className="flex gap-1.5">{row.map((c) => <Swatch key={c} c={c} />)}</div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">{t('customColors')}</span>
              <button
                type="button"
                onClick={() => onAddCustom(hex)}
                title={t('addCustom')}
                aria-label={t('addCustom')}
                className="h-7 w-7 rounded-lg flex items-center justify-center border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {slots.map((c, i) =>
                c ? (
                  <Swatch key={i} c={c} />
                ) : (
                  <span key={i} className="h-7 w-7 rounded-full border border-dashed border-gray-300 dark:border-white/25" />
                )
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => onOk(hex)} className="h-10 rounded-lg text-sm font-medium bg-indigo-600 text-white dark:bg-indigo-500 hover:opacity-90">{t('colorOk')}</button>
          <button type="button" onClick={onCancel} className="h-10 rounded-lg text-sm border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10">{t('colorCancel')}</button>
        </div>
      </div>
    </div>
  );
}
