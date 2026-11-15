import type { Reading } from '../lib/types';
import { generateSeed, mulberry32, type SeedScript } from './seed';

// Owner A: demo scenarios for when the backend is not reachable. Each one tells a different
// health story with clear spikes (highs and lows) in the last ten days, so the charts, the body
// figure and the alerts all have something to show. Picked at random on start; the same
// (id, seed) always gives the same data. These are invented demo values, not measurements.

export type ScenarioId =
  'fever' | 'hypoxia' | 'hypertension' | 'glucose_swings' | 'sleep_debt' | 'bradycardia';

export interface Scenario {
  id: ScenarioId;
  name: string;
  summary: string;
}

type Day = Record<string, number>;
type Rand = () => number;

const between = (rand: Rand, lo: number, hi: number) => lo + rand() * (hi - lo);

interface ScenarioDef extends Scenario {
  /** Values for days before today (0 = today) that make up the story. */
  story(rand: Rand): Record<number, Day>;
}

const DEFS: ScenarioDef[] = [
  {
    id: 'fever',
    name: 'Fever spike',
    summary: 'A two-day fever with a racing pulse, settling but not gone today.',
    story: (r): Record<number, Day> => {
      const d = 2 + Math.floor(r() * 4);
      return {
        [d + 1]: { body_temp: between(r, 38.0, 38.4), heart_rate: between(r, 98, 106) },
        [d]: { body_temp: between(r, 38.9, 39.4), heart_rate: between(r, 118, 130) },
        [d - 1]: { body_temp: between(r, 38.5, 38.9), heart_rate: between(r, 106, 114) },
        0: { body_temp: 37.9, heart_rate: 96 },
      };
    },
  },
  {
    id: 'hypoxia',
    name: 'Oxygen dips',
    summary: 'Blood oxygen drops twice (cabin air issue?), with the heart working harder.',
    story: (r): Record<number, Day> => {
      const a = 5 + Math.floor(r() * 3);
      const b = 1 + Math.floor(r() * 2);
      return {
        [a]: { spo2: Math.round(between(r, 88, 90)), heart_rate: between(r, 104, 112) },
        [b]: { spo2: Math.round(between(r, 89, 91)), heart_rate: between(r, 100, 108) },
        0: { spo2: 93 },
      };
    },
  },
  {
    id: 'hypertension',
    name: 'Blood pressure spikes',
    summary: 'Morning blood pressure jumps on three days, highest yesterday.',
    story: (r): Record<number, Day> => ({
      [6 + Math.floor(r() * 2)]: { bp_systolic: between(r, 146, 152), bp_diastolic: 94 },
      3: { bp_systolic: between(r, 152, 158), bp_diastolic: between(r, 96, 100) },
      1: { bp_systolic: between(r, 162, 170), bp_diastolic: between(r, 102, 108) },
      0: { bp_systolic: 144, bp_diastolic: 92 },
    }),
  },
  {
    id: 'glucose_swings',
    name: 'Glucose highs and lows',
    summary: 'Blood sugar swings from low to high and back after meal-timing changes.',
    story: (r): Record<number, Day> => ({
      8: { blood_glucose: between(r, 168, 182) },
      6: { blood_glucose: between(r, 58, 64) },
      4: { blood_glucose: between(r, 176, 194) },
      2: { blood_glucose: between(r, 60, 66) },
      0: { blood_glucose: 138 },
    }),
  },
  {
    id: 'sleep_debt',
    name: 'Sleep debt',
    summary: 'Short nights pile up: sleep crashes, mood drops, resting pulse creeps up.',
    story: (r): Record<number, Day> => ({
      5: { sleep_hours: between(r, 5, 5.5), mood: 3 },
      4: { sleep_hours: between(r, 4, 4.5), mood: 2 },
      3: { sleep_hours: between(r, 3.5, 4), mood: 2, heart_rate: between(r, 96, 104) },
      2: { sleep_hours: 8.5, mood: 4 },
      1: { sleep_hours: between(r, 4.25, 4.75), mood: 2 },
      0: { sleep_hours: 4.5, mood: 1, heart_rate: 102 },
    }),
  },
  {
    id: 'bradycardia',
    name: 'Slow heart, low pressure',
    summary: 'Pulse and blood pressure dip low (fluid shift in weightlessness).',
    story: (r): Record<number, Day> => ({
      7: { heart_rate: between(r, 50, 54), bp_systolic: 96, bp_diastolic: 60 },
      4: { heart_rate: between(r, 44, 48), bp_systolic: between(r, 88, 92), bp_diastolic: 56 },
      2: { heart_rate: between(r, 46, 50), bp_systolic: 92, bp_diastolic: 58 },
      0: { heart_rate: 52, bp_systolic: 94, bp_diastolic: 60 },
    }),
  },
];

/** Extra one-off spikes (high or low) sprinkled over other days, so no two runs look alike. */
const RANDOM_SPIKES: [string, number, number][] = [
  ['heart_rate', 108, 46],
  ['body_temp', 38.3, 35.6],
  ['spo2', 99, 92],
  ['blood_glucose', 160, 64],
  ['sleep_hours', 9.5, 5],
  ['bp_systolic', 142, 94],
];

export const SCENARIOS: Scenario[] = DEFS.map(({ id, name, summary }) => ({ id, name, summary }));

export function getScenario(id: ScenarioId): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

/** A random scenario (optionally different from `not`, for a "shuffle" button). */
export function pickScenario(random: Rand = Math.random, not?: ScenarioId): ScenarioId {
  const pool = SCENARIOS.filter((s) => s.id !== not);
  return pool[Math.floor(random() * pool.length) % pool.length].id;
}

/** The scenario's script: its story in the last ten days plus a few random spikes earlier. */
export function scenarioScript(id: ScenarioId, seed: number): SeedScript {
  const def = DEFS.find((d) => d.id === id) ?? DEFS[0];
  const rand = mulberry32(seed);
  const recent: Record<number, Day> = {};
  for (const [ago, day] of Object.entries(def.story(rand))) recent[Number(ago)] = { ...day };
  for (let i = 0; i < 3; i++) {
    const ago = 11 + Math.floor(rand() * 16);
    const [indicatorId, high, low] = RANDOM_SPIKES[Math.floor(rand() * RANDOM_SPIKES.length)];
    recent[ago] = { ...recent[ago], [indicatorId]: rand() < 0.5 ? high : low };
  }
  return { events: {}, recent };
}

/** A 30-day demo dataset for the scenario, ending today. */
export function generateScenario(id: ScenarioId, now = new Date(), seed = 7, days = 30): Reading[] {
  return generateSeed(days, now, seed, scenarioScript(id, seed));
}
