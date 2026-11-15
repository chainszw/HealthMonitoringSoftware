import { CANVAS_CLASS, useCanvasLoop } from './useCanvasLoop';

// Owner B: "Telemetry grid" backdrop. A faint dot grid, a soft scan band moving down the
// screen, and now and then an ECG-like trace running once along a grid row. Not tied to the
// mission. Accent blue only, never a status colour.

const GAP = 28;
const SCAN_SECONDS = 9;
const PULSE_EVERY = 4;
const PULSE_SECONDS = 2.6;
const ACCENT = '90,185,252'; // --color-accent #5ab9fc

/** One heartbeat shape over 0..1 (flat, P, QRS spike, T), height in -1..1. */
function ecg(t: number): number {
  const bump = (c: number, wd: number, a: number) => a * Math.exp(-(((t - c) / wd) ** 2));
  return (
    bump(0.22, 0.03, 0.18) +
    bump(0.38, 0.008, -0.25) +
    bump(0.41, 0.012, 1) +
    bump(0.44, 0.01, -0.35) +
    bump(0.64, 0.05, 0.3)
  );
}

export function GridBackdrop() {
  const canvasRef = useCanvasLoop(() => {
    let elapsed = 0;
    let pulseStart = -PULSE_EVERY;
    let pulseRow = 0;
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    return (ctx, w, h, dt, still) => {
      elapsed += dt;
      ctx.clearRect(0, 0, w, h);
      const scanY = still ? h * 0.35 : ((elapsed % SCAN_SECONDS) / SCAN_SECONDS) * (h + 240) - 120;

      // Scan band.
      const band = ctx.createLinearGradient(0, scanY - 120, 0, scanY + 120);
      band.addColorStop(0, `rgba(${ACCENT},0)`);
      band.addColorStop(0.5, `rgba(${ACCENT},0.1)`);
      band.addColorStop(1, `rgba(${ACCENT},0)`);
      ctx.fillStyle = band;
      ctx.fillRect(0, scanY - 120, w, 240);

      // Dot grid; dots near the band brighten.
      const ox = (w % GAP) / 2;
      const oy = (h % GAP) / 2;
      for (let y = oy; y < h; y += GAP) {
        const near = Math.max(0, 1 - Math.abs(y - scanY) / 120);
        ctx.fillStyle = `rgba(245,245,247,${0.14 + near * 0.22})`;
        for (let x = ox; x < w; x += GAP) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
      }

      // ECG trace along one row, every few seconds.
      if (still) return;
      if (elapsed - pulseStart > PULSE_EVERY) {
        pulseStart = elapsed;
        const rows = Math.max(1, Math.floor(h / GAP));
        pulseRow = oy + Math.floor(rand() * rows) * GAP;
      }
      const p = (elapsed - pulseStart) / PULSE_SECONDS;
      if (p > 1.4) return;
      const head = p * w;
      const tail = head - w * 0.35;
      ctx.lineWidth = 1.25;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let x = Math.max(0, tail); x <= Math.min(w, head); x += 3) {
        const beatX = (x % 360) / 360;
        const y = pulseRow - ecg(beatX) * GAP * 1.4;
        if (x === Math.max(0, tail)) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const fadeOut = Math.max(0, Math.min(1, (1.4 - p) / 0.4));
      const grad = ctx.createLinearGradient(tail, 0, head, 0);
      grad.addColorStop(0, `rgba(${ACCENT},0)`);
      grad.addColorStop(1, `rgba(${ACCENT},${0.35 * fadeOut})`);
      ctx.strokeStyle = grad;
      ctx.stroke();
    };
  });

  return <canvas ref={canvasRef} aria-hidden="true" className={CANVAS_CLASS} />;
}
