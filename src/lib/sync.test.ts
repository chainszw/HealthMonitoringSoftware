import { describe, expect, it } from 'vitest';
import type { Outbox } from './storage';
import { mergeIncoming, removeAcked } from './sync';
import type { SyncChange } from './syncProtocol';
import type { Reading } from './types';

const T1 = '2026-11-15T07:00:00.000Z';
const T2 = '2026-11-15T08:00:00.000Z';

const reading = (id: string, value: number, updatedAt?: string): Reading => ({
  id,
  indicatorId: 'heart_rate',
  value,
  timestamp: T1,
  ...(updatedAt ? { updatedAt } : {}),
});
const change = (id: string, value: number, updatedAt: string, deletedAt?: string): SyncChange => ({
  ...reading(id, value, updatedAt),
  updatedAt,
  ...(deletedAt ? { deletedAt } : {}),
});

describe('mergeIncoming', () => {
  it('adds readings from the server', () => {
    expect(mergeIncoming([reading('a', 70, T1)], {}, [change('b', 80, T1)])).toEqual([
      reading('a', 70, T1),
      reading('b', 80, T1),
    ]);
  });

  it('replaces an older local version and keeps a newer one', () => {
    expect(mergeIncoming([reading('a', 70, T1)], {}, [change('a', 90, T2)])).toEqual([
      reading('a', 90, T2),
    ]);
    expect(mergeIncoming([reading('a', 70, T2)], {}, [change('a', 90, T1)])).toBeNull();
  });

  it('lets the server win a tie, so devices converge', () => {
    expect(mergeIncoming([reading('a', 70, T1)], {}, [change('a', 90, T1)])).toEqual([
      reading('a', 90, T1),
    ]);
  });

  it('replaces seed readings, which have no updatedAt', () => {
    expect(mergeIncoming([reading('seed-1', 70)], {}, [change('seed-1', 75, T1)])).toEqual([
      reading('seed-1', 75, T1),
    ]);
  });

  it('applies tombstones', () => {
    expect(mergeIncoming([reading('a', 70, T1)], {}, [change('a', 70, T2, T2)])).toEqual([]);
    expect(mergeIncoming([], {}, [change('gone', 70, T2, T2)])).toBeNull();
  });

  it('does not bring back a reading deleted locally while the tombstone is still pending', () => {
    const outbox: Outbox = { a: change('a', 70, T2, T2) };
    expect(mergeIncoming([], outbox, [change('a', 70, T1)])).toBeNull();
  });

  it('returns null when nothing changes', () => {
    expect(mergeIncoming([reading('a', 70, T1)], {}, [change('a', 70, T1)])).toBeNull();
    expect(mergeIncoming([reading('a', 70, T1)], {}, [])).toBeNull();
  });
});

describe('removeAcked', () => {
  it('drops sent changes but keeps ones edited since', () => {
    const sent = [change('a', 70, T1), change('b', 80, T1)];
    const outbox: Outbox = { a: change('a', 70, T1), b: change('b', 85, T2) };
    expect(removeAcked(outbox, sent)).toEqual({ b: change('b', 85, T2) });
  });

  it('returns null when nothing was acknowledged', () => {
    expect(removeAcked({ a: change('a', 70, T2) }, [change('a', 70, T1)])).toBeNull();
  });
});
