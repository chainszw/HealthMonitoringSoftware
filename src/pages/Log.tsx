import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  IconArrowRight,
  IconChevronRight,
  IconClock,
  IconInfo,
  IconMinus,
  IconPlus,
  IconTriangle,
} from '../components/icons';
import { btn, ROW, TONE, toneOf, type Tone } from '../components/tone';
import { PageHeader, Panel, ProgressBar, StatusIcon, SubHeading, TonePill } from '../components/ui';
import { useNow } from '../components/useNow';
import {
  DAILY_ENTRIES,
  dueEntries,
  ENTRY_KEYS,
  entryIndicatorIds,
  entryLabel,
  entryRange,
  entryStatus,
  entryUnit,
  primaryIndicator,
  type EntryKey,
  type EntryStatus,
} from '../components/vitals';
import { content, getIndicator } from '../data/content';
import { formatClock, formatValue, formatWhen, greenBand } from '../lib/format';
import { localDay } from '../lib/routine';
import { getStatus, worstStatus } from '../lib/status';
import { chartDomain, dailySeries, seriesFor } from '../lib/trends';
import type { Indicator, Reading } from '../lib/types';
import { useMissionDay, useReadings, useSync } from '../lib/useReadings';
import { validateBloodPressure, validateValue } from '../lib/validation';

// Owner B: "03 · Log vitals" from the design canvas. Saves through useReadings().add(); status,
// ranges and guidance come from getStatus() and content.json. `?i=<entry>` picks an entry.

/** Mood scale words (UI labels; the guidance comes from the mood indicator). */
const MOOD_WORDS = ['Very low', 'Low', 'Okay', 'Good', 'Very good'];
const FIELD_LABEL: Record<string, string> = {
  bp_systolic: 'Top number',
  bp_diastolic: 'Bottom number',
};

type Live =
  | { kind: 'empty' }
  | { kind: 'error'; error: string }
  | { kind: 'ok'; values: Record<string, number>; tone: Tone | null };

function evaluate(key: EntryKey, vals: Record<string, string>): Live {
  const ids = entryIndicatorIds(key);
  if (ids.some((id) => !vals[id]?.trim())) return { kind: 'empty' };
  const indicators = ids.map((id) => getIndicator(id)!);
  const values: Record<string, number> = {};
  if (key === 'bp') {
    const r = validateBloodPressure(
      indicators[0],
      indicators[1],
      vals.bp_systolic,
      vals.bp_diastolic,
    );
    if (!r.ok) return { kind: 'error', error: r.error };
    values.bp_systolic = r.systolic;
    values.bp_diastolic = r.diastolic;
  } else {
    const r = validateValue(indicators[0], vals[key]);
    if (!r.ok) return { kind: 'error', error: r.error };
    values[key] = r.value;
  }
  const level = worstStatus(indicators.map((i) => getStatus(i, values[i.id]).level));
  return { kind: 'ok', values, tone: toneOf(level) };
}

const midGreen = (i: Indicator) => {
  const [lo, hi] = greenBand(i);
  return formatValue(i, Math.round((lo + hi) / 2 / i.input.step) * i.input.step);
};

export function Log() {
  const { readings, add, remove } = useReadings();
  const sync = useSync();
  const now = useNow();
  const missionDay = useMissionDay();
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('i');
  const [sel, setSel] = useState<EntryKey>(() =>
    fromUrl && ENTRY_KEYS.includes(fromUrl)
      ? fromUrl
      : (dueEntries(readings, new Date())[0]?.key ?? 'bp'),
  );
  const [vals, setVals] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Partial<Record<EntryKey, boolean>>>(() =>
    fromUrl && ENTRY_KEYS.includes(fromUrl) ? { [fromUrl]: true } : {},
  );
  const [mood, setMood] = useState<number | null>(null);
  const [tags, setTags] = useState<Record<string, boolean>>({});

  const pick = (k: EntryKey) => {
    setSel(k);
    setVals({});
    setMood(null);
    setTags({});
    if (params.has('i')) setParams({}, { replace: true });
  };
  // A link from another screen (e.g. "Re-measure") picks its entry and opens the form.
  const [seenUrl, setSeenUrl] = useState(fromUrl);
  if (fromUrl !== seenUrl) {
    setSeenUrl(fromUrl);
    if (fromUrl && ENTRY_KEYS.includes(fromUrl)) {
      setSel(fromUrl);
      setEditing({ ...editing, [fromUrl]: true });
    }
  }

  const today = localDay(now);
  const todays = useMemo(
    () => readings.filter((r) => localDay(new Date(r.timestamp)) === today),
    [readings, today],
  );
  const todayStatus = (k: EntryKey) => entryStatus(k, todays);
  const due = dueEntries(readings, now);
  const doneKeys = ENTRY_KEYS.filter((k) => todayStatus(k).value !== undefined);
  const otherKeys = ENTRY_KEYS.filter((k) => !DAILY_ENTRIES.includes(k) && !doneKeys.includes(k));
  const doneCount = DAILY_ENTRIES.length - due.length;

  const isMood = sel === 'mood';
  const st = todayStatus(sel);
  const showResult = st.value !== undefined && !editing[sel];
  const live = isMood ? null : evaluate(sel, vals);
  const nextKey = due.find((d) => d.key !== sel && todayStatus(d.key).value === undefined)?.key;

  const save = (values: Record<string, number>, note?: string) => {
    const timestamp = new Date().toISOString();
    for (const [indicatorId, value] of Object.entries(values)) {
      add(note ? { indicatorId, value, timestamp, note } : { indicatorId, value, timestamp });
    }
    setEditing({ ...editing, [sel]: false });
    setVals({});
  };
  const again = () => {
    setEditing({ ...editing, [sel]: true });
    setVals({});
    setMood(null);
    setTags({});
  };
  const goNext = () => nextKey && pick(nextKey);

  return (
    <div className="flex flex-col gap-3.5 xl:min-h-0 xl:flex-1">
      <PageHeader
        title="Log vitals"
        meta={[
          { label: 'Mission day', value: missionDay || '--' },
          { label: 'Logged today', value: `${doneCount} of ${DAILY_ENTRIES.length}` },
          { label: 'Ship time', value: formatClock(now) },
        ]}
      >
        <span className="text-sm text-muted">
          Measure, save, and get a next step straight away.
        </span>
      </PageHeader>

      <div className="chc-fit-cols flex flex-col gap-3.5 xl:min-h-0 xl:flex-1 xl:flex-row">
        {/* Column A: today's list */}
        <div className="flex min-w-0 animate-chc-in flex-col [animation-delay:60ms] xl:min-h-0 xl:w-[clamp(260px,21vw,340px)] xl:shrink-0">
          <Panel className="chc-scroll flex-1 !gap-0.5 !p-4">
            <div className="flex flex-col gap-2 pb-1">
              <h2 className="m-0 text-lg font-medium tracking-[-0.01em]">Today’s list</h2>
              <div className="flex items-center gap-3">
                <ProgressBar
                  value={doneCount}
                  max={DAILY_ENTRIES.length}
                  label="Measurements logged today"
                  className="flex-1"
                />
                <span className="font-mono text-[13px] whitespace-nowrap text-muted">
                  {doneCount} of {DAILY_ENTRIES.length} logged
                </span>
              </div>
            </div>
            {due.length > 0 && (
              <div className="pt-2 pb-1">
                <SubHeading>Due</SubHeading>
              </div>
            )}
            {due.map((d) => (
              <ListRow
                key={d.key}
                on={sel === d.key}
                onClick={() => pick(d.key)}
                icon={
                  <span className="text-muted">
                    <IconClock size={20} strokeWidth={1.8} />
                  </span>
                }
                title={d.label}
                sub={d.lastAt ? `Last ${formatWhen(d.lastAt, now)}` : 'Not logged yet'}
              />
            ))}
            {doneKeys.length > 0 && (
              <div className="pt-3 pb-1">
                <SubHeading>Done</SubHeading>
              </div>
            )}
            {doneKeys.map((k) => {
              const s = todayStatus(k);
              return (
                <ListRow
                  key={k}
                  on={sel === k}
                  onClick={() => pick(k)}
                  icon={
                    s.tone && (
                      <span className={TONE[s.tone].text}>
                        <StatusIcon tone={s.tone} size={20} strokeWidth={2.2} />
                      </span>
                    )
                  }
                  title={s.label}
                  sub={`${s.value} ${s.unit} · ${formatWhen(s.timestamp!, now)}`}
                  mono
                />
              );
            })}
            {otherKeys.length > 0 && (
              <div className="pt-3 pb-1">
                <SubHeading>When asked</SubHeading>
              </div>
            )}
            {otherKeys.map((k) => {
              const s = entryStatus(k, readings);
              return (
                <ListRow
                  key={k}
                  on={sel === k}
                  onClick={() => pick(k)}
                  icon={
                    <span className="text-muted">
                      <IconPlus size={20} strokeWidth={1.8} />
                    </span>
                  }
                  title={s.label}
                  sub={s.timestamp ? `Last ${formatWhen(s.timestamp, now)}` : 'Not logged yet'}
                />
              );
            })}
          </Panel>
        </div>

        {/* Column B: entry / result / mood */}
        <div className="flex min-w-0 animate-chc-in flex-col [animation-delay:120ms] xl:min-h-0 xl:flex-1">
          <section
            aria-live="polite"
            className={`flex flex-1 flex-col gap-4 rounded-[18px] border bg-surface p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] xl:min-h-0 xl:overflow-y-auto ${showResult && st.tone === 'act' ? 'border-act-l' : showResult && st.tone === 'watch' ? 'border-watch/45' : 'border-line'}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-[22px] leading-7 font-medium tracking-[-0.02em]">
                {entryLabel(sel)}
              </h2>
              <span className="font-mono text-[13px] text-muted">
                {isMood ? 'Takes 30 seconds' : `Unit: ${entryUnit(sel)} · range ${entryRange(sel)}`}
              </span>
            </div>

            {showResult ? (
              <ResultView
                st={st}
                isMood={isMood}
                note={todays.find((r) => r.id === st.ids[0])?.note}
                syncOn={sync.status !== 'disabled'}
                next={
                  <NextButton nextName={nextKey ? entryLabel(nextKey) : null} onNext={goNext} />
                }
                onAgain={again}
                onRemove={() => st.ids.forEach((id) => remove(id))}
              />
            ) : isMood ? (
              <MoodForm
                mood={mood}
                tags={tags}
                onMood={setMood}
                onTag={(id) => setTags({ ...tags, [id]: !tags[id] })}
                onSave={() => {
                  if (mood == null) return;
                  const note = content.moodTags
                    .filter((t) => tags[t.id])
                    .map((t) => t.label)
                    .join(', ');
                  save({ mood }, note || undefined);
                }}
              />
            ) : (
              <VitalForm
                entry={sel}
                vals={vals}
                live={live!}
                onChange={setVals}
                onSave={() => live?.kind === 'ok' && save(live.values)}
                time={formatClock(now)}
              />
            )}
          </section>
        </div>

        {/* Column C: range + recent, or mood history */}
        <div className="chc-scroll flex min-w-0 animate-chc-in flex-col gap-3.5 [animation-delay:180ms] xl:w-[clamp(300px,25vw,420px)] xl:shrink-0">
          {isMood ? (
            <MoodHistory readings={readings} now={now} />
          ) : (
            <>
              <RangePanel
                entry={sel}
                readings={readings}
                now={now}
                current={
                  live?.kind === 'ok'
                    ? { values: live.values, tone: live.tone }
                    : showResult
                      ? {
                          values: Object.fromEntries(
                            st.ids.map((id) => {
                              const r = todays.find((x) => x.id === id)!;
                              return [r.indicatorId, r.value];
                            }),
                          ),
                          tone: st.tone,
                        }
                      : null
                }
              />
              <RecentReadings entry={sel} readings={readings} now={now} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ListRow({
  on,
  onClick,
  icon,
  title,
  sub,
  mono = false,
}: {
  on: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  sub: string;
  mono?: boolean;
}) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`${ROW} cursor-pointer`}>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-medium">{title}</span>
        <span className={`text-[13px] text-muted ${mono ? 'font-mono' : ''}`}>{sub}</span>
      </span>
      <span className="text-muted">
        <IconChevronRight size={18} />
      </span>
    </button>
  );
}

function VitalForm({
  entry,
  vals,
  live,
  onChange,
  onSave,
  time,
}: {
  entry: EntryKey;
  vals: Record<string, string>;
  live: Live;
  onChange: (v: Record<string, string>) => void;
  onSave: () => void;
  time: string;
}) {
  const indicators = entryIndicatorIds(entry).map((id) => getIndicator(id)!);
  const steps = primaryIndicator(entry)?.howToMeasureSteps ?? [];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-4">
        {indicators.map((ind) => {
          const raw = vals[ind.id] ?? '';
          const label = FIELD_LABEL[ind.id] ?? ind.name;
          const ph = midGreen(ind);
          const bump = (dir: number) => () => {
            const base = raw === '' || isNaN(Number(raw)) ? Number(ph) : Number(raw);
            const n = base + dir * ind.input.step;
            onChange({
              ...vals,
              [ind.id]: formatValue(ind, Math.min(ind.input.max, Math.max(ind.input.min, n))),
            });
          };
          return (
            <div key={ind.id} className="flex min-w-[220px] flex-1 flex-col gap-2">
              <label htmlFor={`v-${ind.id}`} className="text-[15px] font-medium text-text">
                {label}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={bump(-1)}
                  aria-label={`Lower ${label}`}
                  className={btn('secondary', 'size-12 shrink-0 cursor-pointer')}
                >
                  <IconMinus size={20} />
                </button>
                <div
                  className={`flex h-12 min-w-0 flex-1 items-baseline gap-1.5 rounded-xl border bg-sunk px-3 transition-shadow focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(90,185,252,0.16)] ${live.kind === 'ok' && live.tone === 'act' ? 'border-act-l' : raw !== '' ? 'border-accent shadow-[0_0_0_3px_rgba(90,185,252,0.16)]' : 'border-line-2'}`}
                >
                  <input
                    id={`v-${ind.id}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={raw}
                    placeholder={ph}
                    onChange={(e) =>
                      onChange({
                        ...vals,
                        [ind.id]: e.target.value.replace(/[^0-9.]/g, '').slice(0, 6),
                      })
                    }
                    onKeyDown={(e) => e.key === 'Enter' && onSave()}
                    className="h-full min-w-0 flex-1 bg-transparent font-mono text-[26px] font-medium tabular-nums text-ink outline-none placeholder:text-faint focus-visible:outline-none"
                  />
                  <span className="shrink-0 font-mono text-sm text-text">{entryUnit(entry)}</span>
                </div>
                <button
                  type="button"
                  onClick={bump(1)}
                  aria-label={`Raise ${label}`}
                  className={btn('secondary', 'size-12 shrink-0 cursor-pointer')}
                >
                  <IconPlus size={20} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {live.kind === 'error' && (
        <span role="status" className="inline-flex items-center gap-2 text-[15px] text-watch">
          <IconTriangle size={16} />
          {live.error}
        </span>
      )}
      {steps.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-line bg-sunk p-4">
          <span className="text-accent">
            <IconInfo size={22} strokeWidth={1.8} />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-muted">How to measure in space</span>
            <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[15px] leading-[22px] text-text">
              {steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={live.kind !== 'ok'}
          onClick={onSave}
          className={`${btn('primary', 'h-12 cursor-pointer px-6 text-base')} disabled:!bg-raised disabled:!text-muted`}
        >
          Save reading
        </button>
        <span className="text-[13px] text-muted">
          Saves with ship time {time} · your range {entryRange(entry)}
        </span>
      </div>
    </div>
  );
}

function ResultView({
  st,
  isMood,
  note,
  syncOn,
  next,
  onAgain,
  onRemove,
}: {
  st: EntryStatus;
  isMood: boolean;
  note?: string;
  syncOn: boolean;
  next: ReactNode;
  onAgain: () => void;
  onRemove: () => void;
}) {
  const tone = st.tone ?? 'normal';
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <span
          className={`flex size-14 items-center justify-center rounded-xl ${TONE[tone].bg} ${TONE[tone].text}`}
        >
          <StatusIcon tone={tone} size={30} strokeWidth={2.2} />
        </span>
        <div className="flex flex-col">
          <span className={`text-[15px] font-medium ${TONE[tone].text}`}>{TONE[tone].label}</span>
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-[46px] leading-[50px] font-medium tracking-[-0.03em] tabular-nums">
              {st.value}
            </span>
            <span className="font-mono text-[19px] text-text">{st.unit}</span>
            <span className="font-mono text-[15px] text-muted">
              at {formatClock(new Date(st.timestamp!))}
            </span>
          </span>
        </div>
      </div>
      {st.bandLabel && <p className="m-0 text-lg leading-7 text-text">{st.bandLabel}.</p>}
      {isMood && note && <p className="m-0 text-[15px] text-text">Noted: {note}</p>}
      <div
        className={`flex flex-col gap-2 rounded-xl border p-4 ${tone === 'act' ? 'border-act-l bg-act-t' : 'border-line bg-sunk'}`}
      >
        <span className="text-[13px] font-medium text-muted">Next step</span>
        <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-lg leading-6 font-medium">
          {st.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {tone === 'act' && st.escalation && (
          <p className="m-0 pt-1 text-[15px] leading-[22px] text-text">{st.escalation}</p>
        )}
        {tone !== 'normal' && syncOn && (
          <span className="text-[13px] text-muted">
            Your flight surgeon sees this reading after the next sync.
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {next}
        <button type="button" onClick={onAgain} className={btn('ghost', 'cursor-pointer px-4')}>
          {isMood ? 'Check in again' : 'Log it again'}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className={btn('ghost', 'cursor-pointer border-transparent px-4 text-muted')}
        >
          Remove this reading
        </button>
      </div>
    </div>
  );
}

function NextButton({ nextName, onNext }: { nextName: string | null; onNext: () => void }) {
  return nextName ? (
    <button type="button" onClick={onNext} className={btn('primary', 'group cursor-pointer px-5')}>
      Next: {nextName}
      <IconArrowRight size={16} className="transition-transform group-hover:translate-x-[3px]" />
    </button>
  ) : (
    <Link to="/" className={btn('primary', 'group px-5 no-underline')}>
      All done, back to today
      <IconArrowRight size={16} className="transition-transform group-hover:translate-x-[3px]" />
    </Link>
  );
}

function MoodForm({
  mood,
  tags,
  onMood,
  onTag,
  onSave,
}: {
  mood: number | null;
  tags: Record<string, boolean>;
  onMood: (m: number) => void;
  onTag: (id: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="pb-3 text-lg font-medium">How are you feeling right now?</legend>
        <div className="grid grid-cols-5 gap-2 max-sm:grid-cols-3">
          {MOOD_WORDS.map((w, i) => {
            const on = mood === i + 1;
            return (
              <button
                key={w}
                type="button"
                aria-pressed={on}
                onClick={() => onMood(i + 1)}
                className={`flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border transition ${on ? 'border-ink/60 bg-raised text-ink' : 'border-line-2 text-muted hover:bg-hover'}`}
              >
                <span className="text-[32px] leading-9 font-medium tabular-nums">{i + 1}</span>
                <span className="text-[13px] font-medium">{w}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {content.moodTags.length > 0 && (
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="pb-3 text-base font-medium">
            Anything weighing on you?{' '}
            <span className="text-[13px] font-normal text-muted">Optional</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {content.moodTags.map(({ id, label }) => {
              const on = !!tags[id];
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onTag(id)}
                  className={`h-11 cursor-pointer rounded-xl border px-4 text-[15px] font-medium transition ${on ? 'border-ink/60 bg-raised text-ink' : 'border-line-2 text-muted hover:bg-hover'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={mood == null}
          onClick={onSave}
          className={`${btn('primary', 'h-12 cursor-pointer px-6 text-base')} disabled:!bg-raised disabled:!text-muted`}
        >
          Save check-in
        </button>
        <span className="text-[13px] text-muted">
          Private to you and your flight surgeon. It shows as a number on your Mind card.
        </span>
      </div>
    </div>
  );
}

function RangePanel({
  entry,
  readings,
  now,
  current,
}: {
  entry: EntryKey;
  readings: Reading[];
  now: Date;
  current: { values: Record<string, number>; tone: Tone | null } | null;
}) {
  const indicators = entryIndicatorIds(entry).map((id) => getIndicator(id)!);
  return (
    <Panel
      title="Your range"
      aside="last 7 days"
      className="shrink-0 !gap-3.5 !p-4 [&_h2]:!text-lg"
    >
      {indicators.map((ind) => {
        const [lo, hi] = greenBand(ind);
        const hist = dailySeries(ind.id, 7, readings, now).flatMap((p) => (p ? [p.value] : []));
        const cv = current?.values[ind.id];
        const [min, max] = chartDomain(cv === undefined ? hist : [...hist, cv], [lo, hi]);
        const pct = (x: number) =>
          `${Math.max(0, Math.min(100, ((x - min) / (max - min)) * 100)).toFixed(1)}%`;
        const label = FIELD_LABEL[ind.id] ?? ind.name;
        const curColor =
          cv !== undefined && current?.tone && current.tone !== 'normal'
            ? TONE[current.tone].hex
            : '#e9edf3';
        const range = entryRange(ind.id);
        return (
          <div key={ind.id} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{label}</span>
              <span className="font-mono text-muted">{range}</span>
            </div>
            <div
              role="img"
              aria-label={`${label}: your range ${range}${cv !== undefined ? `, this reading ${cv}` : ''}`}
              className="relative h-7 rounded-lg bg-sunk"
            >
              <div
                className="absolute inset-y-0 rounded-md bg-ink/8 outline outline-ink/20"
                style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }}
              />
              {hist.map((x, i) => (
                <span
                  key={i}
                  className="absolute top-2 bottom-2 w-0.5 -translate-x-1/2 rounded bg-ink/45"
                  style={{ left: pct(x) }}
                />
              ))}
              {cv !== undefined && (
                <span
                  className="absolute -top-1 -bottom-1 w-1 -translate-x-1/2 rounded-full transition-[left]"
                  style={{ left: pct(cv), background: curColor }}
                />
              )}
            </div>
            <div className="flex justify-between font-mono text-[13px] text-muted">
              <span>{formatValue(ind, min)}</span>
              <span className={cv !== undefined ? 'text-ink' : ''}>
                {cv !== undefined ? `This reading ${formatValue(ind, cv)}` : `Your range ${range}`}
              </span>
              <span>{formatValue(ind, max)}</span>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-4 text-[13px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-ink/8 outline outline-ink/30" />
          Your range
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 rounded bg-ink/45" />
          Past readings
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-1 rounded-full bg-ink" />
          This reading
        </span>
      </div>
    </Panel>
  );
}

function RecentReadings({
  entry,
  readings,
  now,
}: {
  entry: EntryKey;
  readings: Reading[];
  now: Date;
}) {
  const ind = primaryIndicator(entry);
  const rows = seriesFor(entry, 60, readings, now)
    .flatMap((p) => (p ? [p] : []))
    .reverse()
    .slice(0, 5);
  return (
    <Panel
      title="Recent readings"
      aside={
        <Link
          to="/trends"
          className="font-display text-[15px] text-accent no-underline hover:text-[#8fd0fd]"
        >
          Open trends
        </Link>
      }
      className="shrink-0 !gap-0.5 !p-4 [&_h2]:!text-lg"
    >
      {rows.map((p) => (
        <div key={p.id} className="flex items-center gap-3 border-t border-line py-2">
          <span className="flex-1 font-mono text-[13px] text-muted">
            {formatWhen(p.timestamp, now)}
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-mono text-base font-medium tabular-nums">
              {formatValue(ind, p.value)}
              {p.value2 !== undefined && `/${p.value2}`}
            </span>
            <span className="font-mono text-[13px] text-text">{entryUnit(entry)}</span>
          </span>
          <TonePill tone={toneOf(p.level)} />
        </div>
      ))}
      {rows.length === 0 && <span className="text-[15px] text-muted">No readings yet.</span>}
    </Panel>
  );
}

function MoodHistory({ readings, now }: { readings: Reading[]; now: Date }) {
  const series = dailySeries('mood', 7, readings, now);
  const low = series.filter((p) => p && p.level !== 'green').length;
  const logged = series.filter((p) => p).length;
  return (
    <Panel title="Your last 7 days" aside="1 to 5" className="shrink-0 !gap-3 !p-4 [&_h2]:!text-lg">
      <div
        role="img"
        aria-label={`Mood check-ins, oldest to newest: ${series.map((p) => p?.value ?? 'none').join(', ')}`}
        className="flex h-[150px] items-end gap-2"
      >
        {series.map((p, i) => {
          const off = p && p.level !== 'green';
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1.5">
              <span className="h-4 text-watch">
                {off && <IconTriangle size={14} strokeWidth={2.6} />}
              </span>
              <span className="font-mono text-[13px] text-text">{p?.value ?? '–'}</span>
              <div
                className="w-full rounded-t-md"
                style={{
                  height: p ? `${(p.value / 5) * 110}px` : '4px',
                  background: off ? 'rgba(251,191,74,0.55)' : 'rgba(233,237,243,0.32)',
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        {series.map((_, i) => {
          const d = new Date(now);
          d.setDate(d.getDate() - (6 - i));
          return (
            <span key={i} className="flex-1 text-center font-mono text-[13px] text-muted">
              {i === 6 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' })}
            </span>
          );
        })}
      </div>
      <p className="m-0 text-[15px] leading-[22px] text-text">
        {logged === 0
          ? 'No check-ins this week yet.'
          : low === 0
            ? `Steady: ${logged} check-ins, none low.`
            : `${low} low ${low === 1 ? 'day' : 'days'} in the last 7. ${getIndicator('mood')?.escalation ?? ''}`}
      </p>
    </Panel>
  );
}
