import { beforeEach, describe, expect, it } from 'vitest';
import { loggingStreak, latestByIndicator } from './readings';
import {
  READINGS_KEY,
  addReading,
  clearReadings,
  deleteReading,
  getReadingsSnapshot,
  loadMission,
  loadOutbox,
  loadReadings,
  loadSyncState,
  refreshReadings,
  resetToSeed,
  saveMission,
  saveSyncState,
  subscribeOutbox,
  subscribeReadings,
  updateReading,
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
  refreshReadings();
});

describe('edits and the sync outbox', () => {
  const T0 = new Date('2026-11-15T08:00:00.000Z');
  const T1 = new Date('2026-11-15T09:00:00.000Z');

  beforeEach(() => {
    clearReadings();
  });

  it('stamps new readings and queues them for sync', () => {
    const [r] = addReading({ indicatorId: 'mood', value: 4 }, T0);
    expect(r.updatedAt).toBe(T0.toISOString());
    expect(loadOutbox()).toEqual({
      [r.id]: {
        id: r.id,
        indicatorId: 'mood',
        value: 4,
        timestamp: T0.toISOString(),
        updatedAt: T0.toISOString(),
      },
    });
  });

  it('updates a reading and queues the new version', () => {
    const [r] = addReading({ indicatorId: 'heart_rate', value: 70, note: 'x' }, T0);
    const [u] = updateReading(r.id, { value: 75, note: undefined }, T1);
    expect(u).toMatchObject({ id: r.id, value: 75, updatedAt: T1.toISOString() });
    expect(u).not.toHaveProperty('note');
    expect(loadOutbox()[r.id]).toMatchObject({ value: 75, updatedAt: T1.toISOString() });
  });

  it('deletes a reading and queues a tombstone', () => {
    const [r] = addReading({ indicatorId: 'heart_rate', value: 70 }, T0);
    expect(deleteReading(r.id, T1)).toEqual([]);
    expect(loadReadings()).toEqual([]);
    expect(loadOutbox()[r.id]).toMatchObject({ value: 70, deletedAt: T1.toISOString() });
  });

  it('versions each change after the previous one, even in the same millisecond', () => {
    const [r] = addReading({ indicatorId: 'heart_rate', value: 70 }, T0);
    const [u] = updateReading(r.id, { value: 75 }, T0);
    expect(u.updatedAt).toBe('2026-11-15T08:00:00.001Z');
    deleteReading(r.id, T0);
    expect(loadOutbox()[r.id]).toMatchObject({
      updatedAt: '2026-11-15T08:00:00.002Z',
      deletedAt: '2026-11-15T08:00:00.002Z',
    });
    // A clock that stepped back still produces a newer version.
    const [s] = addReading({ indicatorId: 'mood', value: 3 }, T1);
    const [v] = updateReading(s.id, { value: 4 }, T0).filter((x) => x.id === s.id);
    expect(v.updatedAt).toBe('2026-11-15T09:00:00.001Z');
  });

  it('ignores unknown ids', () => {
    addReading({ indicatorId: 'mood', value: 4 }, T0);
    const before = loadOutbox();
    expect(updateReading('nope', { value: 1 })).toHaveLength(1);
    expect(deleteReading('nope')).toHaveLength(1);
    expect(loadOutbox()).toEqual(before);
  });

  it('notifies subscribers and keeps the snapshot stable between changes', () => {
    let readingCalls = 0;
    let outboxCalls = 0;
    const offReadings = subscribeReadings(() => readingCalls++);
    const offOutbox = subscribeOutbox(() => outboxCalls++);
    const snap = getReadingsSnapshot();
    expect(getReadingsSnapshot()).toBe(snap);
    addReading({ indicatorId: 'mood', value: 4 }, T0);
    expect(readingCalls).toBe(1);
    expect(outboxCalls).toBe(1);
    expect(getReadingsSnapshot()).not.toBe(snap);
    expect(getReadingsSnapshot()).toHaveLength(1);
    offReadings();
    offOutbox();
    addReading({ indicatorId: 'mood', value: 3 }, T1);
    expect(readingCalls).toBe(1);
  });

  it('reset and clear drop pending changes and restart sync from scratch', () => {
    addReading({ indicatorId: 'mood', value: 4 }, T0);
    saveSyncState({ cursor: 12, lastSyncedAt: T0.toISOString() });
    resetToSeed(T1);
    expect(loadOutbox()).toEqual({});
    expect(loadSyncState()).toEqual({ cursor: 0 });
  });
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
