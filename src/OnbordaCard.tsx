// src/OnbordaCard.tsx
//
// Structurally ported from uixmat/onborda-demo's example CustomCard (MIT
// license) — https://github.com/uixmat/onborda-demo — same layout:
// header (icon + title + step counter + close), content, footer
// (previous / next / finish), arrow at the end. Restyled with this app's
// own black/white Tailwind + dark: convention (matches HintBubble.tsx)
// since shadcn/ui isn't installed here. Dropped: canvas-confetti on
// finish — not an existing dependency, and not essential to the tour
// mechanic itself.

import { X } from 'lucide-react';
import type { CardComponentProps } from './onbordaTypes';

export default function OnbordaCard({ step, currentStep, totalSteps, nextStep, prevStep, skipTour, arrow }: CardComponentProps) {
  return (
    <div className="relative w-[300px] rounded-2xl border border-black/10 dark:border-white/20 bg-white dark:bg-black text-black dark:text-white shadow-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-1.5">
            {step.icon}
            {step.title}
          </div>
          <div className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
            {currentStep + 1} of {totalSteps}
          </div>
        </div>
        <button onClick={skipTour} aria-label="Close tour" className="text-gray-400 dark:text-white/40 hover:text-black dark:hover:text-white transition">
          <X size={16} />
        </button>
      </div>

      <div className="text-sm text-gray-600 dark:text-white/70 leading-relaxed mb-4">{step.content}</div>

      <div className="flex justify-between items-center">
        {currentStep !== 0 ? (
          <button
            onClick={prevStep}
            className="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10 transition"
          >
            Peeche
          </button>
        ) : (
          <span />
        )}
        {currentStep + 1 !== totalSteps ? (
          <button
            onClick={nextStep}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition"
          >
            Aage
          </button>
        ) : (
          <button
            onClick={skipTour}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition"
          >
            Ho gaya
          </button>
        )}
      </div>

      <span className="text-white dark:text-black">{arrow}</span>
    </div>
  );
}
