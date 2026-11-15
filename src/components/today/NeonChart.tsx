import { useEffect, useRef } from 'react';

// Owner B: a flowing chart (canvas) on a faint grid panel: a flat normal band with dashed edges,
// a soft line (status colour when abnormal),
// ▲/▼ markers on readings outside the band, and a pulsing latest point.
//  - Streaming (`tickAt` set, demo mode): the line slides left smoothly as each new point arrives.
//  - Otherwise (real data): the values stay put; light dashes flow along the line and a cursor
//    sweeps across, so the chart still moves without changing the data.

interface Props {
  data: number[];
  min: number;
  max: number;
  band?: [number, number];
  /** Line colour (status colour when abnormal). */
  color: string;
  /** performance.now() of the latest streamed point; enables the sliding stream. */
  tickAt?: number;
  label: string;
}

// Kept in sync with TONE (tone.ts) / index.css.
const ACCENT = '#5ab9fc';
const WATCH = '#fbbf4a';
const ACT = '#ff8a8a';
const GRID = 'rgba(233,237,243,0.06)';
const TICK_MS = 1000;

export function NeonChart({ data, min, max, band, color, tickAt, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const props = useRef({ data, min, max, band, color, tickAt });

  useEffect(() => {
    props.current = { data, min, max, band, color, tickAt };
  }, [data, min, max, band, color, tickAt]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = (now: number) => {
      const { data: d, min: lo, max: hi, band: b, color: c, tickAt: t } = props.current;
      ctx.clearRect(0, 0, w, h);
      if (d.length < 2 || w < 4 || h < 4) return;
      const pad = 8;
      const y = (v: number) =>
        pad + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * (h - pad * 2);
      const streaming = t !== undefined;
      const step = w / (d.length - (streaming ? 2 : 1));
      const frac = streaming && !reduce ? Math.min(1, (now - t) / TICK_MS) : 0;
      const x = (i: number) => (i - frac) * step;

      // Grid: faint square cells (flat 1px lines).
      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const cell = Math.max(16, (h - pad * 2) / 3);
      for (let gy = pad; gy <= h; gy += cell) {
        ctx.moveTo(0, Math.round(gy) + 0.5);
        ctx.lineTo(w, Math.round(gy) + 0.5);
      }
      for (let gx = w; gx >= 0; gx -= cell) {
        ctx.moveTo(Math.round(gx) + 0.5, 0);
        ctx.lineTo(Math.round(gx) + 0.5, h);
      }
      ctx.stroke();

      // Normal band: flat fill + dashed edges.
      if (b) {
        ctx.fillStyle = 'rgba(233,237,243,0.035)';
        ctx.fillRect(0, y(b[1]), w, y(b[0]) - y(b[1]));
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(233,237,243,0.22)';
        ctx.beginPath();
        for (const e of b) {
          ctx.moveTo(0, Math.round(y(e)) + 0.5);
          ctx.lineTo(w, Math.round(y(e)) + 0.5);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // The line: a faint halo under a crisp 2px core.
      const path = () => {
        ctx.beginPath();
        d.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
      };
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      path();
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.12;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Flowing dashes along the line (real data mode).
      if (!streaming && !reduce) {
        path();
        ctx.setLineDash([2, 14]);
        ctx.lineDashOffset = -((now / 40) % 16);
        ctx.strokeStyle = 'rgba(233,237,243,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Spikes outside the band.
      if (b) {
        ctx.font = '10px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        d.forEach((v, i) => {
          if (v >= b[0] && v <= b[1]) return;
          const high = v > b[1];
          // Only the tips: a local peak above the band or a local dip below it.
          const prev = d[i - 1] ?? v;
          const next = d[i + 1] ?? v;
          if (high ? v < prev || v < next : v > prev || v > next) return;
          ctx.fillStyle = high ? WATCH : ACT;
          ctx.fillText(high ? '▲' : '▼', x(i), high ? y(v) - 6 : y(v) + 14);
        });
      }

      // Latest point, pulsing.
      const lx = x(d.length - 1);
      const ly = y(d[d.length - 1]);
      const pulse = reduce ? 0 : (Math.sin(now / 220) + 1) / 2;
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.25 + 0.25 * pulse;
      ctx.beginPath();
      ctx.arc(lx, ly, 6 + 4 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(lx, ly, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Sweeping cursor (real data mode).
      if (!streaming && !reduce) {
        const sx = ((now / 4000) % 1) * w;
        ctx.fillStyle = ACCENT;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(Math.round(sx), 0, 1, h);
        ctx.globalAlpha = 1;
      }
    };

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    if (reduce) draw(performance.now());
    else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className="block size-full rounded-lg border border-line bg-sunk/70"
    />
  );
}
