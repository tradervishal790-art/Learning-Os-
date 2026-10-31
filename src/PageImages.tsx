import { useCallback, useEffect, useRef, useState } from 'react';
import { BringToFront, RotateCw, SendToBack, Trash2 } from 'lucide-react';
import type { PageAttachment } from './notebookStore';
import { PAGE_UNITS } from './inkEngine';
import { deleteImage, getImage, putImage } from './attachStore';
import { cropRotateFlip, scanFilter } from './imageTools';
import { BTN, errorKey, isFloating } from './PageAttachments';
import { askConfirm } from './dialogApi';

// ============================================================
// PageImages.tsx — photos placed ON the page.
// Position and size are stored in PAGE UNITS (page width = 1000), exactly like
// ink strokes, so a photo keeps its place and its size relative to the page
// on any screen and at any zoom.
// Type mode: tap a photo to select it, then drag to move, drag the corner to
// resize. (In pen modes the ink layer sits on top, so you can draw over photos.)
// ============================================================

const MIN_W = 80;
const KEEP_VISIBLE = 100; // page units that must stay on the page when dragging
const CLICKS_FOR_TOOLS = 4; // quick clicks on one photo before Rotate / filters / Delete appear
const CLICK_WINDOW_MS = 1500;

type Drag =
  | { kind: 'move'; id: string; sx: number; sy: number; x: number; y: number }
  | { kind: 'size'; id: string; sx: number; w: number };

export default function PageImages({
  attachments,
  width,
  onChange,
  labels,
}: {
  attachments: PageAttachment[];
  /** Sheet width in px (zoom already applied). */
  width: number;
  onChange: (next: PageAttachment[]) => void;
  labels: Record<string, string>;
}) {
  const scale = width / PAGE_UNITS;
  const items = attachments.filter(isFloating);
  const [sel, setSel] = useState<string | null>(null);
  // Live values while dragging; committed once on release (one save, no jitter).
  const [live, setLive] = useState<Record<string, Partial<PageAttachment>>>({});
  const drag = useRef<Drag | null>(null);
  const latest = useRef(attachments);
  useEffect(() => {
    latest.current = attachments;
  }, [attachments]);

  // Tapping anywhere outside a photo (or its buttons) deselects it.
  useEffect(() => {
    if (!sel) return;
    const off = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.(`[data-attach-id="${sel}"]`)) setSel(null);
    };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [sel]);

  const patch = useCallback(
    (id: string, p: Partial<PageAttachment>) => {
      onChange(latest.current.map((a) => (a.id === id ? { ...a, ...p } : a)));
    },
    [onChange]
  );

  const remove = async (a: PageAttachment) => {
    if (!(await askConfirm(labels.removeConfirm ?? 'Remove?', { danger: true }))) return;
    onChange(latest.current.filter((x) => x.id !== a.id));
    setSel(null);
    void deleteImage(a.id).catch(() => undefined);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || scale <= 0) return;
    if (d.kind === 'move') {
      const w = items.find((i) => i.id === d.id)?.w ?? MIN_W;
      const x = Math.min(PAGE_UNITS - KEEP_VISIBLE, Math.max(KEEP_VISIBLE - w, d.x + (e.clientX - d.sx) / scale));
      const y = Math.max(0, d.y + (e.clientY - d.sy) / scale);
      setLive((l) => ({ ...l, [d.id]: { x, y } }));
    } else {
      const w = Math.min(PAGE_UNITS, Math.max(MIN_W, d.w + (e.clientX - d.sx) / scale));
      setLive((l) => ({ ...l, [d.id]: { w } }));
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const p = live[d.id];
    if (p) patch(d.id, { ...p, ...(p.x !== undefined ? { x: Math.round(p.x) } : {}), ...(p.y !== undefined ? { y: Math.round(p.y) } : {}), ...(p.w !== undefined ? { w: Math.round(p.w) } : {}) });
    setLive((l) => {
      const rest = { ...l };
      delete rest[d.id];
      return rest;
    });
  };

  if (width <= 0) return null;
  return (
    <>
      {items.map((a) => {
        const v = { ...a, ...live[a.id] };
        return (
          <FloatingImage
            key={a.id}
            a={a}
            x={v.x ?? 0}
            y={v.y ?? 0}
            w={v.w ?? 0}
            scale={scale}
            selected={sel === a.id}
            labels={labels}
            onSelect={() => setSel(a.id)}
            onStartMove={(e) => {
              drag.current = { kind: 'move', id: a.id, sx: e.clientX, sy: e.clientY, x: a.x ?? 0, y: a.y ?? 0 };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onStartSize={(e) => {
              e.stopPropagation();
              drag.current = { kind: 'size', id: a.id, sx: e.clientX, w: a.w ?? MIN_W };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onRatio={(ar) => {
              // A rotated photo has a new height÷width: remember it so the page grows to fit.
              if (a.ar === undefined || Math.abs(a.ar - ar) > 0.01) patch(a.id, { ar: Math.round(ar * 1000) / 1000 });
            }}
            onToggleBehind={() => patch(a.id, { behind: !a.behind })}
            onRemove={() => remove(a)}
          />
        );
      })}
    </>
  );
}

function FloatingImage({
  a,
  x,
  y,
  w,
  scale,
  selected,
  labels,
  onSelect,
  onStartMove,
  onStartSize,
  onPointerMove,
  onPointerUp,
  onRatio,
  onToggleBehind,
  onRemove,
}: {
  a: PageAttachment;
  x: number;
  y: number;
  w: number;
  scale: number;
  selected: boolean;
  labels: Record<string, string>;
  onSelect: () => void;
  onStartMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onStartSize: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onRatio: (ar: number) => void;
  onToggleBehind: () => void;
  onRemove: () => void;
}) {
  const t = (k: string) => labels[k] ?? k;
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [rev, setRev] = useState(0);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState('');
  const [tools, setTools] = useState(false);
  const clicks = useRef({ n: 0, t: 0 });
  useEffect(() => {
    if (!selected) setTools(false);
  }, [selected]);

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void getImage(a.id)
      .then((blob) => {
        if (!alive) return;
        if (!blob) return setMissing(true);
        made = URL.createObjectURL(blob);
        setUrl(made);
        setMissing(false);
      })
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [a.id, rev]);

  const edit = async (fn: (b: Blob) => Promise<Blob>) => {
    setWorking(true);
    setErr('');
    try {
      const blob = await getImage(a.id);
      if (!blob) throw new Error('missing');
      await putImage(a.id, await fn(blob), a.name);
      setRev((r) => r + 1);
    } catch (e) {
      setErr(t(errorKey(e)));
    } finally {
      setWorking(false);
    }
  };

  // A photo "behind the text" sits under the typed text and lets clicks through, so the text on top stays
  // editable. While it is selected it comes to the front so it can be moved and resized; a small chip at its
  // corner (always on top) is how you select it again.
  const behind = !!a.behind;
  const hidden = behind && !selected;
  return (
    <>
    {hidden && (
      <button
        type="button"
        data-img-ui
        aria-label={t('selectPhoto')}
        title={t('selectPhoto')}
        onClick={onSelect}
        className="absolute z-[16] flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white/85 text-gray-600 opacity-60 hover:opacity-100 focus-visible:opacity-100 dark:border-white/20 dark:bg-gray-900/85 dark:text-white/70"
        style={{ left: x * scale + 2, top: y * scale + 2 }}
      >
        <SendToBack size={13} />
      </button>
    )}
    <figure
      data-attach-id={a.id}
      onPointerDown={(e) => {
        if ((e.target as Element).closest('[data-img-ui]')) return;
        const now = Date.now();
        clicks.current.n = now - clicks.current.t > CLICK_WINDOW_MS ? 1 : clicks.current.n + 1;
        clicks.current.t = now;
        if (clicks.current.n >= CLICKS_FOR_TOOLS) {
          clicks.current.n = 0;
          setTools(true);
        }
        onSelect();
        // Selected photos drag right away; an unselected one only selects, so a finger can still scroll the page.
        if (selected) onStartMove(e as unknown as React.PointerEvent<HTMLDivElement>);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute m-0 ${hidden ? 'z-[5] pointer-events-none' : 'z-[15]'}`}
      style={{
        left: x * scale,
        top: y * scale,
        width: w * scale,
        touchAction: selected ? 'none' : 'auto',
        cursor: selected ? 'move' : 'pointer',
      }}
    >
      {missing ? (
        <p className="rounded-lg border border-dashed border-gray-300 dark:border-white/20 bg-white/80 dark:bg-black/40 p-3 text-center text-xs text-gray-500 dark:text-white/50">{t('notHere')}</p>
      ) : url ? (
        <img
          src={url}
          alt={t('imageAlt')}
          draggable={false}
          onLoad={(e) => {
            const im = e.currentTarget;
            if (im.naturalWidth > 0) onRatio(im.naturalHeight / im.naturalWidth);
          }}
          className="block h-auto w-full select-none rounded-sm bg-white shadow-sm"
        />
      ) : (
        <div className="animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" style={{ height: w * scale * (a.ar ?? 0.75) }} />
      )}

      {selected && (
        <>
          <button
            type="button"
            data-img-ui
            aria-label={behind ? t('bringFront') : t('sendBehind')}
            title={behind ? t('bringFront') : t('sendBehind')}
            onClick={onToggleBehind}
            className="absolute -right-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-500 bg-white text-blue-600"
          >
            {behind ? <BringToFront size={13} /> : <SendToBack size={13} />}
          </button>
          <div
            data-img-ui
            onPointerDown={onStartSize}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="absolute -bottom-2.5 -right-2.5 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-blue-500 bg-white"
            style={{ touchAction: 'none' }}
          />
          {tools && <div data-img-ui className="absolute left-0 top-full z-10 mt-2 flex w-max max-w-[90vw] flex-wrap items-center gap-1.5 rounded-xl bg-white/95 dark:bg-gray-900/95 p-1.5 shadow-lg" style={{ fontSize: 12 }}>
            {!missing && (
              <>
                <button type="button" className={BTN} disabled={working} onClick={() => void edit((b) => cropRotateFlip(b, { rotate: 90 }))}>
                  <RotateCw size={14} /> {t('rotate')}
                </button>
                <button type="button" className={BTN} disabled={working} onClick={() => void edit((b) => scanFilter(b, 'bw'))}>
                  {t('scanBw')}
                </button>
                <button type="button" className={BTN} disabled={working} onClick={() => void edit((b) => scanFilter(b, 'gray'))}>
                  {t('scanGray')}
                </button>
                <button type="button" className={BTN} disabled={working} onClick={() => void edit((b) => scanFilter(b, 'boost'))}>
                  {t('scanBoost')}
                </button>
              </>
            )}
            <button type="button" className={BTN} onClick={onRemove} aria-label={t('remove')} title={t('remove')}>
              <Trash2 size={14} />
            </button>
            {err && (
              <span role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
                {err}
              </span>
            )}
          </div>}
        </>
      )}
    </figure>
    </>
  );
}
