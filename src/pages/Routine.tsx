import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router';
import { IconCheck, IconCheckCircle, IconPlus } from '../components/icons';
import { btn } from '../components/tone';
import { PageHeader, Panel, ProgressBar, StatusPill, SubHeading } from '../components/ui';
import { formatShipDate, useNow } from '../components/useNow';
import { entryKeyOf, logHref } from '../components/vitals';
import { content } from '../data/content';
import { formatClock, formatDelay } from '../lib/format';
import type { RoutineItemState } from '../lib/routine';
import { getReadinessBreakdown } from '../lib/today';
import type { MissionProfileId, RoutineTaskContent } from '../lib/types';
import { useMissionDay, useReadings, useRoutine } from '../lib/useReadings';

// Owner B: "05 · Routine" from the design canvas. Tasks come from content.json; completions are
// stored per day (useRoutine). Tasks linked to vitals tick themselves when the readings are logged.

type Item = RoutineItemState<RoutineTaskContent>;

/** Where a task linked to readings is logged. */
const taskHref = (t: RoutineTaskContent) =>
  t.indicatorIds?.length ? logHref(entryKeyOf(t.indicatorIds[0])) : null;

export function Routine() {
  const { mission } = useOutletContext<{ mission: MissionProfileId }>();
  const { readings } = useReadings();
  const now = useNow();
  const missionDay = useMissionDay();
  const delay = formatDelay(
    content.missionProfiles.find((m) => m.id === mission)?.commsDelaySeconds.max ?? 0,
  );
  const sleepLevel = getReadinessBreakdown(readings, now).sleep.level;
  const shortSleep = sleepLevel === 'amber' || sleepLevel === 'red';
  const extraTasks = useMemo(
    () =>
      content.routine.extra
        .filter((t) => t.showWhen !== 'short_sleep' || shortSleep)
        .map((t) => ({ ...t, why: t.why.replaceAll('{delay}', delay) })),
    [shortSleep, delay],
  );
  const daily = useRoutine(content.routine.daily);
  const extra = useRoutine(extraTasks);
  const [active, setActive] = useState<string | null>(null);

  const nextItem = daily.day.items.find((i) => !i.doneAt);
  const next = nextItem?.task;
  const doneCount = daily.day.done;
  const total = daily.day.total;
  const isActive = !!next && active === next.id;
  const toggle = (id: string, toggleFn: (id: string) => void) => {
    toggleFn(id);
    if (active === id) setActive(null);
  };
  const week = daily.week.map((w, i) => ({
    label:
      i === daily.week.length - 1
        ? 'Today'
        : new Date(`${w.day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' }),
    count: Math.round(w.done * total),
  }));
  const weekTotal = week.reduce((a, w) => a + w.count, 0);
  const nextHref = next ? taskHref(next) : null;

  const startOrFinish = () => {
    if (!next) return;
    if (isActive) {
      daily.toggle(next.id);
      setActive(null);
    } else setActive(next.id);
  };

  return (
    <div className="flex flex-col gap-3.5 xl:min-h-0 xl:flex-1">
      <PageHeader
        title="Routine"
        meta={[
          { label: 'Mission day', value: missionDay || '--' },
          { label: 'Done today', value: `${doneCount} of ${total}` },
          { label: 'Next', value: next ? next.time : 'All done' },
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
                {formatShipDate(now)} · ship time {formatClock(now)}
              </span>
            </div>
            <div className="flex min-w-[200px] items-center gap-3">
              <ProgressBar
                value={doneCount}
                max={total}
                label="Daily routine done"
                className="flex-1"
              />
              <span className="font-mono text-[13px] whitespace-nowrap text-muted">
                {doneCount} of {total} done
              </span>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
            {daily.day.items.map((item) => (
              <RoutineRow
                key={item.task.id}
                item={item}
                isNext={next?.id === item.task.id}
                isActive={active === item.task.id && !item.doneAt}
                onToggle={() => toggle(item.task.id, daily.toggle)}
              />
            ))}
            <div className="px-3 pt-3 pb-1">
              <SubHeading>Also today</SubHeading>
            </div>
            {extra.day.items.map((item) => (
              <RoutineRow
                key={item.task.id}
                item={item}
                onToggle={() => toggle(item.task.id, extra.toggle)}
              />
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
            {next ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[28px] leading-none font-medium text-ink tabular-nums">
                    {next.time}
                  </span>
                  <span className="text-lg leading-6 font-medium text-ink">{next.title}</span>
                </div>
                <p className="m-0 text-[15px] leading-[21px] text-text">{next.why}</p>
                {next.duration && (
                  <span className="font-mono text-[13px] text-muted">
                    {next.duration} · {next.category}
                  </span>
                )}
                {nextHref ? (
                  <Link
                    to={nextHref}
                    className={btn('primary', 'h-11 pr-5 pl-4 text-base no-underline')}
                  >
                    <IconPlus size={20} strokeWidth={2.2} />
                    Log {next.short ?? next.title}
                  </Link>
                ) : (
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
                      ? `Mark ${next.short ?? next.title} done`
                      : `Start ${next.short ?? next.title}`}
                  </button>
                )}
              </>
            ) : (
              <p className="m-0 text-[15px] text-text">Everything on today's list is done.</p>
            )}
          </section>

          <Panel
            title="Last 7 days"
            aside={`${weekTotal} of ${week.length * total}`}
            className="!gap-3 !p-4"
          >
            <div
              role="img"
              aria-label={`Routine items done, last 7 days: ${week
                .map((w) => `${w.label} ${w.count}`)
                .join(', ')} of ${total}`}
              className="flex h-[96px] items-end gap-2"
            >
              {week.map((w, i) => {
                const today = i === week.length - 1;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="font-mono text-[13px] text-text tabular-nums">{w.count}</span>
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: Math.max(6, (w.count / Math.max(1, total)) * 64),
                        background: today ? 'rgba(90,185,252,0.55)' : 'rgba(233,237,243,0.32)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              {week.map((w, i) => (
                <span
                  key={i}
                  className={`flex-1 text-center font-mono text-[13px] ${i === week.length - 1 ? 'text-ink' : 'text-muted'}`}
                >
                  {w.label}
                </span>
              ))}
            </div>
            {daily.streak > 0 && (
              <span className="text-[13px] text-muted">
                {daily.streak} {daily.streak === 1 ? 'day' : 'days'} in a row with everything done.
              </span>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function RoutineRow({
  item,
  isNext = false,
  isActive = false,
  onToggle,
}: {
  item: Item;
  isNext?: boolean;
  isActive?: boolean;
  onToggle: () => void;
}) {
  const { task, doneAt, fromReadings } = item;
  const isDone = !!doneAt;
  const href = taskHref(task);
  const flag = task.showWhen && !isDone;
  const highlight = isNext || isActive;
  const why = isDone
    ? `Done at ${formatClock(new Date(doneAt))}${fromReadings ? ', from your readings' : ''}. ${task.why}`
    : isActive
      ? `In progress. ${task.why}`
      : task.why;
  const box = `flex size-11 shrink-0 items-center justify-center rounded-xl transition ${isDone ? 'bg-ink text-bg' : 'border-[1.5px] border-ink/32 hover:border-ink/60'}`;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${highlight ? 'bg-raised' : 'hover:bg-hover'}`}
    >
      <span className={`w-12 shrink-0 font-mono text-[15px] ${isDone ? 'text-muted' : 'text-ink'}`}>
        {task.time}
      </span>
      {href && !isDone ? (
        <Link to={href} aria-label={`Log: ${task.title}`} className={`${box} no-underline`} />
      ) : (
        <button
          type="button"
          onClick={onToggle}
          disabled={fromReadings}
          aria-pressed={isDone}
          aria-label={`${isDone ? 'Mark not done' : 'Mark done'}: ${task.title}`}
          className={`${box} cursor-pointer disabled:cursor-default`}
        >
          {isDone && <IconCheck size={20} strokeWidth={2.4} />}
        </button>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className={`text-base font-medium ${isDone ? 'text-muted' : 'text-ink'}`}>
            {task.title}
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
        {!isDone && task.duration && (
          <span className="font-mono text-[13px] text-muted">{task.duration}</span>
        )}
        {flag ? (
          <StatusPill tone="watch" label="Added" />
        ) : (
          <span className="text-[13px] text-muted">
            {isDone ? (
              <span className="inline-flex items-center gap-1 text-text">
                <IconCheckCircle size={14} strokeWidth={2.6} />
                {task.category}
              </span>
            ) : (
              task.category
            )}
          </span>
        )}
      </span>
    </div>
  );
}
