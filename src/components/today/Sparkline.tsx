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
          points={points}
          fill="none"
          stroke={LINE}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* HTML dot so it stays round when the SVG stretches. */}
      <span
        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
        style={{
          left: '100%',
          top: `${y(last)}%`,
          background: tone === 'normal' ? 'var(--color-ink)' : TONE[tone].hex,
        }}
      />
    </div>
  );
}
