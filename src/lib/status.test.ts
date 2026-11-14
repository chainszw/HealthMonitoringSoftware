import { describe, expect, it } from 'vitest';
import type { Indicator } from './types';
import { getStatus, worstStatus } from './status';

const hr: Indicator = {
  id: 'hr',
  name: 'HR',
  unit: 'bpm',
  howToMeasureInSpace: '',
  bodySystem: 'heart',
  ranges: {
    green: [{ min: 50, max: 90 }],
    amber: [
      { min: 40, max: 50 },
      { min: 90, max: 110 },
    ],
    red: [{ max: 40 }, { min: 110 }],
  },
  actions: { green: 'ok', amber: 'watch', red: 'act' },
  sources: [],
};

// Bands with a gap, to test the "outside every band" fallback.
const gappy: Indicator = {
  ...hr,
  ranges: { green: [{ min: 95, max: 100 }], amber: [{ min: 92, max: 94 }], red: [{ max: 85 }] },
};

describe('getStatus', () => {
  it('returns green with the green action', () => {
    expect(getStatus(hr, 70)).toEqual({ level: 'green', action: 'ok' });
  });

  it('handles low and high amber bands', () => {
    expect(getStatus(hr, 45).level).toBe('amber');
    expect(getStatus(hr, 100).level).toBe('amber');
    expect(getStatus(hr, 100).action).toBe('watch');
  });

  it('handles open-ended red bands', () => {
    expect(getStatus(hr, 30).level).toBe('red');
    expect(getStatus(hr, 180)).toEqual({ level: 'red', action: 'act' });
  });

  it('resolves shared band edges to the less severe level', () => {
    expect(getStatus(hr, 50).level).toBe('green');
    expect(getStatus(hr, 90).level).toBe('green');
    expect(getStatus(hr, 110).level).toBe('amber');
    expect(getStatus(hr, 40).level).toBe('amber');
    expect(getStatus(hr, 49.95).level).toBe('amber');
  });

  it('falls back to red when a value is outside every band', () => {
    expect(getStatus(gappy, 88).level).toBe('red');
    expect(getStatus(gappy, 101).level).toBe('red');
  });

  it('returns unknown for missing or invalid values', () => {
    expect(getStatus(hr, NaN, 'log it')).toEqual({ level: 'unknown', action: 'log it' });
    expect(getStatus(hr, undefined).level).toBe('unknown');
    expect(getStatus(hr, null).level).toBe('unknown');
  });
});

describe('worstStatus', () => {
  it('picks the most severe level', () => {
    expect(worstStatus(['green', 'amber', 'green'])).toBe('amber');
    expect(worstStatus(['green', 'red', 'amber'])).toBe('red');
    expect(worstStatus(['unknown', 'green'])).toBe('green');
    expect(worstStatus([])).toBe('unknown');
  });
});
