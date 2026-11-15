import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { IconCheck, IconCheckCircle, IconPlus } from '../components/icons';
import { btn } from '../components/tone';
import { PageHeader, Panel, ProgressBar, StatusPill, SubHeading } from '../components/ui';
import type { MissionProfileId } from '../lib/types';
import {
  DAILY,
  extraRoutine,
  INITIAL_DONE,
  MISSIONS,
  SHIP,
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

  const startOrFinish = () => {
    if (!nextItem) return;
    if (isActive) {
      setDone({ ...done, [nextItem.id]: SHIP.time });
      setActive(null);
    } else setActive(nextItem.id);
  };

  return (
    <div className="flex flex-col gap-3.5 xl:min-h-0 xl:flex-1">
      <PageHeader
        title="Routine"
        meta={[
          { label: 'Mission day', value: SHIP.day },
          { label: 'Done today', value: `${doneCount} of 7` },
          { label: 'Next', value: nextItem ? nextItem.time : 'All done' },
        ]}
      />

      <div className="chc-fit-cols flex flex-col gap-3.5 xl:min-h-0 xl:flex-1 xl:flex-row">
        {/* Column A: today's prompts. Header fixed, rows scroll inside. */}
        <section
          aria-labelledby="routine-today-h"
          className="flex min-w-0 animate-chc-in flex-col rounded-[18px] border border-line bg-surface [animation-delay:60ms] xl:min-h-0 xl:flex-1"
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
            <div className="flex items-baseline gap-3">
              <h2 id="routine-today-h" className="m-0 text-lg font-medium tracking-[-0.01em]">
                Today
              </h2>
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
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
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
            <div className="px-3 pt-3 pb-1">
              <SubHeading>Also today</SubHeading>
            </div>
            {extraRoutine(MISSIONS[mission].delay).map((d) => (
              <RoutineRow key={d.id} item={d} doneAt={done[d.id]} onToggle={() => toggle(d.id)} />
            ))}
          </div>
        </section>

        {/* Column B: next up + week */}
        <div className="chc-scroll flex min-w-0 animate-chc-in flex-col gap-3.5 [animation-delay:120ms] xl:w-[clamp(320px,26vw,420px)] xl:shrink-0">
          <section
            aria-labelledby="next-h"
            className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4"
          >
            <h2 id="next-h" className="m-0 text-base font-medium text-text">
              Next up
            </h2>
            {nextItem ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[28px] leading-none font-medium text-ink tabular-nums">
                    {nextItem.time}
                  </span>
                  <span className="text-lg leading-6 font-medium text-ink">{nextItem.title}</span>
                </div>
                <p className="m-0 text-[15px] leading-[21px] text-text">{nextItem.why}</p>
                {nextItem.dur && (
                  <span className="font-mono text-[13px] text-muted">
                    {nextItem.dur} · {nextItem.cat}
                  </span>
                )}
                <button
                  type="button"
                  onClick={startOrFinish}
                  className={btn('primary', 'h-11 cursor-pointer pr-5 pl-4 text-base')}
                >
                  {isActive ? (
                    <IconCheck size={20} strokeWidth={2.2} />
                  ) : (
                    <IconPlus size={20} strokeWidth={2.2} />
                  )}
                  {isActive
                    ? `Mark ${nextItem.short} done`
                    : `Start ${nextItem.short ?? nextItem.title}`}
                </button>
              </>
            ) : (
              <p className="m-0 text-[15px] text-text">Everything on today's list is done.</p>
            )}
          </section>

          <Panel title="This week" aside={`${weekTotal} of 49`} className="!gap-3 !p-4">
            <div
              role="img"
              aria-label={`Routine items done this week: ${week
                .slice(0, 6)
                .map(([d, v]) => `${d} ${v}`)
                .join(', ')} of 7`}
              className="flex h-[96px] items-end gap-2"
            >
              {week.map(([day, v], i) => {
                const today = i === 5;
                const future = i === 6;
                return (
                  <div key={day} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="font-mono text-[13px] text-text tabular-nums">
                      {future ? '' : v}
                    </span>
                    <div
                      className={`w-full rounded-t-md ${future ? 'border border-dashed border-ink/22' : ''}`}
                      style={{
                        height: future ? 6 : Math.max(6, (v / 7) * 64),
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
      </div>
    </div>
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
      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${highlight ? 'bg-raised' : 'hover:bg-hover'}`}
    >
      <span className={`w-12 shrink-0 font-mono text-[15px] ${isDone ? 'text-muted' : 'text-ink'}`}>
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
        <span className="text-sm leading-5 text-text">{why}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {!isDone && item.dur && (
          <span className="font-mono text-[13px] text-muted">{item.dur}</span>
        )}
        {flag ? (
          <StatusPill tone={flag} label={item.flagText} />
        ) : (
          <span className="text-[13px] text-muted">
            {isDone ? (
              <span className="inline-flex items-center gap-1 text-text">
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
