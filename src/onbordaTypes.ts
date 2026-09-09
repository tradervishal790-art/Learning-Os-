// src/onbordaTypes.ts
//
// Ported from uixmat/onborda (MIT license). Dropped: nextRoute/prevRoute
// (Onborda's Next.js multi-page navigation between steps) — this app is a
// single-page, state-driven dashboard (activePage switches via useState,
// not URL routes), so a step never needs to navigate a route, only to
// point at an element that's already on screen or one click away.

import type { Transition } from 'framer-motion';

export type CardSide =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'left-top'
  | 'left-bottom'
  | 'right-top'
  | 'right-bottom';

export interface TourStep {
  icon?: React.ReactNode | string | null;
  title: string;
  content: React.ReactNode;
  /** CSS selector (usually `#some-id`) of the element this step points at. */
  selector: string;
  side?: CardSide;
  showControls?: boolean;
  pointerPadding?: number;
  pointerRadius?: number;
}

export interface Tour {
  tour: string;
  steps: TourStep[];
}

export interface CardComponentProps {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  arrow: React.JSX.Element;
}

export interface OnbordaProps {
  children: React.ReactNode;
  /** When true, the target element stays clickable during its own step
   *  (elevated above the page-blocking layer) instead of being purely
   *  look-only. */
  interact?: boolean;
  steps: Tour[];
  shadowRgb?: string;
  shadowOpacity?: string;
  cardTransition?: Transition;
  cardComponent: React.ComponentType<CardComponentProps>;
}
