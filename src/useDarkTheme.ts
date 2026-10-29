import { useSyncExternalStore } from 'react';

// ============================================================
// useDarkTheme — true while the app is in dark mode, and re-renders the component when the student switches
// theme. Colour dots / stroke samples that depend on it used to read the theme once and stayed in the old colour.
// ============================================================
const subscribe = (onChange: () => void): (() => void) => {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => mo.disconnect();
};
const snapshot = (): boolean => document.documentElement.classList.contains('dark');

export function useDarkTheme(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
