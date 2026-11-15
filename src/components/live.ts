import { useEffect, useState } from 'react';
import type { EntryKey } from './vitals';

// Owner B: the demo's live feed. In demo mode the Today numbers change every second, like a
// monitor: each vital random-walks close to its latest reading and its chart streams. Display
// only: nothing is saved. With real server data this is off and the screens show real readings.

/** Noise per tick and rounding step for each live value. Sleep is last night's total: fixed. */
const LIVE: Partial<Record<EntryKey, { noise: number; step: number }[]>> = {
  heart_rate: [{ noise: 2.2, step: 1 }],
  bp: [
    { noise: 2.4, step: 1 },
    { noise: 1.8, step: 1 },
  ],
  spo2: [{ noise: 0.7, step: 1 }],
  body_temp: [{ noise: 0.06, step: 0.1 }],
  blood_glucose: [{ noise: 1.8, step: 1 }],
};

export const LIVE_POINTS = 36;
const TICK_MS = 1000;

export interface LiveValue {
  /** Current value(s): one number, or [systolic, diastolic] for blood pressure. */
  now: number[];
  /** Recent values of the first number, oldest first (for the streaming chart). */
  series: number[];
}

const round = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(1));

/** One random-walk step: drift back toward the base value plus noise. */
export function nextLive(prev: number, base: number, noise: number, rand = Math.random): number {
  return prev + (base - prev) * 0.25 + (rand() * 2 - 1) * noise;
}

/**
 * Live values for the given entries while `enabled`. `bases` are the latest readings
 * (bp as [systolic, diastolic]). Returns null when off.
 */
export function useLiveFeed(
  enabled: boolean,
  bases: Partial<Record<EntryKey, number[]>>,
): { values: Partial<Record<EntryKey, LiveValue>>; tickAt: number } | null {
  const key = JSON.stringify(bases);
  const [state, setState] = useState<{
    key: string;
    raw: Partial<Record<EntryKey, { now: number[]; series: number[] }>>;
    tickAt: number;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const parsed = JSON.parse(key) as Partial<Record<EntryKey, number[]>>;
    const init = () => {
      const raw: Partial<Record<EntryKey, { now: number[]; series: number[] }>> = {};
      for (const [k, base] of Object.entries(parsed) as [EntryKey, number[]][]) {
        const spec = LIVE[k];
        if (!spec) continue;
        const series: number[] = [];
        let v = base[0];
        for (let i = 0; i < LIVE_POINTS; i++) {
          v = nextLive(v, base[0], spec[0].noise);
          series.push(v);
        }
        raw[k] = { now: [...base], series };
      }
      return raw;
    };
    let raw = init();
    const tick = () => {
      const next: typeof raw = {};
      for (const [k, cur] of Object.entries(raw) as [
        EntryKey,
        { now: number[]; series: number[] },
      ][]) {
        const spec = LIVE[k]!;
        const base = parsed[k]!;
        // Now and then a short spike up or down, so the stream shows highs and lows.
        const spike = Math.random() < 0.06 ? (Math.random() < 0.5 ? -1 : 1) * 6 : 0;
        const now = cur.now.map(
          (v, i) => nextLive(v, base[i], spec[i].noise) + spike * spec[i].noise,
        );
        next[k] = { now, series: [...cur.series.slice(1), now[0]] };
      }
      raw = next;
      setState({ key, raw, tickAt: performance.now() });
    };
    const id = setInterval(tick, TICK_MS);
    tick();
    return () => clearInterval(id);
  }, [enabled, key]);

  if (!enabled || !state || state.key !== key) return null;
  const values: Partial<Record<EntryKey, LiveValue>> = {};
  for (const [k, cur] of Object.entries(state.raw) as [
    EntryKey,
    { now: number[]; series: number[] },
  ][]) {
    const spec = LIVE[k]!;
    values[k] = {
      now: cur.now.map((v, i) => round(v, spec[i].step)),
      series: cur.series,
    };
  }
  return { values, tickAt: state.tickAt };
}
