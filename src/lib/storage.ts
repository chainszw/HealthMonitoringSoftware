import { generateSeed } from '../data/seed';
import type { RoutineLog } from './routine';
import type { CrewMember, SyncChange } from './syncProtocol';
import type { MissionProfileId, Reading } from './types';

// The ONLY module that touches localStorage. Bump the version prefix if the
// Reading shape changes incompatibly (old data is then ignored and re-seeded).
export const READINGS_KEY = 'chc:v1:readings';
export const MISSION_KEY = 'chc:v1:mission';
/** Local changes not yet sent to the sync server: the latest version per reading id. */
export const OUTBOX_KEY = 'chc:v1:outbox';
/** Sync cursor and the time of the last successful sync. */
export const SYNC_KEY = 'chc:v1:sync';
/** The crew member signed in on this device and their sync token. */
export const SESSION_KEY = 'chc:v1:session';
/** Routine completions per local day (see routine.ts). */
export const ROUTINE_KEY = 'chc:v1:routine';
/** Optional mission start (ISO); without it, mission day counts from the first reading. */
export const MISSION_START_KEY = 'chc:v1:missionStart';
/** Device-only dev settings (e.g. { backdrop: 'aurora' }); never synced. */
export const DEV_KEY = 'chc:v1:dev';
const DEFAULT_MISSION: MissionProfileId = 'iss';

// Fallback when localStorage is unavailable (private mode, blocked, tests).
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    if (globalThis.localStorage) return globalThis.localStorage.getItem(key);
  } catch {
    /* fall through to memory */
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string): void {
  try {
    if (globalThis.localStorage) {
      globalThis.localStorage.setItem(key, value);
      return;
    }
  } catch {
    /* fall through to memory */
  }
  memory.set(key, value);
}

function remove(key: string): void {
  try {
    if (globalThis.localStorage) {
      globalThis.localStorage.removeItem(key);
      return;
    }
  } catch {
    /* fall through to memory */
  }
  memory.delete(key);
}

function readJson(key: string): unknown {
  const raw = read(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

// --- Change notifications (for React's useSyncExternalStore) -----------------

type Listener = () => void;
const readingListeners = new Set<Listener>();
const outboxListeners = new Set<Listener>();
const sessionListeners = new Set<Listener>();
const routineListeners = new Set<Listener>();
let readingsCache: Reading[] | null = null;

const notify = (listeners: Set<Listener>) => listeners.forEach((l) => l());

/** Call `listener` whenever the stored readings change. Returns an unsubscribe function. */
export function subscribeReadings(listener: Listener): () => void {
  readingListeners.add(listener);
  return () => readingListeners.delete(listener);
}

/** Call `listener` whenever the outbox changes. Returns an unsubscribe function. */
export function subscribeOutbox(listener: Listener): () => void {
  outboxListeners.add(listener);
  return () => outboxListeners.delete(listener);
}

/** Cached readings for rendering: the same array until something changes. */
export function getReadingsSnapshot(): Reading[] {
  readingsCache ??= loadReadings();
  return readingsCache;
}

/** Re-read storage (e.g. another tab wrote to it) and notify subscribers. */
export function refreshReadings(): void {
  readingsCache = null;
  notify(readingListeners);
}

// Another browser tab changed the data: pick it up. (Typed locally so this module also
// compiles for the server, which has no DOM types.)
interface StorageEventLike {
  key: string | null;
}
const win = (
  globalThis as {
    window?: { addEventListener(type: 'storage', fn: (e: StorageEventLike) => void): void };
  }
).window;
win?.addEventListener('storage', (e) => {
  if (e.key === READINGS_KEY) refreshReadings();
  if (e.key === OUTBOX_KEY) notify(outboxListeners);
  if (e.key === SESSION_KEY) {
    sessionCache = undefined;
    notify(sessionListeners);
  }
});

// --- Readings ----------------------------------------------------------------

function isReading(x: unknown): x is Reading {
  const r = x as Reading;
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.id === 'string' &&
    typeof r.indicatorId === 'string' &&
    typeof r.value === 'number' &&
    typeof r.timestamp === 'string'
  );
}

/** Indicator ids renamed in content.json; stored readings are migrated on load. */
const RENAMED_INDICATORS: Record<string, string> = {
  glucose: 'blood_glucose',
  temperature: 'body_temp',
};

function migrate(readings: Reading[]): Reading[] {
  return readings.map((r) =>
    r.indicatorId in RENAMED_INDICATORS
      ? { ...r, indicatorId: RENAMED_INDICATORS[r.indicatorId] }
      : r,
  );
}

/** Persist without notifying (used while loading, which can run during a render). */
function writeReadings(readings: Reading[]): void {
  write(READINGS_KEY, JSON.stringify(readings));
  readingsCache = readings;
}

/** Load readings. Seeds demo data on first run or if stored data is corrupt. */
export function loadReadings(): Reading[] {
  const parsed = readJson(READINGS_KEY);
  if (Array.isArray(parsed) && parsed.every(isReading)) return migrate(parsed);
  const seed = generateSeed(30, new Date());
  writeReadings(seed);
  return seed;
}

/** Persist readings and notify subscribers. */
export function saveReadings(readings: Reading[]): void {
  writeReadings(readings);
  notify(readingListeners);
}

export type NewReading = Omit<Reading, 'id' | 'timestamp' | 'updatedAt'> & { timestamp?: string };
export type ReadingPatch = Partial<Pick<Reading, 'value' | 'timestamp' | 'note'>>;

function toChange(r: Reading, updatedAt: string, deletedAt?: string): SyncChange {
  const change: SyncChange = {
    id: r.id,
    indicatorId: r.indicatorId,
    value: r.value,
    timestamp: r.timestamp,
    updatedAt,
  };
  if (r.note !== undefined) change.note = r.note;
  if (deletedAt !== undefined) change.deletedAt = deletedAt;
  return change;
}

/**
 * The time for a new version of a reading: now, but always after its previous version. Sync keeps
 * the newest `updatedAt` and the server wins ties, so an edit then a delete in the same millisecond
 * (or after the device clock stepped back) would otherwise lose the later change.
 */
function nextVersion(now: Date, previous?: string): string {
  const prev = previous === undefined ? NaN : Date.parse(previous);
  const t = Number.isNaN(prev) ? now.getTime() : Math.max(now.getTime(), prev + 1);
  return new Date(t).toISOString();
}

/** Append a reading and persist. Returns the updated list. */
export function addReading(input: NewReading, now = new Date()): Reading[] {
  const t = now.toISOString();
  const reading: Reading = {
    id: globalThis.crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random()}`,
    indicatorId: input.indicatorId,
    value: input.value,
    timestamp: input.timestamp ?? t,
    updatedAt: t,
  };
  if (input.note !== undefined) reading.note = input.note;
  const next = [...loadReadings(), reading];
  saveReadings(next);
  enqueue(toChange(reading, t));
  return next;
}

/** Change a reading's value, timestamp and/or note (`note: undefined` clears it). */
export function updateReading(id: string, patch: ReadingPatch, now = new Date()): Reading[] {
  const readings = loadReadings();
  const index = readings.findIndex((r) => r.id === id);
  if (index < 0) return readings;
  const t = nextVersion(now, readings[index].updatedAt);
  const updated: Reading = { ...readings[index], ...patch, updatedAt: t };
  if ('note' in patch && patch.note === undefined) delete updated.note;
  const next = readings.with(index, updated);
  saveReadings(next);
  enqueue(toChange(updated, t));
  return next;
}

/** Delete a reading. With sync on, the deletion reaches the server as a tombstone. */
export function deleteReading(id: string, now = new Date()): Reading[] {
  const readings = loadReadings();
  const reading = readings.find((r) => r.id === id);
  if (!reading) return readings;
  const t = nextVersion(now, reading.updatedAt);
  const next = readings.filter((r) => r.id !== id);
  saveReadings(next);
  enqueue(toChange(reading, t, t));
  return next;
}

/**
 * Replace all readings with the 30-day demo dataset. Local only: pending changes are dropped
 * and the next sync pulls the server's copy again.
 */
export function resetToSeed(now = new Date()): Reading[] {
  const seed = generateSeed(30, now);
  saveReadings(seed);
  resetSync();
  return seed;
}

/** Remove all readings on this device (keeps an empty list, so the app does not re-seed). */
export function clearReadings(): Reading[] {
  saveReadings([]);
  resetSync();
  return [];
}

/**
 * Demo readings made on this device (the seed and the offline scenarios): ids start with `seed-`
 * and they have no `updatedAt`. Readings from the server always carry `updatedAt`, even the demo
 * crew's (which also use `seed-` ids), so they are never mistaken for local demo data.
 */
export const isDemoReading = (r: Reading): boolean =>
  r.id.startsWith('seed-') && r.updatedAt === undefined;

/**
 * Backend not reachable and nobody signed in: replace the device's readings with a demo dataset
 * (e.g. `generateScenario()`). Local only, like resetToSeed: pending changes are dropped.
 */
export function applyDemoReadings(readings: Reading[]): Reading[] {
  saveReadings(readings);
  resetSync();
  return readings;
}

/**
 * Backend reachable and signed in: show real data only. Drops demo readings, keeps readings
 * logged on this device and changes still waiting to be sent, and pulls the server's copy again.
 */
export function dropDemoReadings(): Reading[] {
  const next = loadReadings().filter((r) => !isDemoReading(r));
  saveReadings(next);
  resetSyncCursor();
  return next;
}

// --- Sync outbox and cursor ----------------------------------------------------

export type Outbox = Record<string, SyncChange>;

export function loadOutbox(): Outbox {
  const parsed = readJson(OUTBOX_KEY);
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Outbox)
    : {};
}

export function saveOutbox(outbox: Outbox): void {
  write(OUTBOX_KEY, JSON.stringify(outbox));
  notify(outboxListeners);
}

function enqueue(change: SyncChange): void {
  saveOutbox({ ...loadOutbox(), [change.id]: change });
}

export interface SyncState {
  /** Server cursor from the last successful sync (0 = never synced). */
  cursor: number;
  lastSyncedAt?: string;
}

export function loadSyncState(): SyncState {
  const parsed = readJson(SYNC_KEY) as Partial<SyncState> | undefined;
  return typeof parsed?.cursor === 'number'
    ? { cursor: parsed.cursor, lastSyncedAt: parsed.lastSyncedAt }
    : { cursor: 0 };
}

export function saveSyncState(state: SyncState): void {
  write(SYNC_KEY, JSON.stringify(state));
}

function resetSync(): void {
  saveOutbox({});
  saveSyncState({ cursor: 0 });
}

/** Pull everything again on the next sync, keeping changes that are still waiting to be sent. */
export function resetSyncCursor(): void {
  saveSyncState({ cursor: 0 });
}

// --- Session (who is signed in for sync) ------------------------------------------

export interface Session {
  token: string;
  crew: CrewMember;
}

let sessionCache: Session | null | undefined;

export function loadSession(): Session | null {
  const s = readJson(SESSION_KEY) as Partial<Session> | undefined;
  return typeof s?.token === 'string' && typeof s.crew?.id === 'string' ? (s as Session) : null;
}

/** Cached session for rendering (same object until it changes); null when signed out. */
export function getSessionSnapshot(): Session | null {
  if (sessionCache === undefined) sessionCache = loadSession();
  return sessionCache;
}

export function saveSession(session: Session | null): void {
  if (session) write(SESSION_KEY, JSON.stringify(session));
  else remove(SESSION_KEY);
  sessionCache = session;
  notify(sessionListeners);
}

/** Call `listener` whenever the session changes. Returns an unsubscribe function. */
export function subscribeSession(listener: Listener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

// --- Mission -------------------------------------------------------------------

export function loadMission(): MissionProfileId {
  const raw = read(MISSION_KEY);
  return raw === 'iss' || raw === 'lunar' || raw === 'mars' ? raw : DEFAULT_MISSION;
}

export function saveMission(id: MissionProfileId): void {
  write(MISSION_KEY, id);
}

// --- Routine and mission start ---------------------------------------------------

let routineCache: RoutineLog | undefined;

export function loadRoutineLog(): RoutineLog {
  const parsed = readJson(ROUTINE_KEY);
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as RoutineLog)
    : {};
}

/** Cached routine log for rendering (same object until it changes). */
export function getRoutineSnapshot(): RoutineLog {
  routineCache ??= loadRoutineLog();
  return routineCache;
}

export function saveRoutineLog(log: RoutineLog): void {
  write(ROUTINE_KEY, JSON.stringify(log));
  routineCache = log;
  notify(routineListeners);
}

export function subscribeRoutine(listener: Listener): () => void {
  routineListeners.add(listener);
  return () => routineListeners.delete(listener);
}

export function loadMissionStart(): string | undefined {
  return read(MISSION_START_KEY) ?? undefined;
}

/** Set (ISO date or time) or clear (undefined) the mission start. */
export function saveMissionStart(iso: string | undefined): void {
  if (iso) write(MISSION_START_KEY, iso);
  else remove(MISSION_START_KEY);
}

/** Dev settings for this device, as plain strings. Missing or corrupt data reads as {}. */
export function loadDevSettings(): Record<string, string> {
  const parsed = readJson(DEV_KEY);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
}

export function saveDevSetting(name: string, value: string): void {
  write(DEV_KEY, JSON.stringify({ ...loadDevSettings(), [name]: value }));
}
