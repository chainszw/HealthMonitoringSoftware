import type { TrendPoint } from './insights';
import type { BodySystemId, Reading, StatusResult } from './types';

// Wire format of the sync server API, shared by the app (src/lib/sync.ts, session.ts) and the server.

export type CrewRole = 'astronaut' | 'flight_surgeon';
export const CREW_ROLES: CrewRole[] = ['astronaut', 'flight_surgeon'];

/** A crew member as the API returns it (GET /me, GET /crew). */
export interface CrewMember {
  id: string;
  name: string;
  /** Astronauts read and write their own readings; flight surgeons read everyone's. */
  role: CrewRole;
}

/** One reading as exchanged during sync: its full latest state. */
export interface SyncChange extends Reading {
  /** When this version was written (ISO 8601). The newest version wins. */
  updatedAt: string;
  /** Set when the reading was deleted (a tombstone). */
  deletedAt?: string;
}

export interface SyncRequest {
  /** Server cursor from the previous sync; 0 on the first sync. */
  since: number;
  /** Local changes not yet sent (latest version per reading id). */
  changes: SyncChange[];
}

export interface SyncResponse {
  /** Every reading changed on the server after `since`, plus the server's version of any stale change. */
  changes: SyncChange[];
  /** Pass this back as `since` next time. */
  cursor: number;
  /** Changes the server refused (validation failed). */
  rejected: { id: string; error: string }[];
}

export const MAX_SYNC_CHANGES = 1000;

/** True if version `a` is strictly newer than `b`. A missing or invalid `b` counts as oldest. */
export function isNewer(a: string, b: string | undefined): boolean {
  if (b === undefined) return true;
  const tb = Date.parse(b);
  return Number.isNaN(tb) || Date.parse(a) > tb;
}

// --- Flight-surgeon endpoints (GET /crew/overview, /crew/:id/overview, /crew/:id/trend/:indicatorId)

/** A status level, including 'unknown' (no current reading). */
export type Level = StatusResult['level'];

/** An amber or red reading, for the flight surgeon's alert list. */
export interface CrewAlert {
  readingId: string;
  indicatorId: string;
  indicatorName: string;
  value: number;
  unit: string;
  level: 'amber' | 'red';
  /** Band label from content.json, e.g. "High resting pulse". */
  label?: string;
  timestamp: string;
}

/** The latest reading of one indicator. */
export interface LatestReading {
  readingId: string;
  value: number;
  timestamp: string;
  level: Level;
  label?: string;
  /** Within the current window (48h); older readings do not count toward status. */
  current: boolean;
}

/** One astronaut's health at a glance. */
export interface CrewOverviewItem {
  crew: CrewMember;
  /** Worst current status across all body systems ('unknown' if nothing is current). */
  status: Level;
  /** Same rules as the crew app: green 100, amber 50, red 0, averaged; streak in days. */
  readiness: { score: number; streak: number };
  systems: Record<BodySystemId, Level>;
  /** Latest reading per indicator id (indicators never measured are absent). */
  latest: Record<string, LatestReading>;
  /** Indicator ids with no reading in the current window: missed checks. */
  overdue: string[];
  /** Amber and red readings within `alertDays`, newest first (at most 50). */
  alerts: CrewAlert[];
  lastReadingAt?: string;
}

export interface CrewOverviewResponse {
  generatedAt: string;
  currentWindowHours: number;
  alertDays: number;
  /** Astronauts, most urgent first: red, amber, unknown, green; then by name. */
  crew: CrewOverviewItem[];
}

export interface CrewMemberOverviewResponse {
  generatedAt: string;
  currentWindowHours: number;
  alertDays: number;
  overview: CrewOverviewItem;
}

export interface CrewTrendResponse {
  crewId: string;
  indicatorId: string;
  days: number;
  /** Oldest first; same shape as getTrend() in the app. */
  points: TrendPoint[];
}
