import { beforeEach, describe, expect, it } from 'vitest';
import { checkBackend, decideMode, startDemo, startLive } from './dataSource';
import {
  addReading,
  applyDemoReadings,
  loadOutbox,
  loadReadings,
  loadSyncState,
  saveSyncState,
} from './storage';
import type { FetchLike } from './sync';

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

const answer =
  (ok: boolean): FetchLike =>
  async () =>
    new Response(null, { status: ok ? 200 : 503 });

describe('checkBackend', () => {
  it('is true only when /health answers OK', async () => {
    expect(await checkBackend('http://api', answer(true))).toBe(true);
    expect(await checkBackend('http://api', answer(false))).toBe(false);
  });

  it('is false without a URL or when the request fails', async () => {
    expect(await checkBackend('', answer(true))).toBe(false);
    const down: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    expect(await checkBackend('http://api', down)).toBe(false);
  });
});

describe('decideMode', () => {
  it('uses real data only when the backend is up and someone is signed in', () => {
    expect(decideMode(true, true)).toBe('live');
    expect(decideMode(true, false)).toBe('sign-in');
    expect(decideMode(false, true)).toBe('offline');
    expect(decideMode(false, false)).toBe('demo');
  });
});

describe('startDemo / startLive', () => {
  it('startDemo replaces readings with a scenario and drops pending changes', () => {
    addReading({ indicatorId: 'heart_rate', value: 70 });
    const id = startDemo('hypoxia', 1, new Date('2026-11-15T12:00:00'));
    expect(id).toBe('hypoxia');
    const rs = loadReadings();
    expect(rs.length).toBeGreaterThan(100);
    expect(rs.every((r) => r.id.startsWith('seed-'))).toBe(true);
    expect(loadOutbox()).toEqual({});
  });

  it('startLive keeps real readings and pending changes, drops demo ones, re-pulls', () => {
    applyDemoReadings([
      { id: 'seed-heart_rate-1', indicatorId: 'heart_rate', value: 60, timestamp: 'x' },
      // Pulled from the server (the demo crew also uses seed- ids): has updatedAt, so it stays.
      {
        id: 'seed-mood-1',
        indicatorId: 'mood',
        value: 4,
        timestamp: 'x',
        updatedAt: '2026-11-15T07:00:00Z',
      },
    ]);
    addReading({ indicatorId: 'spo2', value: 97 });
    saveSyncState({ cursor: 42 });
    startLive();
    const rs = loadReadings();
    expect(rs.map((r) => r.indicatorId)).toEqual(['mood', 'spo2']);
    expect(Object.keys(loadOutbox())).toHaveLength(1);
    expect(loadSyncState().cursor).toBe(0);
  });
});
