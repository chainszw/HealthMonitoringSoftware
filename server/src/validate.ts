import { getIndicator } from '../../src/data/content';
import { MAX_SYNC_CHANGES, type SyncChange } from '../../src/lib/syncProtocol';
import type { Reading } from '../../src/lib/types';
import { validateValue } from '../../src/lib/validation';

// Request-body checks. Uses the same validateValue() as the log form, so the
// server and the app accept exactly the same values. Every timestamp is stored
// in one format (toISOString), so comparing them as strings is safe.

export const MAX_NOTE_LENGTH = 500;
/** How far a device clock may run ahead before its sync changes are refused. */
export const MAX_CLOCK_SKEW_MS = 24 * 3_600_000;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type Check<T> = { ok: true; value: T } | { ok: false; error: string; field?: string };

const fail = (error: string, field?: string): { ok: false; error: string; field?: string } => ({
  ok: false,
  error,
  field,
});

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export function isIsoTimestamp(x: unknown): x is string {
  return typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(x) && !Number.isNaN(Date.parse(x));
}

/** One canonical form, e.g. 2026-11-15T08:00:00.000Z. */
export const toIso = (x: string): string => new Date(x).toISOString();

function checkNote(note: unknown): Check<string | null | undefined> {
  if (note === undefined || note === null) return { ok: true, value: note };
  if (typeof note !== 'string') return fail('note must be a string.', 'note');
  if (note.length > MAX_NOTE_LENGTH) {
    return fail(`note must be at most ${MAX_NOTE_LENGTH} characters.`, 'note');
  }
  return { ok: true, value: note };
}

function checkId(id: unknown): Check<string> {
  return typeof id === 'string' && ID_PATTERN.test(id)
    ? { ok: true, value: id }
    : fail('id must be 1-64 letters, digits, "-" or "_".', 'id');
}

function checkValue(indicatorId: unknown, value: unknown): Check<number> {
  if (typeof indicatorId !== 'string') return fail('indicatorId is required.', 'indicatorId');
  const indicator = getIndicator(indicatorId);
  if (!indicator) return fail(`Unknown indicatorId "${indicatorId}".`, 'indicatorId');
  const v = validateValue(indicator, typeof value === 'number' ? value : undefined);
  return v.ok ? { ok: true, value: v.value } : fail(v.error, 'value');
}

/** Validate a POST /readings body. `id` and `timestamp` are optional (generated if missing). */
export function checkNewReading(
  body: unknown,
  makeId: () => string,
  now: () => string,
): Check<Reading> {
  if (!isObject(body)) return fail('Body must be a JSON object.');
  const { id, indicatorId, value, timestamp, note } = body;

  if (id !== undefined) {
    const i = checkId(id);
    if (!i.ok) return i;
  }
  const v = checkValue(indicatorId, value);
  if (!v.ok) return v;
  if (timestamp !== undefined && !isIsoTimestamp(timestamp)) {
    return fail('timestamp must be an ISO 8601 string.', 'timestamp');
  }
  const n = checkNote(note);
  if (!n.ok) return n;

  const reading: Reading = {
    id: (id as string | undefined) ?? makeId(),
    indicatorId: indicatorId as string,
    value: v.value,
    timestamp: toIso((timestamp as string | undefined) ?? now()),
  };
  if (typeof n.value === 'string') reading.note = n.value;
  return { ok: true, value: reading };
}

export interface ReadingPatch {
  value?: number;
  timestamp?: string;
  note?: string | null;
}

/** Validate a PATCH /readings/:id body against the reading's indicator. */
export function checkPatch(body: unknown, indicatorId: string): Check<ReadingPatch> {
  if (!isObject(body)) return fail('Body must be a JSON object.');
  const allowed = new Set(['value', 'timestamp', 'note']);
  const extra = Object.keys(body).filter((k) => !allowed.has(k));
  if (extra.length) return fail(`Cannot change: ${extra.join(', ')}.`, extra[0]);
  if (Object.keys(body).length === 0) return fail('Nothing to change.');

  const patch: ReadingPatch = {};
  if (body.value !== undefined) {
    const v = checkValue(indicatorId, body.value);
    if (!v.ok) return v;
    patch.value = v.value;
  }
  if (body.timestamp !== undefined) {
    if (!isIsoTimestamp(body.timestamp)) {
      return fail('timestamp must be an ISO 8601 string.', 'timestamp');
    }
    patch.timestamp = toIso(body.timestamp);
  }
  if (body.note !== undefined) {
    const n = checkNote(body.note);
    if (!n.ok) return n;
    patch.note = n.value ?? null;
  }
  return { ok: true, value: patch };
}

/** Validate one change from a device. */
export function checkSyncChange(x: unknown, now: () => string): Check<SyncChange> {
  if (!isObject(x)) return fail('Change must be a JSON object.');
  const id = checkId(x.id);
  if (!id.ok) return id;
  const v = checkValue(x.indicatorId, x.value);
  if (!v.ok) return v;
  if (!isIsoTimestamp(x.timestamp))
    return fail('timestamp must be an ISO 8601 string.', 'timestamp');
  if (!isIsoTimestamp(x.updatedAt))
    return fail('updatedAt must be an ISO 8601 string.', 'updatedAt');
  if (Date.parse(x.updatedAt) - Date.parse(now()) > MAX_CLOCK_SKEW_MS) {
    return fail('updatedAt is in the future; check the device clock.', 'updatedAt');
  }
  if (x.deletedAt !== undefined && x.deletedAt !== null && !isIsoTimestamp(x.deletedAt)) {
    return fail('deletedAt must be an ISO 8601 string.', 'deletedAt');
  }
  const n = checkNote(x.note);
  if (!n.ok) return n;

  const change: SyncChange = {
    id: id.value,
    indicatorId: x.indicatorId as string,
    value: v.value,
    timestamp: toIso(x.timestamp),
    updatedAt: toIso(x.updatedAt),
  };
  if (typeof n.value === 'string') change.note = n.value;
  if (typeof x.deletedAt === 'string') change.deletedAt = toIso(x.deletedAt);
  return { ok: true, value: change };
}

export interface CheckedSync {
  since: number;
  /** Valid changes, at most one per id (the newest). */
  changes: SyncChange[];
  rejected: { id: string; error: string }[];
}

/**
 * Validate a POST /sync body. A malformed request fails as a whole; an invalid change is only
 * listed in `rejected`, so one bad reading never blocks the rest.
 */
export function checkSyncRequest(body: unknown, now: () => string): Check<CheckedSync> {
  if (!isObject(body)) return fail('Body must be a JSON object.');
  const { since, changes } = body;
  if (typeof since !== 'number' || !Number.isInteger(since) || since < 0) {
    return fail('since must be a whole number, 0 or more.', 'since');
  }
  if (!Array.isArray(changes)) return fail('changes must be an array.', 'changes');
  if (changes.length > MAX_SYNC_CHANGES) {
    return fail(`Send at most ${MAX_SYNC_CHANGES} changes per request.`, 'changes');
  }

  const byId = new Map<string, SyncChange>();
  const rejected: { id: string; error: string }[] = [];
  for (const raw of changes) {
    const c = checkSyncChange(raw, now);
    if (!c.ok) {
      const id = isObject(raw) && typeof raw.id === 'string' ? raw.id : '';
      rejected.push({ id, error: c.error });
      continue;
    }
    const prev = byId.get(c.value.id);
    if (!prev || Date.parse(c.value.updatedAt) > Date.parse(prev.updatedAt)) {
      byId.set(c.value.id, c.value);
    }
  }
  return { ok: true, value: { since, changes: [...byId.values()], rejected } };
}
