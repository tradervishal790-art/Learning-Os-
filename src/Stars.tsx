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

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const maxRadius = () => Math.hypot(canvas.width, canvas.height) / 2;

    const stars: Star[] = Array.from({ length: 300 }, () => {
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
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.01;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      stars.forEach((star) => {
        star.angle += star.orbitSpeed;

        const x = centerX + Math.cos(star.angle) * star.radius;
        const y = centerY + Math.sin(star.angle) * star.radius;

        const twinkle = Math.sin(time + star.angle * 10) * 0.3 + 0.7;

        ctx.beginPath();
        ctx.arc(x, y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 200, 255, ${star.opacity * twinkle})`;
        ctx.fill();
      });
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />;
}