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
});
