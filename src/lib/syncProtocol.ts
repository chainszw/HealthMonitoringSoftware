import type { Reading } from './types';

// Wire format for POST /sync, shared by the app (src/lib/sync.ts) and the server.

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
