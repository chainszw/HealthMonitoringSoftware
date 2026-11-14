import { getMissionProfile } from '../../src/data/content';
import type { MissionProfileId } from '../../src/lib/types';

// Comms-delay simulation (roadmap phase 6). The server stands for Earth. Data an astronaut sends
// reaches Earth after their mission's one-way light-time (the profile's worst case, from
// content.json); Earth-side views (flight surgeons) hide it until then. The astronaut's own views
// are not delayed: their devices are with them.
//
// COMMS_DELAY_SCALE sets the speed: 0 = off (default), 1 = real time, 0.01 = 100x faster
// (Mars: 22 min becomes 13.2 s).

export const MISSION_IDS: MissionProfileId[] = ['iss', 'lunar', 'mars'];

export const isMissionId = (x: unknown): x is MissionProfileId =>
  typeof x === 'string' && (MISSION_IDS as string[]).includes(x);

/** One-way delay in seconds for a mission at the given scale (0 when off or no mission). */
export function commsDelaySeconds(mission: MissionProfileId | undefined, scale: number): number {
  if (!mission || !(scale > 0)) return 0;
  const profile = getMissionProfile(mission);
  // Rounded to whole milliseconds (1320 * 0.01 is 13.200000000000001 in floating point).
  return profile ? Math.round(profile.commsDelaySeconds.max * scale * 1000) / 1000 : 0;
}

/** When data sent at `sentAt` reaches Earth, or null when there is no delay. */
export function arrivalTime(sentAt: string, delaySeconds: number): string | null {
  if (!(delaySeconds > 0)) return null;
  return new Date(Date.parse(sentAt) + Math.round(delaySeconds * 1000)).toISOString();
}

/** COMMS_DELAY_SCALE as a number; missing, invalid or negative means off (0). */
export function parseScale(raw: string | undefined): number {
  const n = Number(raw);
  return raw !== undefined && raw.trim() !== '' && Number.isFinite(n) && n > 0 ? n : 0;
}
