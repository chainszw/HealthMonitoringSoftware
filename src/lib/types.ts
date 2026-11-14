// Shared data contract. Changing anything here affects every owner:
// coordinate with the team and update README.md + CLAUDE.md in the same commit.

export type StatusLevel = 'green' | 'amber' | 'red';

/** 'unknown' = no reading or a non-numeric value. */
export type StatusResult = { level: StatusLevel | 'unknown'; action: string };

export type BodySystemId =
  'heart' | 'bone' | 'muscle' | 'immune' | 'eyes' | 'mind' | 'sleep' | 'metabolic';

/** Inclusive numeric band. Omit min or max for an open-ended band. */
export interface Range {
  min?: number;
  max?: number;
}

export interface Source {
  title: string;
  url?: string;
}

export interface Indicator {
  id: string;
  name: string;
  unit: string;
  howToMeasureInSpace: string;
  bodySystem: BodySystemId;
  /** Each level can have several bands (e.g. amber = slightly low OR slightly high). */
  ranges: Record<StatusLevel, Range[]>;
  /** Guidance shown to the crew for each status level. */
  actions: Record<StatusLevel, string>;
  sources: Source[];
  /** "TODO-verify" until a teammate has checked ranges against sources; then "verified". */
  rangesStatus?: string;
  /** Optional input hints for the log form. */
  input?: { min?: number; max?: number; step?: number };
}

export interface Reading {
  id: string;
  indicatorId: string;
  value: number;
  /** ISO 8601 string. */
  timestamp: string;
  note?: string;
}

export interface BodySystem {
  id: BodySystemId;
  name: string;
  spaceflightEffects: string;
  hazards: string[];
  indicatorIds: string[];
}

export type MissionProfileId = 'iss' | 'lunar' | 'mars';

export interface MissionProfile {
  id: MissionProfileId;
  name: string;
  description: string;
  /** One-way communication delay to Earth, in seconds. */
  commsDelaySeconds: { min: number; max: number };
}

/** Shape of src/data/content.json. */
export interface Content {
  disclaimer: string;
  unknownStatusAction: string;
  indicators: Indicator[];
  bodySystems: BodySystem[];
  missionProfiles: MissionProfile[];
}
