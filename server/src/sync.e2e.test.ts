import { beforeEach, describe, expect, it } from 'vitest';
import { signIn, signOut } from '../../src/lib/session';
import {
  addReading,
  clearReadings,
  deleteReading,
  loadOutbox,
  loadReadings,
  loadSession,
  loadSyncState,
  refreshReadings,
  saveSession,
  updateReading,
} from '../../src/lib/storage';
import { syncNow, type FetchLike } from '../../src/lib/sync';
import type { StoredReading } from './readingsRepo';
import { json, setupApi } from './testkit';

// End to end: the app's real sync and sign-in code (src/lib) against the real API, with an
// in-memory database and an in-memory localStorage. Requests signed with the same astronaut's
// token play the part of that astronaut's other device.

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
let api: ReturnType<typeof setupApi>;
let toServer: FetchLike;
let otherDevice: ReturnType<ReturnType<typeof setupApi>['as']>;

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  refreshReadings();
  saveSession(null);
  clearReadings();
  api = setupApi();
  toServer = async (url, init) => api.app.fetch(new Request(url, init));
  otherDevice = api.as(api.tokens.alpha);
  saveSession({
    token: api.tokens.alpha,
    crew: { id: 'alpha', name: 'Alex Rivera', role: 'astronaut' },
  });
});

const sync = () => syncNow(API, { fetchImpl: toServer });
const serverReadings = async (query = '') =>
  (await json<{ readings: StoredReading[] }>(otherDevice(`/readings${query}`))).readings;
const local = (id: string) => loadReadings().find((r) => r.id === id);

describe('sync between the app and the server', () => {
  it('pushes new readings and empties the outbox', async () => {
    const [r] = addReading({ indicatorId: 'heart_rate', value: 72, note: 'after rest' });
    expect(Object.keys(loadOutbox())).toEqual([r.id]);

    expect(await sync()).toMatchObject({ status: 'synced' });
    expect(loadOutbox()).toEqual({});
    expect(loadSyncState().cursor).toBe(1);
    expect(await serverReadings()).toMatchObject([
      { id: r.id, crewId: 'alpha', indicatorId: 'heart_rate', value: 72, note: 'after rest' },
    ]);
  });

  it('pulls readings, edits and deletions made on another device', async () => {
    await otherDevice('/readings', {
      method: 'POST',
      body: { id: 'other', indicatorId: 'mood', value: 4 },
    });
    await sync();
    expect(local('other')?.value).toBe(4);

    await otherDevice('/readings/other', { method: 'PATCH', body: { value: 2 } });
    await sync();
    expect(local('other')?.value).toBe(2);

    await otherDevice('/readings/other', { method: 'DELETE' });
    await sync();
    expect(local('other')).toBeUndefined();
  });

  it('sends local edits and deletions', async () => {
    const [r] = addReading({ indicatorId: 'heart_rate', value: 72 });
    await sync();

    updateReading(r.id, { value: 90 });
    await sync();
    expect((await serverReadings())[0].value).toBe(90);

    deleteReading(r.id);
    await sync();
    expect(await serverReadings()).toEqual([]);
    expect((await serverReadings('?includeDeleted=true'))[0].deletedAt).toBeTypeOf('string');
  });

  it('keeps working offline and catches up when the server is back', async () => {
    const down: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    addReading({ indicatorId: 'mood', value: 3 });
    addReading({ indicatorId: 'spo2', value: 97 });
    expect(await syncNow(API, { fetchImpl: down })).toMatchObject({ status: 'offline' });
    expect(Object.keys(loadOutbox())).toHaveLength(2);
    expect(loadReadings()).toHaveLength(2);

    expect(await sync()).toMatchObject({ status: 'synced' });
    expect(loadOutbox()).toEqual({});
    expect(await serverReadings()).toHaveLength(2);
  });

  it('keeps the newest edit when two devices change the same reading', async () => {
    const [r] = addReading({ indicatorId: 'heart_rate', value: 72 });
    await sync();

    // This device edits while offline, but the other device's later edit reaches the server first.
    updateReading(r.id, { value: 100 }, new Date(Date.now() - 60_000));
    await otherDevice(`/readings/${r.id}`, { method: 'PATCH', body: { value: 120 } });
    await sync();
    expect(local(r.id)?.value).toBe(120);
    expect((await serverReadings())[0].value).toBe(120);
    expect(loadOutbox()).toEqual({});

    // A newer local edit wins.
    updateReading(r.id, { value: 130 }, new Date(Date.now() + 60_000));
    await sync();
    expect((await serverReadings())[0].value).toBe(130);
  });

  it('reports server errors and keeps the outbox', async () => {
    const broken: FetchLike = async () =>
      new Response(JSON.stringify({ error: 'Internal server error.' }), { status: 500 });
    addReading({ indicatorId: 'mood', value: 4 });
    expect(await syncNow(API, { fetchImpl: broken })).toMatchObject({
      status: 'error',
      error: 'Internal server error.',
    });
    expect(Object.keys(loadOutbox())).toHaveLength(1);
  });

  it('reports a reading the server refuses and stops resending it', async () => {
    // The log form does not validate yet (B's task), so a decimal heart rate can be saved locally.
    addReading({ indicatorId: 'heart_rate', value: 72.5 });
    const result = await sync();
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/refused 1 change/);
    expect(loadOutbox()).toEqual({});
    expect(loadReadings()).toHaveLength(1);
  });
});

describe('crew sign-in for sync', () => {
  beforeEach(() => {
    saveSession(null);
  });

  it('stays signed out without a token, keeping changes for later', async () => {
    addReading({ indicatorId: 'mood', value: 4 });
    expect(await sync()).toMatchObject({ status: 'signed-out' });
    expect(Object.keys(loadOutbox())).toHaveLength(1);
  });

  it('can use a default demo token when nobody signed in', async () => {
    const result = await syncNow(API, { fetchImpl: toServer, defaultToken: api.tokens.bravo });
    expect(result.status).toBe('synced');
  });

  it('signs in with a valid astronaut token and uploads what was logged before', async () => {
    addReading({ indicatorId: 'mood', value: 4 });
    const result = await signIn(API, ` ${api.tokens.bravo} `, toServer);
    expect(result).toEqual({
      ok: true,
      crew: { id: 'bravo', name: 'Sam Okafor', role: 'astronaut' },
    });
    expect(loadSession()?.crew.id).toBe('bravo');
    expect(await sync()).toMatchObject({ status: 'synced' });
    const asBravo = await json<{ readings: StoredReading[] }>(
      api.as(api.tokens.bravo)('/readings'),
    );
    expect(asBravo.readings.map((r) => r.crewId)).toEqual(['bravo']);
  });

  it('explains why a sign-in failed', async () => {
    expect(await signIn(API, 'chc_nope', toServer)).toEqual({
      ok: false,
      error: 'That crew token is not valid.',
    });
    expect(await signIn(API, api.tokens.surgeon, toServer)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/flight surgeon/),
    });
    expect(await signIn(API, '  ', toServer)).toMatchObject({ ok: false });
    expect(await signIn('', api.tokens.alpha, toServer)).toMatchObject({ ok: false });
    const down: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    expect(await signIn(API, api.tokens.alpha, down)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Cannot reach/),
    });
    expect(loadSession()).toBeNull();
  });

  it("switching crew members clears the previous member's data from the device", async () => {
    await signIn(API, api.tokens.alpha, toServer);
    addReading({ indicatorId: 'mood', value: 4 });
    await signIn(API, api.tokens.bravo, toServer);
    expect(loadReadings()).toEqual([]);
    expect(loadOutbox()).toEqual({});
    expect(loadSession()?.crew.id).toBe('bravo');
  });

  it('signing out removes the token and the readings', async () => {
    await signIn(API, api.tokens.alpha, toServer);
    addReading({ indicatorId: 'mood', value: 4 });
    signOut();
    expect(loadSession()).toBeNull();
    expect(loadReadings()).toEqual([]);
    expect(loadOutbox()).toEqual({});
  });

  it('reports signed-out when the token stops working', async () => {
    await signIn(API, api.tokens.alpha, toServer);
    api.crew.rotateToken('alpha');
    expect(await sync()).toMatchObject({
      status: 'signed-out',
      error: expect.stringMatching(/Authorization: Bearer/),
    });
  });
});
