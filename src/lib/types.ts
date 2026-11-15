// Shared data contract. Changing anything here affects every owner:
// coordinate with the team and update README.md + CLAUDE.md in the same commit.
// The app reads this shape; src/data/content.ts converts content.json (C's format) into it.

export type StatusLevel = 'green' | 'amber' | 'red';

/** 'unknown' = no reading or a non-numeric value. */
export type StatusResult = {
  level: StatusLevel | 'unknown';
  action: string;
  /** Label of the matching band from content.json, e.g. "High resting pulse". */
  label?: string;
};

export type BodySystemId =
  'heart' | 'respiratory' | 'bone' | 'muscle' | 'immune' | 'eyes' | 'mind' | 'sleep' | 'metabolic';

/** Half-open numeric band: min inclusive, max exclusive. Omit min or max for an open end. */
export interface Range {
  min?: number;
  max?: number;
  label?: string;
}

export interface Source {
  title: string;
  org?: string;
  url?: string;
}

export interface Hazard {
  id: string;
  name: string;
  summary: string;
}

export interface Indicator {
  id: string;
  name: string;
  unit: string;
  /** Measurement steps joined into one paragraph (see howToMeasureSteps for the list). */
  howToMeasureInSpace: string;
  howToMeasureSteps: string[];
  bodySystem: BodySystemId;
  /** Each level can have several bands (e.g. amber = slightly low OR slightly high). */
  ranges: Record<StatusLevel, Range[]>;
  /** Guidance for each status level, joined into one string (see actionSteps for the list). */
  actions: Record<StatusLevel, string>;
  actionSteps: Record<StatusLevel, string[]>;
  sources: Source[];
  /** "TODO-verify" until the ranges are approved; then "verified". */
  rangesStatus?: string;
  /** Input limits for the log form; values outside them are rejected (see validateValue). */
  input: { min: number; max: number; step: number };
  whyItMatters?: string;
  spaceflightEffect?: string;
  /** When and how to escalate to the flight surgeon. */
  escalation?: string;
  measureFrequency?: string;
  reviewNote?: string;
  /** Hazard names (resolved from content.json hazard ids). */
  hazards: string[];
}

export interface Reading {
  id: string;
  indicatorId: string;
  value: number;
  /** ISO 8601 string. */
  timestamp: string;
  note?: string;
  /** When this reading was last added or edited on this device (ISO). Used by sync; absent on seed data. */
  updatedAt?: string;
}

export interface BodySystem {
  id: BodySystemId;
  name: string;
  spaceflightEffects: string;
  /** Hazard names (resolved from content.json hazard ids). */
  hazards: string[];
  /** Derived: indicators whose bodySystem is this system. */
  indicatorIds: string[];
  /** What to do, for systems with no indicator to take steps from (e.g. eyes, bone). */
  steps?: string[];
}

export type MissionProfileId = 'iss' | 'lunar' | 'mars';

export interface MissionProfile {
  id: MissionProfileId;
  name: string;
  description: string;
  /** One-way communication delay to Earth, in seconds. */
  commsDelaySeconds: { min: number; max: number };
}

/** One task on the daily routine (Routine screen). Text comes from content.json. */
export interface RoutineTaskContent {
  id: string;
  /** Planned time of day, "HH:MM". */
  time: string;
  title: string;
  /** Lower-case name for buttons, e.g. "resistance session". */
  short?: string;
  /** Why it matters. May contain a `{delay}` token (the mission's comms delay). */
  why: string;
  category: string;
  /** Free text, e.g. "45 min". */
  duration?: string;
  /** Done automatically once each of these indicators has a reading today. */
  indicatorIds?: string[];
  /** Only shown when the condition holds ('short_sleep': last sleep was amber or red). */
  showWhen?: 'short_sleep';
}

export interface MoodTag {
  id: string;
  label: string;
}

/** What the app reads (built from content.json by src/data/content.ts). */
export interface Content {
  disclaimer: string;
  unknownStatusAction: string;
  hazards: Hazard[];
  indicators: Indicator[];
  bodySystems: BodySystem[];
  missionProfiles: MissionProfile[];
  /** Daily tasks (counted for progress and streaks) and extra tasks (shown, not counted). */
  routine: { daily: RoutineTaskContent[]; extra: RoutineTaskContent[] };
  /** Optional tags for the mood check-in (saved in the reading's note). */
  moodTags: MoodTag[];
}
