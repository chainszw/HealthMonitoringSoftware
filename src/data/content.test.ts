import { describe, expect, it } from 'vitest';
import { getStatus } from '../lib/status';
import { content, getBodySystem, getIndicator, normalizeContent, type RawContent } from './content';
import raw from './content.json';

describe('content adapter', () => {
  it('loads every indicator with bands, actions, sources and input limits', () => {
    expect(content.indicators.map((i) => i.id)).toEqual([
      'heart_rate',
      'bp_systolic',
      'bp_diastolic',
      'blood_glucose',
      'body_temp',
      'spo2',
      'sleep_hours',
      'mood',
    ]);
    for (const i of content.indicators) {
      expect(i.ranges.green.length).toBeGreaterThan(0);
      for (const level of ['green', 'amber', 'red'] as const) {
        expect(i.actions[level].length).toBeGreaterThan(0);
        expect(i.actionSteps[level].length).toBeGreaterThan(0);
      }
      expect(i.howToMeasureInSpace.length).toBeGreaterThan(0);
      expect(i.input.max).toBeGreaterThan(i.input.min);
      for (const s of i.sources) expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it('turns null band ends into open ranges', () => {
    const hr = getIndicator('heart_rate')!;
    expect(hr.ranges.red).toEqual([
      { max: 41, label: 'Very low resting pulse' },
      { min: 131, label: 'Very high resting pulse' },
    ]);
  });

  it('classifies band edges with inclusive min and exclusive max', () => {
    const hr = getIndicator('heart_rate')!;
    expect(getStatus(hr, 40).level).toBe('red');
    expect(getStatus(hr, 41).level).toBe('amber');
    expect(getStatus(hr, 60).level).toBe('green');
    expect(getStatus(hr, 100).level).toBe('green');
    expect(getStatus(hr, 101)).toMatchObject({ level: 'amber', label: 'High resting pulse' });
    expect(getStatus(hr, 131).level).toBe('red');
    const mood = getIndicator('mood')!;
    expect([1, 2, 3, 5].map((v) => getStatus(mood, v).level)).toEqual([
      'red',
      'amber',
      'green',
      'green',
    ]);
  });

  it('has no gaps: every value in the input range gets a real band', () => {
    for (const i of content.indicators) {
      for (let v = i.input.min; v <= i.input.max; v += i.input.step) {
        expect(getStatus(i, v).label, `${i.id} ${v}`).toBeDefined();
      }
    }
  });

  it('derives body-system indicator ids and resolves hazard names', () => {
    expect(getBodySystem('heart')!.indicatorIds).toEqual([
      'heart_rate',
      'bp_systolic',
      'bp_diastolic',
    ]);
    expect(getBodySystem('respiratory')!.indicatorIds).toEqual(['spo2']);
    expect(getBodySystem('mind')!.indicatorIds).toEqual(['sleep_hours', 'mood']);
    expect(getBodySystem('heart')!.hazards).toContain('Altered gravity');
    expect(getIndicator('spo2')!.hazards).toContain('Hostile and closed environment');
  });

  it('keeps disclaimer, unknown action and mission profiles', () => {
    expect(content.disclaimer).toMatch(/not diagnosis/);
    expect(content.unknownStatusAction.length).toBeGreaterThan(0);
    expect(content.missionProfiles.map((m) => m.id)).toEqual(['iss', 'lunar', 'mars']);
  });

  it('falls back safely for unknown systems and sources', () => {
    const base = raw as RawContent;
    const out = normalizeContent({
      ...base,
      meta: { ...base.meta, unknownStatusAction: undefined },
      indicators: [{ ...base.indicators[0], bodySystem: 'kidney', sources: ['missing'] }],
    });
    expect(out.indicators[0].bodySystem).toBe('metabolic');
    expect(out.indicators[0].sources).toEqual([{ title: 'missing' }]);
    expect(out.unknownStatusAction.length).toBeGreaterThan(0);
  });
});
