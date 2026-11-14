import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CrewMemberOverviewResponse,
  CrewOverviewResponse,
  CrewTrendResponse,
} from '../../src/lib/syncProtocol';
import { json, setupApi } from './testkit';

const NOW = '2026-11-15T12:00:00.000Z';
const ago = (hours: number) => new Date(Date.parse(NOW) - hours * 3_600_000).toISOString();

let api: ReturnType<typeof setupApi>;
let surgeon: ReturnType<ReturnType<typeof setupApi>['as']>;

beforeEach(async () => {
  api = setupApi({ now: () => NOW });
  surgeon = api.as(api.tokens.surgeon);
  const log = (token: string, id: string, indicatorId: string, value: number, hoursAgo: number) =>
    api.as(token)('/readings', {
      method: 'POST',
      body: { id, indicatorId, value, timestamp: ago(hoursAgo) },
    });
  await log(api.tokens.alpha, 'a1', 'heart_rate', 70, 2);
  await log(api.tokens.alpha, 'a2', 'heart_rate', 75, 26);
  await log(api.tokens.bravo, 'b1', 'heart_rate', 140, 1);
  await log(api.tokens.bravo, 'b2', 'spo2', 93, 30);
});

describe('GET /crew/overview', () => {
  it('summarises every astronaut, most urgent first', async () => {
    const res = await surgeon('/crew/overview');
    expect(res.status).toBe(200);
    const body = await json<CrewOverviewResponse>(res);
    expect(body).toMatchObject({ generatedAt: NOW, currentWindowHours: 48, alertDays: 7 });
    expect(body.crew.map((i) => [i.crew.id, i.status])).toEqual([
      ['bravo', 'red'],
      ['alpha', 'green'],
    ]);
    const bravo = body.crew[0];
    expect(bravo.alerts.map((a) => a.readingId)).toEqual(['b1', 'b2']);
    expect(bravo.latest.heart_rate).toMatchObject({ value: 140, level: 'red', current: true });
  });

  it('takes the alert window in days', async () => {
    const body = await json<CrewOverviewResponse>(surgeon('/crew/overview?days=1'));
    expect(body.alertDays).toBe(1);
    expect(body.crew[0].alerts.map((a) => a.readingId)).toEqual(['b1']);
    for (const bad of ['0', '91', '1.5', 'week']) {
      expect((await surgeon(`/crew/overview?days=${bad}`)).status, bad).toBe(400);
    }
  });

  it('is only for flight surgeons', async () => {
    expect((await api.as(api.tokens.alpha)('/crew/overview')).status).toBe(403);
    expect((await api.as(undefined)('/crew/overview')).status).toBe(401);
  });
});

describe('GET /crew/:crewId/overview', () => {
  it('gives one astronaut to the flight surgeon or to that astronaut', async () => {
    const asSurgeon = await json<CrewMemberOverviewResponse>(surgeon('/crew/alpha/overview'));
    expect(asSurgeon.overview).toMatchObject({ crew: { id: 'alpha' }, status: 'green' });
    const asSelf = await json<CrewMemberOverviewResponse>(
      api.as(api.tokens.alpha)('/crew/alpha/overview'),
    );
    expect(asSelf.overview.status).toBe('green');
  });

  it("refuses other astronauts' data and non-astronauts", async () => {
    expect((await api.as(api.tokens.alpha)('/crew/bravo/overview')).status).toBe(403);
    expect((await surgeon('/crew/surgeon/overview')).status).toBe(404);
    expect((await surgeon('/crew/nobody/overview')).status).toBe(404);
  });
});

describe('GET /crew/:crewId/trend/:indicatorId', () => {
  it('returns chart points with levels, oldest first', async () => {
    const body = await json<CrewTrendResponse>(surgeon('/crew/alpha/trend/heart_rate?days=3'));
    expect(body).toMatchObject({ crewId: 'alpha', indicatorId: 'heart_rate', days: 3 });
    expect(body.points.map((p) => [p.value, p.level])).toEqual([
      [75, 'green'],
      [70, 'green'],
    ]);
    expect(body.points[0].label).toBeTypeOf('string');
    const self = await json<CrewTrendResponse>(api.as(api.tokens.bravo)('/crew/bravo/trend/spo2'));
    expect(self.days).toBe(30);
    expect(self.points.map((p) => p.level)).toEqual(['amber']);
  });

  it('checks the indicator, the days and who is asking', async () => {
    expect((await surgeon('/crew/alpha/trend/nope')).status).toBe(404);
    expect((await surgeon('/crew/alpha/trend/heart_rate?days=0')).status).toBe(400);
    expect((await api.as(api.tokens.alpha)('/crew/bravo/trend/spo2')).status).toBe(403);
  });
});
