import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { openDb } from './db';
import type { StoredReading } from './readingsRepo';

let app: ReturnType<typeof createApp>;
let clock: number;
let ids: number;

beforeEach(() => {
  clock = Date.parse('2026-11-15T08:00:00.000Z');
  ids = 0;
  app = createApp(openDb(':memory:'), {
    now: () => new Date((clock += 1000)).toISOString(),
    makeId: () => `gen-${++ids}`,
  });
});

/** Union of every response body the API returns, for typed assertions. */
interface ApiBody {
  ok?: boolean;
  reading: StoredReading;
  readings: StoredReading[];
  error?: string;
  field?: string;
}
const body = async (res: Response | Promise<Response>) => (await (await res).json()) as ApiBody;

const json = (method: string, payload: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const get = (path: string) => app.request(path);
const post = (payload: unknown) => app.request('/readings', json('POST', payload));
const patch = (id: string, payload: unknown) =>
  app.request(`/readings/${id}`, json('PATCH', payload));
const del = (id: string) => app.request(`/readings/${id}`, { method: 'DELETE' });
const idsOf = (readings: StoredReading[]) => readings.map((r) => r.id);

async function create(payload: Record<string, unknown>) {
  return (await body(post(payload))).reading;
}

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
    expect(await body(res)).toMatchObject({ ok: true });
  });
});

describe('POST /readings', () => {
  it('creates a reading with a generated id and timestamp', async () => {
    const res = await post({ indicatorId: 'heart_rate', value: 72, note: 'after rest' });
    expect(res.status).toBe(201);
    const { reading } = await body(res);
    expect(reading).toMatchObject({
      id: 'gen-1',
      indicatorId: 'heart_rate',
      value: 72,
      note: 'after rest',
    });
    // The fake clock ticks on every read, so the timestamp is the server time just before insert.
    expect(reading.timestamp).toBe('2026-11-15T08:00:01.000Z');
    expect(reading.createdAt).toBe('2026-11-15T08:00:02.000Z');
  });

  it('keeps a client id and timestamp, and is idempotent on that id', async () => {
    const payload = {
      id: 'client-uuid-1',
      indicatorId: 'mood',
      value: 4,
      timestamp: '2026-11-14T20:00:00.000Z',
    };
    expect((await post(payload)).status).toBe(201);
    const again = await post(payload);
    expect(again.status).toBe(200);
    expect((await body(again)).reading.id).toBe('client-uuid-1');
    expect((await body(get('/readings'))).readings).toHaveLength(1);
  });

  it('rejects invalid bodies with the field name', async () => {
    const cases: [unknown, string | undefined][] = [
      [{ indicatorId: 'nope', value: 1 }, 'indicatorId'],
      [{ value: 1 }, 'indicatorId'],
      [{ indicatorId: 'spo2', value: 101 }, 'value'],
      [{ indicatorId: 'heart_rate', value: 72.5 }, 'value'],
      [{ indicatorId: 'heart_rate', value: '72' }, 'value'],
      [{ indicatorId: 'mood', value: 3, timestamp: 'yesterday' }, 'timestamp'],
      [{ indicatorId: 'mood', value: 3, note: 'x'.repeat(501) }, 'note'],
      [{ id: 'bad id!', indicatorId: 'mood', value: 3 }, 'id'],
      [[1, 2], undefined],
    ];
    for (const [payload, field] of cases) {
      const res = await post(payload);
      expect(res.status, JSON.stringify(payload)).toBe(400);
      expect((await body(res)).field).toBe(field);
    }
  });

  it('rejects malformed JSON', async () => {
    const res = await app.request('/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{oops',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /readings', () => {
  beforeEach(async () => {
    await create({
      id: 'a',
      indicatorId: 'heart_rate',
      value: 70,
      timestamp: '2026-11-12T07:00:00Z',
    });
    await create({
      id: 'b',
      indicatorId: 'heart_rate',
      value: 75,
      timestamp: '2026-11-14T07:00:00Z',
    });
    await create({ id: 'c', indicatorId: 'mood', value: 4, timestamp: '2026-11-13T20:00:00Z' });
  });

  it('lists readings oldest first', async () => {
    expect(idsOf((await body(get('/readings'))).readings)).toEqual(['a', 'c', 'b']);
  });

  it('filters by indicator and time range', async () => {
    const res = get(
      '/readings?indicatorId=heart_rate&from=2026-11-13T00:00:00Z&to=2026-11-15T00:00:00Z',
    );
    expect(idsOf((await body(res)).readings)).toEqual(['b']);
  });

  it('rejects a bad time filter', async () => {
    expect((await get('/readings?from=soon')).status).toBe(400);
  });

  it('gets one reading or 404', async () => {
    expect((await body(get('/readings/c'))).reading.value).toBe(4);
    expect((await get('/readings/zzz')).status).toBe(404);
  });
});

describe('PATCH /readings/:id', () => {
  it('updates value and note, and bumps updatedAt', async () => {
    const before = await create({ id: 'p', indicatorId: 'heart_rate', value: 70, note: 'x' });
    const res = await patch('p', { value: 140, note: null });
    expect(res.status).toBe(200);
    const { reading } = await body(res);
    expect(reading.value).toBe(140);
    expect(reading.note).toBeUndefined();
    expect(reading.updatedAt > before.updatedAt).toBe(true);
    expect(reading.createdAt).toBe(before.createdAt);
  });

  it('validates against the reading indicator and refuses other fields', async () => {
    await create({ id: 'p', indicatorId: 'mood', value: 3 });
    expect((await patch('p', { value: 6 })).status).toBe(400);
    expect((await patch('p', { indicatorId: 'spo2' })).status).toBe(400);
    expect((await patch('p', {})).status).toBe(400);
    expect((await patch('missing', { value: 3 })).status).toBe(404);
  });
});

describe('DELETE /readings/:id', () => {
  it('soft-deletes: hidden from lists, kept as a tombstone', async () => {
    await create({ id: 'd', indicatorId: 'mood', value: 3 });
    expect((await del('d')).status).toBe(204);
    expect((await del('d')).status).toBe(404);
    expect((await body(get('/readings'))).readings).toEqual([]);
    const [tombstone] = (await body(get('/readings?includeDeleted=true'))).readings;
    expect(tombstone).toMatchObject({ id: 'd' });
    expect(tombstone.deletedAt).toBeTypeOf('string');
    expect((await patch('d', { value: 4 })).status).toBe(404);
  });
});

describe('CORS', () => {
  it('allows the Vite dev origin', async () => {
    const res = await app.request('/health', { headers: { Origin: 'http://localhost:5173' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });
});
