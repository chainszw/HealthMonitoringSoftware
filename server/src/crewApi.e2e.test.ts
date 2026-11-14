import { beforeEach, describe, expect, it } from 'vitest';
import {
  fetchCrewMemberOverview,
  fetchCrewOverview,
  fetchCrewTrend,
  fetchMe,
} from '../../src/lib/crewApi';
import type { FetchLike } from '../../src/lib/sync';
import { setupApi } from './testkit';

// The typed client functions a flight-surgeon console would call, against the real API.

const API = 'http://api.test';
let api: ReturnType<typeof setupApi>;
let opts: { fetchImpl: FetchLike };

beforeEach(async () => {
  api = setupApi();
  opts = { fetchImpl: async (url, init) => api.app.fetch(new Request(url, init)) };
  await api.as(api.tokens.alpha)('/readings', {
    method: 'POST',
    body: { id: 'r1', indicatorId: 'sleep_hours', value: 5 },
  });
});

describe('flight-surgeon client calls', () => {
  it('fetches who is signed in, the overview, one member and a trend', async () => {
    const me = await fetchMe(API, api.tokens.surgeon, opts);
    expect(me).toEqual({
      ok: true,
      data: { crew: { id: 'surgeon', name: 'Dr. Jordan Lee', role: 'flight_surgeon' } },
    });

    const overview = await fetchCrewOverview(API, api.tokens.surgeon, 7, opts);
    expect(overview.ok && overview.data.crew.map((i) => [i.crew.id, i.status])).toEqual([
      ['alpha', 'red'],
      ['bravo', 'unknown'],
    ]);

    const one = await fetchCrewMemberOverview(API, api.tokens.surgeon, 'alpha', undefined, opts);
    expect(one.ok && one.data.overview.alerts.map((a) => a.readingId)).toEqual(['r1']);

    const trend = await fetchCrewTrend(API, api.tokens.surgeon, 'alpha', 'sleep_hours', 7, opts);
    expect(trend.ok && trend.data.points.map((p) => p.level)).toEqual(['red']);
  });

  it('returns the server error message instead of throwing', async () => {
    expect(await fetchCrewOverview(API, api.tokens.alpha, undefined, opts)).toEqual({
      ok: false,
      status: 403,
      error: 'Only flight surgeons can see the crew overview.',
    });
    expect(await fetchMe(API, 'chc_wrong', opts)).toMatchObject({ ok: false, status: 401 });
    const down: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    expect(await fetchMe(API, api.tokens.surgeon, { fetchImpl: down })).toEqual({
      ok: false,
      status: 0,
      error: 'Cannot reach the server.',
    });
  });
});
