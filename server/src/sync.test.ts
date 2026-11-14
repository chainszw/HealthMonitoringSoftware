import { beforeEach, describe, expect, it } from 'vitest';
import type { SyncChange, SyncResponse } from '../../src/lib/syncProtocol';
import type { StoredReading } from './readingsRepo';
import { json, setupApi } from './testkit';

let api: ReturnType<typeof setupApi>;
let clock: number;

beforeEach(() => {
  clock = Date.parse('2026-11-15T08:00:00.000Z');
  api = setupApi({ now: () => new Date((clock += 1000)).toISOString() });
});

type Reply = SyncResponse & { error?: string; field?: string };

async function syncAs(token: string, since: number, changes: unknown[]) {
  const res = await api.as(token)('/sync', { method: 'POST', body: { since, changes } });
  return { status: res.status, body: await json<Reply>(res) };
}
const sync = (since: number, changes: unknown[]) => syncAs(api.tokens.alpha, since, changes);

const change = (over: Partial<SyncChange> = {}): SyncChange => ({
  id: 'r1',
  indicatorId: 'heart_rate',
  value: 70,
  timestamp: '2026-11-15T07:00:00.000Z',
  updatedAt: '2026-11-15T07:00:00.000Z',
  ...over,
});

async function stored(id: string, token = api.tokens.alpha): Promise<StoredReading> {
  return (await json<{ reading: StoredReading }>(api.as(token)(`/readings/${id}`))).reading;
}

describe('POST /sync', () => {
  it('stores new changes and returns them with a cursor', async () => {
    const { status, body } = await sync(0, [change()]);
    expect(status).toBe(200);
    expect(body).toEqual({ changes: [change()], cursor: 1, rejected: [] });
    expect((await stored('r1')).value).toBe(70);
  });

  it('returns only what changed after the cursor', async () => {
    const first = await sync(0, [change()]);
    expect((await sync(first.body.cursor, [])).body.changes).toEqual([]);
    await api.as(api.tokens.alpha)('/readings', {
      method: 'POST',
      body: { id: 'r2', indicatorId: 'mood', value: 4 },
    });
    const later = await sync(first.body.cursor, []);
    expect(later.body.changes.map((c) => c.id)).toEqual(['r2']);
    expect(later.body.cursor).toBe(2);
  });

  it('keeps the newest version and sends the winner back for a stale change', async () => {
    await sync(0, [change({ value: 70, updatedAt: '2026-11-15T07:00:00.000Z' })]);
    const stale = await sync(1, [change({ value: 80, updatedAt: '2026-11-15T06:00:00.000Z' })]);
    expect(stale.body.changes).toEqual([change({ value: 70 })]);
    expect((await stored('r1')).value).toBe(70);

    await sync(1, [change({ value: 90, updatedAt: '2026-11-15T07:30:00.000Z' })]);
    expect((await stored('r1')).value).toBe(90);
  });

  it('applies tombstones, and a newer change brings a reading back', async () => {
    await sync(0, [change()]);
    const t = '2026-11-15T07:10:00.000Z';
    await sync(1, [change({ updatedAt: t, deletedAt: t })]);
    expect((await stored('r1')).deletedAt).toBe(t);
    const list = await json<{ readings: unknown[] }>(api.as(api.tokens.alpha)('/readings'));
    expect(list.readings).toEqual([]);

    await sync(2, [change({ value: 75, updatedAt: '2026-11-15T07:20:00.000Z' })]);
    expect(await stored('r1')).not.toHaveProperty('deletedAt');
  });

  it('refuses invalid changes but applies the rest', async () => {
    const { body } = await sync(0, [
      change({ id: 'ok' }),
      change({ id: 'bad', value: 999 }),
      change({ id: 'clock', updatedAt: '2026-11-20T00:00:00.000Z' }),
      { nope: true },
    ]);
    expect(body.changes.map((c) => c.id)).toEqual(['ok']);
    expect(body.rejected.map((r) => r.id)).toEqual(['bad', 'clock', '']);
    expect(body.rejected[1].error).toMatch(/future/);
  });

  it("refuses changing a reading's indicator", async () => {
    await sync(0, [change()]);
    const { body } = await sync(1, [
      change({ indicatorId: 'mood', value: 3, updatedAt: '2026-11-15T07:30:00.000Z' }),
    ]);
    expect(body.rejected).toEqual([{ id: 'r1', error: 'indicatorId cannot change.' }]);
    expect((await stored('r1')).indicatorId).toBe('heart_rate');
  });

  it('keeps only the newest of duplicate ids in one request', async () => {
    await sync(0, [
      change({ value: 71, updatedAt: '2026-11-15T07:05:00.000Z' }),
      change({ value: 72, updatedAt: '2026-11-15T07:01:00.000Z' }),
    ]);
    expect((await stored('r1')).value).toBe(71);
  });

  it('stores timestamps in one ISO format', async () => {
    await sync(0, [change({ timestamp: '2026-11-15T07:00:00Z', updatedAt: '2026-11-15T07:00Z' })]);
    const r = await stored('r1');
    expect(r.timestamp).toBe('2026-11-15T07:00:00.000Z');
    expect(r.updatedAt).toBe('2026-11-15T07:00:00.000Z');
  });

  it('sends everything when the device cursor is ahead of the server', async () => {
    await sync(0, [change()]);
    expect((await sync(99, [])).body.changes.map((c) => c.id)).toEqual(['r1']);
  });

  it('advances the cursor for REST writes too', async () => {
    const req = api.as(api.tokens.alpha);
    await req('/readings', { method: 'POST', body: { id: 'x', indicatorId: 'mood', value: 3 } });
    await req('/readings/x', { method: 'PATCH', body: { value: 4 } });
    expect((await sync(0, [])).body.cursor).toBe(2);
    await req('/readings/x', { method: 'DELETE' });
    const { body } = await sync(2, []);
    expect(body.cursor).toBe(3);
    expect(body.changes[0]).toMatchObject({ id: 'x', value: 4 });
    expect(body.changes[0].deletedAt).toBeTypeOf('string');
  });

  it('rejects malformed requests', async () => {
    expect((await sync(-1, [])).body.field).toBe('since');
    expect((await sync(1.5, [])).body.field).toBe('since');
    const tooMany = await sync(
      0,
      Array.from({ length: 1001 }, (_, i) => change({ id: `r${i}` })),
    );
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.field).toBe('changes');
    const notArray = await api.as(api.tokens.alpha)('/sync', {
      method: 'POST',
      body: { since: 0, changes: 'x' },
    });
    expect(notArray.status).toBe(400);
  });
});

describe('POST /sync per crew member', () => {
  it("keeps each astronaut's readings separate, even with the same ids", async () => {
    await syncAs(api.tokens.alpha, 0, [change({ value: 70 })]);
    const bravo = await syncAs(api.tokens.bravo, 0, [change({ value: 99 })]);
    expect(bravo.body.changes).toEqual([change({ value: 99 })]);
    expect((await stored('r1', api.tokens.alpha)).value).toBe(70);
    expect((await stored('r1', api.tokens.bravo)).value).toBe(99);

    const alpha = await syncAs(api.tokens.alpha, 1, []);
    expect(alpha.body.changes).toEqual([]);
    expect(alpha.body.cursor).toBe(2);
  });

  it('is not available to flight surgeons', async () => {
    const res = await syncAs(api.tokens.surgeon, 0, []);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/astronauts/);
  });

  it('needs a token', async () => {
    const res = await api.as(undefined)('/sync', {
      method: 'POST',
      body: { since: 0, changes: [] },
    });
    expect(res.status).toBe(401);
  });
});
