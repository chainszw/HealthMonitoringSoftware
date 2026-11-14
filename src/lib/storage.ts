import { generateSeed } from '../data/seed';
import type { MissionProfileId, Reading } from './types';

// The ONLY module that touches localStorage. Bump the version prefix if the
// Reading shape changes incompatibly (old data is then ignored and re-seeded).
export const READINGS_KEY = 'chc:v1:readings';
export const MISSION_KEY = 'chc:v1:mission';
const DEFAULT_MISSION: MissionProfileId = 'iss';

// Fallback when localStorage is unavailable (private mode, blocked, tests).
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    if (globalThis.localStorage) return globalThis.localStorage.getItem(key);
  } catch {
    /* fall through to memory */
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string): void {
  try {
    if (globalThis.localStorage) {
      globalThis.localStorage.setItem(key, value);
      return;
    }
  } catch {
    /* fall through to memory */
  }
  memory.set(key, value);
}

function isReading(x: unknown): x is Reading {
  const r = x as Reading;
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.id === 'string' &&
    typeof r.indicatorId === 'string' &&
    typeof r.value === 'number' &&
    typeof r.timestamp === 'string'
  );
}

/** Load readings. Seeds demo data on first run or if stored data is corrupt. */
export function loadReadings(): Reading[] {
  const raw = read(READINGS_KEY);
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(isReading)) return parsed;
    } catch {
      /* corrupt: re-seed below */
    }
  }
  return resetToSeed();
}

export function saveReadings(readings: Reading[]): void {
  write(READINGS_KEY, JSON.stringify(readings));
}

export type NewReading = Omit<Reading, 'id' | 'timestamp'> & { timestamp?: string };

/** Append a reading and persist. Returns the updated list. */
export function addReading(input: NewReading): Reading[] {
  const reading: Reading = {
    ...input,
    id: globalThis.crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random()}`,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
  const next = [...loadReadings(), reading];
  saveReadings(next);
  return next;
}

/** Replace all readings with the 30-day demo dataset. */
export function resetToSeed(now = new Date()): Reading[] {
  const seed = generateSeed(30, now);
  saveReadings(seed);
  return seed;
}

/** Remove all readings (keeps an empty list, so the app does not re-seed). */
export function clearReadings(): Reading[] {
  saveReadings([]);
  return [];
}

export function loadMission(): MissionProfileId {
  const raw = read(MISSION_KEY);
  return raw === 'iss' || raw === 'lunar' || raw === 'mars' ? raw : DEFAULT_MISSION;
}

export function saveMission(id: MissionProfileId): void {
  write(MISSION_KEY, id);
}
