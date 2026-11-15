import { useEffect, useRef } from 'react';
import type { MissionProfileId } from '../lib/types';

// Owner B: faint animated sky behind the app shell. Stars drift slowly; the limb of the
// mission's body (Earth, Moon, Mars) glows at the bottom edge and cross-fades when the
// mission changes. Canvas only, no dependency, still frame with prefers-reduced-motion.
// Keep it dim: status colours (ok/watch/act) must stay the loudest thing on screen.

type RGB = [number, number, number];

/** Canvas needs hex colours. Mars stays browner and dimmer than `act` so it never reads as an alert. */
const MISSION_SKY: Record<
  MissionProfileId,
  { body: string; shade: string; glow: string; glowAlpha: number }
> = {
  iss: { body: '#3b82c4', shade: '#0b1a2e', glow: '#5ab9fc', glowAlpha: 0.32 },
  lunar: { body: '#8e8e93', shade: '#1a1a1c', glow: '#c8c8cc', glowAlpha: 0.08 },
  mars: { body: '#a0674a', shade: '#24140d', glow: '#c08a6a', glowAlpha: 0.16 },
};

const STAR_COUNT = 160;
const LAYERS = [
  { size: 0.7, alpha: 0.28, speed: 2 },
  { size: 1, alpha: 0.45, speed: 4.5 },
  { size: 1.4, alpha: 0.7, speed: 8 },
];
const FADE_SECONDS = 1.2;
const FRAME_MS = 1000 / 30;

interface Star {
  x: number; // 0..1
  y: number; // 0..1
  layer: number;
  phase: number;
  twinkle: number;
}

/** Deterministic PRNG (mulberry32) so the sky is the same on every load. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeStars(): Star[] {
  const r = rng(20261115);
  return Array.from({ length: STAR_COUNT }, () => ({
    x: r(),
    y: r(),
    layer: r() < 0.55 ? 0 : r() < 0.7 ? 1 : 2,
    phase: r() * Math.PI * 2,
    twinkle: 0.4 + r() * 1.2,
  }));
}

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const rgba = (c: RGB, a: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

interface Palette {
  body: RGB;
  shade: RGB;
  glow: RGB;
  glowAlpha: number;
}
const paletteOf = (m: MissionProfileId): Palette => {
  const s = MISSION_SKY[m] ?? MISSION_SKY.iss;
  return { body: hex(s.body), shade: hex(s.shade), glow: hex(s.glow), glowAlpha: s.glowAlpha };
};

export function SpaceBackdrop({ mission }: { mission: MissionProfileId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef<Palette>(paletteOf(mission));

  useEffect(() => {
    targetRef.current = paletteOf(mission);
  }, [mission]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const stars = makeStars();
    const copy = (p: Palette): Palette => ({
      body: [...p.body],
      shade: [...p.shade],
      glow: [...p.glow],
      glowAlpha: p.glowAlpha,
    });
    const current: Palette = copy(targetRef.current);
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    let offset = 0; // star drift in px

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const fade = (dt: number) => {
      const t = Math.min(1, dt / FADE_SECONDS);
      const target = targetRef.current;
      for (const k of ['body', 'shade', 'glow'] as const) {
        for (let i = 0; i < 3; i++) current[k][i] = mix(current[k][i], target[k][i], t * 3);
      }
      current.glowAlpha = mix(current.glowAlpha, target.glowAlpha, t * 3);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Stars, three depth layers drifting left.
      for (const s of stars) {
        const L = LAYERS[s.layer];
        let x = (s.x * w - offset * L.speed) % w;
        if (x < 0) x += w;
        const tw = 0.75 + 0.25 * Math.sin(elapsed * s.twinkle + s.phase);
        ctx.fillStyle = `rgba(245,245,247,${L.alpha * tw})`;
        ctx.beginPath();
        ctx.arc(x, s.y * h, L.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Planet limb: a huge circle whose centre is far below the viewport.
      const R = Math.max(w, h) * 1.6;
      const cx = w / 2;
      const cy = h + R - Math.max(90, h * 0.17);
      // Light source swings slowly so the limb seems to turn.
      const lx = cx + Math.sin(elapsed * 0.03) * R * 0.35;
      const ly = cy - R * 0.9;

      const glow = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.05);
      glow.addColorStop(0, rgba(current.glow, current.glowAlpha));
      glow.addColorStop(1, rgba(current.glow, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2);
      ctx.fill();

      const body = ctx.createRadialGradient(lx, ly, R * 0.05, cx, cy, R);
      body.addColorStop(0, rgba(current.body, 0.34));
      body.addColorStop(0.6, rgba(current.body, 0.16));
      body.addColorStop(1, rgba(current.shade, 0.5));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Thin bright rim along the limb.
      ctx.strokeStyle = rgba(current.glow, current.glowAlpha * 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    };

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) {
        last = now;
        return;
      }
      if (now - last < FRAME_MS) return;
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      elapsed += dt;
      offset += dt;
      fade(dt);
      draw();
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduce.matches) {
        // Still frame; still follow mission changes (checked on a slow timer below).
        Object.assign(current, copy(targetRef.current));
        draw();
      } else {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    // With reduced motion there is no loop, so redraw when the mission changes.
    let shown = targetRef.current;
    const still = setInterval(() => {
      if (reduce.matches && shown !== targetRef.current) {
        shown = targetRef.current;
        start();
      }
    }, 300);

    const onResize = () => {
      resize();
      draw();
    };
    resize();
    start();
    window.addEventListener('resize', onResize);
    reduce.addEventListener('change', start);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(still);
      window.removeEventListener('resize', onResize);
      reduce.removeEventListener('change', start);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
