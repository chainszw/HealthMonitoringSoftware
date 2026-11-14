import type { BodySystem, BodySystemId, Content, Indicator, MissionProfile } from '../lib/types';
import raw from './content.json';

/** All app text and thresholds. Edit content.json, never hardcode guidance in components. */
export const content = raw as Content;

export function getIndicator(id: string): Indicator | undefined {
  return content.indicators.find((i) => i.id === id);
}

export function getBodySystem(id: BodySystemId): BodySystem | undefined {
  return content.bodySystems.find((b) => b.id === id);
}

export function getMissionProfile(id: string): MissionProfile | undefined {
  return content.missionProfiles.find((m) => m.id === id);
}
