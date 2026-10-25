import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import PageBackground from './PageBackground';
import { PAGE_RATIO } from './inkEngine';
import { PAGE_TEMPLATES, PAPER_COLORS, paperColor, type PageTemplateId } from './pageTemplates';

// ============================================================
// PageTemplatePicker.tsx — "Add page" dialog: pick a paper type (blank, lined,
// grid, dotted, ...) and a paper colour. Each card is a live preview drawn by
// PageBackground, so what you see is exactly what the page will look like.
// ============================================================

const PREVIEW_W = 84;
const PREVIEW_H = Math.round(PREVIEW_W * PAGE_RATIO);
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white';

export interface PageTemplatePickerLabels {
  title: string;
  paper: string;
  close: string;
  templates: Record<PageTemplateId, string>;
}

export default function PageTemplatePicker({
  labels, dark, onPick, onClose,
}: {
  labels: PageTemplatePickerLabels;
  dark: boolean;
  onPick: (template: PageTemplateId, paper: string) => void;
  onClose: () => void;
}) {
  const [paper, setPaper] = useState('white');
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{labels.title}</h2>
          <button
            type="button"
            aria-label={labels.close}
            title={labels.close}
            onClick={onClose}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 ${FOCUS}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div role="group" aria-label={labels.paper} className="flex flex-wrap items-center gap-2 px-4 pb-3">
          {PAPER_COLORS.map((c, n) => {
            const on = paper === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={`${labels.paper} ${n + 1}`}
                aria-pressed={on}
                onClick={() => setPaper(c.id)}
                className={`h-8 w-8 rounded-full border ${FOCUS} ${on ? 'ring-2 ring-black dark:ring-white ring-offset-1' : 'border-gray-300 dark:border-white/30'}`}
                style={{ background: paperColor(c.id, dark) }}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-3 overflow-y-auto px-4 pb-4 sm:grid-cols-4">
          {PAGE_TEMPLATES.map((t, i) => (
            <button
              key={t.id}
              ref={i === 0 ? first : undefined}
              type="button"
              onClick={() => onPick(t.id, paper)}
              className={`flex flex-col items-center gap-1.5 rounded-xl p-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/10 ${FOCUS}`}
            >
              <span
                className="relative block overflow-hidden rounded-md border border-gray-300 dark:border-white/20"
                style={{ width: PREVIEW_W, height: PREVIEW_H }}
              >
                {/* drawn 3x bigger and cropped to the top-left corner, so the lines are readable at card size;
                    Cornell is a whole-page layout, so it is drawn at 1x */}
                <PageBackground
                  template={t.id}
                  paper={paper}
                  width={PREVIEW_W * (t.id === 'cornell' ? 1 : 3)}
                  height={PREVIEW_H * (t.id === 'cornell' ? 1 : 3)}
                  dark={dark}
                />
              </span>
              <span className="text-center leading-tight">{labels.templates[t.id]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
