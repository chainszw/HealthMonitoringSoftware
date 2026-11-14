import { getBodySystem, getIndicator } from '../data/content';
import { latestByIndicator, loggingStreak, readingsFor } from './readings';
import { getStatus, worstStatus } from './status';
import { loadReadings } from './storage';
import type { BodySystemId, StatusResult } from './types';

// Contract functions the UI builds against: getSystemStatus, getTrend, getReadiness.
// Each takes the readings as an optional argument. Components that already hold
// readings from useReadings() should pass them, so the result updates with state;
// without it, the stored readings are loaded.

type Level = StatusResult['level'];

/** A reading is "current" for status purposes if it is at most this old. */
export const CURRENT_WINDOW_HOURS = 48;

/** Worst current status across a body system's indicators. 'unknown' if none are current. */
export function getSystemStatus(
  bodySystem: BodySystemId,
  readings = loadReadings(),
  now = new Date(),
): Level {
  const system = getBodySystem(bodySystem);
  if (!system) return 'unknown';
  const latest = latestByIndicator(readings);
  const cutoff = now.getTime() - CURRENT_WINDOW_HOURS * 3_600_000;
  return worstStatus(
    system.indicatorIds.map((id) => {
      const indicator = getIndicator(id);
      const reading = latest[id];
      if (!indicator || !reading || new Date(reading.timestamp).getTime() < cutoff) {
        return 'unknown';
      }
      return getStatus(indicator, reading.value).level;
    }),
  );
}

/** One chart point, ready for Recharts (`dataKey="value"`, x-axis `dataKey="label"`). */
export interface TrendPoint {
  /** ISO timestamp of the reading. */
  timestamp: string;
  /** Short local date for the x-axis, e.g. "Nov 14". */
  label: string;
  value: number;
  level: Level;
}

/**
 * Readings for one indicator over the last `days` days (today counts as day 1),
 * oldest first, each with its status level. Unknown indicator → [].
 */
export function getTrend(
  indicatorId: string,
  days: number,
  readings = loadReadings(),
  now = new Date(),
): TrendPoint[] {
  const indicator = getIndicator(indicatorId);
  if (!indicator || days <= 0) return [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return readingsFor(readings, indicatorId)
    .filter((r) => {
      const t = new Date(r.timestamp);
      return t >= start && t <= now;
    })
    .map((r) => ({
      timestamp: r.timestamp,
      label: new Date(r.timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      value: r.value,
      level: getStatus(indicator, r.value).level,
    }));
}

const LEVEL_SCORE: Record<Exclude<Level, 'unknown'>, number> = { green: 100, amber: 50, red: 0 };

/**
 * Readiness 0–100: the average of each indicator's current status
 * (green 100, amber 50, red 0). Indicators with no current reading are left out;
 * with none current the score is 0. Streak = consecutive days logged.
 * First version: to be refined in the routine task.
 */
export function getReadiness(
  readings = loadReadings(),
  now = new Date(),
): { score: number; streak: number } {
  const latest = latestByIndicator(readings);
  const cutoff = now.getTime() - CURRENT_WINDOW_HOURS * 3_600_000;
  const scores: number[] = [];
  for (const reading of Object.values(latest)) {
    const indicator = getIndicator(reading.indicatorId);
    if (!indicator || new Date(reading.timestamp).getTime() < cutoff) continue;
    const { level } = getStatus(indicator, reading.value);
    if (level !== 'unknown') scores.push(LEVEL_SCORE[level]);
  }
  const score = scores.length
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : 0;
  return { score, streak: loggingStreak(readings, now) };
}
