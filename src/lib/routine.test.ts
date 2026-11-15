import { describe, expect, it } from 'vitest';
import {
  getRoutineDay,
  localDay,
  markDone,
  markUndone,
  routineStreak,
  routineWeek,
  type RoutineLog,
} from './routine';

const NOW = new Date(2026, 10, 15, 12, 0); // local noon
const daysAgo = (d: number, h = 8) => new Date(2026, 10, 15 - d, h, 0);
const tasks = [
  { id: 'vitals', time: '07:30', title: 'Morning vitals' },
  { id: 'water', time: '09:00', title: 'Water' },
  { id: 'exercise', time: '15:00', title: 'Exercise' },
];

/** A log with every task done on each of the given days ago. */
function fullDays(...days: number[]): RoutineLog {
  let log: RoutineLog = {};
  for (const d of days) for (const t of tasks) log = markDone(log, t.id, daysAgo(d));
  return log;
}

describe('routine', () => {
  it('marks tasks done and undone per local day', () => {
    let log = markDone({}, 'water', NOW);
    expect(log[localDay(NOW)].water).toBe(NOW.toISOString());
    log = markUndone(log, 'water', NOW);
    expect(log[localDay(NOW)]).toEqual({});
    expect(localDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it("shows today's tasks in time order, done or overdue", () => {
    const log = markDone({}, 'vitals', new Date(2026, 10, 15, 7, 40));
    const day = getRoutineDay([...tasks].reverse(), log, NOW);
    expect(day.items.map((i) => i.task.id)).toEqual(['vitals', 'water', 'exercise']);
    expect(day.items.map((i) => [Boolean(i.doneAt), i.overdue])).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ]);
    expect([day.done, day.total]).toEqual([1, 3]);
    expect(day.items[0].task.title).toBe('Morning vitals');
  });

  it('counts a streak of fully done days, waiting for today to finish', () => {
    expect(routineStreak(tasks, fullDays(1, 2, 3, 5), NOW)).toBe(3);
    expect(routineStreak(tasks, fullDays(0, 1, 2), NOW)).toBe(3);
    expect(routineStreak(tasks, fullDays(2, 3), NOW)).toBe(0);
    expect(routineStreak([], fullDays(1), NOW)).toBe(0);
  });

  it('summarises the last 7 days, oldest first', () => {
    const log = markDone(fullDays(1), 'water', NOW);
    const week = routineWeek(tasks, log, NOW);
    expect(week).toHaveLength(7);
    expect(week[6]).toEqual({ day: localDay(NOW), done: 1 / 3 });
    expect(week[5].done).toBe(1);
    expect(week[0].done).toBe(0);
  });

  it('counts a task linked to indicators as done once each one has a reading that day', () => {
    const linked = [{ id: 'bp', time: '07:30', indicatorIds: ['bp_systolic', 'bp_diastolic'] }];
    const reading = (indicatorId: string, at: Date) => ({
      id: `${indicatorId}-${at.getTime()}`,
      indicatorId,
      value: 1,
      timestamp: at.toISOString(),
    });
    const half = [reading('bp_systolic', daysAgo(0, 7))];
    expect(getRoutineDay(linked, {}, NOW, half).done).toBe(0);
    const both = [...half, reading('bp_diastolic', daysAgo(0, 8))];
    const day = getRoutineDay(linked, {}, NOW, both);
    expect(day.items[0]).toMatchObject({ doneAt: daysAgo(0, 8).toISOString(), fromReadings: true });
    const yesterday = [reading('bp_systolic', daysAgo(1)), reading('bp_diastolic', daysAgo(1))];
    expect(routineStreak(linked, {}, NOW, yesterday)).toBe(1);
    expect(routineWeek(linked, {}, NOW, 7, yesterday)[5].done).toBe(1);
  });
});
