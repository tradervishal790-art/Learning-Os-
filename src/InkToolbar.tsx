import { useEffect, useState } from 'react';
import { useDarkTheme } from './useDarkTheme';
import {
  BringToFront, ClipboardPaste, Copy, CopyPlus, Eraser, Hand, Highlighter, Keyboard as TypeIcon, LassoSelect, PenLine, Pointer, Pencil, Paintbrush,
  Plus, Redo2, RotateCcw, Scissors, ScanText, SendToBack, Shapes, SquareDashed, Trash2, Undo2, X,
} from 'lucide-react';
import { useTranslation } from './i18n/LanguageContext';
import type { InkMode, InkPrefs } from './inkPrefs';
import { HL_COLORS, INK_COLORS, resolveColor } from './inkEngine';
import type { InkKind } from './notebookStore';
import { Btn, Pop, RingSwatch, Swatches, Sep, TaperStrip } from './toolbarParts';
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
  const dark = useDarkTheme();
  const d = Math.min(22, Math.max(2, width * 2));
  return (
    <span
      className="inline-block shrink-0"
      style={{ width: hl ? 22 : d, height: hl ? Math.min(20, Math.max(4, width * 2.4)) : d, borderRadius: hl ? 3 : 999, background: resolveColor(color, dark), opacity: hl ? 0.7 : 1 }}
    />
  );
}

function Dot({ color, size = 18 }: { color: string; size?: number }) {
  const dark = useDarkTheme();
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
  const darkTheme = useDarkTheme();
  const [colorOpen, setColorOpen] = useState(false);
  // Laser: the delay + colour options stay hidden until a laser style is tapped, then open in the same row.
  const [selWidth, setSelWidth] = useState(2);
  const [laserOpts, setLaserOpts] = useState(false);
  useEffect(() => {
    if (mode !== 'laser') setLaserOpts(false);
  }, [mode]);
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
  // Colours are the student's own saved ones (starting from a few suggestions); the colour in use always shows first.
  // The highlighter has its own colours: the pen's custom colours are not shown as highlighter colours.
  const saved = isHl ? palette.slice(0, 4) : prefs.recentColors.length > 0 ? prefs.recentColors : palette.slice(1, 6);
  const quickLimit = isHl ? 5 : 7;
  const quickBase = [...new Set([...(isHl ? [] : ['auto']), ...saved])];
  // Keep the row in a fixed order (picking a colour must not shuffle the buttons under the finger);
  // a colour chosen elsewhere (e.g. the custom picker) is put in front only while it is not in the row.
  let quick = quickBase.slice(0, quickLimit);
  if (!quick.includes(color)) quick = [color, ...quick].slice(0, quickLimit);


  const addFavorite = () => {
    const current = { kind: prefs.kind, color: prefs.color, width: prefs.width };
    // Saving the same pen again promotes it instead of wasting a favorite slot.
    const favorites = [
      current,
      ...prefs.favorites.filter((f) => f.kind !== current.kind || f.color !== current.color || f.width !== current.width),
    ].slice(0, 5);
    setPrefs({ favorites });
  };

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
        <div className="flex flex-wrap items-center gap-1.5 overflow-visible pb-2">
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
                <TaperStrip label={t.selWidth} min={1} max={12} step={0.5} className="w-40" value={selWidth} onChange={setSelWidth} onCommit={a.onWidth} />
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
    // tapping the style that is already active just shows / hides the options; the other style switches and shows them
    const pick = (style: 'dot' | 'ink') => {
      setPrefs({ laserStyle: style });
      setLaserOpts((o) => (prefs.laserStyle === style ? !o : true));
    };
    return (
      <div className="flex flex-wrap items-center gap-1.5 overflow-visible pb-2">
        <button className={chip(!ink)} aria-expanded={laserOpts} title={t.laserHint} onClick={() => pick('dot')}>{t.laserPointer}</button>
        <button className={chip(ink)} aria-expanded={laserOpts} title={t.laserInkHint} onClick={() => pick('ink')}>{t.laserInk}</button>
        {laserOpts && (
          <>
            <Sep />
            <span className="text-xs text-gray-500 dark:text-white/60 shrink-0">{t.laserDelay}</span>
            <TaperStrip label={t.laserDelay} min={1} max={10} step={1} value={prefs.laserDelay} onChange={(v) => setPrefs({ laserDelay: v })} />
            <Sep />
            {!ink &&
              ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b'].map((c) => (
                <RingSwatch key={c} color={c} label={c} selected={prefs.laserColor === c} onClick={() => setPrefs({ laserColor: c })} />
              ))}
            {ink && (
              <>
                {INK_COLORS.slice(0, 6).map((c) => (
                  <RingSwatch
                    key={c}
                    color={resolveColor(c, darkTheme)}
                    label={c}
                    selected={prefs.color === c}
                    onClick={() => setPrefs({ color: c })}
                  />
                ))}
                <TaperStrip label={t.thickness} min={1} max={8} step={0.5} value={prefs.width} onChange={(v) => setPrefs({ width: v })} />
              </>
            )}
          </>
        )}
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
          <TaperStrip label={t.eraserSize} min={6} max={60} value={prefs.eraserSize} onChange={(v) => setPrefs({ eraserSize: v })} />
        </label>
        <Sep />
        <Btn label={t.eraseAll} onClick={onEraseAll}><Trash2 size={16} /></Btn>
        {fingerBtn}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 overflow-visible pb-2">
      {undoRedo}
      <Sep />
      {!isHl && (
        <>
          <PenPicker kind={prefs.kind} color={color} labels={kindLabel} title={t.penType} onPick={(k) => setPrefs({ kind: k })} />
          <Sep />
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">{t.quickStyles}</span>
          <button type="button" onClick={() => setPrefs({ kind: 'pencil', width: 2 })} title={t.penPencil} aria-label={t.penPencil} aria-pressed={prefs.kind === 'pencil'} className={chip(prefs.kind === 'pencil')}><Pencil size={15} /><span className="ml-1">{t.penPencil}</span></button>
          <button type="button" onClick={() => setPrefs({ kind: 'fineliner', width: 1 })} title={t.penFineliner} aria-label={t.penFineliner} aria-pressed={prefs.kind === 'fineliner'} className={chip(prefs.kind === 'fineliner')}><PenLine size={15} /><span className="ml-1">{t.penFineliner}</span></button>
          <button type="button" onClick={() => setPrefs({ kind: 'marker', width: 4 })} title={t.penMarker} aria-label={t.penMarker} aria-pressed={prefs.kind === 'marker'} className={chip(prefs.kind === 'marker')}><Highlighter size={15} /><span className="ml-1">{t.penMarker}</span></button>
          <button type="button" onClick={() => setPrefs({ kind: 'brush', width: 3 })} title={t.penBrush} aria-label={t.penBrush} aria-pressed={prefs.kind === 'brush'} className={chip(prefs.kind === 'brush')}><Paintbrush size={15} /><span className="ml-1">{t.penBrush}</span></button>
        </>
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
      {/* thickness: one wedge strip (thin -> thick) and a live dot showing the real stroke */}
      <TaperStrip label={t.thickness} min={0.5} max={20} step={0.5} className="w-28" value={width} onChange={setWidth} />
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
          <TaperStrip label={t.smoothing} min={0} max={1} step={0.05} className="w-20" value={prefs.smoothing} onChange={(v) => setPrefs({ smoothing: v })} />
        </label>
      )}
      <button
        type="button"
        title="Draw a rough circle, rectangle, or line and hold still to snap it into a neat shape"
        aria-label="Shape snap"
        aria-pressed={prefs.shapeSnap}
        onClick={() => setPrefs({ shapeSnap: !prefs.shapeSnap })}
        className={chip(prefs.shapeSnap) + ' flex items-center gap-1.5'}
      >
        <Shapes size={16} /> <span>{t.snapShapes}</span>
      </button>
      {fingerBtn}
      <Btn label={t.resetPen} onClick={resetPrefs}><RotateCcw size={16} /></Btn>
    </div>
  );
}
