import { getIndicator } from '../../src/data/content';
import type { Reading } from '../../src/lib/types';
import { validateValue } from '../../src/lib/validation';

// Request-body checks. Uses the same validateValue() as the log form, so the
// server and the app accept exactly the same values.

export const MAX_NOTE_LENGTH = 500;
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

function checkNote(note: unknown): Check<string | null | undefined> {
  if (note === undefined || note === null) return { ok: true, value: note };
  if (typeof note !== 'string') return fail('note must be a string.', 'note');
  if (note.length > MAX_NOTE_LENGTH) {
    return fail(`note must be at most ${MAX_NOTE_LENGTH} characters.`, 'note');
  }
  return { ok: true, value: note };
}

/** Validate a POST /readings body. `id` and `timestamp` are optional (generated if missing). */
export function checkNewReading(
  body: unknown,
  makeId: () => string,
  now: () => string,
): Check<Reading> {
  if (!isObject(body)) return fail('Body must be a JSON object.');
  const { id, indicatorId, value, timestamp, note } = body;

  if (id !== undefined && (typeof id !== 'string' || !ID_PATTERN.test(id))) {
    return fail('id must be 1-64 letters, digits, "-" or "_".', 'id');
  }
  if (typeof indicatorId !== 'string') return fail('indicatorId is required.', 'indicatorId');
  const indicator = getIndicator(indicatorId);
  if (!indicator) return fail(`Unknown indicatorId "${indicatorId}".`, 'indicatorId');

  const v = validateValue(indicator, typeof value === 'number' ? value : undefined);
  if (!v.ok) return fail(v.error, 'value');
  if (timestamp !== undefined && !isIsoTimestamp(timestamp)) {
    return fail('timestamp must be an ISO 8601 string.', 'timestamp');
  }
  const n = checkNote(note);
  if (!n.ok) return n;

  const reading: Reading = {
    id: (id as string | undefined) ?? makeId(),
    indicatorId,
    value: v.value,
    timestamp: (timestamp as string | undefined) ?? now(),
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
    const indicator = getIndicator(indicatorId);
    if (!indicator) return fail(`Unknown indicatorId "${indicatorId}".`, 'indicatorId');
    const v = validateValue(indicator, typeof body.value === 'number' ? body.value : undefined);
    if (!v.ok) return fail(v.error, 'value');
    patch.value = v.value;
  }
  if (body.timestamp !== undefined) {
    if (!isIsoTimestamp(body.timestamp)) {
      return fail('timestamp must be an ISO 8601 string.', 'timestamp');
    }
    patch.timestamp = body.timestamp;
  }
  if (body.note !== undefined) {
    const n = checkNote(body.note);
    if (!n.ok) return n;
    patch.note = n.value ?? null;
  }
  return { ok: true, value: patch };
}
