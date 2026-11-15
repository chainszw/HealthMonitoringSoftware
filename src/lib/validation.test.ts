import { describe, expect, it } from 'vitest';
import { getIndicator } from '../data/content';
import { validateBloodPressure, validateValue } from './validation';

const hr = getIndicator('heart_rate')!;
const spo2 = getIndicator('spo2')!;
const sleep = getIndicator('sleep_hours')!;
const mood = getIndicator('mood')!;

describe('validateValue', () => {
  it('accepts valid values from strings and numbers', () => {
    expect(validateValue(hr, '72')).toEqual({ ok: true, value: 72 });
    expect(validateValue(sleep, 7.5)).toEqual({ ok: true, value: 7.5 });
  });

  it('rejects empty and non-numeric input', () => {
    expect(validateValue(hr, '').ok).toBe(false);
    expect(validateValue(hr, '  ').ok).toBe(false);
    expect(validateValue(hr, undefined).ok).toBe(false);
    expect(validateValue(hr, 'abc').ok).toBe(false);
    expect(validateValue(hr, NaN).ok).toBe(false);
  });

  it('requires whole numbers where content.json says so', () => {
    expect(validateValue(hr, '72.5').ok).toBe(false);
    expect(validateValue(mood, '3.5').ok).toBe(false);
    expect(validateValue(sleep, '6.75').ok).toBe(true);
  });

  it('rejects impossible values', () => {
    expect(validateValue(spo2, '101').ok).toBe(false);
    expect(validateValue(spo2, '-1').ok).toBe(false);
    expect(validateValue(sleep, '25').ok).toBe(false);
    expect(validateValue(mood, '0').ok).toBe(false);
    expect(validateValue(mood, '6').ok).toBe(false);
    expect(validateValue(spo2, '100')).toEqual({ ok: true, value: 100 });
  });

  it('checks blood pressure as a pair', () => {
    const sys = getIndicator('bp_systolic')!;
    const dia = getIndicator('bp_diastolic')!;
    expect(validateBloodPressure(sys, dia, '120', '80')).toEqual({
      ok: true,
      systolic: 120,
      diastolic: 80,
    });
    expect(validateBloodPressure(sys, dia, '80', '120').ok).toBe(false);
    expect(validateBloodPressure(sys, dia, '', '80')).toMatchObject({ ok: false });
  });
});
