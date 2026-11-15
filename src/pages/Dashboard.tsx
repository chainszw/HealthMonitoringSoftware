import { useMemo } from 'react';
import { Link } from 'react-router';
import { FIGURE_SYSTEMS, heartbeatSeconds } from '../components/figure';
import { IconPlus } from '../components/icons';
import { ActNowBanner } from '../components/today/ActNowBanner';
import { CrewCharacter, type CharacterView } from '../components/today/CrewCharacter';
import {
  AttentionPanel,
  type AttentionView,
  type DueView,
} from '../components/today/AttentionPanel';
import { ReadinessSummary, type ReadinessView } from '../components/today/ReadinessSummary';
import type { VitalTile } from '../components/today/VitalCard';
import { VitalRow } from '../components/today/VitalRow';
import { useLiveFeed, type LiveValue } from '../components/live';
import { useStart } from '../components/startGate';
import { btn, toneOf, type Tone } from '../components/tone';
import { PageHeader } from '../components/ui';
import { formatShipDate, useNow } from '../components/useNow';
import {
  attentionTitle,
  DAILY_ENTRIES,
  dueEntries,
  entryKeyOf,
  entryLabel,
  entryStatus,
  logHref,
  primaryIndicator,
  type EntryKey,
} from '../components/vitals';
import { content, getIndicator } from '../data/content';
import { formatClock, formatValue, formatWhen, greenBand } from '../lib/format';
import { getSystemStatus } from '../lib/insights';
import { latestByIndicator } from '../lib/readings';
import { getStatus } from '../lib/status';
import { getAttention, getReadinessBreakdown } from '../lib/today';
import { chartDomain, seriesFor } from '../lib/trends';
import type { BodySystemId, Reading } from '../lib/types';
import { organTint } from '../components/anatomy/organs';
import { useMissionDay, useReadings, useRoutine, useSession, useSync } from '../lib/useReadings';

// Owner B: "Today" dashboard. KPI vitals first (left, largest), then what to do (right).
// At ≥1280×600 the app locks to the viewport (`.chc-fit` rule in index.css): no page scroll;
// only the attention list scrolls inside its panel. Smaller screens fall back to normal flow.

const TILE_KEYS: EntryKey[] = [
  'heart_rate',
  'bp',
  'spo2',
  'body_temp',
  'blood_glucose',
  'sleep_hours',
];

function buildTile(key: EntryKey, readings: Reading[], now: Date): VitalTile {
  const st = entryStatus(key, readings);
  const indicator = primaryIndicator(key)!;
  const data = seriesFor(key, 7, readings, now).flatMap((p) => (p ? [p.value] : []));
  const band = greenBand(indicator);
  const [min, max] = chartDomain(data, band);
  const tile: VitalTile = {
    label: st.label,
    short: st.label.toLowerCase(),
    unit: st.unit,
    meaning: st.value ? (st.bandLabel ?? '') : 'Not logged yet',
    href: logHref(key),
    data,
    min,
    max,
    band,
  };
  if (st.value) tile.value = st.value;
  if (st.tone) tile.tone = st.tone;
  if (st.timestamp) tile.time = formatWhen(st.timestamp, now);
  return tile;
}

const RANK: Record<Tone, number> = { normal: 0, watch: 1, act: 2 };

/** Demo mode: put the live value, its status and its streaming series on a tile. */
function withLive(key: EntryKey, t: VitalTile, lv: LiveValue | undefined): VitalTile {
  if (!lv || !t.value) return t;
  const ids = key === 'bp' ? ['bp_systolic', 'bp_diastolic'] : [key];
  const tones = ids.map((id, i) => {
    const ind = getIndicator(id);
    return ind ? toneOf(getStatus(ind, lv.now[i]).level) : null;
  });
  const tone = tones.reduce<Tone>((w, x) => (x && RANK[x] > RANK[w] ? x : w), 'normal');
  const value =
    key === 'bp' ? `${lv.now[0]}/${lv.now[1]}` : formatValue(primaryIndicator(key), lv.now[0]);
  const [min, max] = chartDomain(lv.series, t.band);
  return { ...t, value, tone, data: lv.series, min, max };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function Dashboard() {
  const { readings } = useReadings();
  const sync = useSync();
  const now = useNow();
  const missionDay = useMissionDay();
  const routine = useRoutine(content.routine.daily);
  const crewName = useSession().session?.crew.name;
  // Demo data: numbers change every second (display only). Real data: readings as they are.
  const demo = useStart().mode === 'demo';
  const bases = useMemo(() => {
    const l = latestByIndicator(readings);
    const b: Partial<Record<EntryKey, number[]>> = {};
    for (const k of ['heart_rate', 'spo2', 'body_temp', 'blood_glucose'] as const) {
      if (l[k]) b[k] = [l[k].value];
    }
    if (l.bp_systolic && l.bp_diastolic) b.bp = [l.bp_systolic.value, l.bp_diastolic.value];
    return b;
  }, [readings]);
  const live = useLiveFeed(demo, bases);

  const view = useMemo(() => {
    const attention = getAttention(readings, now);
    const breakdown = getReadinessBreakdown(readings, now, {
      done: routine.day.done,
      total: routine.day.total,
    });
    const red = attention.filter((a) => a.level === 'red');
    const names = attention.map((a) => entryLabel(entryKeyOf(a.key)).toLowerCase());
    const headline =
      breakdown.level === 'red'
        ? `Limited: ${plural(red.length, 'alert', 'alerts')} to act on`
        : breakdown.level === 'amber'
          ? `Ready, ${plural(attention.length, 'thing', 'things')} to watch`
          : breakdown.level === 'green'
            ? 'Ready for today'
            : 'Log your vitals to see readiness';
    const sub =
      breakdown.level === 'red'
        ? `Handle ${names[0]} first. The score updates after your re-check.`
        : breakdown.level === 'amber'
          ? `Fit for today’s schedule. Watch: ${names.join(', ')}.`
          : breakdown.level === 'green'
            ? 'Every current reading is in range.'
            : 'Readiness uses readings from the last 48 hours.';
    const sleepIndicator = getIndicator('sleep_hours');
    const ready: ReadinessView = {
      score: breakdown.score,
      tone: toneOf(breakdown.level),
      headline,
      sub,
      parts: [
        {
          label: 'Vitals',
          value: `${breakdown.vitals.ok} ok, ${breakdown.vitals.off} off`,
          tone: breakdown.vitals.off ? (toneOf(breakdown.level) ?? undefined) : undefined,
        },
        {
          label: 'Sleep',
          value:
            breakdown.sleep.hours !== undefined
              ? `${formatValue(sleepIndicator, breakdown.sleep.hours)} of ${breakdown.sleep.target ?? '--'} h`
              : '--',
          tone: toneOf(breakdown.sleep.level) ?? undefined,
        },
        { label: 'Routine', value: `${routine.day.done} of ${routine.day.total}` },
      ],
    };
    const items: AttentionView[] = attention.map((a) => ({
      key: a.key,
      tone: a.level === 'red' ? 'act' : 'watch',
      title: attentionTitle(a),
      detail: a.actionSteps[0] ?? a.action,
      cta: a.key === 'sleep_hours' || a.key === 'mood' ? 'Log again' : 'Re-measure',
      href: logHref(entryKeyOf(a.key)),
    }));
    const due: DueView[] = dueEntries(readings, now).map((d) => ({
      key: d.key,
      name: d.label,
      when: d.lastAt ? `Last logged ${formatWhen(d.lastAt, now)}` : 'Not logged yet',
      href: logHref(d.key),
    }));
    const firstRed = red[0];
    const banner = firstRed && {
      title: `${attentionTitle(firstRed)} at ${formatWhen(firstRed.timestamp, now)}`,
      action: firstRed.actionSteps.join(' ') || firstRed.action,
      href: logHref(entryKeyOf(firstRed.key)),
    };
    const tones = Object.fromEntries(
      FIGURE_SYSTEMS.map((id) => [id, toneOf(getSystemStatus(id, readings, now))]),
    );
    const character: CharacterView = {
      tones,
      tint: organTint(
        Object.fromEntries(
          [...FIGURE_SYSTEMS, 'metabolic', 'muscle'].map((id) => [
            id,
            toneOf(getSystemStatus(id as BodySystemId, readings, now)),
          ]),
        ),
      ),
      flagged: Object.values(tones).filter((t) => t === 'watch' || t === 'act').length,
    };
    const hr = entryStatus('heart_rate', readings).value;
    const beat = heartbeatSeconds(readings);
    if (crewName) character.name = crewName;
    if (hr) character.heartRate = hr;
    if (beat) character.beatSeconds = beat;
    return {
      tiles: TILE_KEYS.map((k) => buildTile(k, readings, now)),
      character,
      ready,
      items,
      due,
      banner,
      logged: DAILY_ENTRIES.length - due.length,
    };
  }, [readings, now, routine.day.done, routine.day.total, crewName]);

  const tiles = live
    ? view.tiles.map((t, i) => withLive(TILE_KEYS[i], t, live.values[TILE_KEYS[i]]))
    : view.tiles;
  const liveHr = live?.values.heart_rate?.now[0];
  const character: CharacterView = liveHr
    ? { ...view.character, heartRate: String(liveHr), beatSeconds: 60 / liveHr }
    : view.character;

  return (
    <div className="flex flex-col gap-3.5 xl:min-h-0 xl:flex-1">
      <PageHeader
        title="Today"
        meta={[
          { label: 'Mission day', value: missionDay || '--' },
          { label: 'Date', value: formatShipDate(now) },
          { label: 'Ship time', value: formatClock(now) },
        ]}
      >
        <Link to="/log" className={btn('primary', 'h-11 pr-5 pl-4 text-base no-underline')}>
          <IconPlus size={20} strokeWidth={2.2} />
          Log vitals
        </Link>
      </PageHeader>

      {view.banner && (
        <ActNowBanner
          {...view.banner}
          note={
            sync.status === 'disabled'
              ? undefined
              : 'Your flight surgeon sees this reading after the next sync.'
          }
        />
      )}

      <div className="flex flex-col gap-3.5 xl:min-h-0 xl:flex-1 xl:flex-row">
        <section
          aria-labelledby="vit-h"
          className="flex min-w-0 animate-chc-in flex-col gap-2 [animation-delay:60ms] xl:min-h-0 xl:flex-1"
        >
          <h2 id="vit-h" className="sr-only">
            Today’s vitals
          </h2>
          {/* One card per vital, stacked. */}
          <div className="flex flex-col gap-2 xl:min-h-0 xl:flex-1">
            {tiles.map((t, i) => (
              <VitalRow
                key={t.label}
                t={t}
                live={!!live?.values[TILE_KEYS[i]]}
                tickAt={live?.values[TILE_KEYS[i]] ? live.tickAt : undefined}
              />
            ))}
          </div>
        </section>

        {/* Live crew character: reserved stage for the 3D body model */}
        <div className="flex min-w-0 animate-chc-in flex-col [animation-delay:90ms] xl:min-h-0 xl:w-[clamp(250px,20vw,340px)] xl:shrink-0">
          <CrewCharacter view={character} />
        </div>

        <div className="flex min-w-0 animate-chc-in flex-col gap-3.5 [animation-delay:120ms] xl:min-h-0 xl:w-[clamp(340px,26vw,440px)] xl:shrink-0">
          <ReadinessSummary ready={view.ready} />
          <AttentionPanel
            items={view.items}
            due={view.due}
            logged={view.logged}
            total={DAILY_ENTRIES.length}
          />
        </div>
      </div>
    </div>
  );
}
