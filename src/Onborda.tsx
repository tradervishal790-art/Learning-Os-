// src/Onborda.tsx
//
// Ported from uixmat/onborda (MIT license) — https://github.com/uixmat/onborda
// (1.3k-star, framer-motion-based spotlight tour library for React).
//
// WHAT'S IDENTICAL to the original: the spotlight technique itself — a div
// sized exactly to the target element, given
//   boxShadow: `0 0 200vw 200vh rgba(${shadowRgb}, ${shadowOpacity})`
// which paints a dark fill everywhere OUTSIDE that div's own box out to
// 200 viewport-widths/heights in every direction, i.e. the entire screen —
// while the box's own interior stays a clear "hole". No SVG mask needed.
// The target element itself gets `position: relative` (+ `z-index: 990`
// when `interact` is on) so it sits above a full-screen invisible blocking
// div, which is what makes every OTHER control on the page inert while a
// step is active. framer-motion animates that spotlight box's x/y/width/
// height smoothly between each step's target — that glide IS the "moving
// pointer" effect. Card/arrow positioning math (getCardStyle/getArrowStyle)
// is copied as-is; it's generic geometry, not app-specific.
//
// WHAT'S ADAPTED for this app: Onborda is built for Next.js and can
// navigate between ROUTES between steps (`nextRoute`/`prevRoute`, via
// `next/navigation`'s router + a MutationObserver waiting for the new
// page's target element to mount). This app is a single-page dashboard —
// `activePage` is React state, not a URL — so there's no route to push;
// a step just points at whatever's on screen (or about to be, once a
// step's onBeforeStep callback flips `activePage`, see onbordaTypes.ts).
// Also swapped `@radix-ui/react-portal` (not a dependency here) for
// React DOM's built-in `createPortal`, which does the same job.

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useInView } from 'framer-motion';
import { useOnborda } from './OnbordaContext';
import type { OnbordaProps, CardSide } from './onbordaTypes';

const Onborda: React.FC<OnbordaProps> = ({
  children,
  interact = false,
  steps,
  shadowRgb = '0, 0, 0',
  shadowOpacity = '0.65',
  cardTransition = { ease: 'anticipate', duration: 0.6 },
  cardComponent: CardComponent,
}) => {
  const { currentTour, currentStep, setCurrentStep, closeOnborda, isOnbordaVisible } = useOnborda();
  const currentTourSteps = steps.find((tour) => tour.tour === currentTour)?.steps;

  const [elementToScroll, setElementToScroll] = useState<Element | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const currentElementRef = useRef<Element | null>(null);
  const observeRef = useRef(null);
  const isInView = useInView(observeRef);
  const offset = 20;

  const getElementPosition = (element: Element) => {
    const { top, left, width, height } = element.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    return { x: left + scrollLeft, y: top + scrollTop, width, height };
  };

  useEffect(() => {
    if (isOnbordaVisible && currentTourSteps) {
      currentTourSteps.forEach((tourStep) => {
        const element = document.querySelector(tourStep.selector) as HTMLElement | null;
        if (element && tourStep !== currentTourSteps[currentStep] && interact) {
          element.style.position = '';
          element.style.zIndex = '';
        }
      });

      const step = currentTourSteps[currentStep];
      if (step) {
        const element = document.querySelector(step.selector) as Element | null;
        if (element) {
          (element as HTMLElement).style.position = 'relative';
          if (interact) (element as HTMLElement).style.zIndex = '990';

          setPointerPosition(getElementPosition(element));
          currentElementRef.current = element;
          setElementToScroll(element);

          const rect = element.getBoundingClientRect();
          const isInViewportWithOffset = rect.top >= -offset && rect.bottom <= window.innerHeight + offset;
          if (!isInView || !isInViewportWithOffset) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => setPointerPosition(getElementPosition(element)), 500);
          }
        }
      }
    }

    return () => {
      if (currentTourSteps) {
        currentTourSteps.forEach((step) => {
          const element = document.querySelector(step.selector) as HTMLElement | null;
          if (element && interact) {
            element.style.position = '';
            element.style.zIndex = '';
          }
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, currentTourSteps, isInView, isOnbordaVisible, interact]);

  useEffect(() => {
    if (elementToScroll && !isInView && isOnbordaVisible) {
      elementToScroll.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [elementToScroll, isInView, isOnbordaVisible]);

  const updatePointerPosition = () => {
    if (currentTourSteps) {
      const step = currentTourSteps[currentStep];
      if (step) {
        const element = document.querySelector(step.selector) as Element | null;
        if (element) setPointerPosition(getElementPosition(element));
      }
    }
  };

  useEffect(() => {
    if (!isOnbordaVisible) return;
    window.addEventListener('resize', updatePointerPosition);

    let debounceTimer: ReturnType<typeof setTimeout>;
    const handleScrollEnd = () => updatePointerPosition();
    const handleScroll = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updatePointerPosition, 150);
    };
    const supportsScrollEnd = 'onscrollend' in window;
    if (supportsScrollEnd) window.addEventListener('scrollend', handleScrollEnd);
    else window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', updatePointerPosition);
      if (supportsScrollEnd) window.removeEventListener('scrollend', handleScrollEnd);
      else {
        window.removeEventListener('scroll', handleScroll);
        clearTimeout(debounceTimer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, currentTourSteps, isOnbordaVisible]);

  const scrollToElement = (stepIndex: number) => {
    if (!currentTourSteps) return;
    const element = document.querySelector(currentTourSteps[stepIndex].selector) as Element | null;
    if (!element) return;
    const { top } = element.getBoundingClientRect();
    const isInViewport = top >= -offset && top <= window.innerHeight + offset;
    if (!isInViewport) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setPointerPosition(getElementPosition(element)), 500);
    } else {
      setPointerPosition(getElementPosition(element));
    }
  };

  // No route navigation here (see file header) — a step just moves to the
  // next/previous selector already reachable on screen.
  const nextStep = () => {
    if (currentTourSteps && currentStep < currentTourSteps.length - 1) {
      const nextStepIndex = currentStep + 1;
      setCurrentStep(nextStepIndex);
      scrollToElement(nextStepIndex);
    } else {
      closeOnborda();
    }
  };

  const prevStep = () => {
    if (currentTourSteps && currentStep > 0) {
      const prevStepIndex = currentStep - 1;
      setCurrentStep(prevStepIndex);
      scrollToElement(prevStepIndex);
    }
  };

  const getCardStyle = (side?: CardSide): React.CSSProperties => {
    switch (side) {
      case 'top':
        return { transform: 'translate(-50%, 0)', left: '50%', bottom: '100%', marginBottom: '25px' };
      case 'bottom':
        return { transform: 'translate(-50%, 0)', left: '50%', top: '100%', marginTop: '25px' };
      case 'left':
        return { transform: 'translate(0, -50%)', right: '100%', top: '50%', marginRight: '25px' };
      case 'right':
        return { transform: 'translate(0, -50%)', left: '100%', top: '50%', marginLeft: '25px' };
      case 'top-left':
        return { bottom: '100%', marginBottom: '25px' };
      case 'top-right':
        return { right: 0, bottom: '100%', marginBottom: '25px' };
      case 'bottom-left':
        return { top: '100%', marginTop: '25px' };
      case 'bottom-right':
        return { right: 0, top: '100%', marginTop: '25px' };
      case 'right-bottom':
        return { left: '100%', bottom: 0, marginLeft: '25px' };
      case 'right-top':
        return { left: '100%', top: 0, marginLeft: '25px' };
      case 'left-bottom':
        return { right: '100%', bottom: 0, marginRight: '25px' };
      case 'left-top':
        return { right: '100%', top: 0, marginRight: '25px' };
      default:
        return {};
    }
  };

  const getArrowStyle = (side?: CardSide): React.CSSProperties => {
    switch (side) {
      case 'bottom':
        return { transform: 'translate(-50%, 0) rotate(270deg)', left: '50%', top: '-23px' };
      case 'top':
        return { transform: 'translate(-50%, 0) rotate(90deg)', left: '50%', bottom: '-23px' };
      case 'right':
        return { transform: 'translate(0, -50%) rotate(180deg)', top: '50%', left: '-23px' };
      case 'left':
        return { transform: 'translate(0, -50%) rotate(0deg)', top: '50%', right: '-23px' };
      case 'top-left':
        return { transform: 'rotate(90deg)', left: '10px', bottom: '-23px' };
      case 'top-right':
        return { transform: 'rotate(90deg)', right: '10px', bottom: '-23px' };
      case 'bottom-left':
        return { transform: 'rotate(270deg)', left: '10px', top: '-23px' };
      case 'bottom-right':
        return { transform: 'rotate(270deg)', right: '10px', top: '-23px' };
      case 'right-bottom':
        return { transform: 'rotate(180deg)', left: '-23px', bottom: '10px' };
      case 'right-top':
        return { transform: 'rotate(180deg)', left: '-23px', top: '10px' };
      case 'left-bottom':
        return { transform: 'rotate(0deg)', right: '-23px', bottom: '10px' };
      case 'left-top':
        return { transform: 'rotate(0deg)', right: '-23px', top: '10px' };
      default:
        return {};
    }
  };

  const CardArrow = () => (
    <svg
      viewBox="0 0 54 54"
      className="absolute w-6 h-6 origin-center"
      style={getArrowStyle(currentTourSteps?.[currentStep]?.side)}
    >
      <path d="M27 27L0 0V54L27 27Z" fill="currentColor" />
    </svg>
  );

  const variants = { visible: { opacity: 1 }, hidden: { opacity: 0 } };

  const pointerPadding = currentTourSteps?.[currentStep]?.pointerPadding ?? 12;
  const pointerPadOffset = pointerPadding / 2;
  const pointerRadius = currentTourSteps?.[currentStep]?.pointerRadius ?? 16;

  return (
    <div className="relative w-full">
      <div className="block w-full">{children}</div>

      {pointerPosition &&
        isOnbordaVisible &&
        currentTourSteps &&
        createPortal(
          <>
            {!interact && <div className="fixed inset-0 z-[900]" />}
            <motion.div
              className="absolute inset-0"
              initial="hidden"
              animate={isOnbordaVisible ? 'visible' : 'hidden'}
              variants={variants}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="relative z-[900]"
                style={{
                  boxShadow: `0 0 200vw 200vh rgba(${shadowRgb}, ${shadowOpacity})`,
                  borderRadius: `${pointerRadius}px`,
                }}
                initial={{
                  x: pointerPosition.x - pointerPadOffset,
                  y: pointerPosition.y - pointerPadOffset,
                  width: pointerPosition.width + pointerPadding,
                  height: pointerPosition.height + pointerPadding,
                }}
                animate={{
                  x: pointerPosition.x - pointerPadOffset,
                  y: pointerPosition.y - pointerPadOffset,
                  width: pointerPosition.width + pointerPadding,
                  height: pointerPosition.height + pointerPadding,
                }}
                transition={cardTransition}
              >
                <div
                  className="absolute flex flex-col max-w-[100%] min-w-min pointer-events-auto z-[950]"
                  style={getCardStyle(currentTourSteps[currentStep]?.side)}
                >
                  <CardComponent
                    step={currentTourSteps[currentStep]}
                    currentStep={currentStep}
                    totalSteps={currentTourSteps.length}
                    nextStep={nextStep}
                    prevStep={prevStep}
                    skipTour={closeOnborda}
                    arrow={<CardArrow />}
                  />
                </div>
              </motion.div>
            </motion.div>
          </>,
          document.body
        )}
    </div>
  );
};

export default Onborda;
