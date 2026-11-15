import { describe, expect, it } from 'vitest';
import { getReadiness, getSystemStatus, getTrend } from './insights';
import type { Reading } from './types';

const now = new Date('2026-11-14T12:00:00');
let n = 0;
const at = (indicatorId: string, value: number, day: number, hour = 8): Reading => ({
  id: `r${n++}`,
  indicatorId,
  value,
  timestamp: new Date(2026, 10, day, hour).toISOString(),
});

describe('getSystemStatus', () => {
  it('returns the worst current status across the system', () => {
    // heart: heart_rate green 60–101, amber 101–131, red ≥131; bp_systolic green 101–120
    const readings = [
      at('heart_rate', 70, 14),
      at('bp_systolic', 110, 14),
      at('bp_diastolic', 70, 14),
    ];
    expect(getSystemStatus('heart', readings, now)).toBe('green');
    expect(getSystemStatus('heart', [...readings, at('heart_rate', 110, 14, 9)], now)).toBe(
      'amber',
    );
    expect(getSystemStatus('heart', [...readings, at('heart_rate', 140, 14, 9)], now)).toBe('red');
  });

  it('puts SpO2 under the respiratory system', () => {
    expect(getSystemStatus('respiratory', [at('spo2', 93, 14)], now)).toBe('amber');
    expect(getSystemStatus('heart', [at('spo2', 85, 14)], now)).toBe('unknown');
  });

  it('ignores stale readings and systems without indicators', () => {
    expect(getSystemStatus('heart', [at('heart_rate', 140, 10)], now)).toBe('unknown');
    expect(getSystemStatus('bone', [at('heart_rate', 70, 14)], now)).toBe('unknown');
    expect(getSystemStatus('heart', [], now)).toBe('unknown');
  });
});

describe('getTrend', () => {
  const readings = [
    at('heart_rate', 72, 10),
    at('heart_rate', 140, 12),
    at('heart_rate', 70, 14),
    at('mood', 4, 14),
  ];

  it('returns chart points for the last N days, oldest first, with levels', () => {
    const points = getTrend('heart_rate', 3, readings, now);
    expect(points.map((p) => p.value)).toEqual([140, 70]);
    expect(points.map((p) => p.level)).toEqual(['red', 'green']);
    expect(points[0].label).toBeTypeOf('string');
  });

  it('returns [] for unknown ids or non-positive days', () => {
    expect(getTrend('nope', 30, readings, now)).toEqual([]);
    expect(getTrend('heart_rate', 0, readings, now)).toEqual([]);
  });
});

describe('getReadiness', () => {
  it('averages current statuses and reports the streak', () => {
    const readings = [at('heart_rate', 70, 13), at('heart_rate', 140, 14), at('mood', 4, 14)];
    // heart_rate latest red (0), mood green (100) → 50; logged on 13th and 14th → streak 2
    expect(getReadiness(readings, now)).toEqual({ score: 50, streak: 2 });
  });

  it('scores 0 with no current readings', () => {
    expect(getReadiness([at('heart_rate', 70, 1)], now)).toEqual({ score: 0, streak: 0 });
    expect(getReadiness([], now)).toEqual({ score: 0, streak: 0 });
  });
});
