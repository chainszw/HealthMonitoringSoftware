import type { SyncChange } from '../../src/lib/syncProtocol';
import { isNewer } from '../../src/lib/syncProtocol';
import type { Reading } from '../../src/lib/types';
import type { Db } from './db';

/** A stored reading: the shared Reading shape plus server bookkeeping. */
export interface StoredReading extends Reading {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

interface Row {
  id: string;
  indicator_id: string;
  value: number;
  timestamp: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  seq: number;
}

function toReading(r: Row): StoredReading {
  const out: StoredReading = {
    id: r.id,
    indicatorId: r.indicator_id,
    value: r.value,
    timestamp: r.timestamp,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  if (r.note !== null) out.note = r.note;
  if (r.deleted_at !== null) out.deletedAt = r.deleted_at;
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
  indicatorId?: string;
  /** Inclusive ISO lower bound on timestamp. */
  from?: string;
  /** Inclusive ISO upper bound on timestamp. */
  to?: string;
  includeDeleted?: boolean;
}

/** Every write takes the next value of the change counter (see migration 2 in db.ts). */
const NEXT_SEQ = '(SELECT COALESCE(MAX(seq), 0) + 1 FROM readings)';

export type ApplyResult = 'applied' | 'stale' | 'indicator-mismatch';

/** Data access for readings. All SQL for the table lives here. */
export function readingsRepo(db: Db, now: () => string = () => new Date().toISOString()) {
  const getStmt = db.prepare('SELECT * FROM readings WHERE id = ?');

  function get(id: string): StoredReading | undefined {
    const row = getStmt.get(id) as Row | undefined;
    return row ? toReading(row) : undefined;
  }

  function list(filter: ListFilter = {}): StoredReading[] {
    const where: string[] = [];
    const params: string[] = [];
    if (!filter.includeDeleted) where.push('deleted_at IS NULL');
    if (filter.indicatorId) {
      where.push('indicator_id = ?');
      params.push(filter.indicatorId);
    }
    if (filter.from) {
      where.push('timestamp >= ?');
      params.push(filter.from);
    }
    if (filter.to) {
      where.push('timestamp <= ?');
      params.push(filter.to);
    }
    const sql = `SELECT * FROM readings ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY timestamp, id`;
    return (db.prepare(sql).all(...params) as unknown as Row[]).map(toReading);
  }

  /** Insert a new reading. Returns undefined if the id already exists. */
  function insert(r: Reading): StoredReading | undefined {
    if (get(r.id)) return undefined;
    const t = now();
    db.prepare(
      `INSERT INTO readings (id, indicator_id, value, timestamp, note, created_at, updated_at, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${NEXT_SEQ})`,
    ).run(r.id, r.indicatorId, r.value, r.timestamp, r.note ?? null, t, t);
    return get(r.id);
  }

  /** Change value, timestamp and/or note. `note: null` clears it. Deleted readings are not updated. */
  function update(
    id: string,
    patch: { value?: number; timestamp?: string; note?: string | null },
  ): StoredReading | undefined {
    const cur = get(id);
    if (!cur || cur.deletedAt) return undefined;
    const note = patch.note === undefined ? (cur.note ?? null) : patch.note;
    db.prepare(
      `UPDATE readings SET value = ?, timestamp = ?, note = ?, updated_at = ?, seq = ${NEXT_SEQ}
       WHERE id = ?`,
    ).run(patch.value ?? cur.value, patch.timestamp ?? cur.timestamp, note, now(), id);
    return get(id);
  }

  /** Soft delete (kept as a tombstone so sync can propagate it). */
  function remove(id: string): boolean {
    const cur = get(id);
    if (!cur || cur.deletedAt) return false;
    const t = now();
    db.prepare(
      `UPDATE readings SET deleted_at = ?, updated_at = ?, seq = ${NEXT_SEQ} WHERE id = ?`,
    ).run(t, t, id);
    return true;
  }

  /**
   * Apply one change from a device. Last write wins: the change is applied only if its
   * updatedAt is newer than the stored version ('stale' otherwise, and the stored row stays).
   * A newer change without deletedAt brings a deleted reading back.
   */
  function applyChange(c: SyncChange): ApplyResult {
    const cur = get(c.id);
    if (cur && cur.indicatorId !== c.indicatorId) return 'indicator-mismatch';
    if (cur && !isNewer(c.updatedAt, cur.updatedAt)) return 'stale';
    const note = c.note ?? null;
    const deletedAt = c.deletedAt ?? null;
    if (!cur) {
      db.prepare(
        `INSERT INTO readings
           (id, indicator_id, value, timestamp, note, created_at, updated_at, deleted_at, seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${NEXT_SEQ})`,
      ).run(c.id, c.indicatorId, c.value, c.timestamp, note, now(), c.updatedAt, deletedAt);
    } else {
      db.prepare(
        `UPDATE readings
         SET value = ?, timestamp = ?, note = ?, updated_at = ?, deleted_at = ?, seq = ${NEXT_SEQ}
         WHERE id = ?`,
      ).run(c.value, c.timestamp, note, c.updatedAt, deletedAt, c.id);
    }
    return 'applied';
  }

  /** Readings written after change number `since`, oldest change first, tombstones included. */
  function changesSince(since: number): StoredReading[] {
    const rows = db.prepare('SELECT * FROM readings WHERE seq > ? ORDER BY seq').all(since);
    return (rows as unknown as Row[]).map(toReading);
  }

  /** The latest change number (0 for an empty table). */
  function cursor(): number {
    const row = db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM readings').get();
    return (row as { seq: number }).seq;
  }

  return { get, list, insert, update, remove, applyChange, changesSince, cursor };
}

export type ReadingsRepo = ReturnType<typeof readingsRepo>;
