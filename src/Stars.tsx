import { useEffect, useRef } from 'react';

interface Star {
  angle: number;      // current angle around the center (radians)
  radius: number;     // distance from center
  orbitSpeed: number; // how fast this star orbits — smaller radius = faster (like a galaxy)
  size: number;
  opacity: number;
}

export default function Stars() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Draw in CSS pixels, back the canvas with device pixels (capped at 2x) so stars stay
    // sharp on phones without paying for a 3x canvas.
    let cssW = 0;
    let cssH = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = canvas.clientWidth || window.innerWidth;
      cssH = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const maxRadius = () => Math.hypot(cssW, cssH) / 2;

    // Phones get fewer stars: same look, far less per-frame work.
    const count = cssW < 640 ? 140 : 300;
    const stars: Star[] = Array.from({ length: count }, () => {
      const radius = Math.random() * maxRadius();
      return {
        angle: Math.random() * Math.PI * 2,
        radius,
        // Inner stars orbit faster than outer ones — mimics a spinning
        // galaxy / vortex rather than a flat uniform rotation.
        orbitSpeed: (0.0006 + Math.random() * 0.0008) * (1 - radius / maxRadius() + 0.3),
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.7 + 0.3,
      };
    });

    let time = 0;
    let frameId = 0;
    const draw = (advance: boolean) => {
      ctx.clearRect(0, 0, cssW, cssH);
      if (advance) time += 0.01;

      const centerX = cssW / 2;
      const centerY = cssH / 2;

      stars.forEach((star) => {
        if (advance) star.angle += star.orbitSpeed;

        const x = centerX + Math.cos(star.angle) * star.radius;
        const y = centerY + Math.sin(star.angle) * star.radius;

        const twinkle = Math.sin(time + star.angle * 10) * 0.3 + 0.7;

        ctx.beginPath();
        ctx.arc(x, y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 200, 255, ${star.opacity * twinkle})`;
        ctx.fill();
      });
    };

    const loop = () => {
      frameId = requestAnimationFrame(loop);
      draw(true);
    };
    const start = () => {
      if (reduceMotion || frameId) return;
      frameId = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
    };

    // Reduced motion: one still frame. Otherwise animate, but not while the tab is in the background.
    draw(false);
    start();

    const onResize = () => {
      resize();
      if (reduceMotion || !frameId) draw(false);
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />;
}
