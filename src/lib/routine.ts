import type { Reading } from './types';

// Daily routine logic for the Routine screen (B's design). Pure functions: the task list comes
// from the caller (its titles and reasons are content, so they belong in content.json), and
// completions are stored per local day by storage.ts (chc:v1:routine). A task linked to
// indicators (e.g. "Morning vitals") is also done once each of them has a reading that day.

/** One routine task. Only `id` matters to the logic; the rest is passed through for display. */
export interface RoutineTask {
  id: string;
  /** Planned time of day, "HH:MM" (used for ordering and "overdue"). */
  time?: string;
  /** Done automatically once each of these indicators has a reading that day. */
  indicatorIds?: string[];
}

/** Latest reading time per indicator, per local day: { "2026-11-15": { mood: iso } }. */
type ReadingDays = Record<string, Record<string, string>>;

function readingDays(readings: Reading[]): ReadingDays {
  const out: ReadingDays = {};
  for (const r of readings) {
    const day = localDay(new Date(r.timestamp));
    const cur = (out[day] ??= {});
    if (!cur[r.indicatorId] || r.timestamp > cur[r.indicatorId]) cur[r.indicatorId] = r.timestamp;
  }
  return out;
}

/** When the task was done on `day`: a manual tick, or the last of its linked readings. */
function doneAtOn(
  task: RoutineTask,
  log: RoutineLog,
  day: string,
  byDay: ReadingDays,
): string | undefined {
  const manual = log[day]?.[task.id];
  if (manual) return manual;
  const ids = task.indicatorIds;
  if (!ids?.length) return undefined;
  const times = ids.map((id) => byDay[day]?.[id]);
  if (times.some((t) => !t)) return undefined;
  return (times as string[]).reduce((a, b) => (b > a ? b : a));
}

/** Completion times: { "2026-11-15": { "water": "2026-11-15T07:05:00.000Z" } }. */
export type RoutineLog = Record<string, Record<string, string>>;

/** Local calendar day as "YYYY-MM-DD". */
export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const shiftDays = (d: Date, days: number) => {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
};

/** Mark a task done now (or at `at`). Returns a new log. */
export function markDone(log: RoutineLog, taskId: string, at = new Date()): RoutineLog {
  const day = localDay(at);
  return { ...log, [day]: { ...log[day], [taskId]: at.toISOString() } };
}

/** Undo a task for the day of `at`. Returns a new log. */
export function markUndone(log: RoutineLog, taskId: string, at = new Date()): RoutineLog {
  const day = localDay(at);
  const rest = { ...log[day] };
  delete rest[taskId];
  return { ...log, [day]: rest };
}

export interface RoutineItemState<T extends RoutineTask> {
  task: T;
  /** When it was done today (ISO), if done. */
  doneAt?: string;
  /** Done by logging its readings rather than a manual tick. */
  fromReadings?: boolean;
  /** Not done and its planned time has passed. */
  overdue: boolean;
}

export interface RoutineDay<T extends RoutineTask> {
  items: RoutineItemState<T>[];
  done: number;
  total: number;
}

/** Today's tasks with their state, ordered by planned time. */
export function getRoutineDay<T extends RoutineTask>(
  tasks: T[],
  log: RoutineLog,
  now = new Date(),
  readings: Reading[] = [],
): RoutineDay<T> {
  const day = localDay(now);
  const byDay = readingDays(readings);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const items = [...tasks]
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
    .map((task) => {
      const doneAt = doneAtOn(task, log, day, byDay);
      const item: RoutineItemState<T> = {
        task,
        overdue: !doneAt && task.time !== undefined && task.time < hhmm,
      };
      if (doneAt) item.doneAt = doneAt;
      if (doneAt && !log[day]?.[task.id]) item.fromReadings = true;
      return item;
    });
  const done = items.filter((i) => i.doneAt).length;
  return { items, done, total: tasks.length };
}

/** Share of tasks done on a given day, 0-1 (tasks no longer in the list are ignored). */
function completion(
  tasks: RoutineTask[],
  log: RoutineLog,
  day: string,
  byDay: ReadingDays,
): number {
  if (!tasks.length) return 0;
  return tasks.filter((t) => doneAtOn(t, log, day, byDay)).length / tasks.length;
}

/**
 * Consecutive days with every task done, counting back from today. If today is not complete
 * yet, the streak counts back from yesterday (today can still be finished).
 */
export function routineStreak(
  tasks: RoutineTask[],
  log: RoutineLog,
  now = new Date(),
  readings: Reading[] = [],
): number {
  if (!tasks.length) return 0;
  const byDay = readingDays(readings);
  let cursor = now;
  if (completion(tasks, log, localDay(cursor), byDay) < 1) cursor = shiftDays(cursor, -1);
  let streak = 0;
  while (completion(tasks, log, localDay(cursor), byDay) === 1) {
    streak++;
    cursor = shiftDays(cursor, -1);
  }
  return streak;
}

/** The last `days` days, oldest first, with the share of tasks done (0-1). */
export function routineWeek(
  tasks: RoutineTask[],
  log: RoutineLog,
  now = new Date(),
  days = 7,
  readings: Reading[] = [],
): { day: string; done: number }[] {
  const byDay = readingDays(readings);
  return Array.from({ length: days }, (_, i) => {
    const day = localDay(shiftDays(now, i - days + 1));
    return { day, done: completion(tasks, log, day, byDay) };
  });
}
