import { useState } from 'react';
import { shouldShowHint, markHintSeen, skipAllHints } from './hintsStore';

// ============================================================
// HintBubble.tsx
//
// Drop this into any section with a stable `id`:
//   <HintBubble id="roadmap" text="..." />
//
// Shows once (first time that id is reached), then never again for that
// id. Every bubble also carries a "Skip tour" button that hides ALL
// remaining hints app-wide — not just this one — for learners who don't
// want the guidance at all.
//
// Static text only — zero AI calls, zero ongoing cost.
// ============================================================

interface HintBubbleProps {
  id: string;
  text: string;
}

export default function HintBubble({ id, text }: HintBubbleProps) {
  // Read once per mount — good enough here, since a hint only needs to
  // decide "show or not" a single time when its section first renders.
  const [visible, setVisible] = useState(() => shouldShowHint(id));

  if (!visible) return null;

  const dismiss = () => {
    markHintSeen(id);
    setVisible(false);
  };

  const skipTour = () => {
    skipAllHints();
    setVisible(false);
  };

  return (
    <div className="flex items-start gap-2 p-3 mb-3 rounded-xl border border-gray-200 dark:border-white/20 bg-gray-50 dark:bg-white/5">
      <span className="text-base leading-none mt-0.5">💡</span>
      <p className="flex-1 text-sm text-black dark:text-white leading-relaxed">{text}</p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={dismiss}
          className="text-xs text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 transition"
        >
          Got it
        </button>
        <button
          onClick={skipTour}
          className="text-xs text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 transition underline"
        >
          Skip tour
        </button>
      </div>
    </div>
  );
}
