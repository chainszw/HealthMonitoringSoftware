import { useEffect, useRef } from 'react';

// Owner B: the calm blue background. A grid of soft dots that slowly "breathes": a gentle wave
// rolls out from the centre (dots swell and brighten as it passes), the field drifts a little,
// and dots near the pointer light up. Flat colours (no gradients), ~30 fps. With
// prefers-reduced-motion it draws one still frame.

const GAP = 28;
const DOT = '107,188,255';

export function CalmDots({ opacity = 1 }: { opacity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let w = 0;
    let h = 0;
    let mx = -9999;
    let my = -9999;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const ox = (Math.sin(t * 0.05) * GAP) / 2;
      const oy = (Math.cos(t * 0.04) * GAP) / 2;
      for (let y = -GAP; y < h + GAP; y += GAP) {
        for (let x = -GAP; x < w + GAP; x += GAP) {
          const px = x + ox;
          const py = y + oy;
          const d = Math.hypot(px - cx, py - cy);
          // Breathing wave: slow (about 8 s per breath), rolling outward from the centre.
          const wave = (Math.sin(d / 120 - t * 0.8) + 1) / 2;
          const near = Math.max(0, 1 - Math.hypot(px - mx, py - my) / 140);
          const r = 1.1 + wave * 1.3 + near * 2.2;
          const a = 0.12 + wave * 0.22 + near * 0.45;
          ctx.fillStyle = `rgba(${DOT},${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    resize();
    draw(0);
    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now() / 1000);
    });
    ro.observe(canvas);
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };
    const onLeave = () => {
      mx = -9999;
      my = -9999;
    };
    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
    let raf = 0;
    let lastDraw = 0;
    const loop = (now: number) => {
      if (now - lastDraw > 33) {
        draw(now / 1000);
        lastDraw = now;
      }
      raf = requestAnimationFrame(loop);
    };
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-[1] size-full"
      style={{ opacity }}
    />
  );
}
