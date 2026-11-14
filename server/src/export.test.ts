import { beforeEach, describe, expect, it } from 'vitest';
import type { ExportRow } from '../../src/lib/exportData';
import { json, setupApi } from './testkit';

const NOW = '2026-11-15T12:00:00.000Z';
let api: ReturnType<typeof setupApi>;

beforeEach(async () => {
  api = setupApi({ now: () => NOW });
  const alpha = api.as(api.tokens.alpha);
  const bravo = api.as(api.tokens.bravo);
  const t = (h: number) => new Date(Date.parse(NOW) - h * 3_600_000).toISOString();
  await alpha('/readings', {
    method: 'POST',
    body: {
      id: 'a1',
      indicatorId: 'heart_rate',
      value: 72,
      timestamp: t(30),
      note: 'calm, rested',
    },
  });
  await alpha('/readings', {
    method: 'POST',
    body: { id: 'a2', indicatorId: 'spo2', value: 93, timestamp: t(2), note: '=1+1' },
  });
  await alpha('/readings', {
    method: 'POST',
    body: { id: 'a3', indicatorId: 'mood', value: 4, timestamp: t(1) },
  });
  await alpha('/readings/a3', { method: 'DELETE' });
  await bravo('/readings', {
    method: 'POST',
    body: { id: 'b1', indicatorId: 'heart_rate', value: 140, timestamp: t(1) },
  });
});

interface ExportDoc {
  scope: string;
  exportedBy: { id: string };
  filters: Record<string, string>;
  count: number;
  readings: ExportRow[];
}

describe('GET /export.csv', () => {
  it("exports an astronaut's own readings as a CSV download", async () => {
    const res = await api.as(api.tokens.alpha)('/export.csv');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="crew-health-alpha-2026-11-15.csv"',
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
    // The file starts with a UTF-8 byte-order mark (for Excel); text() decodes it away.
    const bytes = new Uint8Array(await res.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = await res.text();
    expect(text.startsWith('crew_id,crew_name,reading_id')).toBe(true);
    const lines = text.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('alpha,Alex Rivera,a1,heart_rate,Heart rate,bpm,72,green');
    expect(lines[1]).toContain('"calm, rested"');
    expect(lines[2]).toContain(",'=1+1,");
  });

  it("refuses another astronaut's readings", async () => {
    expect((await api.as(api.tokens.alpha)('/export.csv?crewId=bravo')).status).toBe(403);
    expect((await api.as(undefined)('/export.csv')).status).toBe(401);
  });
});

describe('GET /export.json', () => {
  it('gives flight surgeons the whole crew, or one crew member', async () => {
    const all = await json<ExportDoc>(api.as(api.tokens.surgeon)('/export.json'));
    expect(all).toMatchObject({ scope: 'all-crew', exportedBy: { id: 'surgeon' }, filters: {} });
    expect(all.readings.map((r) => [r.crewName, r.readingId])).toEqual([
      ['Alex Rivera', 'a1'],
      ['Alex Rivera', 'a2'],
      ['Sam Okafor', 'b1'],
    ]);
    expect(all.readings[2]).toMatchObject({ status: 'red', band: 'Very high resting pulse' });

    const res = await api.as(api.tokens.surgeon)('/export.json?crewId=bravo');
    expect(res.headers.get('content-disposition')).toContain('crew-health-bravo-2026-11-15.json');
    const one = await json<ExportDoc>(res);
    expect(one).toMatchObject({ scope: 'bravo', filters: { crewId: 'bravo' }, count: 1 });
  });

  it('applies filters and can include deleted readings', async () => {
    const alpha = api.as(api.tokens.alpha);
    const spo2 = await json<ExportDoc>(alpha('/export.json?indicatorId=spo2'));
    expect(spo2.readings.map((r) => r.readingId)).toEqual(['a2']);
    expect(spo2.filters).toEqual({ crewId: 'alpha', indicatorId: 'spo2' });

    const recent = await json<ExportDoc>(alpha('/export.json?from=2026-11-15T00:00:00Z'));
    expect(recent.readings.map((r) => r.readingId)).toEqual(['a2']);

    const withDeleted = await json<ExportDoc>(alpha('/export.json?includeDeleted=true'));
    const a3 = withDeleted.readings.find((r) => r.readingId === 'a3');
    expect(a3?.deletedAt).toBe(NOW);
  });

  it('checks the filters and the crew member', async () => {
    const surgeon = api.as(api.tokens.surgeon);
    expect((await surgeon('/export.json?indicatorId=nope')).status).toBe(400);
    expect((await surgeon('/export.json?from=yesterday')).status).toBe(400);
    expect((await surgeon('/export.json?crewId=nobody')).status).toBe(404);
  });
});
