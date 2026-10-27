import { useState } from 'react';
import { Lightbulb, X } from 'lucide-react';

interface HintBubbleProps {
  id: string;
  text: string;
}

/** Small, dismissible contextual hint shared by learning flows. */
export default function HintBubble({ id, text }: HintBubbleProps) {
  const [visible, setVisible] = useState(true);

  if (!text.trim() || !visible) return null;

  return (
    <aside
      id={`hint-${id}`}
      role="note"
      className="my-3 flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-300/15 dark:bg-amber-300/[0.06] dark:text-amber-100"
    >
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
      <p className="min-w-0 flex-1 leading-relaxed">{text}</p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss hint"
        className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-amber-800/70 transition hover:bg-amber-200/70 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-amber-100/70 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </aside>
  );
}
