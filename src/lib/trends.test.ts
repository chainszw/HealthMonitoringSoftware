import { describe, expect, it } from 'vitest';
import { getIndicator } from '../data/content';
import { formatDelay, formatRange, formatValue, formatWhen, greenBand } from './format';
import { bpDailySeries, chartDomain, dailySeries, lastDays, summarizeSeries } from './trends';
import type { Reading } from './types';

const NOW = new Date('2026-11-15T12:00:00');
const at = (daysAgo: number, hour = 7) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
let n = 0;
const r = (indicatorId: string, value: number, daysAgo: number, hour = 7): Reading => ({
  id: `r${n++}`,
  indicatorId,
  value,
  timestamp: at(daysAgo, hour),
});

describe('dailySeries', () => {
  it('has one slot per day, oldest first, with the latest reading of each day', () => {
    const s = dailySeries(
      'heart_rate',
      3,
      [r('heart_rate', 70, 2), r('heart_rate', 72, 0, 7), r('heart_rate', 120, 0, 9)],
      NOW,
    );
    expect(s.map((p) => p?.value ?? null)).toEqual([70, null, 120]);
    expect(s[2]!.level).toBe('amber');
  });

  it('keeps a reading saved later today and handles unknown indicators', () => {
    expect(dailySeries('heart_rate', 1, [r('heart_rate', 70, 0, 18)], NOW)[0]!.value).toBe(70);
    expect(dailySeries('nope', 2, [], NOW)).toEqual([null, null]);
  });
});

describe('bpDailySeries', () => {
  it('pairs systolic and diastolic by day with the worse level', () => {
    const s = bpDailySeries(
      2,
      [r('bp_systolic', 110, 1), r('bp_systolic', 112, 0), r('bp_diastolic', 86, 0)],
      NOW,
    );
    expect(s[0]).toMatchObject({ value: 110, level: 'green' });
    expect(s[0]!.value2).toBeUndefined();
    expect(s[1]).toMatchObject({ value: 112, value2: 86, level: 'amber' });
  });
});

describe('summarizeSeries', () => {
  it('counts in-range and off-range days and finds the direction', () => {
    const vals = [70, 70, 70, 70, 70, 80, 80, 80, 80, 105];
    const s = summarizeSeries(
      dailySeries(
        'heart_rate',
        10,
        vals.map((v, i) => r('heart_rate', v, 9 - i)),
        NOW,
      ),
      2,
    );
    expect(s).toMatchObject({ total: 10, inRange: 9, worst: 'amber', direction: 'rising' });
    expect(s.off.map((p) => p.value)).toEqual([105]);
    expect(s.latest!.value).toBe(105);
  });

  it('needs six readings for a direction', () => {
    expect(summarizeSeries([null, null], 1)).toMatchObject({
      total: 0,
      worst: 'unknown',
      direction: 'insufficient',
    });
  });
});

describe('chartDomain and lastDays', () => {
  it('fits values and band with padding', () => {
    const [lo, hi] = chartDomain([50, 150], [60, 100]);
    expect(lo).toBeLessThan(50);
    expect(hi).toBeGreaterThan(150);
    expect(chartDomain([])).toEqual([0, 1]);
  });

  it('lists days ending today', () => {
    const days = lastDays(3, NOW);
    expect(days).toHaveLength(3);
    expect(days[2].getDate()).toBe(NOW.getDate());
  });
});

describe('format', () => {
  it('formats values at input precision', () => {
    expect(formatValue(getIndicator('heart_rate'), 64)).toBe('64');
    expect(formatValue(getIndicator('body_temp'), 37)).toBe('37.0');
    expect(formatValue(getIndicator('sleep_hours'), 7)).toBe('7');
    expect(formatValue(getIndicator('sleep_hours'), 6.25)).toBe('6.25');
  });

  it('shows green ranges for people', () => {
    expect(greenBand(getIndicator('heart_rate')!)).toEqual([60, 101]);
    expect(formatRange(getIndicator('heart_rate')!)).toBe('60–100');
    expect(formatRange(getIndicator('spo2')!)).toBe('96–100');
    expect(formatRange(getIndicator('sleep_hours')!)).toBe('7–9');
  });

  it('formats delays and times', () => {
    expect(formatDelay(0)).toBe('<1 s');
    expect(formatDelay(1.3)).toBe('1.3 s');
    expect(formatDelay(1320)).toBe('22 min');
    expect(formatWhen(at(0, 7), NOW)).toBe('07:00');
    expect(formatWhen(at(1, 7), NOW)).toBe('yesterday 07:00');
  });
});
