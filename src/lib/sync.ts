import {
  loadMission,
  loadOutbox,
  loadReadings,
  loadSession,
  loadSyncState,
  saveOutbox,
  saveReadings,
  saveSyncState,
  subscribeOutbox,
  subscribeSession,
  type Outbox,
} from './storage';
import { isNewer, type SyncChange, type SyncRequest, type SyncResponse } from './syncProtocol';
import type { Reading } from './types';

// Background sync with the optional server (server/, POST /sync). The app stays fully usable
// offline: changes wait in the outbox (storage.ts) and are sent when the server is reachable.
// Conflicts: the newest updatedAt wins; on a tie the server's copy wins, so devices converge.

export type SyncStatusKind = 'disabled' | 'signed-out' | 'offline' | 'syncing' | 'synced' | 'error';

export interface SyncStatus {
  /** 'disabled' = no server configured (VITE_API_URL unset); 'signed-out' = no valid crew token. */
  status: SyncStatusKind;
  /** Local changes waiting to be sent. */
  pending: number;
  lastSyncedAt?: string;
  /** Last problem, e.g. a server error or changes the server refused. */
  error?: string;
}

// --- Pure merge helpers --------------------------------------------------------

function toReading(c: SyncChange): Reading {
  const r: Reading = {
    id: c.id,
    indicatorId: c.indicatorId,
    value: c.value,
    timestamp: c.timestamp,
    updatedAt: c.updatedAt,
  };
  if (c.note !== undefined && c.note !== null) r.note = c.note;
  return r;
}

const sameReading = (a: Reading, b: Reading) =>
  a.indicatorId === b.indicatorId &&
  a.value === b.value &&
  a.timestamp === b.timestamp &&
  a.note === b.note &&
  a.updatedAt === b.updatedAt;

/**
 * Merge server changes into the local readings. A local version that is strictly newer (the
 * reading itself, or a change still waiting in the outbox) is kept; otherwise the server's
 * version wins and tombstones delete. Returns null when nothing changed.
 */
export function mergeIncoming(
  local: Reading[],
  outbox: Outbox,
  incoming: SyncChange[],
): Reading[] | null {
  const byId = new Map(local.map((r) => [r.id, r]));
  let changed = false;
  for (const c of incoming) {
    const mine = byId.get(c.id);
    const pending = outbox[c.id];
    if (pending && isNewer(pending.updatedAt, c.updatedAt)) continue;
    if (mine?.updatedAt && isNewer(mine.updatedAt, c.updatedAt)) continue;
    if (c.deletedAt) {
      if (byId.delete(c.id)) changed = true;
      continue;
    }
    const next = toReading(c);
    if (!mine || !sameReading(mine, next)) {
      byId.set(c.id, next);
      changed = true;
    }
  }
  return changed ? [...byId.values()] : null;
}

/** Drop outbox entries that were sent and not changed since. Returns null when nothing changed. */
export function removeAcked(outbox: Outbox, sent: SyncChange[]): Outbox | null {
  const next = { ...outbox };
  let changed = false;
  for (const c of sent) {
    if (next[c.id]?.updatedAt === c.updatedAt) {
      delete next[c.id];
      changed = true;
    }
  }
  return changed ? next : null;
}

// --- One round trip ----------------------------------------------------------------

export type FetchLike = (
  url: string,
  init: {
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<Response>;

export const defaultFetch: FetchLike = (url, init) => fetch(url, init);

export interface SyncNowOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** Token to use when nobody is signed in (VITE_API_TOKEN, for demos). */
  defaultToken?: string;
}

const browserOffline = () =>
  (globalThis as { navigator?: { onLine?: boolean } }).navigator?.onLine === false;

/**
 * Send the outbox and merge the server's reply, as the signed-in crew member. Never throws:
 * network problems and timeouts report 'offline' and keep the outbox for the next try.
 */
export async function syncNow(
  apiUrl: string,
  { fetchImpl = defaultFetch, timeoutMs = 20_000, defaultToken }: SyncNowOptions = {},
): Promise<Omit<SyncStatus, 'pending'>> {
  const { cursor, lastSyncedAt } = loadSyncState();
  const token = loadSession()?.token ?? defaultToken;
  if (!token) return { status: 'signed-out', lastSyncedAt };
  if (browserOffline()) return { status: 'offline', lastSyncedAt };
  const sent = Object.values(loadOutbox());
  // The mission tells the server this astronaut's comms delay to Earth (phase 6).
  const request: SyncRequest = { since: cursor, changes: sent, mission: loadMission() };

  let res: Response;
  try {
    res = await fetchImpl(`${apiUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { status: 'offline', lastSyncedAt };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const error = body.error ?? `Server error ${res.status}.`;
    return { status: res.status === 401 ? 'signed-out' : 'error', lastSyncedAt, error };
  }
  const data = (await res.json().catch(() => null)) as SyncResponse | null;
  if (!data || !Array.isArray(data.changes) || typeof data.cursor !== 'number') {
    return { status: 'error', lastSyncedAt, error: 'Unexpected reply from the sync server.' };
  }

  const acked = removeAcked(loadOutbox(), sent);
  if (acked) saveOutbox(acked);
  const merged = mergeIncoming(loadReadings(), loadOutbox(), data.changes);
  if (merged) saveReadings(merged);
  const syncedAt = new Date().toISOString();
  saveSyncState({ cursor: data.cursor, lastSyncedAt: syncedAt });

  const rejected = Array.isArray(data.rejected) ? data.rejected : [];
  return rejected.length
    ? {
        status: 'error',
        lastSyncedAt: syncedAt,
        error: `The server refused ${rejected.length} change(s): ${rejected[0].error}`,
      }
    : { status: 'synced', lastSyncedAt: syncedAt };
}

// --- Status store (for useSync) -----------------------------------------------------

let status: SyncStatus = { status: 'disabled', pending: 0 };
let statusReady = false;
const statusListeners = new Set<() => void>();
const pendingCount = () => Object.keys(loadOutbox()).length;

function setStatus(next: SyncStatus): void {
  if (
    next.status === status.status &&
    next.pending === status.pending &&
    next.lastSyncedAt === status.lastSyncedAt &&
    next.error === status.error
  ) {
    return;
  }
  status = next;
  statusListeners.forEach((l) => l());
}

function ensureStatusReady(): void {
  if (statusReady) return;
  statusReady = true;
  status = { ...status, pending: pendingCount(), lastSyncedAt: loadSyncState().lastSyncedAt };
  subscribeOutbox(() => setStatus({ ...status, pending: pendingCount() }));
}

/** Current sync status (same object until it changes). */
export function getSyncStatus(): SyncStatus {
  ensureStatusReady();
  return status;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  ensureStatusReady();
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

// --- Background scheduler -----------------------------------------------------------

export interface SyncOptions {
  /** Pull changes from other devices this often. */
  intervalMs?: number;
  /** Wait this long after a local change before sending, to batch quick edits. */
  debounceMs?: number;
  fetchImpl?: FetchLike;
  /** Token to use when nobody is signed in (VITE_API_TOKEN, for demos). */
  defaultToken?: string;
}

interface EventHost {
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
}

let stopRunning: (() => void) | null = null;

/**
 * Start background sync. Safe to call many times (runs once). With an empty `apiUrl`, sync stays
 * 'disabled' and the app is local-only. Syncs on start, shortly after each local change, every
 * `intervalMs`, and when the browser comes back online or regains focus.
 */
export function startSync(apiUrl: string, opts: SyncOptions = {}): () => void {
  if (!apiUrl) return () => {};
  if (stopRunning) return stopRunning;
  ensureStatusReady();
  const { intervalMs = 30_000, debounceMs = 1_000, fetchImpl, defaultToken } = opts;
  let inFlight = false;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = async (): Promise<void> => {
    if (inFlight) {
      again = true;
      return;
    }
    inFlight = true;
    setStatus({ ...status, status: 'syncing' });
    try {
      const result = await syncNow(apiUrl, { fetchImpl, defaultToken });
      setStatus({ ...result, pending: pendingCount() });
    } finally {
      inFlight = false;
    }
    if (again) {
      again = false;
      void run();
    }
  };
  const schedule = (delayMs: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), delayMs);
  };

  const unsubscribe = subscribeOutbox(() => {
    if (pendingCount() > 0) schedule(debounceMs);
  });
  const unsubscribeSession = subscribeSession(() => schedule(0));
  const interval = setInterval(() => schedule(0), intervalMs);
  const host = (globalThis as { window?: EventHost }).window;
  const now = () => schedule(0);
  const offline = () => setStatus({ ...status, status: 'offline' });
  host?.addEventListener('online', now);
  host?.addEventListener('focus', now);
  host?.addEventListener('offline', offline);
  schedule(0);

  stopRunning = () => {
    clearTimeout(timer);
    clearInterval(interval);
    unsubscribe();
    unsubscribeSession();
    host?.removeEventListener('online', now);
    host?.removeEventListener('focus', now);
    host?.removeEventListener('offline', offline);
    stopRunning = null;
    setStatus({ ...status, status: 'disabled' });
  };
  return stopRunning;
}
