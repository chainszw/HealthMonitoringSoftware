import { beforeEach, describe, expect, it } from 'vitest';
import type { CrewMember } from '../../src/lib/syncProtocol';
import { bearerToken, generateToken, hashToken } from './auth';
import type { StoredReading } from './readingsRepo';
import { json, setupApi } from './testkit';

let api: ReturnType<typeof setupApi>;
beforeEach(() => {
  api = setupApi();
});

const reading = (id: string, value: number) => ({ id, indicatorId: 'heart_rate', value });
const readingsOf = async (res: Response | Promise<Response>) =>
  (await json<{ readings: StoredReading[] }>(res)).readings;

describe('tokens', () => {
  it('parses bearer headers', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer  abc ')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeUndefined();
    expect(bearerToken('Bearer')).toBeUndefined();
    expect(bearerToken(undefined)).toBeUndefined();
  });

  it('generates distinct prefixed tokens and stores only their hash', () => {
    const a = generateToken();
    expect(a).toMatch(/^chc_[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(a);
    const hashes = api.db.prepare('SELECT token_hash FROM crew').all() as { token_hash: string }[];
    expect(hashes.map((h) => h.token_hash)).toContain(hashToken(api.tokens.alpha));
    expect(JSON.stringify(hashes)).not.toContain(api.tokens.alpha);
  });

  it('a new token replaces the old one', async () => {
    const fresh = api.crew.rotateToken('alpha')!;
    expect((await api.as(api.tokens.alpha)('/me')).status).toBe(401);
    expect((await api.as(fresh)('/me')).status).toBe(200);
    expect(api.crew.rotateToken('nobody')).toBeUndefined();
  });
});

describe('authentication', () => {
  it('refuses requests without a valid token', async () => {
    for (const headers of [{}, { Authorization: 'Bearer chc_wrong' }, { Authorization: 'x' }]) {
      const res = await api.app.request('/readings', { headers });
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toBe('Bearer');
      expect((await json<{ error: string }>(res)).error).toMatch(/Authorization: Bearer/);
    }
  });

  it('tells each token who it belongs to', async () => {
    expect(await json<{ crew: CrewMember }>(api.as(api.tokens.alpha)('/me'))).toEqual({
      crew: { id: 'alpha', name: 'Alex Rivera', role: 'astronaut' },
    });
    expect((await json<{ crew: CrewMember }>(api.as(api.tokens.surgeon)('/me'))).crew.role).toBe(
      'flight_surgeon',
    );
  });
});

describe('astronauts', () => {
  it("only see their own readings, even with the same id as a crewmate's", async () => {
    const alpha = api.as(api.tokens.alpha);
    const bravo = api.as(api.tokens.bravo);
    expect((await alpha('/readings', { method: 'POST', body: reading('r1', 70) })).status).toBe(
      201,
    );
    expect(await readingsOf(bravo('/readings'))).toEqual([]);
    expect((await bravo('/readings/r1')).status).toBe(404);

    // Same id for bravo is a separate reading and does not reveal alpha's.
    const created = await json<{ reading: StoredReading }>(
      bravo('/readings', { method: 'POST', body: reading('r1', 99) }),
    );
    expect(created.reading).toMatchObject({ crewId: 'bravo', value: 99 });
    await bravo('/readings/r1', { method: 'PATCH', body: { value: 100 } });
    await bravo('/readings/r1', { method: 'DELETE' });
    expect((await readingsOf(alpha('/readings')))[0]).toMatchObject({ crewId: 'alpha', value: 70 });
  });

  it("cannot read a crewmate's readings or list the crew", async () => {
    const alpha = api.as(api.tokens.alpha);
    expect((await alpha('/readings?crewId=bravo')).status).toBe(403);
    expect((await alpha('/readings?crewId=alpha')).status).toBe(200);
    expect((await alpha('/crew')).status).toBe(403);
  });
});

describe('flight surgeons', () => {
  beforeEach(async () => {
    await api.as(api.tokens.alpha)('/readings', { method: 'POST', body: reading('r1', 70) });
    await api.as(api.tokens.bravo)('/readings', { method: 'POST', body: reading('r1', 99) });
  });

  it("read every crew member's readings, or one crew member's", async () => {
    const surgeon = api.as(api.tokens.surgeon);
    const all = await readingsOf(surgeon('/readings'));
    expect(all.map((r) => [r.crewId, r.value])).toEqual(
      expect.arrayContaining([
        ['alpha', 70],
        ['bravo', 99],
      ]),
    );
    expect((await readingsOf(surgeon('/readings?crewId=bravo'))).map((r) => r.value)).toEqual([99]);
    expect((await surgeon('/readings/r1')).status).toBe(400);
    const one = await json<{ reading: StoredReading }>(surgeon('/readings/r1?crewId=alpha'));
    expect(one.reading.value).toBe(70);
  });

  it('list the crew', async () => {
    const { crew } = await json<{ crew: CrewMember[] }>(api.as(api.tokens.surgeon)('/crew'));
    expect(crew.map((m) => m.id)).toEqual(['surgeon', 'alpha', 'bravo']);
  });

  it('cannot change readings', async () => {
    const surgeon = api.as(api.tokens.surgeon);
    const attempts = [
      surgeon('/readings', { method: 'POST', body: reading('r2', 60) }),
      surgeon('/readings/r1', { method: 'PATCH', body: { value: 1 } }),
      surgeon('/readings/r1', { method: 'DELETE' }),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(403);
      expect((await json<{ error: string }>(res)).error).toMatch(/read-only/);
    }
  });
});
