import { useState } from 'react';
import {
  BringToFront, ClipboardPaste, Copy, CopyPlus, Eraser, Hand, Highlighter, Keyboard as TypeIcon, LassoSelect, PenLine, Pointer,
  Plus, Redo2, RotateCcw, Scissors, ScanText, SendToBack, Shapes, SquareDashed, Trash2, Undo2, X,
} from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import type { InkMode, InkPrefs } from './inkPrefs';
import { HL_COLORS, INK_COLORS, WIDTH_PRESETS, resolveColor } from './inkEngine';
import type { InkKind } from './notebookStore';
import { Btn, Pop, Swatches, Sep } from './toolbarParts';
import ColorDialog from './ColorPicker';
import PenPicker from './PenPicker';

// Type | Pen | Highlighter | Eraser — plus the matching tool options.

export function ModeSwitch({ mode, onMode }: { mode: InkMode; onMode: (m: InkMode) => void }) {
  const t = useTranslation().notebook.ink;
  const items: [InkMode, string, React.ReactNode][] = [
    ['type', t.modeType, <TypeIcon size={15} key="t" />],
    ['pen', t.modePen, <PenLine size={15} key="p" />],
    ['highlighter', t.modeHighlighter, <Highlighter size={15} key="h" />],
    ['eraser', t.modeEraser, <Eraser size={15} key="e" />],
    ['select', t.modeSelect, <LassoSelect size={15} key="s" />],
    ['laser', t.modeLaser, <Pointer size={15} key="l" />],
  ];
  return (
    <div className="flex gap-1 mb-1.5 overflow-x-auto" role="tablist">
      {items.map(([m, label, icon]) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => onMode(m)}
          title={label}
          aria-label={label}
          className={`h-10 sm:h-9 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 border transition-all shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${
            mode === m
              ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white border-transparent'
              : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10'
          }`}
        >
          {icon}
          {/* phones: only the active tool shows its name, so the five tools fit on one line */}
          <span className={mode === m ? '' : 'hidden sm:inline'}>{label}</span>
        </button>
      ))}
    </div>
  );
}

const chip = (on: boolean) =>
  `h-9 sm:h-8 px-2.5 rounded-lg text-xs border shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${
    on
      ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white border-transparent'
      : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10'
  }`;

/** The pen thickness drawn as it really looks: a round dot (a flat bar for the highlighter). */
function ThicknessDot({ width, color, hl = false }: { width: number; color: string; hl?: boolean }) {
  const dark = document.documentElement.classList.contains('dark');
  const d = Math.min(22, Math.max(2, width * 2));
  return (
    <span
      className="inline-block shrink-0"
      style={{ width: hl ? 22 : d, height: hl ? Math.min(20, Math.max(4, width * 2.4)) : d, borderRadius: hl ? 3 : 999, background: resolveColor(color, dark), opacity: hl ? 0.7 : 1 }}
    />
  );
}

function Dot({ color, size = 18 }: { color: string; size?: number }) {
  const dark = document.documentElement.classList.contains('dark');
  return (
    <span
      className="inline-block rounded-full border border-black/15 dark:border-white/30 shrink-0"
      style={{ width: size, height: size, background: resolveColor(color, dark) }}
    />
  );
}

/** Actions for the Select tab. */
export interface SelectApi {
  count: number;
  canPaste: boolean;
  notice: string;
  onAll: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onColor: (c: string) => void;
  onWidth: (w: number) => void;
  onFront: () => void;
  onBack: () => void;
  onNeaten: () => void;
  onToText: () => void;
}

export default function InkToolbar({
  mode, prefs, setPrefs, resetPrefs, canUndo, canRedo, onUndo, onRedo, onEraseAll, select,
}: {
  mode: Exclude<InkMode, 'type'>;
  prefs: InkPrefs;
  setPrefs: (p: Partial<InkPrefs>) => void;
  resetPrefs: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onEraseAll: () => void;
  select: SelectApi;
}) {
  const t = useTranslation().notebook.ink;
  const [colorOpen, setColorOpen] = useState(false);
  const kindLabel: Record<InkKind, string> = {
    ballpoint: t.penBallpoint, fountain: t.penFountain, felt: t.penFelt, pencil: t.penPencil, brush: t.penBrush,
    calligraphy: t.penCalligraphy, fineliner: t.penFineliner, marker: t.penMarker, dotted: t.penDotted, highlighter: t.modeHighlighter,
    calligraphyBrush: t.penCalligraphyBrush, airbrush: t.penAirbrush, oil: t.penOil, crayon: t.penCrayon, natural: t.penNatural, watercolor: t.penWatercolor,
  };

  const isHl = mode === 'highlighter';
  const color = isHl ? prefs.hlColor : prefs.color;
  const width = isHl ? prefs.hlWidth : prefs.width;
  const setColor = (c: string) => {
    setPrefs(isHl ? { hlColor: c } : { color: c });
  };
  const setWidth = (w: number) => setPrefs(isHl ? { hlWidth: w } : { width: w });

  const palette = isHl ? HL_COLORS : INK_COLORS;
  const presets = isHl ? [2, 3, 5, 8] : WIDTH_PRESETS;
  // Colours are the student's own saved ones (starting from a few suggestions); the colour in use always shows first.
  const saved = prefs.recentColors.length > 0 ? prefs.recentColors : palette.slice(isHl ? 0 : 1, isHl ? 4 : 6);
  const quick = [...new Set([color, ...(isHl ? [] : ['auto']), ...saved])].slice(0, isHl ? 5 : 7);


  const addFavorite = () =>
    setPrefs({ favorites: [...prefs.favorites, { kind: prefs.kind, color: prefs.color, width: prefs.width }].slice(0, 5) });

  const undoRedo = (
    <>
      <Btn label={t.undo} disabled={!canUndo} onClick={onUndo}><Undo2 size={16} /></Btn>
      <Btn label={t.redo} disabled={!canRedo} onClick={onRedo}><Redo2 size={16} /></Btn>
    </>
  );

  const fingerBtn = (
    <Btn label={prefs.fingerDraw ? t.fingerDrawOn : t.fingerDrawOff} active={prefs.fingerDraw} onClick={() => setPrefs({ fingerDraw: !prefs.fingerDraw })}>
      <Hand size={16} />
    </Btn>
  );

  if (mode === 'select') {
    const a = select;
    return (
      <div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {undoRedo}
          <Sep />
          <Btn label={t.selLasso} active={prefs.selectShape === 'lasso'} onClick={() => setPrefs({ selectShape: 'lasso' })}><LassoSelect size={16} /></Btn>
          <Btn label={t.selRect} active={prefs.selectShape === 'rect'} onClick={() => setPrefs({ selectShape: 'rect' })}><SquareDashed size={16} /></Btn>
          <button className={chip(false)} onClick={a.onAll}>{t.selAll}</button>
          <Btn label={t.selPaste} disabled={!a.canPaste} onClick={a.onPaste}><ClipboardPaste size={16} /></Btn>
          {a.count > 0 && (
            <>
              <Sep />
              <span className="text-xs text-gray-500 dark:text-white/60 shrink-0 px-1">{t.selCount.replace('{0}', String(a.count))}</span>
              <Btn label={t.selDelete} onClick={a.onDelete}><Trash2 size={16} /></Btn>
              <Btn label={t.selCopy} onClick={a.onCopy}><Copy size={16} /></Btn>
              <Btn label={t.selCut} onClick={a.onCut}><Scissors size={16} /></Btn>
              <Btn label={t.selDuplicate} onClick={a.onDuplicate}><CopyPlus size={16} /></Btn>
              <Pop trigger={(toggle) => (
                <button type="button" onClick={toggle} title={t.selColor} aria-label={t.selColor} className="h-9 px-2 rounded-lg flex items-center border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10">
                  <Dot color="#a855f7" size={18} />
                </button>
              )}>
                <Swatches colors={[...INK_COLORS, ...HL_COLORS]} onPick={a.onColor} />
              </Pop>
              <Pop trigger={(toggle) => <Btn label={t.selWidth} onClick={toggle}><span className="text-xs font-semibold">{t.thickness.slice(0, 1)}</span></Btn>}>
                <div className="flex gap-1">
                  {WIDTH_PRESETS.map((w) => (
                    <button key={w} className={chip(false)} onClick={() => a.onWidth(w)}>{w}</button>
                  ))}
                </div>
              </Pop>
              <Btn label={t.selFront} onClick={a.onFront}><BringToFront size={16} /></Btn>
              <Btn label={t.selBack} onClick={a.onBack}><SendToBack size={16} /></Btn>
              <Btn label={t.selNeaten} onClick={a.onNeaten}><Shapes size={16} /></Btn>
              <Btn label={t.selToText} onClick={a.onToText}><ScanText size={16} /></Btn>
            </>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-white/40 pt-1">{a.notice || (a.count === 0 ? t.selHint : '')}</p>
      </div>
    );
  }

  if (mode === 'laser') {
    const ink = prefs.laserStyle === 'ink';
    return (
      <div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button className={chip(!ink)} onClick={() => setPrefs({ laserStyle: 'dot' })}>{t.laserPointer}</button>
          <button className={chip(ink)} onClick={() => setPrefs({ laserStyle: 'ink' })}>{t.laserInk}</button>
          <Sep />
          {!ink &&
            ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b'].map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setPrefs({ laserColor: c })}
                className={`h-8 w-8 rounded-full border-2 shrink-0 ${prefs.laserColor === c ? 'border-indigo-500' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          {ink && (
            <>
              <span className="text-xs text-gray-500 dark:text-white/60 shrink-0">{t.laserDelay}</span>
              {[2, 5, 10, 20].map((n) => (
                <button key={n} className={chip(prefs.laserDelay === n)} onClick={() => setPrefs({ laserDelay: n })}>{n}s</button>
              ))}
              <Sep />
              {INK_COLORS.slice(0, 6).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setPrefs({ color: c })}
                  className={`h-8 w-8 rounded-full border-2 shrink-0 ${prefs.color === c ? 'border-indigo-500' : 'border-black/10 dark:border-white/20'}`}
                  style={{ background: resolveColor(c, document.documentElement.classList.contains('dark')) }}
                />
              ))}
              {WIDTH_PRESETS.slice(0, 4).map((w) => (
                <button key={w} className={chip(prefs.width === w)} onClick={() => setPrefs({ width: w })} aria-label={`${t.thickness} ${w}`}>{w}</button>
              ))}
            </>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-white/40 pt-1">{ink ? t.laserInkHint : t.laserHint}</p>
      </div>
    );
  }

  if (mode === 'eraser') {
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {undoRedo}
        <Sep />
        <button className={chip(prefs.eraserMode === 'stroke')} onClick={() => setPrefs({ eraserMode: 'stroke' })}>{t.eraserStroke}</button>
        <button className={chip(prefs.eraserMode === 'area')} onClick={() => setPrefs({ eraserMode: 'area' })}>{t.eraserArea}</button>
        <Sep />
        <button className={chip(prefs.eraserTarget === 'all')} onClick={() => setPrefs({ eraserTarget: 'all' })}>{t.targetAll}</button>
        <button className={chip(prefs.eraserTarget === 'ink')} onClick={() => setPrefs({ eraserTarget: 'ink' })}>{t.targetInk}</button>
        <button className={chip(prefs.eraserTarget === 'hl')} onClick={() => setPrefs({ eraserTarget: 'hl' })}>{t.targetHl}</button>
        <Sep />
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-white/70 shrink-0">
          {t.eraserSize}
          <input type="range" min={6} max={60} value={prefs.eraserSize} onChange={(e) => setPrefs({ eraserSize: Number(e.target.value) })} className="w-24" />
        </label>
        <Sep />
        <Btn label={t.eraseAll} onClick={onEraseAll}><Trash2 size={16} /></Btn>
        {fingerBtn}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {undoRedo}
      <Sep />
      {!isHl && (
        <PenPicker kind={prefs.kind} color={color} labels={kindLabel} title={t.penType} onPick={(k) => setPrefs({ kind: k })} />
      )}
      {/* the first colours sit right on the toolbar; the rest (and "recent" + custom) are one tap away */}
      {quick.map((c) => (
        <button
          key={c}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setColor(c)}
          title={c === 'auto' ? t.colorAuto : c}
          aria-label={c === 'auto' ? t.colorAuto : c}
          aria-pressed={color === c}
          className="h-10 w-9 sm:h-9 sm:w-8 shrink-0 flex items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          <span className={`rounded-full ${color === c ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-black' : ''}`}>
            <Dot color={c} size={22} />
          </span>
        </button>
      ))}
      {/* the "Edit colors" window: any colour, plus the student's own custom colours */}
      <button
        type="button"
        onClick={() => setColorOpen(true)}
        title={t.color}
        aria-label={t.color}
        className="h-9 w-9 sm:h-8 sm:w-8 shrink-0 rounded-full border border-black/15 dark:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
        style={{ background: 'conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
      />
      {colorOpen && (
        <ColorDialog
          value={color === 'auto' ? '#000000' : color}
          custom={prefs.recentColors}
          onAddCustom={(c) => setPrefs({ recentColors: [c, ...prefs.recentColors.filter((x) => x !== c)].slice(0, 24) })}
          onOk={(c) => {
            setColor(c);
            setColorOpen(false);
          }}
          onCancel={() => setColorOpen(false)}
          labels={t as unknown as Record<string, string>}
        />
      )}
      {/* thickness is shown as the real stroke (a dot as wide as the pen), not as a number */}
      {presets.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => setWidth(w)}
          title={`${t.thickness} ${w}`}
          aria-label={`${t.thickness} ${w}`}
          aria-pressed={width === w}
          className={`h-9 w-9 sm:h-8 sm:w-8 rounded-lg border shrink-0 flex items-center justify-center transition-colors ${
            width === w ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20' : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
          }`}
        >
          <ThicknessDot width={w} color={color} hl={isHl} />
        </button>
      ))}
      <input
        type="range" min={0.5} max={20} step={0.5} value={width}
        onChange={(e) => setWidth(Number(e.target.value))}
        aria-label={t.thickness} title={t.thickness} className="w-20 shrink-0"
      />
      <span className="h-9 w-9 sm:h-8 sm:w-8 shrink-0 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-white/5" aria-hidden>
        <ThicknessDot width={width} color={color} hl={isHl} />
      </span>
      {!isHl && (
        <>
          <Sep />
          {prefs.favorites.map((f, i) => (
            <span key={i} className="flex items-center shrink-0 rounded-lg border border-gray-200 dark:border-white/10">
              <button
                title={`${t.favorites}: ${kindLabel[f.kind]}`}
                onClick={() => setPrefs({ kind: f.kind, color: f.color, width: f.width })}
                className="h-8 pl-2 pr-1 flex items-center gap-1 text-[11px] text-gray-600 dark:text-white/70"
              >
                <Dot color={f.color} size={14} /> <ThicknessDot width={f.width} color={f.color} />
              </button>
              <button
                aria-label={t.removeFavorite}
                title={t.removeFavorite}
                onClick={() => setPrefs({ favorites: prefs.favorites.filter((_, j) => j !== i) })}
                className="h-8 px-1 text-gray-400 hover:text-red-500"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {prefs.favorites.length < 5 && (
            <Btn label={t.saveFavorite} onClick={addFavorite}><Plus size={16} /></Btn>
          )}
        </>
      )}
      <Sep />
      {!isHl && (
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-white/70 shrink-0">
          {t.smoothing}
          <input type="range" min={0} max={1} step={0.05} value={prefs.smoothing} onChange={(e) => setPrefs({ smoothing: Number(e.target.value) })} className="w-16" />
        </label>
      )}
      <Btn label={t.shapeSnap} active={prefs.shapeSnap} onClick={() => setPrefs({ shapeSnap: !prefs.shapeSnap })}><Shapes size={16} /></Btn>
      {fingerBtn}
      <Btn label={t.resetPen} onClick={resetPrefs}><RotateCcw size={16} /></Btn>
    </div>
  );
}
