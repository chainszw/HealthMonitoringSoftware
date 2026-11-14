import { beforeEach, describe, expect, it } from 'vitest';
import { generateSeed } from '../../src/data/seed';
import { crewRepo, slugify } from './crewRepo';
import { DEMO_CREW, DEMO_EVENTS, runCrewCommand } from './crewCommands';
import { buildCrewOverview } from './overview';
import { openDb, type Db } from './db';
import { readingsRepo } from './readingsRepo';

const NOW = '2026-11-15T12:00:00.000Z';
let db: Db;
let out: string[];
const run = (...args: string[]) => {
  out = [];
  return runCrewCommand(
    args,
    db,
    (line) => out.push(line),
    () => NOW,
  );
};
const tokensIn = (lines: string[]): string[] =>
  [...lines.join(' ').matchAll(/chc_[A-Za-z0-9_-]+/g)].map((m) => m[0]);

beforeEach(() => {
  db = openDb(':memory:');
});

describe('crew command line', () => {
  it('adds crew members and prints their token once', () => {
    expect(run('add', 'Alex Rivera', 'astronaut')).toBe(0);
    const [token] = tokensIn(out);
    expect(crewRepo(db).findByToken(token)).toEqual({
      id: 'alex-rivera',
      name: 'Alex Rivera',
      role: 'astronaut',
    });
    expect(run('add', 'Alex Rivera', 'astronaut')).toBe(0);
    expect(out[0]).toContain('alex-rivera-2');
    expect(run('add', 'Dr. Jordan Lee', 'flight_surgeon', 'surgeon')).toBe(0);
    expect(run('list')).toBe(0);
    expect(out[0]).toMatch(/^surgeon\s+flight_surgeon\s+-\s+Dr\. Jordan Lee$/);
    expect(out).toHaveLength(3);
    expect(tokensIn(out)).toEqual([]);
  });

  it('refuses bad input', () => {
    expect(run('add', 'Alex', 'pilot')).toBe(1);
    expect(out[0]).toMatch(/Role must be/);
    expect(run('add', 'Alex')).toBe(1);
    run('add', 'Alex', 'astronaut', 'alex');
    expect(run('add', 'Another', 'astronaut', 'alex')).toBe(1);
    expect(out[0]).toMatch(/already taken/);
    expect(run('add', 'Bad Id', 'astronaut', 'Bad Id!')).toBe(1);
    expect(run('token', 'nobody')).toBe(1);
    expect(run('launch')).toBe(1);
    expect(run('help')).toBe(0);
  });

  it('replaces a token', () => {
    run('add', 'Alex', 'astronaut', 'alex');
    const [old] = tokensIn(out);
    expect(run('token', 'alex')).toBe(0);
    const [fresh] = tokensIn(out);
    const crew = crewRepo(db);
    expect(crew.findByToken(old)).toBeUndefined();
    expect(crew.findByToken(fresh)?.id).toBe('alex');
  });

  it('creates a demo crew with readings, and refreshes tokens on a second run', () => {
    expect(run('demo')).toBe(0);
    const first = tokensIn(out);
    expect(first).toHaveLength(DEMO_CREW.length);
    const readings = readingsRepo(db);
    // 30 days x 8 indicators, minus any of today's readings still in the future at NOW.
    const expected = (seed?: number) =>
      seed === undefined ? 0 : generateSeed(30, new Date(NOW), seed).length;
    const events = (id: string) => DEMO_EVENTS.filter((e) => e.crewId === id).length;
    for (const m of DEMO_CREW) {
      expect(readings.list({ crewId: m.id }).length, m.id).toBe(expected(m.seed) + events(m.id));
    }
    expect(expected(1)).toBeGreaterThan(220);
    const alphaFirst = readings.list({ crewId: 'alpha' }).map((r) => r.value);
    const bravoFirst = readings.list({ crewId: 'bravo' }).map((r) => r.value);
    expect(alphaFirst).not.toEqual(bravoFirst);

    expect(run('demo')).toBe(0);
    const second = tokensIn(out);
    expect(second.some((t) => first.includes(t))).toBe(false);
    expect(readings.list({ crewId: 'alpha' })).toHaveLength(expected(1));
  });
});

describe('missions', () => {
  it('sets and clears a crew member mission', () => {
    run('add', 'Alex', 'astronaut', 'alex');
    expect(run('mission', 'alex', 'mars')).toBe(0);
    expect(crewRepo(db).get('alex')?.mission).toBe('mars');
    expect(run('list')).toBe(0);
    expect(out[0]).toMatch(/^alex\s+astronaut\s+mars\s+Alex$/);
    expect(run('mission', 'alex', 'none')).toBe(0);
    expect(crewRepo(db).get('alex')).not.toHaveProperty('mission');
    expect(run('mission', 'alex', 'venus')).toBe(1);
    expect(run('mission', 'nobody', 'iss')).toBe(1);
  });

  it('puts the demo astronauts on different missions', () => {
    run('demo');
    const crew = crewRepo(db);
    expect(['alpha', 'bravo', 'charlie'].map((id) => crew.get(id)?.mission)).toEqual([
      'iss',
      'lunar',
      'mars',
    ]);
    expect(crew.get('surgeon')).not.toHaveProperty('mission');
  });
});

describe('demo crew for the flight-surgeon overview', () => {
  it('gives the astronauts different current statuses', () => {
    run('demo');
    const readings = readingsRepo(db);
    const crew = crewRepo(db);
    const overview = (id: string) =>
      buildCrewOverview(crew.get(id)!, readings.list({ crewId: id }), new Date(NOW), 7);
    const charlie = overview('charlie');
    expect(charlie.status).toBe('red');
    expect(charlie.latest.sleep_hours).toMatchObject({ value: 5.25, level: 'red', current: true });
    expect(charlie.latest.mood).toMatchObject({ value: 2, level: 'amber' });
    expect(overview('bravo').latest.bp_systolic).toMatchObject({ value: 128, level: 'amber' });
    expect(DEMO_EVENTS.some((e) => e.crewId === 'alpha')).toBe(false);
  });

  it('stamps the demo readings with the time of the latest run', () => {
    run('demo');
    const later = '2026-11-16T09:00:00.000Z';
    runCrewCommand(
      ['demo'],
      db,
      () => {},
      () => later,
    );
    const r = readingsRepo(db).get('charlie', 'demo-sleep_hours')!;
    expect(r.timestamp).toBe(later);
  });
});

describe('slugify', () => {
  it('makes ids from names', () => {
    expect(slugify('Dr. Jordan Lee')).toBe('dr-jordan-lee');
    expect(slugify('  Ünal  Öz ')).toBe('unal-oz');
    expect(slugify('!!!')).toBe('crew');
  });
});
