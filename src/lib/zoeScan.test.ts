import { describe, expect, it } from 'vitest';
import { getIndicator } from '../data/content';
import { validateValue } from './validation';
import { zoeScanValues } from './zoeScan';

describe('zoeScanValues', () => {
  it('returns pulse, oxygen, temperature and glucose that pass validation', () => {
    const values = zoeScanValues([]);
    expect(values.map((v) => v.indicatorId)).toEqual([
      'heart_rate',
      'spo2',
      'body_temp',
      'blood_glucose',
    ]);
    for (const v of values) {
      expect(validateValue(getIndicator(v.indicatorId)!, String(v.value)).ok, v.indicatorId).toBe(
        true,
      );
    }
  });

  it('stays close to the latest reading', () => {
    const [hr] = zoeScanValues(
      [{ id: 'a', indicatorId: 'heart_rate', value: 120, timestamp: '2026-11-15T07:00:00Z' }],
      () => 1,
    );
    expect(hr.value).toBe(123);
  });

  it('keeps blood oxygen at or below 100', () => {
    const spo2 = zoeScanValues(
      [{ id: 'a', indicatorId: 'spo2', value: 100, timestamp: '2026-11-15T07:00:00Z' }],
      () => 1,
    )[1];
    expect(spo2.value).toBe(100);
  });
});
