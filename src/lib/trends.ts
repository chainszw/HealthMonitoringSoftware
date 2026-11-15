import { getIndicator } from '../data/content';
import { readingsFor } from './readings';
import { getStatus, worstStatus } from './status';
import type { Reading, StatusResult } from './types';

// Day-by-day series for the Trends screen, the Today sparklines and the Log range bars.
// Pure functions over readings; colours come from getStatus (content.json bands).

type Level = StatusResult['level'];

/** The latest reading of one local day. */
export interface DailyPoint {
  id: string;
  timestamp: string;
  value: number;
  /** Blood pressure only: that day's diastolic value (value is the systolic). */
  value2?: number;
  /** Blood pressure only: the diastolic reading's id. */
  id2?: string;
  level: Level;
}

/** A trend key: an indicator id, or 'bp' for systolic + diastolic together. */
export type SeriesKey = string;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** The last `days` local days, oldest first, ending today. */
export function lastDays(days: number, now = new Date()): Date[] {
  return Array.from({ length: Math.max(0, days) }, (_, i) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    return d;
  });
}

/** Latest reading per local day for one indicator, keyed by day. */
function latestPerDay(readings: Reading[], indicatorId: string): Map<string, Reading> {
  const out = new Map<string, Reading>();
  for (const r of readingsFor(readings, indicatorId)) out.set(dayKey(new Date(r.timestamp)), r);
  return out;
}

/** One slot per day for the last `days` days (null = nothing logged that day), oldest first. */
export function dailySeries(
  indicatorId: string,
  days: number,
  readings: Reading[],
  now = new Date(),
): (DailyPoint | null)[] {
  const indicator = getIndicator(indicatorId);
  if (!indicator) return lastDays(days, now).map(() => null);
  // Keyed by local day, so a reading saved after `now` (a clock that ticks once a minute) still
  // lands on today.
  const byDay = latestPerDay(readings, indicatorId);
  return lastDays(days, now).map((d) => {
    const r = byDay.get(dayKey(d));
    if (!r) return null;
    return {
      id: r.id,
      timestamp: r.timestamp,
      value: r.value,
      level: getStatus(indicator, r.value).level,
    };
  });
}

/**
 * Blood pressure per day: value = systolic, value2 = diastolic, level = the worse of the two
 * (content.json: "Use the worse blood-pressure status"). A day without a systolic is null.
 */
export function bpDailySeries(
  days: number,
  readings: Reading[],
  now = new Date(),
): (DailyPoint | null)[] {
  const sys = dailySeries('bp_systolic', days, readings, now);
  const dia = dailySeries('bp_diastolic', days, readings, now);
  return sys.map((s, i) => {
    if (!s) return null;
    const d = dia[i];
    if (!d) return s;
    return { ...s, value2: d.value, id2: d.id, level: worstStatus([s.level, d.level]) };
  });
}

/** dailySeries or bpDailySeries by key. */
export function seriesFor(
  key: SeriesKey,
  days: number,
  readings: Reading[],
  now = new Date(),
): (DailyPoint | null)[] {
  return key === 'bp' ? bpDailySeries(days, readings, now) : dailySeries(key, days, readings, now);
}

/** Padded [min, max] that fits the values and the band, for charts and range bars. */
export function chartDomain(values: number[], band?: [number, number]): [number, number] {
  const all = [...values, ...(band ?? [])].filter(Number.isFinite);
  if (!all.length) return [0, 1];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.15 || Math.max(1, Math.abs(hi) * 0.05);
  return [lo - pad, hi + pad];
}

export type Direction = 'rising' | 'falling' | 'steady' | 'insufficient';

export interface SeriesSummary {
  /** Days with a reading. */
  total: number;
  /** Days whose reading was green. */
  inRange: number;
  /** Amber and red days, oldest first. */
  off: DailyPoint[];
  /** Worst level in the series ('unknown' if empty). */
  worst: Level;
  latest?: DailyPoint;
  /** The last 5 readings vs the 5 before; needs at least 6 readings. */
  direction: Direction;
}

/** Counts, off-range days and direction. `tolerance` is the change that counts as a move. */
export function summarizeSeries(points: (DailyPoint | null)[], tolerance: number): SeriesSummary {
  const present = points.filter((p): p is DailyPoint => p !== null);
  const values = present.map((p) => p.value);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  let direction: Direction = 'insufficient';
  if (values.length >= 6) {
    const recent = avg(values.slice(-5));
    const before = avg(values.slice(-10, -5));
    direction =
      recent - before > tolerance ? 'rising' : before - recent > tolerance ? 'falling' : 'steady';
  }
  return {
    total: present.length,
    inRange: present.filter((p) => p.level === 'green').length,
    off: present.filter((p) => p.level === 'amber' || p.level === 'red'),
    worst: worstStatus(present.map((p) => p.level)),
    latest: present[present.length - 1],
    direction,
  };
}
