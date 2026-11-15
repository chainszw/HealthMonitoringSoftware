import { useMemo, useState, type ComponentType } from 'react';
import { Link } from 'react-router';
import { BodyFigure, type FigureCallout } from '../components/BodyFigure';
import { FIGURE_LABEL, FIGURE_SYSTEMS } from '../components/figure';
import {
  IconArrowRight,
  IconBox,
  IconChevronRight,
  IconGlobe,
  IconGravity,
  IconMinus,
  IconOctagon,
  IconRadiation,
  IconWind,
} from '../components/icons';
import { btn, ROW, TONE, toneOf, type Tone } from '../components/tone';
import { Legend, PageHeader, Panel, StatusIcon, TonePill } from '../components/ui';
import { useNow } from '../components/useNow';
import {
  entryKeyOf,
  entryLabel,
  entryStatus,
  logHref,
  type EntryStatus,
} from '../components/vitals';
import { content, getBodySystem, getIndicator } from '../data/content';
import { formatWhen } from '../lib/format';
import { getSystemStatus } from '../lib/insights';
import type { BodySystemId, Reading } from '../lib/types';
import { useMissionDay, useReadings, useSync } from '../lib/useReadings';

// Owner B: "02 · Body view" from the design canvas. System status comes from getSystemStatus();
// the text from content.json (body systems, hazards, indicator actions).

/** Systems on the figure, plus metabolic (glucose), which is only listed. */
const SYSTEMS: BodySystemId[] = [...FIGURE_SYSTEMS, 'metabolic'];

const HAZARD_ICON: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  radiation: IconRadiation,
  isolation_confinement: IconBox,
  distance_from_earth: IconGlobe,
  altered_gravity: IconGravity,
  hostile_environment: IconWind,
};

interface SystemView {
  id: BodySystemId;
  name: string;
  tone: Tone | null;
  note: string;
  what: string;
  /** Hazard names. */
  hazards: string[];
  entries: EntryStatus[];
  steps: string[];
  cta: { label: string; href: string };
  source?: string;
  act?: { title: string; action: string; href: string };
}

function systemView(id: BodySystemId, readings: Reading[], now: Date): SystemView | null {
  const system = getBodySystem(id);
  if (!system) return null;
  const level = getSystemStatus(id, readings, now);
  const keys = [...new Set(system.indicatorIds.map(entryKeyOf))];
  const entries = keys.map((k) => entryStatus(k, readings));
  const worst = entries.find((e) => e.value && e.level === level) ?? entries.find((e) => e.value);
  const note = !keys.length
    ? 'no reading tracked'
    : level === 'unknown' || !worst
      ? 'no recent reading'
      : `${worst.label.toLowerCase()} ${worst.value}`;
  const steps =
    level !== 'unknown' && worst?.steps.length
      ? worst.steps
      : (system.steps ?? [content.unknownStatusAction]);
  const firstIndicator = getIndicator(system.indicatorIds[0] ?? '');
  const view: SystemView = {
    id,
    name: system.name,
    tone: toneOf(level),
    note,
    what: system.spaceflightEffects,
    hazards: system.hazards,
    entries,
    steps,
    cta: keys.length
      ? {
          label: `Log ${entryLabel(worst?.key ?? keys[0]).toLowerCase()}`,
          href: logHref(worst?.key ?? keys[0]),
        }
      : { label: 'Open today’s routine', href: '/routine' },
  };
  const source = firstIndicator?.sources[0];
  if (source) view.source = source.org ? `${source.title} (${source.org})` : source.title;
  if (level === 'red' && worst) {
    view.act = {
      title: `${worst.label} ${worst.value} ${worst.unit}`,
      action: worst.steps[0] ?? '',
      href: logHref(worst.key),
    };
  }
  return view;
}

const RANK = { act: 0, watch: 1, normal: 2 } as const;

export function Body() {
  const { readings } = useReadings();
  const sync = useSync();
  const now = useNow();
  const missionDay = useMissionDay();
  const views = useMemo(
    () =>
      SYSTEMS.map((id) => systemView(id, readings, now)).filter((v): v is SystemView => v !== null),
    [readings, now],
  );
  const [sel, setSel] = useState<BodySystemId>(
    () =>
      [...views].sort((a, b) => RANK[a.tone ?? 'normal'] - RANK[b.tone ?? 'normal'])[0]?.id ??
      'heart',
  );
  const [factor, setFactor] = useState<string | null>(null);

  const callouts = useMemo<FigureCallout[]>(
    () =>
      views
        .filter((v) => (FIGURE_SYSTEMS as BodySystemId[]).includes(v.id))
        .map((v) => ({
          id: v.id as FigureCallout['id'],
          name: FIGURE_LABEL[v.id as FigureCallout['id']],
          tone: v.tone,
          text: `${v.tone ? TONE[v.tone].label : 'No data'} · ${v.note}`,
        })),
    [views],
  );
  const flaggedCount = views.filter((v) => v.tone === 'watch' || v.tone === 'act').length;
  const latest = readings.reduce<string | undefined>(
    (max, r) => (!max || r.timestamp > max ? r.timestamp : max),
    undefined,
  );
  const d = views.find((v) => v.id === sel) ?? views[0];
  const factorName = content.hazards.find((h) => h.id === factor)?.name;

  return (
    <div className="flex flex-col gap-3.5 xl:min-h-0 xl:flex-1">
      <PageHeader
        title="Body view"
        meta={[
          { label: 'Mission day', value: missionDay || '--' },
          { label: 'Systems to look at', value: `${flaggedCount} of ${views.length}` },
          { label: 'Last reading', value: latest ? formatWhen(latest, now) : '--' },
        ]}
      >
        <span className="text-sm text-muted">Pick a system on the figure or in the list.</span>
      </PageHeader>

      <div className="chc-fit-cols flex flex-col gap-3.5 xl:min-h-0 xl:flex-1 xl:flex-row">
        {/* Column A: systems + hazards (the column scrolls inside on short screens) */}
        <div className="chc-scroll flex min-w-0 animate-chc-in flex-col gap-3.5 [animation-delay:60ms] xl:w-[clamp(280px,22vw,360px)] xl:shrink-0">
          <Panel
            title="Systems"
            aside={`${views.length} tracked`}
            className="shrink-0 !gap-0.5 !p-4 [&_h2]:!text-lg"
          >
            {views.map((s) => {
              const hit = !!factorName && s.hazards.includes(factorName);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={sel === s.id}
                  onClick={() => setSel(s.id)}
                  className={`${ROW} cursor-pointer transition-opacity ${factor && !hit ? 'opacity-45' : ''}`}
                >
                  <span className={s.tone ? TONE[s.tone].text : 'text-muted'}>
                    {s.tone ? (
                      <StatusIcon tone={s.tone} size={20} strokeWidth={2.2} />
                    ) : (
                      <IconMinus size={20} strokeWidth={2.2} />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-medium">{s.name}</span>
                    <span
                      className={`text-[13px] ${!s.tone || s.tone === 'normal' ? 'text-muted' : `font-medium ${TONE[s.tone].text}`}`}
                    >
                      {s.tone ? TONE[s.tone].label : 'No data'} · {s.note}
                    </span>
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
          <Panel className="shrink-0 !gap-0.5 !p-4">
            <div className="flex flex-col gap-1 pb-1.5">
              <h2 className="m-0 text-lg font-medium tracking-[-0.01em]">What spaceflight does</h2>
              <span className="text-[13px] text-muted">
                The five hazards NASA tracks. Pick one to see which systems it touches.
              </span>
            </div>
            {content.hazards.map((f) => {
              const on = factor === f.id;
              const Icon = HAZARD_ICON[f.id] ?? IconGlobe;
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
                    <span className="text-[13px] leading-[18px] text-muted">{f.summary}</span>
                  </span>
                </button>
              );
            })}
          </Panel>
        </div>

        {/* Column B: large figure */}
        <div className="flex min-w-0 animate-chc-in flex-col [animation-delay:120ms] xl:min-h-0 xl:flex-1">
          <Panel
            sunk
            title="Your body today"
            aside={
              <span className="font-display">
                {flaggedCount
                  ? `${flaggedCount} of ${views.length} systems need a look`
                  : 'Nothing flagged'}
              </span>
            }
            className="min-h-[520px] flex-1 !gap-2 !p-4 xl:min-h-0 [&_h2]:!text-lg"
          >
            <BodyFigure
              systems={callouts}
              selected={
                (FIGURE_SYSTEMS as BodySystemId[]).includes(sel)
                  ? (sel as FigureCallout['id'])
                  : undefined
              }
              onSelect={setSel}
              minHeight={0}
            />
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <Legend />
              <span className="font-mono text-[13px] text-muted">Tap a system</span>
            </div>
          </Panel>
        </div>

        {/* Column C: system panel */}
        {d && (
          <div className="flex min-w-0 animate-chc-in flex-col [animation-delay:180ms] xl:min-h-0 xl:w-[clamp(320px,27vw,460px)] xl:shrink-0">
            <section
              aria-live="polite"
              aria-labelledby="sys-h"
              className={`flex flex-1 flex-col overflow-hidden rounded-[18px] border bg-surface xl:min-h-0 ${d.tone === 'watch' ? 'border-watch/45' : d.tone ? TONE[d.tone].border : 'border-line'}`}
            >
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2
                    id="sys-h"
                    className="m-0 text-[22px] leading-7 font-medium tracking-[-0.02em]"
                  >
                    {d.name}
                  </h2>
                  <TonePill tone={d.tone} />
                </div>
                <p className="m-0 text-[15px] leading-[22px] text-text">{d.what}</p>

                <div className="flex flex-col">
                  <h3 className="m-0 pb-1.5 text-[13px] font-medium text-muted">Your readings</h3>
                  {d.entries.map((r) => (
                    <div
                      key={r.key}
                      className="flex items-center gap-3 border-t border-line py-2.5"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[15px] font-medium">{r.label}</span>
                        <span className="text-[13px] text-muted">
                          {r.timestamp ? formatWhen(r.timestamp, now) : 'not logged yet'}
                        </span>
                      </span>
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-mono text-lg font-medium tabular-nums">
                          {r.value ?? '--'}
                        </span>
                        <span className="font-mono text-[13px] text-text">{r.unit}</span>
                      </span>
                      <TonePill tone={r.tone} />
                    </div>
                  ))}
                  {d.entries.length === 0 && (
                    <span className="border-t border-line py-2.5 text-[15px] text-muted">
                      No vital sign tracks this system yet. Your routine covers it.
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <h3 className="m-0 text-[13px] font-medium text-muted">
                    How spaceflight affects it
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {content.hazards.map((h) => {
                      const on = d.hazards.includes(h.name);
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
                  {d.act && (
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
                            Act now · <span className="font-mono">{d.act.title}</span>
                          </span>
                          <span className="text-lg leading-6 font-medium">{d.act.action}</span>
                        </div>
                      </div>
                      <Link to={d.act.href} className={btn('primary', '!bg-act no-underline')}>
                        Re-measure
                      </Link>
                    </div>
                  )}
                  <ol className="m-0 flex list-none flex-col gap-2 p-0">
                    {d.steps.map((st, i) => (
                      <li key={st} className="flex items-start gap-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-raised font-mono text-[13px] text-ink">
                          {i + 1}
                        </span>
                        <span className="text-[15px] leading-[22px] text-text">{st}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2.5 border-t border-line px-4 pt-3 pb-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  {!d.act && (
                    <Link
                      to={d.cta.href}
                      className={btn(
                        'primary',
                        'group h-auto min-h-11 flex-none px-4 whitespace-nowrap no-underline',
                      )}
                    >
                      {d.cta.label}
                      <IconArrowRight
                        size={16}
                        className="shrink-0 transition-transform group-hover:translate-x-[3px]"
                      />
                    </Link>
                  )}
                  {sync.status !== 'disabled' && d.tone && d.tone !== 'normal' && (
                    <span className="text-[13px] text-muted">
                      Your flight surgeon sees these readings after the next sync.
                    </span>
                  )}
                </div>
                {d.source && <span className="text-[13px] text-muted">Source: {d.source}</span>}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
