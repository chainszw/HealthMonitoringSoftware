import { useEffect, useRef } from 'react';
import type { MissionProfileId } from '../../lib/types';

// Owner B: "Aurora" backdrop. Three large blurred colour fields drift slowly; their colours
// follow the mission. Plain elements animated with the Web Animations API (no keyframes in
// index.css, no dependency); still with prefers-reduced-motion. Mars stays dimmer than `act`.

const AURORA: Record<MissionProfileId, [string, string, string]> = {
  iss: ['rgba(56,189,190,0.16)', 'rgba(59,130,196,0.18)', 'rgba(90,185,252,0.10)'],
  lunar: ['rgba(142,142,147,0.12)', 'rgba(99,102,170,0.14)', 'rgba(200,200,204,0.07)'],
  mars: ['rgba(160,103,74,0.16)', 'rgba(176,132,70,0.12)', 'rgba(120,80,64,0.14)'],
};

const BLOBS = [
  {
    pos: 'left-[-15%] top-[-20%] h-[70vh] w-[70vw]',
    path: [
      [0, 0],
      [12, 8],
      [-6, 14],
    ],
    s: 52,
  },
  {
    pos: 'right-[-20%] top-[20%] h-[80vh] w-[60vw]',
    path: [
      [0, 0],
      [-10, -12],
      [-4, 10],
    ],
    s: 61,
  },
  {
    pos: 'bottom-[-30%] left-[20%] h-[70vh] w-[70vw]',
    path: [
      [0, 0],
      [8, -10],
      [-12, -4],
    ],
    s: 44,
  },
];

export function AuroraBackdrop({ mission }: { mission: MissionProfileId }) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const colors = AURORA[mission] ?? AURORA.iss;

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let anims: Animation[] = [];
    const start = () => {
      anims.forEach((a) => a.cancel());
      anims = [];
      if (reduce.matches) return;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const b = BLOBS[i];
        const frames = [...b.path, b.path[0]].map(([x, y], k) => ({
          transform: `translate(${x}vw, ${y}vh) scale(${k % 2 ? 1.12 : 1})`,
        }));
        anims.push(
          el.animate(frames, { duration: b.s * 1000, iterations: Infinity, easing: 'ease-in-out' }),
        );
      });
    };
    start();
    reduce.addEventListener('change', start);
    return () => {
      anims.forEach((a) => a.cancel());
      reduce.removeEventListener('change', start);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {BLOBS.map((b, i) => (
        <div
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`absolute rounded-full blur-3xl transition-colors duration-[1200ms] ${b.pos}`}
          style={{ backgroundColor: colors[i] }}
        />
      ))}
    </div>
  );
}
