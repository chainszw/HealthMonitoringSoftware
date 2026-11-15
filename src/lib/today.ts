import { content, getIndicator } from '../data/content';
import { CURRENT_WINDOW_HOURS, getReadiness } from './insights';
import { latestByIndicator } from './readings';
import { getStatus, worstStatus } from './status';
import type { Reading, StatusResult } from './types';

// Logic for the Today screen (B's design): combined blood pressure, "needs attention", readiness
// parts, checks due today and the mission day. Pure functions over readings, built on the same
// content.json bands as getStatus(), so every screen agrees on a colour.

type Level = StatusResult['level'];
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const isCurrent = (r: Reading, now: Date) =>
  now.getTime() - Date.parse(r.timestamp) <= CURRENT_WINDOW_HOURS * HOUR;

export interface BloodPressureStatus {
  /** The worse of the two (content.json: "Use the worse blood-pressure status"). */
  level: Level;
  /** Action text for that level, from the worse of the two indicators. */
  action: string;
  systolic?: Reading & { status: StatusResult };
  diastolic?: Reading & { status: StatusResult };
  /** "134/86", or one number when only one side was measured. */
  display?: string;
}

/** Latest systolic and diastolic readings, combined into one status. */
export function bloodPressureStatus(readings: Reading[]): BloodPressureStatus {
  const latest = latestByIndicator(readings);
  const out: BloodPressureStatus = { level: 'unknown', action: content.unknownStatusAction };
  for (const side of ['systolic', 'diastolic'] as const) {
    const r = latest[`bp_${side}`];
    const indicator = getIndicator(`bp_${side}`);
    if (r && indicator) out[side] = { ...r, status: getStatus(indicator, r.value) };
  }
  const sides = [out.systolic, out.diastolic].filter((s) => s !== undefined);
  if (sides.length) {
    out.level = worstStatus(sides.map((s) => s.status.level));
    out.action = sides.find((s) => s.status.level === out.level)!.status.action;
    out.display = [out.systolic?.value, out.diastolic?.value]
      .filter((v) => v !== undefined)
      .join('/');
  }
  return out;
}

export interface AttentionItem {
  /** An indicator id, or 'bp' for blood pressure as one item. */
  key: string;
  name: string;
  level: 'amber' | 'red';
  value: string;
  unit: string;
  /** Band label from content.json, e.g. "High resting pulse". */
  label?: string;
  /** Guidance for this level, from content.json. */
  action: string;
  actionSteps: string[];
  timestamp: string;
}

/**
 * Current readings that are amber or red, most urgent first (red, then newest). Blood pressure
 * is one item with the worse of its two statuses. Readings older than 48h are not "current".
 */
export function getAttention(readings: Reading[], now = new Date()): AttentionItem[] {
  const latest = latestByIndicator(readings);
  const items: AttentionItem[] = [];
  for (const indicator of content.indicators) {
    if (indicator.id.startsWith('bp_')) continue;
    const r = latest[indicator.id];
    if (!r || !isCurrent(r, now)) continue;
    const s = getStatus(indicator, r.value);
    if (s.level !== 'amber' && s.level !== 'red') continue;
    items.push({
      key: indicator.id,
      name: indicator.name,
      level: s.level,
      value: String(r.value),
      unit: indicator.unit,
      label: s.label,
      action: s.action,
      actionSteps: indicator.actionSteps[s.level],
      timestamp: r.timestamp,
    });
  }
  const bp = bloodPressureStatus(readings.filter((r) => isCurrent(r, now)));
  if (bp.level === 'amber' || bp.level === 'red') {
    const worse = [bp.systolic, bp.diastolic].find((s) => s?.status.level === bp.level)!;
    const indicator = getIndicator(worse.indicatorId)!;
    items.push({
      key: 'bp',
      name: 'Blood pressure',
      level: bp.level,
      value: bp.display ?? String(worse.value),
      unit: indicator.unit,
      label: worse.status.label,
      action: bp.action,
      actionSteps: indicator.actionSteps[bp.level],
      timestamp: worse.timestamp,
    });
  }
  return items.sort(
    (a, b) =>
      (b.level === 'red' ? 1 : 0) - (a.level === 'red' ? 1 : 0) ||
      b.timestamp.localeCompare(a.timestamp),
  );
}

/** Indicators measured every day (glucose is only on the flight surgeon's screening plan). */
export const DAILY_INDICATORS = [
  'heart_rate',
  'bp_systolic',
  'bp_diastolic',
  'body_temp',
  'spo2',
  'sleep_hours',
  'mood',
];

export interface DueCheck {
  indicatorId: string;
  name: string;
  /** When to measure, from content.json (free text). */
  when: string;
  /** Last reading time, if any. */
  lastAt?: string;
}

/** Daily checks with no reading yet today (local day), in content.json order. */
export function getDueChecks(readings: Reading[], now = new Date()): DueCheck[] {
  const today = dayKey(now);
  const doneToday = new Set(
    readings.filter((r) => dayKey(new Date(r.timestamp)) === today).map((r) => r.indicatorId),
  );
  const latest = latestByIndicator(readings);
  return DAILY_INDICATORS.filter((id) => !doneToday.has(id)).flatMap((id) => {
    const indicator = getIndicator(id);
    if (!indicator) return [];
    const due: DueCheck = {
      indicatorId: id,
      name: indicator.name,
      when: indicator.measureFrequency ?? '',
    };
    if (latest[id]) due.lastAt = latest[id].timestamp;
    return [due];
  });
}

export interface ReadinessBreakdown {
  /** Same score and streak as getReadiness(). */
  score: number;
  streak: number;
  level: Level;
  /** Current daily indicators: how many are green, how many amber or red. */
  vitals: { ok: number; off: number };
  /** Last night's sleep against content.json's green band (e.g. 7 h). */
  sleep: { hours?: number; target?: number; level: Level };
  /** Routine progress, when the caller passes it (see routine.ts). */
  routine?: { done: number; total: number };
}

/** getReadiness() plus the parts the Today screen shows. */
export function getReadinessBreakdown(
  readings: Reading[],
  now = new Date(),
  routine?: { done: number; total: number },
): ReadinessBreakdown {
  const { score, streak } = getReadiness(readings, now);
  const latest = latestByIndicator(readings);
  const levels: Level[] = [];
  let ok = 0;
  let off = 0;
  for (const id of DAILY_INDICATORS) {
    const r = latest[id];
    const indicator = getIndicator(id);
    if (!r || !indicator || !isCurrent(r, now)) continue;
    const { level } = getStatus(indicator, r.value);
    levels.push(level);
    if (level === 'green') ok++;
    else off++;
  }
  const sleepIndicator = getIndicator('sleep_hours');
  const sleepReading = latest.sleep_hours;
  const sleep: ReadinessBreakdown['sleep'] = { level: 'unknown' };
  if (sleepIndicator) sleep.target = sleepIndicator.ranges.green[0]?.min;
  if (sleepReading && sleepIndicator && isCurrent(sleepReading, now)) {
    sleep.hours = sleepReading.value;
    sleep.level = getStatus(sleepIndicator, sleepReading.value).level;
  }
  const out: ReadinessBreakdown = {
    score,
    streak,
    level: worstStatus(levels),
    vitals: { ok, off },
    sleep,
  };
  if (routine) out.routine = routine;
  return out;
}

/**
 * Mission day, 1-based (the launch day is day 1). Without a start date, the first reading's day
 * counts as day 1. 0 when there is nothing to count from.
 */
export function getMissionDay(readings: Reading[], now = new Date(), startIso?: string): number {
  const first =
    startIso ??
    readings.reduce<string | undefined>(
      (min, r) => (!min || r.timestamp < min ? r.timestamp : min),
      undefined,
    );
  if (!first) return 0;
  const start = new Date(first);
  start.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - start.getTime()) / DAY) + 1);
}
