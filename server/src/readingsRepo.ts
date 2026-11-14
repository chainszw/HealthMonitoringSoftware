import type { SyncChange } from '../../src/lib/syncProtocol';
import { isNewer } from '../../src/lib/syncProtocol';
import type { Reading } from '../../src/lib/types';
import type { Db } from './db';

// Every reading belongs to one crew member: rows are keyed by (crew_id, id), and every
// function except list() and cursor() takes the crew id first.

/** A stored reading: the shared Reading shape plus server bookkeeping. */
export interface StoredReading extends Reading {
  crewId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  /** When this version reaches Earth (comms-delay simulation); absent once there is no delay. */
  arrivesAt?: string;
}

interface Row {
  crew_id: string;
  id: string;
  indicator_id: string;
  value: number;
  timestamp: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  seq: number;
  arrives_at: string | null;
}

function toReading(r: Row): StoredReading {
  const out: StoredReading = {
    id: r.id,
    crewId: r.crew_id,
    indicatorId: r.indicator_id,
    value: r.value,
    timestamp: r.timestamp,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  if (r.note !== null) out.note = r.note;
  if (r.deleted_at !== null) out.deletedAt = r.deleted_at;
  if (r.arrives_at !== null) out.arrivesAt = r.arrives_at;
  return out;
}

/** A stored reading in sync wire format (drops server-only fields). */
export function toSyncChange(r: StoredReading): SyncChange {
  const out: SyncChange = {
    id: r.id,
    indicatorId: r.indicatorId,
    value: r.value,
    timestamp: r.timestamp,
    updatedAt: r.updatedAt,
  };
  if (r.note !== undefined) out.note = r.note;
  if (r.deletedAt !== undefined) out.deletedAt = r.deletedAt;
  return out;
}

export interface ListFilter {
  /** One crew member's readings; omit for everyone's (flight surgeons). */
  crewId?: string;
  indicatorId?: string;
  /** Inclusive ISO lower bound on timestamp. */
  from?: string;
  /** Inclusive ISO upper bound on timestamp. */
  to?: string;
  includeDeleted?: boolean;
  /** Earth-side view: only readings that have arrived by this ISO time. */
  arrivedBy?: string;
}

/** Every write takes the next value of the global change counter (see migration 2 in db.ts). */
const NEXT_SEQ = '(SELECT COALESCE(MAX(seq), 0) + 1 FROM readings)';

export type ApplyResult = 'applied' | 'stale' | 'indicator-mismatch';

/** Data access for readings. All SQL for the table lives here. */
export function readingsRepo(db: Db, now: () => string = () => new Date().toISOString()) {
  const getStmt = db.prepare('SELECT * FROM readings WHERE crew_id = ? AND id = ?');

  function get(crewId: string, id: string): StoredReading | undefined {
    const row = getStmt.get(crewId, id) as Row | undefined;
    return row ? toReading(row) : undefined;
  }

  function list(filter: ListFilter = {}): StoredReading[] {
    const where: string[] = [];
    const params: string[] = [];
    const add = (sql: string, value: string) => {
      where.push(sql);
      params.push(value);
    };
    if (!filter.includeDeleted) where.push('deleted_at IS NULL');
    if (filter.crewId) add('crew_id = ?', filter.crewId);
    if (filter.indicatorId) add('indicator_id = ?', filter.indicatorId);
    if (filter.from) add('timestamp >= ?', filter.from);
    if (filter.to) add('timestamp <= ?', filter.to);
    if (filter.arrivedBy) add('(arrives_at IS NULL OR arrives_at <= ?)', filter.arrivedBy);
    const sql = `SELECT * FROM readings ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY timestamp, crew_id, id`;
    return (db.prepare(sql).all(...params) as unknown as Row[]).map(toReading);
  }

  // Every write below takes `arrivesAt`: when this version reaches Earth (null = already there).
  // A row whose newest version is still in transit is hidden from Earth-side views as a whole.

  /** Insert a new reading. Returns undefined if this crew member already has the id. */
  function insert(
    crewId: string,
    r: Reading,
    arrivesAt: string | null = null,
  ): StoredReading | undefined {
    if (get(crewId, r.id)) return undefined;
    const t = now();
    db.prepare(
      `INSERT INTO readings
         (crew_id, id, indicator_id, value, timestamp, note, created_at, updated_at, arrives_at, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${NEXT_SEQ})`,
    ).run(crewId, r.id, r.indicatorId, r.value, r.timestamp, r.note ?? null, t, t, arrivesAt);
    return get(crewId, r.id);
  }

  /** Change value, timestamp and/or note. `note: null` clears it. Deleted readings are not updated. */
  function update(
    crewId: string,
    id: string,
    patch: { value?: number; timestamp?: string; note?: string | null },
    arrivesAt: string | null = null,
  ): StoredReading | undefined {
    const cur = get(crewId, id);
    if (!cur || cur.deletedAt) return undefined;
    const note = patch.note === undefined ? (cur.note ?? null) : patch.note;
    db.prepare(
      `UPDATE readings
       SET value = ?, timestamp = ?, note = ?, updated_at = ?, arrives_at = ?, seq = ${NEXT_SEQ}
       WHERE crew_id = ? AND id = ?`,
    ).run(
      patch.value ?? cur.value,
      patch.timestamp ?? cur.timestamp,
      note,
      now(),
      arrivesAt,
      crewId,
      id,
    );
    return get(crewId, id);
  }

  /** Soft delete (kept as a tombstone so sync can propagate it). */
  function remove(crewId: string, id: string, arrivesAt: string | null = null): boolean {
    const cur = get(crewId, id);
    if (!cur || cur.deletedAt) return false;
    const t = now();
    db.prepare(
      `UPDATE readings SET deleted_at = ?, updated_at = ?, arrives_at = ?, seq = ${NEXT_SEQ}
       WHERE crew_id = ? AND id = ?`,
    ).run(t, t, arrivesAt, crewId, id);
    return true;
  }

  /**
   * Apply one change from a crew member's device. Last write wins: the change is applied only if
   * its updatedAt is newer than the stored version ('stale' otherwise, and the stored row stays).
   * A newer change without deletedAt brings a deleted reading back.
   */
  function applyChange(
    crewId: string,
    c: SyncChange,
    arrivesAt: string | null = null,
  ): ApplyResult {
    const cur = get(crewId, c.id);
    if (cur && cur.indicatorId !== c.indicatorId) return 'indicator-mismatch';
    if (cur && !isNewer(c.updatedAt, cur.updatedAt)) return 'stale';
    const note = c.note ?? null;
    const deletedAt = c.deletedAt ?? null;
    if (!cur) {
      db.prepare(
        `INSERT INTO readings
           (crew_id, id, indicator_id, value, timestamp, note, created_at, updated_at, deleted_at,
            arrives_at, seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${NEXT_SEQ})`,
      ).run(
        crewId,
        c.id,
        c.indicatorId,
        c.value,
        c.timestamp,
        note,
        now(),
        c.updatedAt,
        deletedAt,
        arrivesAt,
      );
    } else {
      db.prepare(
        `UPDATE readings
         SET value = ?, timestamp = ?, note = ?, updated_at = ?, deleted_at = ?, arrives_at = ?,
             seq = ${NEXT_SEQ}
         WHERE crew_id = ? AND id = ?`,
      ).run(c.value, c.timestamp, note, c.updatedAt, deletedAt, arrivesAt, crewId, c.id);
    }
    return 'applied';
  }

  /** Changes of a crew member still on their way to Earth at `at`, and the next arrival. */
  function inTransit(crewId: string, at: string): { count: number; nextArrivalAt?: string } {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS count, MIN(arrives_at) AS next
         FROM readings WHERE crew_id = ? AND arrives_at > ?`,
      )
      .get(crewId, at) as { count: number; next: string | null };
    return row.next ? { count: row.count, nextArrivalAt: row.next } : { count: row.count };
  }

  /** A crew member's readings written after change number `since`, oldest change first. */
  function changesSince(crewId: string, since: number): StoredReading[] {
    const rows = db
      .prepare('SELECT * FROM readings WHERE crew_id = ? AND seq > ? ORDER BY seq')
      .all(crewId, since);
    return (rows as unknown as Row[]).map(toReading);
  }

  /** The latest change number across all crew (0 for an empty table). */
  function cursor(): number {
    const row = db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM readings').get();
    return (row as { seq: number }).seq;
  }

  return { get, list, insert, update, remove, applyChange, changesSince, cursor, inTransit };
}

export type ReadingsRepo = ReturnType<typeof readingsRepo>;
