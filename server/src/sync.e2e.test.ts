import { beforeEach, describe, expect, it } from 'vitest';
import {
  addReading,
  clearReadings,
  deleteReading,
  loadOutbox,
  loadReadings,
  loadSyncState,
  refreshReadings,
  updateReading,
} from '../../src/lib/storage';
import { syncNow, type FetchLike } from '../../src/lib/sync';
import { createApp } from './app';
import { openDb } from './db';
import type { StoredReading } from './readingsRepo';

// End to end: the app's real sync code (src/lib/sync.ts + storage.ts) against the real API,
// with an in-memory database and an in-memory localStorage. The REST calls play the part of
// "another device" (or the flight surgeon's console).

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const API = 'http://sync.test';
let app: ReturnType<typeof createApp>;
let toServer: FetchLike;

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  refreshReadings();
  clearReadings();
  app = createApp(openDb(':memory:'));
  toServer = async (url, init) => app.fetch(new Request(url, init));
});

const json = (method: string, body: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function serverReadings(query = ''): Promise<StoredReading[]> {
  const res = await app.request(`/readings${query}`);
  return ((await res.json()) as { readings: StoredReading[] }).readings;
}

const local = (id: string) => loadReadings().find((r) => r.id === id);

describe('sync between the app and the server', () => {
  it('pushes new readings and empties the outbox', async () => {
    const [r] = addReading({ indicatorId: 'heart_rate', value: 72, note: 'after rest' });
    expect(Object.keys(loadOutbox())).toEqual([r.id]);

    expect(await syncNow(API, toServer)).toMatchObject({ status: 'synced' });
    expect(loadOutbox()).toEqual({});
    expect(loadSyncState().cursor).toBe(1);
    expect(await serverReadings()).toMatchObject([
      { id: r.id, indicatorId: 'heart_rate', value: 72, note: 'after rest' },
    ]);
  });

  it('pulls readings, edits and deletions made elsewhere', async () => {
    await app.request('/readings', json('POST', { id: 'other', indicatorId: 'mood', value: 4 }));
    await syncNow(API, toServer);
    expect(local('other')?.value).toBe(4);

    await app.request('/readings/other', json('PATCH', { value: 2 }));
    await syncNow(API, toServer);
    expect(local('other')?.value).toBe(2);

    await app.request('/readings/other', { method: 'DELETE' });
    await syncNow(API, toServer);
    expect(local('other')).toBeUndefined();
  });

  it('sends local edits and deletions', async () => {
    const [r] = addReading({ indicatorId: 'heart_rate', value: 72 });
    await syncNow(API, toServer);

    updateReading(r.id, { value: 90 });
    await syncNow(API, toServer);
    expect((await serverReadings())[0].value).toBe(90);

    deleteReading(r.id);
    await syncNow(API, toServer);
    expect(await serverReadings()).toEqual([]);
    expect((await serverReadings('?includeDeleted=true'))[0].deletedAt).toBeTypeOf('string');
  });

  it('keeps working offline and catches up when the server is back', async () => {
    const down: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    addReading({ indicatorId: 'mood', value: 3 });
    addReading({ indicatorId: 'spo2', value: 97 });
    expect(await syncNow(API, down)).toMatchObject({ status: 'offline' });
    expect(Object.keys(loadOutbox())).toHaveLength(2);
    expect(loadReadings()).toHaveLength(2);

    expect(await syncNow(API, toServer)).toMatchObject({ status: 'synced' });
    expect(loadOutbox()).toEqual({});
    expect(await serverReadings()).toHaveLength(2);
  });

  it('keeps the newest edit when two devices change the same reading', async () => {
    const [r] = addReading({ indicatorId: 'heart_rate', value: 72 });
    await syncNow(API, toServer);

    // This device edits while offline, but the other device's later edit reaches the server first.
    updateReading(r.id, { value: 100 }, new Date(Date.now() - 60_000));
    await app.request(`/readings/${r.id}`, json('PATCH', { value: 120 }));
    await syncNow(API, toServer);
    expect(local(r.id)?.value).toBe(120);
    expect((await serverReadings())[0].value).toBe(120);
    expect(loadOutbox()).toEqual({});

    // A newer local edit wins.
    updateReading(r.id, { value: 130 }, new Date(Date.now() + 60_000));
    await syncNow(API, toServer);
    expect((await serverReadings())[0].value).toBe(130);
  });

  it('reports server errors and keeps the outbox', async () => {
    const broken: FetchLike = async () =>
      new Response(JSON.stringify({ error: 'Internal server error.' }), { status: 500 });
    addReading({ indicatorId: 'mood', value: 4 });
    expect(await syncNow(API, broken)).toMatchObject({
      status: 'error',
      error: 'Internal server error.',
    });
    expect(Object.keys(loadOutbox())).toHaveLength(1);
  });

  it('reports a reading the server refuses and stops resending it', async () => {
    // The log form does not validate yet (B's task), so a decimal heart rate can be saved locally.
    addReading({ indicatorId: 'heart_rate', value: 72.5 });
    const result = await syncNow(API, toServer);
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/refused 1 change/);
    expect(loadOutbox()).toEqual({});
    expect(loadReadings()).toHaveLength(1);
  });
});
