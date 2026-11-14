import { content, getIndicator } from '../../src/data/content';
import { CURRENT_WINDOW_HOURS, getReadiness, getSystemStatus } from '../../src/lib/insights';
import { latestByIndicator } from '../../src/lib/readings';
import { getStatus, worstStatus } from '../../src/lib/status';
import type {
  CrewAlert,
  CrewMember,
  CrewOverviewItem,
  Level,
  LatestReading,
} from '../../src/lib/syncProtocol';
import type { BodySystemId, Reading } from '../../src/lib/types';

// The flight surgeon's view of one astronaut. Built from the same shared rules as the crew app
// (getStatus, getSystemStatus, getReadiness), so both always agree on a status.

export const MAX_ALERTS = 50;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Comms-delay facts for one astronaut (phase 6); none by default. */
export interface CommsInfo {
  delaySeconds: number;
  inTransit: { count: number; nextArrivalAt?: string };
}

const NO_DELAY: CommsInfo = { delaySeconds: 0, inTransit: { count: 0 } };

/**
 * Summarise one astronaut's readings. The caller leaves out deleted readings and, for an
 * Earth-side view, readings still in transit (those are only counted in `comms.inTransit`).
 */
export function buildCrewOverview(
  member: CrewMember,
  readings: Reading[],
  now: Date,
  alertDays: number,
  comms: CommsInfo = NO_DELAY,
): CrewOverviewItem {
  const nowMs = now.getTime();
  const currentFrom = nowMs - CURRENT_WINDOW_HOURS * HOUR;

  const systems = Object.fromEntries(
    content.bodySystems.map((b) => [b.id, getSystemStatus(b.id, readings, now)]),
  ) as Record<BodySystemId, Level>;

  const newest = latestByIndicator(readings);
  const latest: Record<string, LatestReading> = {};
  const overdue: string[] = [];
  for (const indicator of content.indicators) {
    const r = newest[indicator.id];
    const current = r !== undefined && Date.parse(r.timestamp) >= currentFrom;
    if (!current) overdue.push(indicator.id);
    if (!r) continue;
    const { level, label } = getStatus(indicator, r.value);
    latest[indicator.id] = {
      readingId: r.id,
      value: r.value,
      timestamp: r.timestamp,
      level,
      current,
    };
    if (label !== undefined) latest[indicator.id].label = label;
  }

  const alertsFrom = nowMs - alertDays * DAY;
  const alerts: CrewAlert[] = [];
  for (const r of readings) {
    const t = Date.parse(r.timestamp);
    const indicator = getIndicator(r.indicatorId);
    if (!indicator || t < alertsFrom || t > nowMs) continue;
    const { level, label } = getStatus(indicator, r.value);
    if (level !== 'amber' && level !== 'red') continue;
    const alert: CrewAlert = {
      readingId: r.id,
      indicatorId: r.indicatorId,
      indicatorName: indicator.name,
      value: r.value,
      unit: indicator.unit,
      level,
      timestamp: r.timestamp,
    };
    if (label !== undefined) alert.label = label;
    alerts.push(alert);
  }
  alerts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const lastReadingAt = readings.reduce<string | undefined>(
    (max, r) => (max === undefined || r.timestamp > max ? r.timestamp : max),
    undefined,
  );

  const item: CrewOverviewItem = {
    crew: member,
    status: worstStatus(Object.values(systems)),
    readiness: getReadiness(readings, now),
    systems,
    latest,
    overdue,
    alerts: alerts.slice(0, MAX_ALERTS),
    commsDelaySeconds: comms.delaySeconds,
    inTransit: comms.inTransit,
  };
  if (lastReadingAt !== undefined) item.lastReadingAt = lastReadingAt;
  return item;
}

const URGENCY: Record<Level, number> = { red: 3, amber: 2, unknown: 1, green: 0 };

/** Most urgent first: red, amber, unknown (missed checks), green; then by name. */
export function byUrgency(a: CrewOverviewItem, b: CrewOverviewItem): number {
  return URGENCY[b.status] - URGENCY[a.status] || a.crew.name.localeCompare(b.crew.name);
}
