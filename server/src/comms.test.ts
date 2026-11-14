import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CrewMember,
  CrewMemberOverviewResponse,
  CrewOverviewResponse,
} from '../../src/lib/syncProtocol';
import { arrivalTime, commsDelaySeconds, parseScale } from './comms';
import type { StoredReading } from './readingsRepo';
import { json, setupApi } from './testkit';

describe('comms delay maths', () => {
  it("uses the mission's worst-case one-way delay, scaled", () => {
    expect(commsDelaySeconds('mars', 1)).toBe(1320);
    expect(commsDelaySeconds('mars', 0.01)).toBeCloseTo(13.2);
    expect(commsDelaySeconds('lunar', 1)).toBe(1.3);
    expect(commsDelaySeconds('iss', 1)).toBe(1);
    expect(commsDelaySeconds(undefined, 1)).toBe(0);
    expect(commsDelaySeconds('mars', 0)).toBe(0);
  });

  it('computes arrival times and reads the scale setting', () => {
    expect(arrivalTime('2026-11-15T12:00:00.000Z', 13.2)).toBe('2026-11-15T12:00:13.200Z');
    expect(arrivalTime('2026-11-15T12:00:00.000Z', 0)).toBeNull();
    expect(parseScale('0.01')).toBe(0.01);
    for (const off of [undefined, '', ' ', 'fast', '-1', '0']) expect(parseScale(off)).toBe(0);
  });
});

const NOW = Date.parse('2026-11-15T12:00:00.000Z');
let clock: number;
let api: ReturnType<typeof setupApi>;
const advance = (seconds: number) => {
  clock += seconds * 1000;
};

function setup(commsDelayScale: number) {
  clock = NOW;
  api = setupApi({ now: () => new Date(clock).toISOString(), commsDelayScale });
  api.crew.setMission('alpha', 'mars');
}

const logHeartRate = (id: string, value = 72) =>
  api.as(api.tokens.alpha)('/readings', {
    method: 'POST',
    body: { id, indicatorId: 'heart_rate', value },
  });
const surgeonReadings = async () =>
  (await json<{ readings: StoredReading[] }>(api.as(api.tokens.surgeon)('/readings?crewId=alpha')))
    .readings;
const overviewOfAlpha = async () =>
  (await json<CrewOverviewResponse>(api.as(api.tokens.surgeon)('/crew/overview'))).crew.find(
    (i) => i.crew.id === 'alpha',
  )!;

describe('comms delay on (Mars, 100x faster: 13.2 s one way)', () => {
  beforeEach(() => setup(0.01));

  it('keeps a reading from Earth-side views until it arrives', async () => {
    const created = await json<{ reading: StoredReading }>(logHeartRate('r1'));
    expect(created.reading.arrivesAt).toBe('2026-11-15T12:00:13.200Z');

    expect(await surgeonReadings()).toEqual([]);
    const missing = await api.as(api.tokens.surgeon)('/readings/r1?crewId=alpha');
    expect(missing.status).toBe(404);
    expect((await json<{ error: string }>(missing)).error).toMatch(/in transit/);

    const before = await overviewOfAlpha();
    expect(before).toMatchObject({
      crew: { id: 'alpha', mission: 'mars' },
      status: 'unknown',
      commsDelaySeconds: 13.2,
      inTransit: { count: 1, nextArrivalAt: '2026-11-15T12:00:13.200Z' },
    });
    expect(before.latest).toEqual({});

    advance(14);
    expect((await surgeonReadings()).map((r) => r.id)).toEqual(['r1']);
    const after = await overviewOfAlpha();
    expect(after.inTransit).toEqual({ count: 0 });
    expect(after.latest.heart_rate).toMatchObject({ value: 72, level: 'green' });
  });

  it("does not delay the astronaut's own views", async () => {
    await logHeartRate('r1');
    const own = await json<{ readings: StoredReading[] }>(api.as(api.tokens.alpha)('/readings'));
    expect(own.readings.map((r) => r.id)).toEqual(['r1']);
    const mine = await json<CrewMemberOverviewResponse>(
      api.as(api.tokens.alpha)('/crew/alpha/overview'),
    );
    expect(mine.commsDelayScale).toBe(0.01);
    expect(mine.overview.latest.heart_rate.value).toBe(72);
    expect(mine.overview.inTransit.count).toBe(1);
  });

  it('applies to trends and exports too', async () => {
    await logHeartRate('r1');
    const surgeon = api.as(api.tokens.surgeon);
    const trend = await json<{ points: unknown[] }>(surgeon('/crew/alpha/trend/heart_rate'));
    expect(trend.points).toEqual([]);
    const surgeonExport = await json<{ count: number }>(surgeon('/export.json?crewId=alpha'));
    expect(surgeonExport.count).toBe(0);
    const ownExport = await json<{ count: number }>(api.as(api.tokens.alpha)('/export.json'));
    expect(ownExport.count).toBe(1);
  });

  it('hides an edited reading again until the new version arrives', async () => {
    await logHeartRate('r1');
    advance(14);
    await api.as(api.tokens.alpha)('/readings/r1', { method: 'PATCH', body: { value: 140 } });
    expect(await surgeonReadings()).toEqual([]);
    advance(14);
    expect((await surgeonReadings())[0].value).toBe(140);
  });

  it('takes the mission from sync and delays the synced changes', async () => {
    const res = await api.as(api.tokens.alpha)('/sync', {
      method: 'POST',
      body: {
        since: 0,
        mission: 'lunar',
        changes: [
          {
            id: 's1',
            indicatorId: 'mood',
            value: 4,
            timestamp: '2026-11-15T11:59:00.000Z',
            updatedAt: '2026-11-15T11:59:00.000Z',
          },
        ],
      },
    });
    expect(res.status).toBe(200);
    const me = await json<{ crew: CrewMember }>(api.as(api.tokens.alpha)('/me'));
    expect(me.crew.mission).toBe('lunar');
    expect((await overviewOfAlpha()).inTransit).toEqual({
      count: 1,
      nextArrivalAt: '2026-11-15T12:00:00.013Z',
    });

    const bad = await api.as(api.tokens.alpha)('/sync', {
      method: 'POST',
      body: { since: 0, changes: [], mission: 'venus' },
    });
    expect(bad.status).toBe(400);
  });
});

describe('comms delay off (the default)', () => {
  beforeEach(() => setup(0));

  it('shows readings on Earth at once, whatever the mission', async () => {
    const created = await json<{ reading: StoredReading }>(logHeartRate('r1'));
    expect(created.reading).not.toHaveProperty('arrivesAt');
    expect((await surgeonReadings()).map((r) => r.id)).toEqual(['r1']);
    const response = await json<CrewOverviewResponse>(api.as(api.tokens.surgeon)('/crew/overview'));
    expect(response.commsDelayScale).toBe(0);
    expect(response.crew[0]).toMatchObject({ commsDelaySeconds: 0, inTransit: { count: 0 } });
  });
});
