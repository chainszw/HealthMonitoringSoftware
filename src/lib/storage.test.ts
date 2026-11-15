import { beforeEach, describe, expect, it } from 'vitest';
import { loggingStreak, latestByIndicator } from './readings';
import {
  READINGS_KEY,
  addReading,
  clearReadings,
  loadMission,
  loadReadings,
  resetToSeed,
  saveMission,
} from './storage';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

describe('storage', () => {
  it('seeds on first load', () => {
    expect(loadReadings().length).toBeGreaterThan(0);
  });

  it('re-seeds when stored data is corrupt', () => {
    localStorage.setItem(READINGS_KEY, '{not json');
    expect(loadReadings().length).toBeGreaterThan(0);
  });

  it('adds and persists a reading', () => {
    const before = loadReadings().length;
    const after = addReading({ indicatorId: 'heart_rate', value: 70, note: 'test' });
    expect(after).toHaveLength(before + 1);
    expect(loadReadings()).toHaveLength(before + 1);
    expect(after.at(-1)).toMatchObject({ indicatorId: 'heart_rate', value: 70, note: 'test' });
  });

  it('migrates renamed indicator ids on load', () => {
    const ts = '2026-11-14T07:00:00.000Z';
    const old = [
      { id: 'a', indicatorId: 'glucose', value: 90, timestamp: ts },
      { id: 'b', indicatorId: 'temperature', value: 36.8, timestamp: ts },
      { id: 'c', indicatorId: 'mood', value: 4, timestamp: ts },
    ];
    localStorage.setItem(READINGS_KEY, JSON.stringify(old));
    expect(loadReadings().map((r) => r.indicatorId)).toEqual([
      'blood_glucose',
      'body_temp',
      'mood',
    ]);
  });

  it('clears and resets to seed', () => {
    expect(clearReadings()).toEqual([]);
    expect(loadReadings()).toEqual([]);
    expect(resetToSeed().length).toBeGreaterThan(0);
  });

  it('stores the mission profile with a safe default', () => {
    expect(loadMission()).toBe('iss');
    saveMission('mars');
    expect(loadMission()).toBe('mars');
  });
});

describe('readings helpers', () => {
  const r = (id: string, ts: string) => ({ id, indicatorId: 'hr', value: 1, timestamp: ts });

  it('finds the latest reading per indicator', () => {
    const latest = latestByIndicator([
      r('a', '2026-11-01T07:00:00Z'),
      r('b', '2026-11-03T07:00:00Z'),
    ]);
    expect(latest.hr.id).toBe('b');
  });

  it('counts a consecutive-day streak', () => {
    const now = new Date('2026-11-14T12:00:00');
    const day = (d: number) => new Date(2026, 10, d, 8).toISOString();
    expect(loggingStreak([r('a', day(12)), r('b', day(13)), r('c', day(14))], now)).toBe(3);
    expect(loggingStreak([r('a', day(12)), r('b', day(13))], now)).toBe(2); // not logged today yet
    expect(loggingStreak([r('a', day(11)), r('b', day(13))], now)).toBe(1);
    expect(loggingStreak([], now)).toBe(0);
  });
});
