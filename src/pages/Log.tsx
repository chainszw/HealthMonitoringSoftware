import { useState } from 'react';
import { Link } from 'react-router';
import {
  IconArrowRight,
  IconChevronRight,
  IconClock,
  IconInfo,
  IconMinus,
  IconPlus,
  IconTriangle,
} from '../components/icons';
import { btn, ROW, TONE, type Tone } from '../components/tone';
import {
  PageTitle,
  Panel,
  ProgressBar,
  StatusIcon,
  StatusPill,
  SubHeading,
} from '../components/ui';
import {
  DONE_BASE,
  DUE_KEYS,
  evalVital,
  MOOD_HISTORY,
  MOOD_TAGS,
  MOOD_WORDS,
  PRE_LOGGED,
  SHIP,
  VITALS,
  type LogKey,
  type VitalKey,
} from './designMock';

// Owner B: "03 · Log vitals" from the design canvas.
// LAYOUT TEST: nothing is saved to storage; state resets on reload.

export function Log() {
  const [sel, setSel] = useState<LogKey>('bp');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Partial<Record<VitalKey, boolean>>>({});
  const [editing, setEditing] = useState<Partial<Record<VitalKey, boolean>>>({});
  const [timer, setTimer] = useState<LogKey | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [tags, setTags] = useState<Record<string, boolean>>({});
  const [moodSaved, setMoodSaved] = useState(false);

  const isSaved = (k: LogKey) => (k === 'mood' ? moodSaved : !!saved[k]);
  const doneKeys: LogKey[] = [...DONE_BASE, ...DUE_KEYS.filter(isSaved)];
  const doneCount = doneKeys.length;
  const valsFor = (k: VitalKey) =>
    PRE_LOGGED[k] && !saved[k] && !editing[k] ? PRE_LOGGED[k].vals : vals;
  const resultFor = (k: VitalKey) => {
    const r = evalVital(k, valsFor(k));
    return r.ok
      ? { ...r, time: PRE_LOGGED[k] && !saved[k] ? PRE_LOGGED[k].time : SHIP.time }
      : null;
  };
  const pick = (k: LogKey) => {
    setSel(k);
    setTimer(null);
    setFlagged(false);
  };

  const isMood = sel === 'mood';
  const def = isMood ? null : VITALS[sel];
  const res = isMood ? null : resultFor(sel);
  const showResult = !isMood && !!res && (!!saved[sel] || (!!PRE_LOGGED[sel] && !editing[sel]));
  const showForm = !isMood && !showResult;
  const live = isMood ? null : evalVital(sel, vals);
  const canSave = !!live?.ok;
  const nextKey = DUE_KEYS.find((k) => k !== sel && !isSaved(k));
  const nextName = nextKey ? (nextKey === 'mood' ? 'Mood check-in' : VITALS[nextKey].name) : null;
  const goNext = () => {
    if (!nextKey) return;
    pick(nextKey);
    setVals({});
  };
  const edit = () => {
    if (isMood) return;
    if (PRE_LOGGED[sel] && !saved[sel]) setVals({});
    setSaved({ ...saved, [sel]: false });
    setEditing({ ...editing, [sel]: true });
    setTimer(null);
  };

  const curVals = isMood ? {} : valsFor(sel);
  const curRes = showResult ? res : live?.ok ? live : null;

  return (
    <>
      <PageTitle
        title="Log vitals"
        meta={[
          { label: 'Mission day', value: SHIP.day },
          { label: 'Logged today', value: `${doneCount} of 7` },
          { label: 'Ship time', value: SHIP.time },
        ]}
      >
        <span className="text-[15px] text-muted">
          Measure, save, and you’ll get a next step straight away.
        </span>
      </PageTitle>

      <div className="chc-fit-cols flex flex-1 flex-wrap items-stretch gap-[18px]">
        {/* Column A: today's list */}
        <div className="flex min-w-0 flex-[0_1_360px] animate-chc-in flex-col [animation-delay:60ms]">
          <Panel className="chc-scroll flex-1 !gap-1">
            <div className="flex flex-col gap-2 pb-2">
              <h2 className="m-0 text-xl font-medium tracking-[-0.015em]">Today’s list</h2>
              <div className="flex items-center gap-3">
                <ProgressBar
                  value={doneCount}
                  max={7}
                  label="Measurements logged today"
                  className="flex-1"
                />
                <span className="font-mono text-[13px] whitespace-nowrap text-muted">
                  {doneCount} of 7 logged
                </span>
              </div>
            </div>
            <div className="pt-2 pb-1">
              <SubHeading>Due</SubHeading>
            </div>
            {DUE_KEYS.filter((k) => !isSaved(k)).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={sel === k}
                onClick={() => pick(k)}
                className={`${ROW} cursor-pointer`}
              >
                <span className="text-muted">
                  <IconClock size={20} strokeWidth={1.8} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base font-medium">
                    {k === 'mood' ? 'Mood check-in' : VITALS[k].name}
                  </span>
                  <span className="text-[13px] text-muted">
                    {k === 'mood' ? '18:00 · takes 30 seconds' : VITALS[k].due}
                  </span>
                </span>
                <span className="text-muted">
                  <IconChevronRight size={18} />
                </span>
              </button>
            ))}
            <div className="pt-3 pb-1">
              <SubHeading>Done</SubHeading>
            </div>
            {doneKeys.map((k) => {
              const r = k === 'mood' ? null : resultFor(k);
              const tone: Tone =
                k === 'mood' ? ((mood ?? 3) <= 2 ? 'watch' : 'normal') : (r?.tone ?? 'normal');
              const sub =
                k === 'mood'
                  ? `${mood} of 5 · ${SHIP.time}`
                  : `${r?.value ?? ''} ${VITALS[k].unit} · ${r?.time ?? ''}`;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={sel === k}
                  onClick={() => pick(k)}
                  className={`${ROW} cursor-pointer`}
                >
                  <span className={TONE[tone].text}>
                    <StatusIcon tone={tone} size={20} strokeWidth={2.2} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-base font-medium">
                      {k === 'mood' ? 'Mood check-in' : VITALS[k].name}
                    </span>
                    <span className="font-mono text-[13px] text-muted">{sub}</span>
                  </span>
                  <span className="text-muted">
                    <IconChevronRight size={18} />
                  </span>
                </button>
              );
            })}
          </Panel>
        </div>

        {/* Column B: entry / result / mood */}
        <div className="flex min-w-0 flex-[1_1_560px] animate-chc-in flex-col [animation-delay:120ms]">
          <section
            className={`flex flex-1 flex-col gap-5 rounded-[20px] border bg-surface p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${showResult && res?.tone === 'act' ? 'border-act-l' : 'border-line'}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-[26px] leading-8 font-medium tracking-[-0.02em]">
                {def ? def.name : 'Mood check-in'}
              </h2>
              <span className="font-mono text-[13px] text-muted">
                {def ? `Unit: ${def.unit} · range ${def.range}` : 'Takes 30 seconds'}
              </span>
            </div>

            {showForm && def && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap gap-4">
                  {def.fields.map((f) => {
                    const raw = vals[f.k] ?? '';
                    const tone = live?.ok && raw !== '' ? live.tone : null;
                    const bump = (dir: number) => () => {
                      const base = raw === '' || isNaN(Number(raw)) ? Number(f.ph) : Number(raw);
                      const n = Math.round((base + dir * def.step) * 100) / 100;
                      setVals({ ...vals, [f.k]: String(n) });
                    };
                    return (
                      <div key={f.k} className="flex min-w-[240px] flex-1 flex-col gap-2">
                        <label htmlFor={`v-${f.k}`} className="text-[15px] font-medium text-text">
                          {f.label}
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={bump(-1)}
                            aria-label={`Lower ${f.label}`}
                            className={btn('secondary', 'size-14 shrink-0 cursor-pointer')}
                          >
                            <IconMinus size={20} />
                          </button>
                          <div
                            className={`flex h-14 min-w-0 flex-1 items-baseline gap-2 rounded-xl border bg-sunk px-4 transition-shadow focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(90,185,252,0.16)] ${tone === 'act' ? 'border-act-l' : raw !== '' ? 'border-accent shadow-[0_0_0_3px_rgba(90,185,252,0.16)]' : 'border-line-2'}`}
                          >
                            <input
                              id={`v-${f.k}`}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={raw}
                              placeholder={f.ph}
                              onChange={(e) =>
                                setVals({
                                  ...vals,
                                  [f.k]: e.target.value.replace(/[^0-9.]/g, '').slice(0, 6),
                                })
                              }
                              className="h-full min-w-0 flex-1 bg-transparent text-[32px] font-medium tabular-nums text-ink outline-none placeholder:text-faint focus-visible:outline-none"
                            />
                            <span className="font-mono text-base text-text">{def.unit}</span>
                          </div>
                          <button
                            type="button"
                            onClick={bump(1)}
                            aria-label={`Raise ${f.label}`}
                            className={btn('secondary', 'size-14 shrink-0 cursor-pointer')}
                          >
                            <IconPlus size={20} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {live && !live.ok && live.err && (
                  <span
                    role="status"
                    className="inline-flex items-center gap-2 text-[15px] text-watch"
                  >
                    <IconTriangle size={16} />
                    {live.err}
                  </span>
                )}
                <div className="flex gap-3 rounded-xl border border-line bg-sunk p-4">
                  <span className="text-accent">
                    <IconInfo size={22} strokeWidth={1.8} />
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] font-medium text-muted">In microgravity</span>
                    <span className="text-base leading-6 text-text">{def.hint}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    disabled={!canSave}
                    onClick={() => {
                      setSaved({ ...saved, [sel]: true });
                      setEditing({ ...editing, [sel]: false });
                      setTimer(null);
                    }}
                    className={`${btn('primary', 'h-12 cursor-pointer px-6 text-base')} disabled:!bg-raised disabled:!text-muted`}
                  >
                    Save reading
                  </button>
                  <span className="text-[13px] text-muted">
                    Saves with ship time {SHIP.time} · your range {def.range}
                  </span>
                </div>
              </div>
            )}

            {showResult && res && def && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <span
                    className={`flex size-14 items-center justify-center rounded-xl ${TONE[res.tone].bg} ${TONE[res.tone].text}`}
                  >
                    <StatusIcon tone={res.tone} size={30} strokeWidth={2.2} />
                  </span>
                  <div className="flex flex-col">
                    <span className={`text-[15px] font-medium ${TONE[res.tone].text}`}>
                      {TONE[res.tone].label}
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="text-[46px] leading-[50px] font-medium tracking-[-0.03em] tabular-nums">
                        {res.value}
                      </span>
                      <span className="font-mono text-[19px] text-text">{def.unit}</span>
                      <span className="font-mono text-[15px] text-muted">at {res.time}</span>
                    </span>
                  </div>
                </div>
                <p className="m-0 text-lg leading-7 text-text">{res.meaning}</p>
                <div
                  className={`flex flex-col gap-2 rounded-xl border p-4 ${res.tone === 'act' ? 'border-act-l bg-act-t' : 'border-line bg-sunk'}`}
                >
                  <span className="text-[13px] font-medium text-muted">Next step</span>
                  <span className="text-lg leading-6 font-medium">{res.action}</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {res.timer > 0 && (
                      <button
                        type="button"
                        onClick={() => setTimer(sel)}
                        className={btn(
                          res.tone === 'act' ? 'primary' : 'secondary',
                          `cursor-pointer px-4 ${res.tone === 'act' ? '!bg-act' : ''}`,
                        )}
                      >
                        {timer === sel
                          ? `Timer running · re-measure at ${res.timer === 15 ? '09:27' : '09:17'}`
                          : res.timer === 15
                            ? 'Start 15-min timer'
                            : 'Set a 5-min timer'}
                      </button>
                    )}
                    {res.recheck && res.tone !== 'normal' && (
                      <button
                        type="button"
                        onClick={edit}
                        className={btn('secondary', 'cursor-pointer px-4')}
                      >
                        Re-check now
                      </button>
                    )}
                    {res.tone === 'act' && (
                      <button
                        type="button"
                        onClick={() => setFlagged(!flagged)}
                        className={btn('ghost', 'cursor-pointer px-4 !border-act-l')}
                      >
                        {flagged ? 'Flagged for surgeon' : 'Flag for surgeon'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <NextButton nextName={nextName} onNext={goNext} />
                  <button
                    type="button"
                    onClick={edit}
                    className={btn('ghost', 'cursor-pointer px-4')}
                  >
                    Log it again
                  </button>
                </div>
              </div>
            )}

            {isMood && (
              <div className="flex flex-col gap-6">
                <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
                  <legend className="pb-3 text-lg font-medium">
                    How are you feeling right now?
                  </legend>
                  <div className="grid grid-cols-5 gap-2 max-sm:grid-cols-3">
                    {MOOD_WORDS.map((w, i) => {
                      const on = mood === i + 1;
                      return (
                        <button
                          key={w}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setMood(i + 1);
                            setMoodSaved(false);
                          }}
                          className={`flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border transition ${on ? 'border-ink/60 bg-raised text-ink' : 'border-line-2 text-muted hover:bg-hover'}`}
                        >
                          <span className="text-[32px] leading-9 font-medium tabular-nums">
                            {i + 1}
                          </span>
                          <span className="text-[13px] font-medium">{w}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
                  <legend className="pb-3 text-base font-medium">
                    Anything weighing on you?{' '}
                    <span className="text-[13px] font-normal text-muted">Optional</span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {MOOD_TAGS.map(([id, name]) => {
                      const on = !!tags[id];
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setTags({ ...tags, [id]: !on });
                            setMoodSaved(false);
                          }}
                          className={`h-11 cursor-pointer rounded-xl border px-4 text-[15px] font-medium transition ${on ? 'border-ink/60 bg-raised text-ink' : 'border-line-2 text-muted hover:bg-hover'}`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                {moodSaved && mood != null && (
                  <div
                    role="status"
                    className="flex items-center gap-3 rounded-xl border border-line bg-sunk p-4"
                  >
                    <span className={TONE[mood <= 2 ? 'watch' : 'normal'].text}>
                      <StatusIcon
                        tone={mood <= 2 ? 'watch' : 'normal'}
                        size={24}
                        strokeWidth={2.2}
                      />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-base font-medium">
                        Check-in saved · mood {mood} of 5
                      </span>
                      <span className="text-[15px] text-text">
                        {mood <= 2
                          ? 'A low day. Talk to someone you trust today. Low three days running? Your flight surgeon can help.'
                          : 'Thanks. It shows on your Mind card. Same time tomorrow.'}
                      </span>
                    </div>
                  </div>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-4">
                  {moodSaved ? (
                    <NextButton nextName={nextName} onNext={goNext} />
                  ) : (
                    <button
                      type="button"
                      disabled={mood == null}
                      onClick={() => setMoodSaved(true)}
                      className={`${btn('primary', 'h-12 cursor-pointer px-6 text-base')} disabled:!bg-raised disabled:!text-muted`}
                    >
                      Save check-in
                    </button>
                  )}
                  <span className="text-[13px] text-muted">
                    Private to you and your flight surgeon. It shows as a number on your Mind card.
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Column C: range + recent, or mood history */}
        <div className="chc-scroll flex min-w-0 flex-[0_1_440px] animate-chc-in flex-col gap-[18px] [animation-delay:180ms]">
          {def && !isMood && (
            <>
              <Panel title="Your range" aside="last 7 days" className="!gap-5">
                {def.bars.map((b) => {
                  const pct = (x: number) =>
                    `${Math.max(0, Math.min(100, ((x - b.min) / (b.max - b.min)) * 100)).toFixed(1)}%`;
                  const raw = (curVals as Record<string, string | undefined>)[b.k];
                  const cv = raw == null || raw === '' ? null : Number(raw);
                  const hasCur = cv != null && !isNaN(cv) && !!curRes;
                  const curColor =
                    hasCur && curRes && curRes.tone !== 'normal'
                      ? TONE[curRes.tone].hex
                      : '#e9edf3';
                  return (
                    <div key={b.k} className="flex flex-col gap-2">
                      <div className="flex justify-between text-[15px]">
                        <span className="font-medium">{b.label}</span>
                        <span className="font-mono text-muted">
                          {b.lo}–{b.hi}
                        </span>
                      </div>
                      <div
                        role="img"
                        aria-label={`${b.label}: your range ${b.lo} to ${b.hi}${hasCur ? `, this reading ${cv}` : ''}`}
                        className="relative h-9 rounded-lg bg-sunk"
                      >
                        <div
                          className="absolute inset-y-0 rounded-md bg-ok-t"
                          style={{
                            left: pct(b.lo),
                            width: `${(((b.hi - b.lo) / (b.max - b.min)) * 100).toFixed(1)}%`,
                          }}
                        />
                        {b.hist
                          .filter((x): x is number => x != null)
                          .map((x, i) => (
                            <span
                              key={i}
                              className="absolute top-2.5 bottom-2.5 w-0.5 -translate-x-1/2 rounded bg-ink/45"
                              style={{ left: pct(x) }}
                            />
                          ))}
                        {hasCur && cv != null && (
                          <span
                            className="absolute -top-1 -bottom-1 w-1 -translate-x-1/2 rounded-full transition-[left]"
                            style={{ left: pct(cv), background: curColor }}
                          />
                        )}
                      </div>
                      <div className="flex justify-between font-mono text-[13px] text-muted">
                        <span>{b.min}</span>
                        <span className={hasCur ? 'text-ink' : ''}>
                          {hasCur ? `This reading ${cv}` : `Your range ${b.lo}–${b.hi}`}
                        </span>
                        <span>{b.max}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-4 text-[13px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-4 rounded-sm bg-ok-t outline outline-ok/30" />
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
              <RecentReadings k={sel as VitalKey} savedRes={saved[sel as VitalKey] ? res : null} />
            </>
          )}
          {isMood && <MoodHistory latest={moodSaved ? mood : null} />}
        </div>
      </div>
    </>
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

function RecentReadings({
  k,
  savedRes,
}: {
  k: VitalKey;
  savedRes: { tone: 'normal' | 'watch' | 'act'; value: string } | null;
}) {
  const def = VITALS[k];
  const days = [136, 137, 138, 139, 140, 141, 142];
  const rows: { day: string; value: string; tone: 'normal' | 'watch' | 'act' }[] = [];
  days.forEach((day, i) => {
    const v: Record<string, string> = {};
    let missing = false;
    def.bars.forEach((b) => {
      if (b.hist[i] == null) missing = true;
      v[b.k] = String(b.hist[i]);
    });
    if (missing) return;
    const r = evalVital(k, v);
    if (r.ok)
      rows.unshift({
        day: `${day === 142 ? 'Today' : `Day ${day}`} ${def.time}`,
        value: r.value,
        tone: r.tone,
      });
  });
  if (savedRes)
    rows.unshift({ day: `Today ${SHIP.time}`, value: savedRes.value, tone: savedRes.tone });

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
      className="!gap-1"
    >
      {rows.slice(0, 5).map((r, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-line py-2.5">
          <span className="flex-1 font-mono text-[13px] text-muted">{r.day}</span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-lg font-medium tabular-nums">{r.value}</span>
            <span className="font-mono text-[13px] text-text">{def.unit}</span>
          </span>
          <StatusPill tone={r.tone} />
        </div>
      ))}
      {rows.length === 0 && (
        <span className="text-[15px] text-muted">No readings yet this week.</span>
      )}
    </Panel>
  );
}

function MoodHistory({ latest }: { latest: number | null }) {
  const values = latest != null ? [...MOOD_HISTORY.values.slice(1), latest] : MOOD_HISTORY.values;
  const labels =
    latest != null
      ? [...MOOD_HISTORY.days.slice(1).map(String), 'Today']
      : MOOD_HISTORY.days.map(String);
  return (
    <Panel title="Your last 7 check-ins" aside="1 to 5" className="!gap-4">
      <div
        role="img"
        aria-label={`Mood check-ins, oldest to newest: ${values.join(', ')} out of 5`}
        className="flex h-[190px] items-end gap-2"
      >
        {values.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            <span className="h-4 text-watch">
              {v <= 2 && <IconTriangle size={14} strokeWidth={2.6} />}
            </span>
            <span className="font-mono text-[13px] text-text">{v}</span>
            <div
              className="w-full rounded-t-md"
              style={{
                height: `${(v / 5) * 150}px`,
                background: v <= 2 ? 'rgba(251,191,74,0.55)' : 'rgba(233,237,243,0.32)',
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {labels.map((d, i) => (
          <span key={i} className="flex-1 text-center font-mono text-[13px] text-muted">
            {d}
          </span>
        ))}
      </div>
      <p className="m-0 text-[15px] leading-[22px] text-text">
        Steady overall. One low day on day 138. Three low days in a row is when to talk to your
        flight surgeon.
      </p>
    </Panel>
  );
}
