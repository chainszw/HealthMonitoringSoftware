import { describe, expect, it } from 'vitest';
import type { CrewMember, CrewOverviewItem, Level } from '../../src/lib/syncProtocol';
import type { Reading } from '../../src/lib/types';
import { MAX_ALERTS, buildCrewOverview, byUrgency } from './overview';

const NOW = new Date('2026-11-15T12:00:00.000Z');
const alpha: CrewMember = { id: 'alpha', name: 'Alex Rivera', role: 'astronaut' };
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const reading = (id: string, indicatorId: string, value: number, hoursAgo: number): Reading => ({
  id,
  indicatorId,
  value,
  timestamp: ago(hoursAgo),
});

describe('buildCrewOverview', () => {
  const readings = [
    reading('hr', 'heart_rate', 70, 2), // green
    reading('o2', 'spo2', 93, 3), // amber
    reading('sleep', 'sleep_hours', 5, 1), // red
    reading('mood', 'mood', 4, 60), // green, but older than the 48h window
    reading('old', 'heart_rate', 140, 10 * 24), // red, 10 days ago
    reading('future', 'body_temp', 41, -5), // red, but in the future
  ];
  const item = buildCrewOverview(alpha, readings, NOW, 7);

  it('reports the worst current status, per system and overall', () => {
    expect(item.status).toBe('red');
    expect(item.systems).toMatchObject({
      heart: 'green',
      respiratory: 'amber',
      mind: 'red',
      bone: 'unknown',
    });
  });

  it('scores readiness with the same rules as the crew app', () => {
    // body_temp's future reading still counts as its latest: red 0, heart 100, spo2 50, sleep 0.
    expect(item.readiness.score).toBe(38);
  });

  it('lists the latest reading per indicator and the missed checks', () => {
    expect(item.latest.heart_rate).toEqual({
      readingId: 'hr',
      value: 70,
      timestamp: ago(2),
      level: 'green',
      label: 'Usual adult resting range',
      current: true,
    });
    expect(item.latest.mood).toMatchObject({ level: 'green', current: false });
    expect(item.latest.blood_glucose).toBeUndefined();
    expect(item.overdue).toEqual(['bp_systolic', 'bp_diastolic', 'blood_glucose', 'mood']);
  });

  it('lists amber and red readings within the alert window, newest first', () => {
    expect(item.alerts.map((a) => [a.readingId, a.level])).toEqual([
      ['sleep', 'red'],
      ['o2', 'amber'],
    ]);
    expect(item.alerts[1]).toEqual({
      readingId: 'o2',
      indicatorId: 'spo2',
      indicatorName: 'Blood oxygen saturation',
      value: 93,
      unit: '%',
      level: 'amber',
      label: 'Below selected reference range',
      timestamp: ago(3),
    });
    const wider = buildCrewOverview(alpha, readings, NOW, 14);
    expect(wider.alerts.map((a) => a.readingId)).toEqual(['sleep', 'o2', 'old']);
    expect(item.lastReadingAt).toBe(ago(-5));
  });

  it('caps the alert list', () => {
    const many = Array.from({ length: 60 }, (_, i) => reading(`a${i}`, 'spo2', 93, i + 1));
    expect(buildCrewOverview(alpha, many, NOW, 7).alerts).toHaveLength(MAX_ALERTS);
  });

  it('handles an astronaut with no readings', () => {
    const empty = buildCrewOverview(alpha, [], NOW, 7);
    expect(empty).toMatchObject({
      status: 'unknown',
      readiness: { score: 0, streak: 0 },
      latest: {},
      alerts: [],
    });
    expect(empty.overdue).toHaveLength(8);
    expect(empty).not.toHaveProperty('lastReadingAt');
  });
});

describe('byUrgency', () => {
  const item = (name: string, status: Level) =>
    ({ crew: { id: name, name, role: 'astronaut' }, status }) as CrewOverviewItem;

  it('puts red first, then amber, missed checks, green; then by name', () => {
    const sorted = [
      item('Zoe', 'green'),
      item('Yan', 'red'),
      item('Ann', 'green'),
      item('Kit', 'unknown'),
      item('Bo', 'amber'),
    ].sort(byUrgency);
    expect(sorted.map((i) => i.crew.name)).toEqual(['Yan', 'Bo', 'Kit', 'Ann', 'Zoe']);
  });
});
