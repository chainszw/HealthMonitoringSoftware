import type { Reading } from './types';

/** Readings for one indicator, oldest first. */
export function readingsFor(readings: Reading[], indicatorId: string): Reading[] {
  return readings
    .filter((r) => r.indicatorId === indicatorId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** Most recent reading per indicator id. */
export function latestByIndicator(readings: Reading[]): Record<string, Reading> {
  const latest: Record<string, Reading> = {};
  for (const r of readings) {
    const cur = latest[r.indicatorId];
    if (!cur || r.timestamp > cur.timestamp) latest[r.indicatorId] = r;
  }
  return latest;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * Consecutive days (local time) with at least one reading, counting back from today.
 * If nothing is logged today yet, the streak counts back from yesterday.
 */
export function loggingStreak(readings: Reading[], now = new Date()): number {
  const days = new Set(readings.map((r) => dayKey(new Date(r.timestamp))));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
