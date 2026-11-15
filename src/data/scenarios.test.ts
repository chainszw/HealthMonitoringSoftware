import { describe, expect, it } from 'vitest';
import { getStatus } from '../lib/status';
import type { Reading } from '../lib/types';
import { getIndicator } from './content';
import { generateScenario, pickScenario, SCENARIOS, type ScenarioId } from './scenarios';

const NOW = new Date('2026-11-15T12:00:00');
const DAY = 86_400_000;

const level = (r: Reading) => getStatus(getIndicator(r.indicatorId)!, r.value).level;
const recent = (rs: Reading[], days: number) =>
  rs.filter((r) => NOW.getTime() - Date.parse(r.timestamp) < days * DAY);

describe('demo scenarios', () => {
  it('are deterministic for the same id and seed', () => {
    expect(generateScenario('fever', NOW, 5)).toEqual(generateScenario('fever', NOW, 5));
  });

  it('every scenario has abnormal spikes in the last ten days and none in the future', () => {
    for (const s of SCENARIOS) {
      const rs = generateScenario(s.id, NOW, 11);
      expect(rs.every((r) => Date.parse(r.timestamp) <= NOW.getTime())).toBe(true);
      expect(rs.every((r) => r.id.startsWith('seed-'))).toBe(true);
      const flagged = recent(rs, 10).filter((r) => level(r) === 'red' || level(r) === 'amber');
      expect(flagged.length, s.id).toBeGreaterThan(0);
    }
  });

  it('glucose swings go both high and low', () => {
    const g = recent(generateScenario('glucose_swings', NOW, 3), 10).filter(
      (r) => r.indicatorId === 'blood_glucose',
    );
    expect(Math.max(...g.map((r) => r.value))).toBeGreaterThan(160);
    expect(Math.min(...g.map((r) => r.value))).toBeLessThan(70);
  });

  it('pickScenario picks from the list and can avoid the current one', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(ids).toContain(pickScenario(() => 0.99));
    const seen = new Set<ScenarioId>();
    for (let i = 0; i < 50; i++) seen.add(pickScenario(Math.random, 'fever'));
    expect(seen.has('fever')).toBe(false);
  });
});
