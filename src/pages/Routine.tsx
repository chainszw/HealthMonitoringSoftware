import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { IconCheck, IconCheckCircle, IconPlus } from '../components/icons';
import { btn } from '../components/tone';
import { PageTitle, Panel, ProgressBar, StatusPill, SubHeading } from '../components/ui';
import type { MissionProfileId } from '../lib/types';
import {
  DAILY,
  extraRoutine,
  INITIAL_DONE,
  MISSIONS,
  PATCHES,
  SHIP,
  STREAKS,
  WEEK,
  type RoutineItem,
} from './designMock';

// Owner B: "05 · Routine" from the design canvas.
// LAYOUT TEST: state is local only; nothing is saved.

export function Routine() {
  const { mission } = useOutletContext<{ mission: MissionProfileId }>();
  const [done, setDone] = useState<Record<string, string>>(INITIAL_DONE);
  const [active, setActive] = useState<string | null>(null);

  const nextItem = DAILY.find((d) => !done[d.id]);
  const doneCount = DAILY.filter((d) => done[d.id]).length;
  const isActive = !!nextItem && active === nextItem.id;
  const toggle = (id: string) => {
    const nd = { ...done };
    if (nd[id]) delete nd[id];
    else nd[id] = SHIP.time;
    setDone(nd);
    if (active === id) setActive(null);
  };
  const week = WEEK.map(([day, v]) => [day, v ?? doneCount] as const);
  const weekTotal = week.slice(0, 6).reduce((a, [, v]) => a + v, 0);
  const earned = PATCHES.filter((p) => p.need == null).length;

  return (
    <>
      <PageTitle
        title="Routine"
        meta={[
          { label: 'Mission day', value: SHIP.day },
          { label: 'Done today', value: `${doneCount} of 7` },
          { label: 'Next', value: nextItem ? nextItem.time : 'All done' },
        ]}
      >
        {nextItem && (
          <button
            type="button"
            onClick={() => {
              if (isActive) {
                setDone({ ...done, [nextItem.id]: SHIP.time });
                setActive(null);
              } else setActive(nextItem.id);
            }}
            className={btn('primary', 'h-12 cursor-pointer pr-5 pl-4 text-base')}
          >
            {isActive ? (
              <IconCheck size={20} strokeWidth={2.2} />
            ) : (
              <IconPlus size={20} strokeWidth={2.2} />
            )}
            {isActive ? `Mark ${nextItem.short} done` : `Start ${nextItem.short ?? nextItem.title}`}
          </button>
        )}
      </PageTitle>

      <div className="chc-fit-cols flex flex-1 flex-wrap items-stretch gap-[18px]">
        {/* Column A: today's prompts */}
        <div className="flex min-w-0 flex-[1_1_560px] animate-chc-in flex-col [animation-delay:60ms]">
          <Panel className="chc-scroll flex-1 !gap-1">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
              <div className="flex items-baseline gap-3">
                <h2 className="m-0 text-xl font-medium tracking-[-0.015em]">Today</h2>
                <span className="font-mono text-[13px] text-muted">
                  {SHIP.date} · ship time {SHIP.time}
                </span>
              </div>
              <div className="flex min-w-[200px] items-center gap-3">
                <ProgressBar
                  value={doneCount}
                  max={7}
                  label="Daily routine done"
                  className="flex-1"
                />
                <span className="font-mono text-[13px] whitespace-nowrap text-muted">
                  {doneCount} of 7 done
                </span>
              </div>
            </div>
            {DAILY.map((d) => (
              <RoutineRow
                key={d.id}
                item={d}
                doneAt={done[d.id]}
                isNext={nextItem?.id === d.id}
                isActive={active === d.id && !done[d.id]}
                onToggle={() => toggle(d.id)}
              />
            ))}
            <div className="pt-4 pb-1">
              <SubHeading>Also today</SubHeading>
            </div>
            {extraRoutine(MISSIONS[mission].delay).map((d) => (
              <RoutineRow key={d.id} item={d} doneAt={done[d.id]} onToggle={() => toggle(d.id)} />
            ))}
          </Panel>
        </div>

        {/* Column B: streaks + week */}
        <div className="chc-scroll flex min-w-0 flex-[0_1_420px] animate-chc-in flex-col gap-[18px] [animation-delay:120ms]">
          <Panel title="Streaks" aside="last 14 days" className="!gap-0">
            {STREAKS.map((s) => {
              const todayDone = s.today.length > 0 && s.today.every((id) => done[id]);
              const days = [...s.past, todayDone ? 1 : 2];
              const n = s.n + (todayDone ? 1 : 0);
              const note =
                s.n === 0
                  ? 'Ended three nights ago. Tonight is a fresh start, and the rest block helps.'
                  : `${n >= s.best ? 'Your best yet.' : `Best ${s.best} days.`}${todayDone ? '' : ' Today still to do.'}`;
              return (
                <div
                  key={s.name}
                  className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-medium">{s.name}</span>
                    <span className="flex items-baseline gap-1">
                      <span
                        className={`text-[26px] leading-8 font-medium tabular-nums ${s.n === 0 ? 'text-muted' : 'text-ink'}`}
                      >
                        {n}
                      </span>
                      <span className="font-mono text-[13px] text-muted">days</span>
                    </span>
                  </div>
                  <div
                    role="img"
                    aria-label={`${s.name}: ${n} days in a row. Last 14 days: ${days.map((x) => (x === 1 ? 'done' : x === 0 ? 'missed' : 'today, to do')).join(', ')}`}
                    className="flex gap-1.5"
                  >
                    {days.map((x, i) => (
                      <span
                        key={i}
                        className={`h-3.5 flex-1 rounded-full ${x === 1 ? 'bg-ink/72' : x === 2 ? 'border-[1.5px] border-accent' : 'border-[1.5px] border-ink/22'}`}
                      />
                    ))}
                  </div>
                  <span className="text-[13px] text-muted">{note}</span>
                </div>
              );
            })}
          </Panel>
          <Panel title="This week" aside={`${weekTotal} of 49`} className="!gap-3">
            <div
              role="img"
              aria-label={`Routine items done this week: ${week
                .slice(0, 6)
                .map(([d, v]) => `${d} ${v}`)
                .join(', ')} of 7`}
              className="flex h-[150px] items-end gap-2"
            >
              {week.map(([day, v], i) => {
                const today = i === 5;
                const future = i === 6;
                return (
                  <div key={day} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="font-mono text-[13px] text-text">{future ? '' : v}</span>
                    <div
                      className={`w-full rounded-t-md ${future ? 'border border-dashed border-ink/22' : ''}`}
                      style={{
                        height: future ? 6 : Math.max(6, (v / 7) * 110),
                        background: future
                          ? 'transparent'
                          : today
                            ? 'rgba(90,185,252,0.55)'
                            : 'rgba(233,237,243,0.32)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              {week.map(([day], i) => (
                <span
                  key={day}
                  className={`flex-1 text-center font-mono text-[13px] ${i === 5 ? 'text-ink' : 'text-muted'}`}
                >
                  {i === 5 ? 'Today' : day}
                </span>
              ))}
            </div>
          </Panel>
        </div>

        {/* Column C: patches */}
        <div className="flex min-w-0 flex-[0_1_460px] animate-chc-in flex-col [animation-delay:180ms]">
          <Panel className="chc-scroll flex-1 !gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="m-0 text-xl font-medium tracking-[-0.015em]">Mission patches</h2>
                <span className="font-mono text-[13px] text-muted">{earned} of 6 earned</span>
              </div>
              <span className="text-[13px] text-muted">
                Earned by keeping the routine going, never by your readings.
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
              {PATCHES.map((p) => {
                const locked = p.need != null;
                return (
                  <div
                    key={p.name}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border border-line p-3 text-center ${locked ? '' : 'bg-hover'}`}
                  >
                    <svg
                      width="88"
                      height="88"
                      viewBox="0 0 88 88"
                      aria-hidden="true"
                      style={{ opacity: locked ? 0.55 : 1 }}
                    >
                      <circle
                        cx="44"
                        cy="44"
                        r="40"
                        fill="none"
                        stroke={locked ? 'rgba(233,237,243,0.32)' : '#5ab9fc'}
                        strokeWidth="2"
                        strokeDasharray={locked ? '5 5' : undefined}
                      />
                      <path
                        d={p.motif}
                        fill="none"
                        stroke={locked ? '#8891a1' : '#e9edf3'}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span
                      className={`text-[15px] font-medium ${locked ? 'text-muted' : 'text-ink'}`}
                    >
                      {p.name}
                    </span>
                    <span className="font-mono text-[12px] text-muted">{p.state}</span>
                    {locked && (
                      <ProgressBar
                        value={p.have ?? 0}
                        max={p.need ?? 1}
                        label={`${p.name} progress`}
                        className="mt-1 w-full"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function RoutineRow({
  item,
  doneAt,
  isNext = false,
  isActive = false,
  onToggle,
}: {
  item: RoutineItem;
  doneAt?: string;
  isNext?: boolean;
  isActive?: boolean;
  onToggle: () => void;
}) {
  const isDone = !!doneAt;
  const flag = item.flag && !isDone ? item.flag : null;
  const highlight = isNext || isActive;
  const why = isDone
    ? `Done at ${doneAt}. ${item.why}`
    : isActive
      ? `In progress, started ${SHIP.time}. ${item.why}`
      : item.why;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${highlight ? 'bg-raised' : 'hover:bg-hover'}`}
    >
      <span className={`w-12 shrink-0 font-mono text-[15px] ${isDone ? 'text-faint' : 'text-ink'}`}>
        {item.time}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isDone}
        aria-label={`${isDone ? 'Mark not done' : 'Mark done'}: ${item.title}`}
        className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition ${isDone ? 'bg-ink text-bg' : 'border-[1.5px] border-ink/32 hover:border-ink/60'}`}
      >
        {isDone && <IconCheck size={20} strokeWidth={2.4} />}
      </button>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className={`text-base font-medium ${isDone ? 'text-muted' : 'text-ink'}`}>
            {item.title}
          </span>
          {highlight && (
            <span className="rounded-md bg-accent px-1.5 text-[12px] leading-5 font-medium text-accent-ink">
              {isActive ? 'In progress' : 'Next'}
            </span>
          )}
        </span>
        <span className="text-[15px] leading-[21px] text-text">{why}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {!isDone && item.dur && (
          <span className="font-mono text-[13px] text-muted">{item.dur}</span>
        )}
        {flag ? (
          <StatusPill tone={flag} label={item.flagText} />
        ) : (
          <span className={`text-[13px] ${isDone ? 'text-faint' : 'text-muted'}`}>
            {isDone ? (
              <span className="inline-flex items-center gap-1 text-ok">
                <IconCheckCircle size={14} strokeWidth={2.6} />
                {item.cat}
              </span>
            ) : (
              item.cat
            )}
          </span>
        )}
      </span>
    </div>
  );
}
