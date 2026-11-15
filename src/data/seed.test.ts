import { describe, expect, it } from 'vitest';
import { getStatus } from '../lib/status';
import { content, getIndicator } from './content';
import { generateSeed } from './seed';

const NOW = new Date('2026-11-14T23:00:00');

describe('generateSeed', () => {
  const seed = generateSeed(30, NOW);

  it('creates one reading per indicator per day', () => {
    expect(seed).toHaveLength(30 * content.indicators.length);
  });

  it('only references indicators that exist in content.json', () => {
    for (const r of seed) expect(getIndicator(r.indicatorId)).toBeDefined();
  });

  it('is deterministic', () => {
    expect(generateSeed(30, NOW)).toEqual(seed);
  });

  it('includes amber and red events, and is mostly green', () => {
    const levels = seed.map((r) => getStatus(getIndicator(r.indicatorId)!, r.value).level);
    expect(levels).toContain('amber');
    expect(levels).toContain('red');
    expect(levels.filter((l) => l === 'green').length / levels.length).toBeGreaterThan(0.85);
  });

  it('ends on a day with amber blood pressure after three short nights', () => {
    const last = (id: string, back = 0) =>
      seed
        .filter((r) => r.indicatorId === id)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .at(-1 - back)!;
    const level = (id: string, back = 0) =>
      getStatus(getIndicator(id)!, last(id, back).value).level;
    expect([last('bp_systolic').value, last('bp_diastolic').value]).toEqual([134, 86]);
    expect([level('bp_systolic'), level('bp_diastolic')]).toEqual(['amber', 'amber']);
    expect([0, 1, 2].map((b) => level('sleep_hours', b))).toEqual(['amber', 'amber', 'amber']);
  });
});
