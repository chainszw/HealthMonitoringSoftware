import { describe, expect, it } from 'vitest';
import {
  bloodPressureStatus,
  getAttention,
  getDueChecks,
  getMissionDay,
  getReadinessBreakdown,
} from './today';
import type { Reading } from './types';

const NOW = new Date(2026, 10, 15, 12, 0); // local noon
let n = 0;
const r = (indicatorId: string, value: number, hoursAgo = 1): Reading => ({
  id: `r${n++}`,
  indicatorId,
  value,
  timestamp: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
});

describe('bloodPressureStatus', () => {
  it('uses the worse of systolic and diastolic', () => {
    const bp = bloodPressureStatus([r('bp_systolic', 110), r('bp_diastolic', 85)]);
    expect(bp.level).toBe('amber');
    expect(bp.display).toBe('110/85');
    expect(bp.systolic?.status.level).toBe('green');
    expect(bp.diastolic?.status.level).toBe('amber');
    expect(bp.action.length).toBeGreaterThan(0);
  });

  it('works with one side, and is unknown with none', () => {
    expect(bloodPressureStatus([r('bp_systolic', 190)])).toMatchObject({
      level: 'red',
      display: '190',
    });
    expect(bloodPressureStatus([]).level).toBe('unknown');
  });
});

describe('getAttention', () => {
  it('lists current amber and red readings, red first, with content.json guidance', () => {
    const items = getAttention(
      [
        r('heart_rate', 70),
        r('sleep_hours', 6.5, 2),
        r('spo2', 90, 3),
        r('bp_systolic', 125),
        r('bp_diastolic', 70),
        r('mood', 1, 72), // red, but older than 48h
      ],
      NOW,
    );
    expect(items.map((i) => [i.key, i.level])).toEqual([
      ['spo2', 'red'],
      ['bp', 'amber'],
      ['sleep_hours', 'amber'],
    ]);
    expect(items[1]).toMatchObject({ name: 'Blood pressure', value: '125/70', unit: 'mmHg' });
    expect(items[0].actionSteps.length).toBeGreaterThan(0);
    expect(items[0].label).toBe('Low oxygen; urgent assessment');
  });

  it('is empty when everything current is green', () => {
    expect(getAttention([r('heart_rate', 70)], NOW)).toEqual([]);
  });
});

describe('getDueChecks', () => {
  it('lists daily checks not yet measured today, without glucose', () => {
    const due = getDueChecks([r('heart_rate', 70), r('mood', 4, 30)], NOW);
    const ids = due.map((d) => d.indicatorId);
    expect(ids).not.toContain('heart_rate');
    expect(ids).toContain('mood');
    expect(ids).not.toContain('blood_glucose');
    expect(due.find((d) => d.indicatorId === 'mood')?.lastAt).toBeDefined();
    expect(due[0].when.length).toBeGreaterThan(0);
  });
});

describe('getReadinessBreakdown', () => {
  it('adds vitals, sleep and routine parts to the readiness score', () => {
    const b = getReadinessBreakdown(
      [r('heart_rate', 70), r('spo2', 93), r('sleep_hours', 6.5)],
      NOW,
      { done: 3, total: 7 },
    );
    expect(b.vitals).toEqual({ ok: 1, off: 2 });
    expect(b.sleep).toEqual({ hours: 6.5, target: 7, level: 'amber' });
    expect(b.routine).toEqual({ done: 3, total: 7 });
    expect(b.level).toBe('amber');
    expect(b.score).toBe(67);
  });

  it('has no sleep figure when there is no current sleep reading', () => {
    expect(getReadinessBreakdown([], NOW).sleep).toEqual({ target: 7, level: 'unknown' });
  });
});

describe('getMissionDay', () => {
  it('counts from the mission start, or from the first reading', () => {
    expect(getMissionDay([], NOW, new Date(2026, 10, 15, 8).toISOString())).toBe(1);
    expect(getMissionDay([], NOW, new Date(2026, 6, 6, 8).toISOString())).toBe(133);
    expect(getMissionDay([r('mood', 4, 24 * 9)], NOW)).toBe(10);
    expect(getMissionDay([], NOW)).toBe(0);
  });
});
