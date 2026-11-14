import { Link, useSearchParams } from 'react-router';
import { BodyFigure, type FigureCallout } from '../components/BodyFigure';
import {
  IconArrowRight,
  IconClock,
  IconInfo,
  IconOctagon,
  IconPlus,
  IconTrend,
} from '../components/icons';
import { btn, TONE } from '../components/tone';
import { Legend, PageTitle, Panel, ProgressBar, StatusPill, StatusTile } from '../components/ui';
import {
  attention,
  dashboardVitals,
  DUE_TODAY,
  FIGURE_SYSTEMS,
  readiness,
  SHIP,
  systemDetails,
  type VitalTile,
} from './designMock';

// Owner B: "01 · Dashboard / Today" from the design canvas.
// LAYOUT TEST: shows design mock data. Add ?alert to the URL for the Act-now state.

export function Dashboard() {
  const [params] = useSearchParams();
  const alert = params.has('alert');
  const ready = readiness(alert);
  const alerts = attention(alert);
  const vitals = dashboardVitals(alert);
  const systems: FigureCallout[] = (() => {
    const d = systemDetails(alert, '');
    return FIGURE_SYSTEMS.map((id) => ({
      id,
      name: id === 'bone' ? 'Bone' : d[id].name,
      tone: d[id].tone,
      text: `${TONE[d[id].tone].label} · ${d[id].note}`,
    }));
  })();
  const flagged = systems.filter((s) => s.tone !== 'normal').length;
  const itemCount = alerts.length + (alert ? 1 : 0) + DUE_TODAY.length;

  return (
    <>
      <PageTitle
        title="Health check"
        meta={[
          { label: 'Mission day', value: SHIP.day },
          { label: 'Date', value: SHIP.date },
          { label: 'Ship time', value: SHIP.time },
        ]}
      >
        <Link to="/log" className={btn('primary', 'h-12 pr-5 pl-4 text-base no-underline')}>
          <IconPlus size={20} strokeWidth={2.2} />
          Log vitals
        </Link>
      </PageTitle>

      <div className="chc-fit-cols flex flex-1 flex-wrap items-stretch gap-[18px]">
        {/* Column A: readiness + attention */}
        <div className="flex min-w-0 flex-[0_1_380px] animate-chc-in flex-col gap-[18px] [animation-delay:60ms]">
          <Panel
            title={
              <span className="flex items-center gap-2">
                Mission readiness
                <span
                  className="group relative inline-flex size-8 cursor-help items-center justify-center rounded-lg text-muted"
                  tabIndex={0}
                  aria-label="About mission readiness"
                >
                  <IconInfo size={18} />
                  <span
                    role="tooltip"
                    className="invisible absolute top-full left-0 z-20 flex w-[260px] -translate-y-0.5 flex-col gap-1 rounded-xl border border-line-2 bg-raised px-3 py-2.5 text-left opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus:visible group-focus:opacity-100"
                  >
                    <span className="text-[15px] leading-5 font-medium text-ink">
                      {ready.headline}
                    </span>
                    <span className="text-sm leading-5 font-normal tracking-normal text-text">
                      {ready.sub}
                    </span>
                  </span>
                </span>
              </span>
            }
          >
            <div className="flex flex-col items-center">
              <div className="relative h-[124px] w-[220px]">
                <svg
                  width="220"
                  height="124"
                  viewBox="0 0 220 124"
                  role="img"
                  aria-label={`Readiness score ${ready.score} out of 100`}
                >
                  <path
                    d="M 16 114 A 94 94 0 0 1 204 114"
                    fill="none"
                    stroke="#1a2131"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 16 114 A 94 94 0 0 1 204 114"
                    fill="none"
                    stroke={TONE[ready.tone].hex}
                    strokeWidth="12"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray={`${ready.score} 100`}
                  />
                </svg>
                <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
                  <span className="text-[44px] leading-[44px] font-medium tracking-[-0.03em] tabular-nums">
                    {ready.score}
                  </span>
                  <span className="font-mono text-[13px] text-muted">of 100</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              {ready.parts.map((p) => (
                <div
                  key={p.label}
                  className="flex items-baseline justify-between gap-3 border-t border-line py-2.5"
                >
                  <span className="text-[15px] text-text">{p.label}</span>
                  <span
                    className={`text-base font-medium tabular-nums ${p.tone ? TONE[p.tone].text : 'text-ink'}`}
                  >
                    {p.value}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Needs your attention"
            aside={`${itemCount} items`}
            className="chc-scroll flex-1 !gap-1"
          >
            {alert && (
              <div
                role="alert"
                className="mt-2 mb-1.5 flex flex-col gap-2.5 rounded-xl border border-act-l bg-act-t p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-act">
                    <IconOctagon size={28} />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-act">
                      Act now · BP <span className="font-mono">156/99</span>
                    </span>
                    <span className="text-lg leading-6 font-medium">
                      Stop, rest, re-measure in 15 min
                    </span>
                  </div>
                </div>
                <span className="text-base leading-6 text-text">
                  High for you. Still high on the re-check? Flag it for your flight surgeon.
                </span>
                <div className="flex gap-2">
                  <button type="button" className={btn('primary', 'flex-1 cursor-pointer !bg-act')}>
                    Start 15-min timer
                  </button>
                  <button
                    type="button"
                    className={btn('ghost', 'flex-1 cursor-pointer !border-act-l')}
                  >
                    Flag for surgeon
                  </button>
                </div>
              </div>
            )}
            {alerts.map((a) => (
              <div key={a.title} className="flex items-center gap-3 border-t border-line py-2.5">
                <StatusTile tone={a.tone} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="inline-flex items-center gap-1.5 text-base font-medium">
                    {a.title}
                    <span
                      title={a.detail}
                      role="img"
                      aria-label={a.detail}
                      className="inline-flex cursor-help text-muted hover:text-ink"
                    >
                      <IconInfo size={16} />
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  className={btn('secondary', 'cursor-pointer px-3 whitespace-nowrap')}
                >
                  {a.cta}
                </button>
              </div>
            ))}

            <div className="flex items-center gap-3 border-t border-line pt-3 pb-1.5">
              <h3 className="m-0 text-[13px] font-medium whitespace-nowrap text-muted">
                Due today
              </h3>
              <ProgressBar value={3} max={7} label="Measurements logged today" className="flex-1" />
              <span className="font-mono text-[13px] whitespace-nowrap text-muted">
                3 of 7 logged
              </span>
            </div>
            {DUE_TODAY.map((d) => (
              <div key={d.name} className="flex items-center gap-3 py-1">
                <span className="flex size-9 shrink-0 items-center justify-center text-muted">
                  <IconClock size={20} strokeWidth={1.8} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="text-base font-medium">{d.name}</span>
                  <span className="text-[13px] text-muted">{d.when}</span>
                </div>
                <Link
                  to="/log"
                  aria-label={`Log ${d.name}`}
                  className={btn('secondary', 'min-w-[60px] px-3.5 no-underline')}
                >
                  Log
                </Link>
              </div>
            ))}
          </Panel>
        </div>

        {/* Column B: body figure */}
        <div className="flex min-w-0 flex-[0_1_560px] animate-chc-in flex-col [animation-delay:120ms]">
          <Panel
            sunk
            title="Body status"
            className="relative flex-1 overflow-hidden !gap-2 !pb-4"
            aside={
              <span className="font-display">
                {flagged ? `${flagged} of 5 systems need a look` : 'All 5 systems normal'}
              </span>
            }
          >
            <BodyFigure systems={systems} hint="Hover a system" />
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <Legend />
              <Link to="/body" className={btn('secondary', 'group px-4 no-underline')}>
                Open body view
                <IconArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-[3px]"
                />
              </Link>
            </div>
          </Panel>
        </div>

        {/* Column C: vitals */}
        <section
          aria-labelledby="vit-h"
          className="flex min-w-0 flex-[1_1_560px] animate-chc-in flex-col gap-3 [animation-delay:180ms]"
        >
          <div className="flex items-center gap-2">
            <h2 id="vit-h" className="m-0 text-xl font-medium tracking-[-0.015em]">
              Today’s vitals
            </h2>
            <button
              type="button"
              title="Line: last 7 days. Band: your normal range."
              aria-label="About these tiles: Line: last 7 days. Band: your normal range."
              className="inline-flex size-8 cursor-help items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-ink"
            >
              <IconInfo size={18} />
            </button>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-2.5">
            {vitals.map((t) =>
              t.value ? <VitalCard key={t.label} t={t} /> : <EmptyVital key={t.label} t={t} />,
            )}
            <Link
              to="/trends"
              className="flex items-center gap-3.5 rounded-[20px] border border-line bg-sunk px-[18px] py-3 text-base leading-[22px] text-text no-underline transition hover:-translate-y-0.5"
            >
              <span className="text-accent">
                <IconTrend size={28} strokeWidth={1.8} />
              </span>
              <span className="font-medium text-ink">Open 30-day trends</span>
              <span>Every indicator against your range</span>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

function spark(data: number[], min: number, max: number) {
  const y = (v: number) => 30 - ((v - min) / (max - min)) * 28;
  return data
    .map((v, i) => `${((i * 120) / (data.length - 1)).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ');
}

function VitalCard({ t }: { t: VitalTile }) {
  const tone = t.tone ?? 'normal';
  return (
    <button
      type="button"
      aria-label={`${t.label} ${t.value} ${t.unit}, ${TONE[tone].label}. ${t.meaning}`}
      className={`relative box-border grid min-h-[108px] w-full cursor-pointer grid-cols-[280px_minmax(0,1fr)] items-center gap-x-7 gap-y-3 rounded-[20px] border bg-surface px-4 py-3.5 text-left text-inherit shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[transform,box-shadow] duration-150 hover:z-30 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(233,237,243,0.16),0_12px_24px_rgba(0,0,0,0.28)] focus-within:z-30 max-sm:grid-cols-1 ${TONE[tone].border}`}
    >
      <span className="relative z-[1] col-start-1 row-span-2 flex flex-wrap content-center items-center gap-x-2.5 gap-y-1.5 self-stretch">
        <span className="text-lg leading-6 font-medium tracking-[-0.01em] text-ink">{t.label}</span>
        <span className="group relative">
          <StatusPill tone={tone} />
          <span
            role="tooltip"
            className="pointer-events-none invisible absolute top-[calc(100%+8px)] left-0 z-20 w-60 rounded-xl border border-line-2 bg-raised px-3 py-2.5 text-sm leading-5 text-ink opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition group-hover:visible group-hover:opacity-100"
          >
            {t.meaning}
          </span>
        </span>
        <span className="order-2 flex basis-full items-baseline gap-x-2 whitespace-nowrap">
          <span className="text-[46px] leading-[50px] font-medium tracking-[-0.03em] text-ink tabular-nums">
            {t.value}
          </span>
          <span className="font-mono text-[19px] font-medium text-text">{t.unit}</span>
          <span className="font-mono text-[15px] text-muted">at {t.time}</span>
        </span>
      </span>
      <svg
        viewBox="0 0 120 32"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 bottom-0 z-0 h-full w-[calc(100%-326px)] rounded-r-[20px] bg-[linear-gradient(rgba(233,237,243,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(233,237,243,0.08)_1px,transparent_1px)] bg-[size:24px_24px] bg-[position:-1px_-1px] max-sm:hidden"
      >
        <polyline
          points={spark(t.data ?? [], t.min ?? 0, t.max ?? 1)}
          fill="none"
          stroke={TONE[tone].line}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {t.action && (
        <span className="relative z-[1] col-start-2 row-start-2 inline-flex h-11 items-center self-end justify-self-end rounded-xl border border-ink/24 bg-[rgba(26,33,49,0.4)] px-[18px] text-[15px] font-medium whitespace-nowrap text-ink max-sm:col-start-1 max-sm:row-start-auto">
          {t.action}
        </span>
      )}
    </button>
  );
}

function EmptyVital({ t }: { t: VitalTile }) {
  return (
    <div className="box-border flex min-h-[108px] flex-wrap items-center gap-x-7 gap-y-3 rounded-[20px] border border-dashed border-line-2 bg-surface px-4 py-3.5">
      <div className="flex flex-[0_0_280px] flex-col items-start gap-1.5">
        <span className="flex items-baseline gap-2.5">
          <span className="text-lg leading-6 font-medium tracking-[-0.01em] text-ink">
            {t.label}
          </span>
          <span className="text-[13px] text-muted">Not logged</span>
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[46px] leading-[50px] font-medium text-faint">--</span>
          <span className="font-mono text-[19px] font-medium text-text">{t.unit}</span>
        </div>
      </div>
      <span className="flex-[1_1_240px] text-base leading-[22px] text-text">{t.meaning}</span>
      <Link to="/log" className={btn('secondary', 'ml-auto px-[18px] no-underline')}>
        Log {t.short}
      </Link>
    </div>
  );
}
