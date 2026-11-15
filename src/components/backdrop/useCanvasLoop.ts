import { useEffect, useRef } from 'react';

/**
 * Draws one frame. `dt` is seconds since the last frame (0 on the first or a still frame);
 * `still` is true when motion is reduced, so the scene should snap to its final state.
 */
export type Frame = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dt: number,
  still: boolean,
) => void;

const FRAME_MS = 1000 / 30;

/**
 * Shared loop for the canvas backdrops: dpr capped at 2, 30 fps, pauses in hidden tabs, and a
 * single still frame with prefers-reduced-motion. `makeFrame` runs once on mount and keeps its
 * own state; with reduced motion, a change of `redrawKey` draws one new still frame.
 */
export function useCanvasLoop(makeFrame: () => Frame, redrawKey?: unknown) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const makeRef = useRef(makeFrame);
  const redrawRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const frame = makeRef.current();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) {
        last = now;
        return;
      }
      if (now - last < FRAME_MS) return;
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      frame(ctx, w, h, dt, false);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduce.matches) frame(ctx, w, h, 0, true);
      else {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    const onResize = () => {
      resize();
      frame(ctx, w, h, 0, reduce.matches);
    };
    redrawRef.current = () => {
      if (reduce.matches) frame(ctx, w, h, 0, true);
    };

    resize();
    start();
    window.addEventListener('resize', onResize);
    reduce.addEventListener('change', start);
    return () => {
      cancelAnimationFrame(raf);
      redrawRef.current = () => {};
      window.removeEventListener('resize', onResize);
      reduce.removeEventListener('change', start);
    };
  }, []);

  useEffect(() => {
    redrawRef.current();
  }, [redrawKey]);

  return canvasRef;
}

export const CANVAS_CLASS = 'pointer-events-none fixed inset-0 -z-10 h-full w-full';
