import { latestByIndicator } from './readings';
import type { Reading } from './types';

// Owner A: what a ZOĒ finger scan "measures". ZOĒ is a concept device, so a scan is simulated:
// each value sits close to the crew member's latest reading (or a typical value without one),
// with a little noise. The readings are saved like any other, so they reach the console and,
// when signed in, the server.

export const ZOE_NOTE = 'ZOĒ finger scan (simulated)';

const SCAN: {
  indicatorId: string;
  fallback: number;
  noise: number;
  step: number;
  min: number;
  max: number;
}[] = [
  { indicatorId: 'heart_rate', fallback: 70, noise: 3, step: 1, min: 35, max: 190 },
  { indicatorId: 'spo2', fallback: 97, noise: 1, step: 1, min: 80, max: 100 },
  { indicatorId: 'body_temp', fallback: 36.7, noise: 0.15, step: 0.1, min: 34, max: 41.5 },
  { indicatorId: 'blood_glucose', fallback: 90, noise: 5, step: 1, min: 40, max: 300 },
];

export interface ScanValue {
  indicatorId: string;
  value: number;
}

export function zoeScanValues(
  readings: Reading[],
  random: () => number = Math.random,
): ScanValue[] {
  const latest = latestByIndicator(readings);
  return SCAN.map((s) => {
    const base = latest[s.indicatorId]?.value ?? s.fallback;
    const raw = base + (random() * 2 - 1) * s.noise;
    const value = Number((Math.round(raw / s.step) * s.step).toFixed(1));
    return { indicatorId: s.indicatorId, value: Math.min(s.max, Math.max(s.min, value)) };
  });
}
