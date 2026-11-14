import { useMemo, useState, type ComponentType } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router';
import { BodyFigure, type FigureCallout } from '../components/BodyFigure';
import {
  IconArrowRight,
  IconBox,
  IconCheckCircle,
  IconChevronRight,
  IconGlobe,
  IconGravity,
  IconOctagon,
  IconRadiation,
  IconWind,
} from '../components/icons';
import { btn, ROW, TONE } from '../components/tone';
import { Legend, PageTitle, Panel, StatusIcon, StatusPill } from '../components/ui';
import type { MissionProfileId } from '../lib/types';
import {
  FIGURE_SYSTEMS,
  HAZARDS,
  MISSIONS,
  SHIP,
  systemDetails,
  type FigureSystem,
  type HazardId,
} from './designMock';

// Owner B: "02 · Body view" from the design canvas.
// LAYOUT TEST: shows design mock data. Add ?alert to the URL for the Act-now state.

const HAZARD_ICON: Record<HazardId, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  radiation: IconRadiation,
  isolation: IconBox,
  distance: IconGlobe,
  gravity: IconGravity,
  environment: IconWind,
};

export function Body() {
  const { mission } = useOutletContext<{ mission: MissionProfileId }>();
  const [params] = useSearchParams();
  const alert = params.has('alert');
  const delay = MISSIONS[mission].delay;
  const [sel, setSel] = useState<FigureSystem>(alert ? 'heart' : 'eyes');
  const [factor, setFactor] = useState<HazardId | null>(null);
  const [flagged, setFlagged] = useState<Partial<Record<FigureSystem, boolean>>>({});
  const [timer, setTimer] = useState(false);

  const details = useMemo(() => systemDetails(alert, delay), [alert, delay]);
  const callouts = useMemo<FigureCallout[]>(
    () =>
      FIGURE_SYSTEMS.map((id) => ({
        id,
        name: details[id].name,
        tone: details[id].tone,
        text: `${TONE[details[id].tone].label} · ${details[id].note}`,
      })),
    [details],
  );
  const flaggedCount = callouts.filter((c) => c.tone !== 'normal').length;
  const d = details[sel];
  const isFlagged = !!flagged[sel];
  const pick = (id: FigureSystem) => {
    setSel(id);
    setTimer(false);
  };

  return (
    <>
      <PageTitle
        title="Body view"
        meta={[
          { label: 'Mission day', value: SHIP.day },
          { label: 'Systems to look at', value: `${flaggedCount} of 5` },
          { label: 'Last reading', value: alert ? '09:05' : '07:45' },
        ]}
      >
        <span className="text-[15px] text-muted">
          Pick a system on the figure or in the list to see what to do.
        </span>
      </PageTitle>

      <div className="chc-fit-cols flex flex-1 flex-wrap items-stretch gap-[18px]">
        {/* Column A: systems + hazards */}
        <div className="chc-scroll flex min-w-0 flex-[0_1_360px] animate-chc-in flex-col gap-[18px] [animation-delay:60ms]">
          <Panel title="Systems" aside="5 tracked" className="!gap-1">
            {callouts.map((s) => {
              const hit = !!factor && details[s.id].hazards.includes(factor);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={sel === s.id}
                  onClick={() => pick(s.id)}
                  className={`${ROW} cursor-pointer transition-opacity ${factor && !hit ? 'opacity-45' : ''}`}
                >
                  <span className={TONE[s.tone].text}>
                    <StatusIcon tone={s.tone} size={20} strokeWidth={2.2} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-base font-medium">{s.name}</span>
                    <span className={`text-[13px] font-medium ${TONE[s.tone].text}`}>{s.text}</span>
                  </span>
                  {hit && (
                    <span className="rounded-md border border-accent/50 px-1.5 text-[12px] font-medium text-accent">
                      Affected
                    </span>
                  )}
                  <span className="text-muted">
                    <IconChevronRight size={18} />
                  </span>
                </button>
              );
            })}
          </Panel>
          <Panel className="!gap-1">
            <div className="flex flex-col gap-1 pb-2">
              <h2 className="m-0 text-xl font-medium tracking-[-0.015em]">What spaceflight does</h2>
              <span className="text-[13px] text-muted">
                The five hazards NASA tracks. Pick one to see which systems it touches.
              </span>
            </div>
            {HAZARDS.map((f) => {
              const on = factor === f.id;
              const Icon = HAZARD_ICON[f.id];
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFactor(on ? null : f.id)}
                  className={`${ROW} cursor-pointer items-start`}
                >
                  <span
                    className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border ${on ? 'border-accent text-accent' : 'border-line text-ink'}`}
                  >
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={`text-[15px] font-medium ${on ? 'text-accent' : 'text-ink'}`}>
                      {f.name}
                    </span>
                    <span className="text-[13px] leading-[18px] text-muted">{f.line(delay)}</span>
                  </span>
                </button>
              );
            })}
          </Panel>
        </div>

        {/* Column B: large figure */}
        <div className="flex min-w-0 flex-[1_1_560px] animate-chc-in flex-col [animation-delay:120ms]">
          <Panel
            sunk
            title="Your body today"
            aside={
              <span className="font-display">
                {flaggedCount ? `${flaggedCount} of 5 systems need a look` : 'All 5 systems normal'}
              </span>
            }
            className="flex-1 !gap-2 !pb-4"
          >
            <BodyFigure systems={callouts} selected={sel} onSelect={pick} minHeight={560} />
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <Legend />
              <span className="font-mono text-[13px] text-muted">Tap a system</span>
            </div>
          </Panel>
        </div>

        {/* Column C: system panel */}
        <div className="flex min-w-0 flex-[0_1_500px] animate-chc-in flex-col [animation-delay:180ms]">
          <section
            aria-live="polite"
            className={`chc-scroll flex flex-1 flex-col gap-5 rounded-[20px] border bg-surface p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${TONE[d.tone].border}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="m-0 text-[26px] leading-8 font-medium tracking-[-0.02em]">{d.name}</h2>
              <StatusPill tone={d.tone} />
            </div>
            <p className="m-0 text-base leading-6 text-text">{d.what}</p>

            <div className="flex flex-col">
              <h3 className="m-0 pb-1.5 text-[13px] font-medium text-muted">Your readings</h3>
              {d.readings.map((r) => (
                <div key={r.label} className="flex items-center gap-3 border-t border-line py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-medium">{r.label}</span>
                    <span className="text-[13px] text-muted">{r.meta}</span>
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-xl font-medium tabular-nums">{r.value}</span>
                    <span className="font-mono text-[13px] text-text">{r.unit}</span>
                  </span>
                  <StatusPill tone={r.tone} />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-[13px] font-medium text-muted">How spaceflight affects it</h3>
              <div className="flex flex-wrap gap-1.5">
                {HAZARDS.map((h) => {
                  const on = d.hazards.includes(h.id);
                  return (
                    <span
                      key={h.id}
                      className={`rounded-lg border px-2.5 py-1 text-[13px] font-medium ${on ? 'border-line-2 bg-raised text-ink' : 'border-line text-muted'}`}
                    >
                      {h.name}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <h3 className="m-0 text-[13px] font-medium text-muted">What to do</h3>
              {d.tone === 'act' && (
                <div
                  role="alert"
                  className="flex flex-col gap-2.5 rounded-xl border border-act-l bg-act-t p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-act">
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
                  <button
                    type="button"
                    onClick={() => setTimer(true)}
                    className={btn('primary', 'cursor-pointer !bg-act')}
                  >
                    {timer ? 'Timer running · re-measure at 09:27' : 'Start 15-min timer'}
                  </button>
                </div>
              )}
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {d.steps.map((st, i) => (
                  <li key={st} className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-raised font-mono text-[13px] text-ink">
                      {i + 1}
                    </span>
                    <span className="text-base leading-6 text-text">{st}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
              <div className="flex flex-wrap gap-2">
                {d.tone !== 'act' && (
                  <Link to={d.ctaHref} className={btn('primary', 'group flex-1 px-4 no-underline')}>
                    {d.cta}
                    <IconArrowRight
                      size={16}
                      className="transition-transform group-hover:translate-x-[3px]"
                    />
                  </Link>
                )}
                <button
                  type="button"
                  aria-pressed={isFlagged}
                  onClick={() => setFlagged({ ...flagged, [sel]: !isFlagged })}
                  className={btn(
                    'secondary',
                    `flex-1 cursor-pointer px-4 ${isFlagged ? '!border-ok/45' : ''}`,
                  )}
                >
                  {isFlagged && (
                    <span className="text-ok">
                      <IconCheckCircle size={18} strokeWidth={2.4} />
                    </span>
                  )}
                  {isFlagged ? 'Flagged, goes with your next report' : 'Flag for surgeon'}
                </button>
              </div>
              <span className="text-[13px] text-muted">
                From NASA Human Research Program: {d.source}
              </span>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
