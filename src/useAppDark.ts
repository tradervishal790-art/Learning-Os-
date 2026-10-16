import { useEffect, useState } from 'react';

const isDark = () => document.documentElement.classList.contains('dark');

/** True while the app is in dark theme (follows the `dark` class on <html>). */
export function useAppDark(): boolean {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(isDark()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}
