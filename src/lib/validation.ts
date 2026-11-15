import type { Indicator } from './types';

export type InputLimits = Indicator['input'];

/**
 * Plausible input limits per indicator, from the rules in content.json meta.disclaimer:
 * whole numbers for heart rate, blood pressure, glucose, SpO2 and mood; decimals for
 * temperature and sleep; SpO2 0-100, sleep 0-24, mood 1-5. The other bounds only reject
 * physically impossible entries; they are not clinical thresholds.
 */
export const INPUT_LIMITS: Record<string, InputLimits> = {
  heart_rate: { min: 20, max: 250, step: 1 },
  bp_systolic: { min: 50, max: 300, step: 1 },
  bp_diastolic: { min: 20, max: 200, step: 1 },
  blood_glucose: { min: 10, max: 600, step: 1 },
  body_temp: { min: 25, max: 45, step: 0.1 },
  spo2: { min: 0, max: 100, step: 1 },
  sleep_hours: { min: 0, max: 24, step: 0.25 },
  mood: { min: 1, max: 5, step: 1 },
};

/** Used for an indicator that has no entry in INPUT_LIMITS. */
export const DEFAULT_LIMITS: InputLimits = { min: 0, max: 100_000, step: 0.01 };

export type ValidationResult = { ok: true; value: number } | { ok: false; error: string };

/**
 * Check a raw form value before it is stored or classified.
 * Rejects empty, non-numeric and out-of-range values, and decimals where a whole number
 * is required (step 1). Never classify a value that fails this check.
 */
export function validateValue(
  indicator: Pick<Indicator, 'input' | 'unit'>,
  raw: string | number | null | undefined,
): ValidationResult {
  const text = typeof raw === 'number' ? String(raw) : (raw ?? '').trim();
  if (text === '') return { ok: false, error: 'Enter a value.' };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, error: 'Enter a number.' };
  const { min, max, step } = indicator.input;
  if (step === 1 && !Number.isInteger(value)) {
    return { ok: false, error: 'Enter a whole number.' };
  }
  if (value < min || value > max) {
    return { ok: false, error: `Enter a value from ${min} to ${max} ${indicator.unit}.` };
  }
  return { ok: true, value };
}
