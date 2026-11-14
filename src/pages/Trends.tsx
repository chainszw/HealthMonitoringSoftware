import { useState } from 'react';
import { Link, useOutletContext } from 'react-router';
import { IconCheckCircle, IconPlus } from '../components/icons';
import { btn, ROW, TONE, type Tone } from '../components/tone';
import { PageTitle, Panel, StatusIcon, StatusPill } from '../components/ui';
import type { MissionProfileId } from '../lib/types';
import { MISSIONS, TREND_DATA, TREND_KEYS, TREND_NOTES, TRENDS, type TrendKey } from './designMock';

// Owner B: "04 · Trends" from the design canvas. Lazy-loaded route.
// LAYOUT TEST: 90 days of deterministic mock data; not connected to storage.

type Point = { i: number; day: number; tone: Tone; value: string; x: number; y: number };

function geometry(k: TrendKey, n: number) {
  const c = TRENDS[k];
  const start = 90 - n;
  const days = TREND_DATA.days.slice(start);
  const series = c.series.map((s) => s.slice(start));
  const xPct = (i: number) => ((i + 0.5) / n) * 100;
  const yPct = (v: number) => ((c.max - v) / (c.max - c.min)) * 100;
  const pts = series.map((ser) =>
    ser
      .map((v, i) => (v == null ? null : `${(xPct(i) * 10).toFixed(1)},${yPct(v).toFixed(2)}`))
      .filter(Boolean)
      .join(' '),
  );
  const bandPath = c.ranges
    .map(([lo, hi]) => `M0 ${yPct(hi).toFixed(2)}H1000V${yPct(lo).toFixed(2)}H0Z`)
    .join(' ');
  const edgePath = c.ranges
    .map(([lo, hi]) => `M0 ${yPct(hi).toFixed(2)}H1000M0 ${yPct(lo).toFixed(2)}H1000`)
    .join(' ');
  const points: Point[] = [];
  series[0].forEach((v, i) => {
    if (v == null) return;
    const args = series.map((s) => s[i] as number);
    points.push({
      i,
      day: days[i],
      tone: c.status(...args),
      value: c.fmt(...args),
      x: xPct(i),
      y: yPct(v),
    });
  });
  const inRange = points.filter((p) => p.tone === 'normal').length;
  const last = points[points.length - 1];
  const vals = points.map((p) => series[0][p.i] as number);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const a1 = avg(vals.slice(-5));
  const a0 = avg(vals.slice(-10, -5));
  const tol = (c.max - c.min) * 0.04;
  const dir =
    vals.length < 6
      ? 'Not enough readings to call a direction'
      : a1 - a0 > tol
        ? 'Rising lately'
        : a0 - a1 > tol
          ? 'Falling lately'
          : 'Steady';
  return {
    c,
    days,
    pts,
    bandPath,
    edgePath,
    points,
    inRange,
    last,
    latestToday: series[0][n - 1] != null,
    dir,
    xPct,
    yPct,
  };
}

export function Trends() {
  const { mission } = useOutletContext<{ mission: MissionProfileId }>();
  const [sel, setSel] = useState<TrendKey>('bp');
  const [n, setN] = useState(30);
  const [hover, setHover] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [attached, setAttached] = useState(false);

  const g = geometry(sel, n);
  const lastTone: Tone = g.last?.tone ?? 'normal';
  const firstDay = g.days[0];
  const midDay = g.days[Math.floor(n / 2)];
  const hp = hover == null ? null : g.points.find((p) => p.i === hover);
  const gl = geometry('glu', n);
  const notes = TREND_NOTES[n].map(([tone, k, title, text]) => ({
    tone,
    k,
    title,
    text: text || `${gl.inRange} of ${gl.points.length} readings in range.`,
  }));
  const yLabels = g.c.ranges.flatMap(([lo, hi]) => [hi, lo]);
  const dots = g.points.filter((p) => p.tone !== 'normal' || n <= 30);

  return (
    <>
      <PageTitle title="Trends">
        <div className="flex flex-wrap items-center gap-4">
          <div
            role="group"
            aria-label="Time range"
            className="inline-flex gap-0.5 rounded-xl border border-line bg-surface p-1"
          >
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={d === n}
                onClick={() => {
                  setN(d);
                  setHover(null);
                }}
                className="h-10 cursor-pointer rounded-lg px-3.5 text-[15px] font-medium text-muted transition-colors hover:text-ink aria-pressed:bg-ink aria-pressed:text-bg"
              >
                {d} days
              </button>
            ))}
          </div>
          <span className="font-mono text-[15px] text-muted">Days {firstDay}–142</span>
          <Link to="/log" className={btn('primary', 'h-12 pr-5 pl-4 text-base no-underline')}>
            <IconPlus size={20} strokeWidth={2.2} />
            Log vitals
          </Link>
        </div>
      </PageTitle>

      <div className="chc-fit-cols flex flex-1 flex-wrap items-stretch gap-[18px]">
        {/* Column A */}
        <div className="chc-scroll flex min-w-0 flex-[0_1_380px] animate-chc-in flex-col gap-[18px] [animation-delay:60ms]">
          <Panel title="What changed" aside={`${n} days`} className="!gap-1">
            {notes.map((o) => (
              <button
                key={o.title}
                type="button"
                aria-pressed={o.k === sel}
                onClick={() => {
                  setSel(o.k);
                  setHover(null);
                }}
                className={`${ROW} cursor-pointer items-start`}
              >
                <span className={`mt-0.5 ${TONE[o.tone].text}`}>
                  <StatusIcon tone={o.tone} size={20} strokeWidth={2.2} />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-base font-medium">{o.title}</span>
                  <span className="text-[15px] leading-[21px] text-text">{o.text}</span>
                </span>
              </button>
            ))}
          </Panel>
          <Panel title="Note for your flight surgeon">
            <label htmlFor="note" className="text-[15px] leading-[22px] text-text">
              Anything that explains these lines, like a hard workout, a late night or a new
              medicine.
            </label>
            <textarea
              id="note"
              rows={4}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setAttached(false);
              }}
              placeholder="e.g. Coffee before the BP check on day 142."
              className="resize-y rounded-xl border border-line-2 bg-sunk p-3 text-base text-ink outline-none placeholder:text-faint focus:border-accent"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setAttached(true)}
                className={btn(
                  'secondary',
                  `cursor-pointer px-4 ${attached ? '!border-ok/45' : ''}`,
                )}
              >
                {attached && (
                  <span className="text-ok">
                    <IconCheckCircle size={18} strokeWidth={2.4} />
                  </span>
                )}
                {attached ? 'Attached to your next report' : 'Attach to next report'}
              </button>
              <span className="text-[13px] text-muted">
                Reaches Earth {MISSIONS[mission].delay} after sending
              </span>
            </div>
          </Panel>
        </div>

        {/* Column B: big chart + small multiples */}
        <div className="flex min-w-0 flex-[1_1_640px] animate-chc-in flex-col gap-[18px] [animation-delay:120ms]">
          <Panel className={`flex-1 !gap-4 ${TONE[lastTone].border}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-3">
                  <h2 className="m-0 text-[26px] leading-8 font-medium tracking-[-0.02em]">
                    {g.c.name}
                  </h2>
                  <span className="font-mono text-[13px] text-muted">
                    {n} days · {g.c.unit}
                  </span>
                </div>
                <span className="text-[15px] text-text">
                  {g.dir}. {g.inRange} of {g.points.length} readings in your range
                  {g.latestToday ? '.' : `, latest on day ${g.last?.day ?? ''}.`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[40px] leading-[44px] font-medium tracking-[-0.03em] tabular-nums">
                    {g.last?.value ?? '--'}
                  </span>
                  <span className="font-mono text-base text-text">{g.c.unit}</span>
                </span>
                <StatusPill tone={lastTone} />
              </div>
            </div>

            {g.points.length >= 3 ? (
              <>
                <div className="flex min-h-[300px] flex-1 gap-2">
                  <div className="relative w-10 shrink-0">
                    {yLabels.map((v) => (
                      <span
                        key={v}
                        className="absolute right-0 -translate-y-1/2 font-mono text-[12px] text-muted"
                        style={{ top: `${g.yPct(v).toFixed(2)}%` }}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                  <div
                    role="img"
                    aria-label={`${g.c.name} over ${n} days: ${g.inRange} of ${g.points.length} readings in range.`}
                    onMouseLeave={() => setHover(null)}
                    className="relative flex-1 rounded-lg bg-sunk"
                  >
                    <svg
                      viewBox="0 0 1000 100"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                      className="absolute inset-0 size-full"
                    >
                      <path d={g.bandPath} fill="rgba(74,222,155,0.08)" />
                      <path
                        d={g.edgePath}
                        stroke="rgba(74,222,155,0.35)"
                        strokeDasharray="4 4"
                        vectorEffect="non-scaling-stroke"
                      />
                      {hover != null && (
                        <path
                          d={`M${(g.xPct(hover) * 10).toFixed(1)} 0V100`}
                          stroke="rgba(233,237,243,0.3)"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                      <polyline
                        points={g.pts[0]}
                        fill="none"
                        stroke="#5ab9fc"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {g.pts[1] && (
                        <polyline
                          points={g.pts[1]}
                          fill="none"
                          stroke="#5ab9fc"
                          strokeOpacity="0.6"
                          strokeWidth="2"
                          strokeDasharray="5 4"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                    </svg>
                    {dots.map((p) => {
                      const size = p.tone === 'normal' ? (n <= 7 ? 10 : 8) : 16;
                      return (
                        <span
                          key={p.i}
                          className={`pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${p.tone === 'normal' ? 'bg-accent' : `bg-bg ${TONE[p.tone].text}`}`}
                          style={{ left: `${p.x}%`, top: `${p.y}%`, width: size, height: size }}
                        >
                          {p.tone !== 'normal' && (
                            <StatusIcon tone={p.tone} size={16} strokeWidth={2.4} />
                          )}
                        </span>
                      );
                    })}
                    {g.days.map((_, i) => (
                      <span
                        key={i}
                        onMouseEnter={() => setHover(i)}
                        className="absolute inset-y-0"
                        style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
                      />
                    ))}
                    {hp && (
                      <div
                        role="status"
                        className="pointer-events-none absolute z-10 flex min-w-[140px] flex-col gap-1 rounded-xl border border-line-2 bg-raised px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                        style={{
                          left: `${g.xPct(hp.i)}%`,
                          top: `${Math.max(0, Math.min(62, hp.y - 34))}%`,
                          transform:
                            g.xPct(hp.i) > 75
                              ? 'translateX(calc(-100% - 14px))'
                              : 'translateX(14px)',
                        }}
                      >
                        <span className="font-mono text-[13px] text-muted">
                          Day {hp.day}
                          {hp.day === 142 ? ', today' : ''}
                        </span>
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-xl font-medium tabular-nums">{hp.value}</span>
                          <span className="font-mono text-[13px] text-text">{g.c.unit}</span>
                        </span>
                        <span>
                          <StatusPill tone={hp.tone} />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between pl-12 font-mono text-[13px] text-muted">
                  <span>Day {firstDay}</span>
                  <span>Day {midDay}</span>
                  <span>Today, day 142</span>
                </div>
              </>
            ) : (
              <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-2">
                <span className="text-lg font-medium">Log 3 readings to see a trend</span>
                <span className="text-[15px] text-muted">
                  {g.points.length} logged in this range so far.
                </span>
                <Link to="/log" className={btn('secondary', 'mt-2 px-4 no-underline')}>
                  Log {g.c.short}
                </Link>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-[13px] font-medium text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm bg-ok-t outline outline-ok/30" />
                Your range
              </span>
              {sel === 'bp' && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-accent" />
                    Top number
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-4 border-t-2 border-dashed border-accent/60" />
                    Bottom number
                  </span>
                </>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className="text-watch">
                  <StatusIcon tone="watch" />
                </span>
                Watch
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-act">
                  <StatusIcon tone="act" />
                </span>
                Act now
              </span>
              <span className="ml-auto font-normal">Hover the chart to read a day</span>
            </div>
          </Panel>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
            {TREND_KEYS.map((k) => (
              <SmallMultiple
                key={k}
                k={k}
                n={n}
                on={k === sel}
                onPick={() => {
                  setSel(k);
                  setHover(null);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function SmallMultiple({
  k,
  n,
  on,
  onPick,
}: {
  k: TrendKey;
  n: number;
  on: boolean;
  onPick: () => void;
}) {
  const g = geometry(k, n);
  const tone: Tone = g.last?.tone ?? 'normal';
  const inRange =
    g.points.length < 3
      ? `${g.points.length} logged · need 3 for a trend`
      : `${g.inRange} of ${g.points.length} in range`;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      aria-label={`${g.c.name}, latest ${g.last?.value ?? '--'} ${g.c.unit}, ${TONE[tone].label}. ${inRange}`}
      className={`flex cursor-pointer flex-col gap-2 rounded-[20px] border bg-surface p-3.5 text-left transition hover:-translate-y-0.5 ${on ? 'border-ink/55' : TONE[tone].border}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-medium">{g.c.name}</span>
        <StatusPill tone={tone} />
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-[26px] leading-8 font-medium tabular-nums">
          {g.last?.value ?? '--'}
        </span>
        <span className="font-mono text-[13px] text-text">{g.c.unit}</span>
      </span>
      <span className="relative h-12 rounded-md bg-sunk">
        <svg
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 size-full"
        >
          <path d={g.bandPath} fill="rgba(74,222,155,0.08)" />
          <polyline
            points={g.pts[0]}
            fill="none"
            stroke={on ? '#5ab9fc' : 'rgba(233,237,243,0.55)'}
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
          {g.pts[1] && (
            <polyline
              points={g.pts[1]}
              fill="none"
              stroke={on ? '#5ab9fc' : 'rgba(233,237,243,0.55)'}
              strokeOpacity="0.6"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {g.points
          .filter((p) => p.tone !== 'normal')
          .map((p) => (
            <span
              key={p.i}
              className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${p.x}%`, top: `${p.y}%`, background: TONE[p.tone].hex }}
            />
          ))}
      </span>
      <span className="font-mono text-[13px] text-muted">{inRange}</span>
    </button>
  );
}
