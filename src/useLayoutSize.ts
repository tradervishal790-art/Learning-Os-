import { useEffect, useLayoutEffect, useState } from 'react';

/** Width / height of an element (CSS px), kept up to date. */
export function useElementSize(el: HTMLElement | null): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const measure = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return size;
}

/**
 * Make `el` as tall as the space below it on screen (minus `bottomPad`), so it can scroll on its own.
 * Re-measured on every render of the caller and when the window / on-screen keyboard resizes.
 */
export function useFillHeight(el: HTMLElement | null, bottomPad: number, minHeight = 320): void {
  useLayoutEffect(() => {
    if (!el) return;
    const apply = () => {
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const top = el.getBoundingClientRect().top;
      el.style.height = `${Math.max(minHeight, Math.floor(viewport - top - bottomPad))}px`;
    };
    apply();
    window.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('resize', apply);
    };
  });
}
