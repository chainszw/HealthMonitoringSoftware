import { TONE, type Tone } from '../tone';

// Owner B: 7-day sparkline for a Today vital card. Neutral line on a shaded normal band;
// only the latest point takes a status colour, and only when it is abnormal.

const LINE = 'rgba(233,237,243,0.6)';

export function Sparkline({
  data,
  min,
  max,
  band,
  tone,
}: {
  data: number[];
  min: number;
  max: number;
  band?: [number, number];
  tone: Tone;
}) {
  if (data.length < 2) return null;
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const y = (v: number) => 100 - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100;
  const points = data.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const last = data[data.length - 1];
  return (
    <div className="relative h-full min-h-0 w-full" aria-hidden="true">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        {/* Chart grid: quarter lines across the range, one vertical line per reading. */}
        <g stroke="rgba(233,237,243,0.07)" vectorEffect="non-scaling-stroke">
          {[0, 25, 50, 75, 100].map((p) => (
            <line key={`h${p}`} x1={0} x2={100} y1={p} y2={p} vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((_, i) => (
            <line
              key={`v${i}`}
              x1={x(i)}
              x2={x(i)}
              y1={0}
              y2={100}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        {band && (
          <>
            <rect
              x={0}
              width={100}
              y={y(band[1])}
              height={y(band[0]) - y(band[1])}
              fill="rgba(233,237,243,0.06)"
            />
            {band.map((b) => (
              <line
                key={b}
                x1={0}
                x2={100}
                y1={y(b)}
                y2={y(b)}
                stroke="rgba(233,237,243,0.22)"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </>
        )}
        <polyline
          key={points}
          className="chc-draw"
          points={points}
          fill="none"
          stroke={LINE}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Spikes: earlier readings outside the normal band, marked high (▲) or low (▼). */}
      {band &&
        data.slice(0, -1).map((v, i) => {
          if (v >= band[0] && v <= band[1]) return null;
          const high = v > band[1];
          return (
            <span
              key={`${points}-${i}`}
              className="chc-pop absolute -translate-x-1/2 text-[9px] leading-none text-watch"
              style={{
                left: `${x(i)}%`,
                top: high ? `calc(${y(v)}% - 11px)` : `calc(${y(v)}% + 3px)`,
                ['--d' as string]: `${(0.15 + (x(i) / 100) * 0.9).toFixed(2)}s`,
              }}
            >
              {high ? '▲' : '▼'}
            </span>
          );
        })}
      {/* HTML dot so it stays round when the SVG stretches; it pops in once the line arrives,
          then a ring keeps pulsing from it to mark the live, latest reading. */}
      <span
        key={points}
        className="chc-pop absolute size-2.5 -translate-x-1/2 -translate-y-1/2"
        style={{
          left: '100%',
          top: `${y(last)}%`,
          ['--d' as string]: '1.1s',
        }}
      >
        <span
          className="absolute inset-0 animate-ping rounded-full opacity-60"
          style={{ background: tone === 'normal' ? 'var(--color-accent)' : TONE[tone].hex }}
        />
        <span
          className="absolute inset-0 rounded-full ring-2 ring-surface"
          style={{ background: tone === 'normal' ? 'var(--color-ink)' : TONE[tone].hex }}
        />
      </span>
    </div>
  );
}
