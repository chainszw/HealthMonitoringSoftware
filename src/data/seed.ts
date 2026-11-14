import type { Reading } from '../lib/types';

/** Deterministic PRNG so demo data is identical on every machine. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SeedSpec {
  indicatorId: string;
  /** Hour of day (local) the reading is taken. */
  hour: number;
  baseline: number;
  /** Max +/- random noise. */
  noise: number;
  /** Total change from day 1 to the last day (slow mission drift). */
  drift: number;
  /** Rounding step (1 = integer, 0.1 = one decimal, ...). */
  step: number;
  min: number;
  max: number;
}

const SPECS: SeedSpec[] = [
  {
    indicatorId: 'heart_rate',
    hour: 7,
    baseline: 63,
    noise: 4,
    drift: 5,
    step: 1,
    min: 30,
    max: 200,
  },
  {
    indicatorId: 'bp_systolic',
    hour: 7,
    baseline: 114,
    noise: 5,
    drift: 3,
    step: 1,
    min: 60,
    max: 220,
  },
  {
    indicatorId: 'bp_diastolic',
    hour: 7,
    baseline: 73,
    noise: 4,
    drift: 2,
    step: 1,
    min: 40,
    max: 140,
  },
  { indicatorId: 'glucose', hour: 7, baseline: 86, noise: 6, drift: 0, step: 1, min: 40, max: 300 },
  {
    indicatorId: 'temperature',
    hour: 7,
    baseline: 36.7,
    noise: 0.25,
    drift: 0,
    step: 0.1,
    min: 34,
    max: 42,
  },
  {
    indicatorId: 'sleep_hours',
    hour: 6,
    baseline: 7.9,
    noise: 0.4,
    drift: -0.5,
    step: 0.25,
    min: 0,
    max: 14,
  },
  {
    indicatorId: 'mood',
    hour: 20,
    baseline: 4.3,
    noise: 0.6,
    drift: -0.3,
    step: 1,
    min: 1,
    max: 5,
  },
  { indicatorId: 'spo2', hour: 7, baseline: 97.5, noise: 1, drift: 0, step: 1, min: 80, max: 100 },
];

/** Scripted off-nominal events (mission day is 1-based) for a compelling demo. */
const EVENTS: Record<number, Record<string, number>> = {
  12: { sleep_hours: 6.0, mood: 3 }, // amber: poor night, low mood
  13: { sleep_hours: 5.25, mood: 2 }, // red sleep, amber mood
  21: { heart_rate: 116, temperature: 38.4 }, // red: fever / tachycardia
  22: { heart_rate: 96, temperature: 37.8 }, // amber: recovering
  25: { spo2: 93 }, // amber: SpO2 dip
};

const round = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(2));

/**
 * Generate a realistic mission dataset: one reading per indicator per day,
 * ending today. Deterministic for a given (days, now, seed).
 */
export function generateSeed(days = 30, now = new Date(), seed = 42): Reading[] {
  const rand = mulberry32(seed);
  const readings: Reading[] = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  for (let d = 0; d < days; d++) {
    const missionDay = d + 1;
    const progress = days > 1 ? d / (days - 1) : 0;
    for (const s of SPECS) {
      const ts = new Date(start);
      ts.setDate(start.getDate() + d);
      ts.setHours(s.hour, Math.floor(rand() * 30), 0, 0);
      if (ts > now) continue; // don't create readings in the future

      const noisy = s.baseline + s.drift * progress + (rand() * 2 - 1) * s.noise;
      const value = EVENTS[missionDay]?.[s.indicatorId] ?? noisy;
      readings.push({
        id: `seed-${s.indicatorId}-${missionDay}`,
        indicatorId: s.indicatorId,
        value: Math.min(s.max, Math.max(s.min, round(value, s.step))),
        timestamp: ts.toISOString(),
      });
    }
  }
  return readings;
}
