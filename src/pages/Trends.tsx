import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router';
import { IconCheckCircle, IconChevronRight, IconPlus } from '../components/icons';
import { btn, ROW, TONE, toneOf, type Tone } from '../components/tone';
import { PageHeader, Panel, StatusIcon, StatusPill } from '../components/ui';
import { useNow } from '../components/useNow';
import { entryLabel, entryUnit, primaryIndicator, type EntryKey } from '../components/vitals';
import { content, getIndicator } from '../data/content';
import { formatDelay, formatValue, greenBand } from '../lib/format';
import {
  chartDomain,
  lastDays,
  seriesFor,
  summarizeSeries,
  type SeriesSummary,
} from '../lib/trends';
import type { MissionProfileId, Reading } from '../lib/types';
import { useMissionDay, useReadings } from '../lib/useReadings';

// Owner B: "04 · Trends" from the design canvas. Lazy-loaded route. One point per day (the
// latest reading), coloured by getStatus(); bands are content.json's green ranges.

type TrendKey = EntryKey;
const TREND_KEYS: TrendKey[] = [
  'bp',
  'heart_rate',
  'sleep_hours',
  'spo2',
  'body_temp',
  'blood_glucose',
];

type Point = { i: number; tone: Tone; value: string; x: number; y: number; id: string };

const DIRECTION: Record<SeriesSummary['direction'], string> = {
  rising: 'Rising lately',
  falling: 'Falling lately',
  steady: 'Steady',
  insufficient: 'Not enough readings to call a direction',
};

function geometry(k: TrendKey, n: number, readings: Reading[], now: Date) {
  const ind = primaryIndicator(k)!;
  const dia = k === 'bp' ? getIndicator('bp_diastolic') : undefined;
  const slots = seriesFor(k, n, readings, now);
  const ranges: [number, number][] = [greenBand(ind), ...(dia ? [greenBand(dia)] : [])];
  const values = slots.flatMap((p) =>
    p ? [p.value, ...(p.value2 !== undefined ? [p.value2] : [])] : [],
  );
  const flat = ranges.flat();
  const [min, max] = chartDomain(values, [Math.min(...flat), Math.max(...flat)]);
  const series = [
    slots.map((p) => p?.value ?? null),
    ...(dia ? [slots.map((p) => p?.value2 ?? null)] : []),
  ];
  const xPct = (i: number) => ((i + 0.5) / n) * 100;
  const yPct = (v: number) => ((max - v) / (max - min)) * 100;
  const pts = series.map((ser) =>
    ser
      .map((v, i) => (v == null ? null : `${(xPct(i) * 10).toFixed(1)},${yPct(v).toFixed(2)}`))
      .filter(Boolean)
      .join(' '),
  );
  const bandPath = ranges
    .map(([lo, hi]) => `M0 ${yPct(hi).toFixed(2)}H1000V${yPct(lo).toFixed(2)}H0Z`)
    .join(' ');
  const edgePath = ranges
    .map(([lo, hi]) => `M0 ${yPct(hi).toFixed(2)}H1000M0 ${yPct(lo).toFixed(2)}H1000`)
    .join(' ');
  const points: Point[] = [];
  slots.forEach((p, i) => {
    if (!p) return;
    points.push({
      i,
      id: p.id,
      tone: toneOf(p.level) ?? 'normal',
      value:
        formatValue(ind, p.value) +
        (p.value2 !== undefined ? `/${formatValue(dia, p.value2)}` : ''),
      x: xPct(i),
      y: yPct(p.value),
    });
  });
  const summary = summarizeSeries(slots, (max - min) * 0.04);
  const yLabels = [...new Set(ranges.flat())].map((v) => ({
    v,
    text: formatValue(ind, v),
  }));
  return {
    name: entryLabel(k),
    short: entryLabel(k).toLowerCase(),
    unit: entryUnit(k),
    slots,
    pts,
    bandPath,
    edgePath,
    points,
    summary,
    inRange: summary.inRange,
    last: points[points.length - 1],
    lastSlot: summary.latest,
    latestToday: slots[n - 1] != null,
    dir: DIRECTION[summary.direction],
    xPct,
    yPct,
    yLabels,
  };
}

type Geometry = ReturnType<typeof geometry>;

const NOTE_RANK = { act: 0, watch: 1, normal: 2 } as const;

/** "What changed": off-range indicators first, then moving ones, then steady ones. */
function whatChanged(
  all: Record<TrendKey, Geometry>,
  dayLabel: (i: number) => string,
): { tone: Tone; k: TrendKey; title: string; text: string; rank: number }[] {
  return TREND_KEYS.flatMap((k) => {
    const g = all[k];
    const s = g.summary;
    if (!s.total) return [];
    if (s.off.length) {
      const lastOff = s.off[s.off.length - 1];
      const i = g.slots.findIndex((p) => p?.id === lastOff.id);
      const tone = toneOf(s.worst) ?? 'watch';
      return [
        {
          tone,
          k,
          title: `${g.name}: ${s.off.length} of ${s.total} outside your range`,
          text:
            lastOff.id === s.latest?.id
              ? `Your latest reading is outside your range. ${g.dir}.`
              : `Last on ${dayLabel(i)}. Back in range since.`,
          rank: NOTE_RANK[tone],
        },
      ];
    }
    const moving = s.direction === 'rising' || s.direction === 'falling';
    return [
      {
        tone: 'normal' as Tone,
        k,
        title: moving ? `${g.name} ${s.direction} lately` : `${g.name} steady`,
        text: `All ${s.total} readings in your range.`,
        rank: moving ? 2 : 3,
      },
    ];
  })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 4);
}

export function Trends() {
  const { mission } = useOutletContext<{ mission: MissionProfileId }>();
  const { readings, update } = useReadings();
  const now = useNow(60_000);
  const missionDay = useMissionDay();
  const [sel, setSel] = useState<TrendKey>('bp');
  const [n, setN] = useState(30);
  const [hover, setHover] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);

  const all = useMemo(
    () =>
      Object.fromEntries(TREND_KEYS.map((k) => [k, geometry(k, n, readings, now)])) as Record<
        TrendKey,
        Geometry
      >,
    [n, readings, now],
  );
  const days = useMemo(() => lastDays(n, now), [n, now]);
  /** "Day 142" when the mission day is known, else the date. */
  const dayLabel = (i: number) => {
    const md = missionDay - (n - 1 - i);
    return missionDay > 0 && md >= 1
      ? `Day ${md}`
      : days[i].toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const g = all[sel];
  const lastTone: Tone = g.last?.tone ?? 'normal';
  const hp = hover == null ? null : g.points.find((p) => p.i === hover);
  const notes = whatChanged(all, dayLabel);
  const dots = g.points.filter((p) => p.tone !== 'normal' || n <= 30);
  const delay = formatDelay(
    content.missionProfiles.find((m) => m.id === mission)?.commsDelaySeconds.max ?? 0,
  );
  const target = g.lastSlot;
  const targetNote = target ? (readings.find((r) => r.id === target.id)?.note ?? '') : '';
  const attached = !!note.trim() && note.trim() === targetNote;
  const attach = () => {
    if (!target || !note.trim()) return;
    update(target.id, { note: note.trim() });
    if (target.id2) update(target.id2, { note: note.trim() });
  };

  return (
    <div className="flex flex-col gap-3.5 xl:min-h-0 xl:flex-1">
      <PageHeader title="Trends" meta={[{ label: 'Range', value: `${dayLabel(0)} – today` }]}>
        <div className="flex flex-wrap items-center gap-2.5">
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
          <Link to="/log" className={btn('primary', 'h-11 pr-5 pl-4 text-base no-underline')}>
            <IconPlus size={20} strokeWidth={2.2} />
            Log vitals
          </Link>
        </div>
      </PageHeader>

      <div className="chc-fit-cols flex flex-col gap-3.5 xl:min-h-0 xl:flex-1 xl:flex-row">
        {/* Column A */}
        <div className="flex min-w-0 animate-chc-in flex-col gap-3.5 [animation-delay:60ms] xl:min-h-0 xl:w-[clamp(300px,24vw,380px)] xl:shrink-0">
          <Panel
            title="What changed"
            aside={`${n} days`}
            className="!gap-1 !p-4 xl:min-h-0 xl:flex-1 [&_h2]:!text-lg"
          >
            <div className="-mx-1 flex flex-col gap-0.5 px-1 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
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
                    <span className="text-[15px] font-medium">{o.title}</span>
                    <span className="text-sm leading-5 text-text">{o.text}</span>
                  </span>
                </button>
              ))}
              {notes.length === 0 && (
                <span className="px-3 py-2.5 text-[15px] text-muted">
                  No readings in this range yet.
                </span>
              )}
            </div>
          </Panel>
          <section
            aria-labelledby="note-h"
            className="flex shrink-0 flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-4"
          >
            <button
              type="button"
              aria-expanded={noteOpen}
              aria-controls="note-body"
              onClick={() => setNoteOpen((o) => !o)}
              className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
            >
              <h2 id="note-h" className="m-0 text-lg font-medium tracking-[-0.01em]">
                Note for your flight surgeon
              </h2>
              <span className="flex items-center gap-2 text-[13px] text-muted">
                {attached ? 'Attached' : note ? 'Draft' : 'Add'}
                <IconChevronRight
                  size={18}
                  className={`transition-transform ${noteOpen ? 'rotate-90' : ''}`}
                />
              </span>
            </button>
            {noteOpen && (
              <div id="note-body" className="flex flex-col gap-2.5">
                <label htmlFor="note" className="text-sm leading-5 text-text">
                  Anything that explains these lines, like a hard workout, a late night or a new
                  medicine. It is saved on your latest {g.short} reading
                  {target ? ` (${dayLabel(g.slots.findIndex((p) => p?.id === target.id))})` : ''}.
                </label>
                <textarea
                  id="note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Coffee just before the blood pressure check."
                  className="resize-y rounded-xl border border-line-2 bg-sunk p-3 text-base text-ink outline-none placeholder:text-faint focus:border-accent"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={attach}
                    disabled={!target || !note.trim()}
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
                    {attached ? 'Saved with the reading' : 'Save with the reading'}
                  </button>
                  <span className="text-[13px] text-muted">
                    Reaches Earth {delay} after the next sync
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Column B: big chart + small multiples */}
        <div className="flex min-w-0 animate-chc-in flex-col gap-3.5 [animation-delay:120ms] xl:min-h-0 xl:flex-1">
          <Panel
            className={`!gap-3 !p-4 xl:min-h-0 xl:flex-1 ${lastTone === 'watch' ? 'border-watch/45' : TONE[lastTone].border}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-baseline gap-3">
                  <h2 className="m-0 text-[22px] leading-7 font-medium tracking-[-0.02em]">
                    {g.name}
                  </h2>
                  <span className="font-mono text-[13px] text-muted">
                    {n} days · {g.unit}
                  </span>
                </div>
                <span className="text-sm text-text">
                  {g.dir}. {g.inRange} of {g.points.length} readings in your range
                  {g.latestToday || !g.last ? '.' : `, latest on ${dayLabel(g.last.i)}.`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[34px] leading-none font-medium tracking-[-0.04em] tabular-nums">
                    {g.last?.value ?? '--'}
                  </span>
                  <span className="font-mono text-base text-text">{g.unit}</span>
                </span>
                <StatusPill tone={lastTone} />
              </div>
            </div>

            {g.points.length >= 3 ? (
              <>
                <div className="flex min-h-[300px] flex-1 gap-2 xl:min-h-[140px]">
                  <div className="relative w-10 shrink-0">
                    {g.yLabels.map(({ v, text }) => (
                      <span
                        key={v}
                        className="absolute right-0 -translate-y-1/2 font-mono text-[12px] text-muted"
                        style={{ top: `${g.yPct(v).toFixed(2)}%` }}
                      >
                        {text}
                      </span>
                    ))}
                  </div>
                  <div
                    role="img"
                    aria-label={`${g.name} over ${n} days: ${g.inRange} of ${g.points.length} readings in range.`}
                    onMouseLeave={() => setHover(null)}
                    className="relative flex-1 rounded-lg bg-sunk"
                  >
                    <svg
                      viewBox="0 0 1000 100"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                      className="absolute inset-0 size-full"
                    >
                      <path d={g.bandPath} fill="rgba(233,237,243,0.06)" />
                      <path
                        d={g.edgePath}
                        stroke="rgba(233,237,243,0.3)"
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
                        key={g.pts[0]}
                        className="chc-draw"
                        points={g.pts[0]}
                        fill="none"
                        stroke="#29f0ff"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* Data flowing along the line */}
                      <polyline
                        className="chc-flow"
                        points={g.pts[0]}
                        fill="none"
                        stroke="#e8fbff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {g.pts[1] && (
                        <polyline
                          key={g.pts[1]}
                          className="chc-draw"
                          points={g.pts[1]}
                          fill="none"
                          stroke="#29f0ff"
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
                          key={`${g.pts[0]}-${p.i}`}
                          className={`chc-pop pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${p.tone === 'normal' ? 'bg-accent' : `bg-bg ${TONE[p.tone].text}`}`}
                          style={{
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                            width: size,
                            height: size,
                            ['--d' as string]: `${(0.15 + (p.x / 100) * 0.9).toFixed(2)}s`,
                          }}
                        >
                          {p.tone !== 'normal' && (
                            <StatusIcon tone={p.tone} size={16} strokeWidth={2.4} />
                          )}
                        </span>
                      );
                    })}
                    {days.map((_, i) => (
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
                          {dayLabel(hp.i)}
                          {hp.i === n - 1 ? ', today' : ''}
                        </span>
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-xl font-medium tabular-nums">{hp.value}</span>
                          <span className="font-mono text-[13px] text-text">{g.unit}</span>
                        </span>
                        <span>
                          <StatusPill tone={hp.tone} />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between pl-12 font-mono text-[13px] text-muted">
                  <span>{dayLabel(0)}</span>
                  <span>{dayLabel(Math.floor(n / 2))}</span>
                  <span>Today{missionDay > 0 ? `, day ${missionDay}` : ''}</span>
                </div>
              </>
            ) : (
              <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-2 xl:min-h-[140px]">
                <span className="text-lg font-medium">Log 3 readings to see a trend</span>
                <span className="text-[15px] text-muted">
                  {g.points.length} logged in this range so far.
                </span>
                <Link to="/log" className={btn('secondary', 'mt-2 px-4 no-underline')}>
                  Log {g.short}
                </Link>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-[13px] font-medium text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm bg-ink/6 outline outline-ink/30" />
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
              <span className="ml-auto hidden font-normal 2xl:inline">
                Hover the chart to read a day
              </span>
            </div>
          </Panel>

          <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
            {TREND_KEYS.map((k) => (
              <SmallMultiple
                key={k}
                g={all[k]}
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
    </div>
  );
}

function SmallMultiple({ g, on, onPick }: { g: Geometry; on: boolean; onPick: () => void }) {
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
      aria-label={`${g.name}, latest ${g.last?.value ?? '--'} ${g.unit}, ${TONE[tone].label}. ${inRange}`}
      title={inRange}
      className={`flex min-w-0 cursor-pointer flex-col items-start gap-1.5 rounded-[16px] border bg-surface px-3 py-2.5 text-left transition hover:-translate-y-0.5 ${on ? 'border-ink/55 bg-raised' : tone === 'watch' ? 'border-watch/45' : TONE[tone].border}`}
    >
      <span className="w-full truncate text-sm font-medium text-text">{g.name}</span>
      <span className="flex items-baseline gap-1">
        <span className="font-mono text-[22px] leading-7 font-medium tracking-[-0.03em] tabular-nums">
          {g.last?.value ?? '--'}
        </span>
        <span className="font-mono text-[12px] text-text">{g.unit}</span>
      </span>
      <StatusPill tone={tone} />
      <span className="relative hidden h-10 w-full rounded-md bg-sunk min-[1700px]:block">
        <svg
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 size-full"
        >
          <path d={g.bandPath} fill="rgba(233,237,243,0.06)" />
          <polyline
            key={g.pts[0]}
            className="chc-draw"
            points={g.pts[0]}
            fill="none"
            stroke={on ? '#29f0ff' : 'rgba(233,237,243,0.55)'}
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
          {g.pts[1] && (
            <polyline
              points={g.pts[1]}
              fill="none"
              stroke={on ? '#29f0ff' : 'rgba(233,237,243,0.55)'}
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
    </button>
  );
}
