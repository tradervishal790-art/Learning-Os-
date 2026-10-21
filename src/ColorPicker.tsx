import { useEffect, useRef, useState } from 'react';
import { Pipette } from 'lucide-react';

// ============================================================
// ColorPicker.tsx — pick any colour: a shade square (light/dark x strength),
// a rainbow slider, a hex box and (where the browser has it) an eyedropper
// that copies a colour from anywhere on the screen.
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

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

export default function ColorPicker({
  value, onChange, eyedropperLabel,
}: {
  value: string;
  onChange: (hex: string) => void;
  eyedropperLabel: string;
}) {
  const start = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(start));
  const [text, setText] = useState(start);
  const boxRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const drag = useRef<'box' | 'bar' | null>(null);
  const Eye = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

  // The picker follows the current colour: pick a saved colour (or type a hex) and the
  // rainbow slider + shade square jump to that colour's own range of shades.
  useEffect(() => {
    if (!/^#[0-9a-f]{6}$/i.test(value)) return;
    if (value.toLowerCase() === hsvToHex(hsv)) return;
    setHsv(hexToHsv(value));
    setText(value.toLowerCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const apply = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setText(hex);
    onChange(hex);
  };

  const fromBox = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    apply({ ...hsv, s: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), v: 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
  };
  const fromBar = (e: React.PointerEvent) => {
    const r = barRef.current!.getBoundingClientRect();
    apply({ ...hsv, h: Math.min(359.9, Math.max(0, ((e.clientX - r.left) / r.width) * 360)) });
  };

  const down = (which: 'box' | 'bar') => (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = which;
    (which === 'box' ? fromBox : fromBar)(e);
  };
  const move = (which: 'box' | 'bar') => (e: React.PointerEvent) => {
    if (drag.current === which) (which === 'box' ? fromBox : fromBar)(e);
  };
  const up = () => { drag.current = null; };

  const typeHex = (v: string) => {
    setText(v);
    if (/^#[0-9a-f]{6}$/i.test(v)) {
      const next = hexToHsv(v);
      setHsv(next);
      onChange(v.toLowerCase());
    }
  };

  const pick = async () => {
    if (!Eye) return;
    try {
      const r = await new Eye().open();
      typeHex(r.sRGBHex);
    } catch {
      // the student pressed Esc: keep the colour as it was
    }
  };

  const hex = hsvToHex(hsv);
  return (
    <div className="w-56 space-y-2" onClick={(e) => e.stopPropagation()}>
      <div
        ref={boxRef}
        className="relative h-32 rounded-lg cursor-crosshair"
        style={{ touchAction: 'none', background: `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${hsv.h},100%,50%))` }}
        onPointerDown={down('box')}
        onPointerMove={move('box')}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <span
          className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow ring-1 ring-black/30 pointer-events-none"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }}
        />
      </div>
      <div
        ref={barRef}
        className="relative h-3 rounded-full cursor-pointer"
        style={{ touchAction: 'none', background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
        onPointerDown={down('bar')}
        onPointerMove={move('bar')}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <span className="absolute top-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow ring-1 ring-black/30 pointer-events-none" style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h},100%,50%)` }} />
      </div>
      <div className="flex items-center gap-2">
        {Eye && (
          <button
            type="button"
            onClick={() => void pick()}
            title={eyedropperLabel}
            aria-label={eyedropperLabel}
            className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center bg-gray-900 text-white dark:bg-white dark:text-black"
          >
            <Pipette size={16} />
          </button>
        )}
        <span className="w-9 h-9 rounded-lg border border-black/15 dark:border-white/30 shrink-0" style={{ background: hex }} />
        <input
          value={text}
          onChange={(e) => typeHex(e.target.value)}
          maxLength={7}
          spellCheck={false}
          aria-label="Hex"
          className="min-w-0 flex-1 h-9 px-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-xs font-mono uppercase"
        />
      </div>
    </div>
  );
}
