import { DEFAULT_LIMITS, INPUT_LIMITS } from '../lib/validation';
import type {
  BodySystem,
  BodySystemId,
  Content,
  Hazard,
  Indicator,
  MissionProfile,
  MissionProfileId,
  MoodTag,
  Range,
  RoutineTaskContent,
  Source,
  StatusLevel,
} from '../lib/types';
import raw from './content.json';

// content.json is authored by C in its own format (RawContent below). This module converts it
// into the Content shape the app reads (src/lib/types.ts), so the UI contract stays stable
// when the content format changes. All guidance text still comes from content.json.

export interface RawBand {
  status: StatusLevel;
  /** Inclusive; null = unbounded. */
  min: number | null;
  /** Exclusive; null = unbounded. */
  max: number | null;
  label: string;
}

export interface RawIndicator {
  id: string;
  name: string;
  unit: string;
  bodySystem: string;
  whyItMatters?: string;
  spaceflightEffect?: string;
  howToMeasure: string[];
  hazards: string[];
  bands: RawBand[];
  actions: Record<StatusLevel, string[]>;
  escalation?: string;
  measureFrequency?: string;
  needsReview?: boolean;
  reviewNote?: string;
  sources: string[];
}

export interface RawContent {
  meta: { version: string; lastUpdated: string; disclaimer: string; unknownStatusAction?: string };
  hazards: Hazard[];
  bodySystems: {
    id: string;
    name: string;
    spaceflightEffects: string;
    hazards: string[];
    steps?: string[];
  }[];
  missionProfiles: {
    id: string;
    name: string;
    description: string;
    commsDelaySeconds: { min: number; max: number };
  }[];
  indicators: RawIndicator[];
  routine?: { daily?: RoutineTaskContent[]; extra?: RoutineTaskContent[] };
  moodTags?: MoodTag[];
  sources: { id: string; title: string; org?: string; url?: string }[];
}

const LEVELS: StatusLevel[] = ['green', 'amber', 'red'];
const SYSTEM_IDS: BodySystemId[] = [
  'heart',
  'respiratory',
  'bone',
  'muscle',
  'immune',
  'eyes',
  'mind',
  'sleep',
  'metabolic',
];
const MISSION_IDS: MissionProfileId[] = ['iss', 'lunar', 'mars'];
const FALLBACK_UNKNOWN_ACTION = 'No valid reading yet.';

const isSystemId = (id: string): id is BodySystemId => (SYSTEM_IDS as string[]).includes(id);
const isMissionId = (id: string): id is MissionProfileId => (MISSION_IDS as string[]).includes(id);

function toRange(band: RawBand): Range {
  const range: Range = { label: band.label };
  if (band.min !== null) range.min = band.min;
  if (band.max !== null) range.max = band.max;
  return range;
}

/** Convert C's content.json format into the app's Content shape. Pure; exported for tests. */
export function normalizeContent(rawContent: RawContent): Content {
  const hazardName = (id: string) => rawContent.hazards.find((h) => h.id === id)?.name ?? id;
  const sourceById = new Map(rawContent.sources.map((s) => [s.id, s]));

  const indicators: Indicator[] = rawContent.indicators.map((r) => {
    const ranges = Object.fromEntries(
      LEVELS.map((l) => [l, r.bands.filter((b) => b.status === l).map(toRange)]),
    ) as Record<StatusLevel, Range[]>;
    const actionSteps = Object.fromEntries(LEVELS.map((l) => [l, r.actions[l] ?? []])) as Record<
      StatusLevel,
      string[]
    >;
    const actions = Object.fromEntries(LEVELS.map((l) => [l, actionSteps[l].join(' ')])) as Record<
      StatusLevel,
      string
    >;
    const sources: Source[] = r.sources.map((id) => {
      const s = sourceById.get(id);
      return s ? { title: s.title, org: s.org, url: s.url } : { title: id };
    });
    return {
      id: r.id,
      name: r.name,
      unit: r.unit,
      howToMeasureInSpace: r.howToMeasure.join(' '),
      howToMeasureSteps: r.howToMeasure,
      // An unrecognised system falls back to 'metabolic' rather than crashing the Body page.
      bodySystem: isSystemId(r.bodySystem) ? r.bodySystem : 'metabolic',
      ranges,
      actions,
      actionSteps,
      sources,
      rangesStatus: r.needsReview === false ? 'verified' : 'TODO-verify',
      input: INPUT_LIMITS[r.id] ?? DEFAULT_LIMITS,
      whyItMatters: r.whyItMatters,
      spaceflightEffect: r.spaceflightEffect,
      escalation: r.escalation,
      measureFrequency: r.measureFrequency,
      reviewNote: r.reviewNote,
      hazards: r.hazards.map(hazardName),
    };
  });

  const bodySystems: BodySystem[] = rawContent.bodySystems
    .filter((b) => isSystemId(b.id))
    .map((b) => {
      const system: BodySystem = {
        id: b.id as BodySystemId,
        name: b.name,
        spaceflightEffects: b.spaceflightEffects,
        hazards: b.hazards.map(hazardName),
        indicatorIds: indicators.filter((i) => i.bodySystem === b.id).map((i) => i.id),
      };
      if (b.steps?.length) system.steps = b.steps;
      return system;
    });

  const missionProfiles: MissionProfile[] = rawContent.missionProfiles
    .filter((m) => isMissionId(m.id))
    .map((m) => ({ ...m, id: m.id as MissionProfileId }));

  return {
    disclaimer: rawContent.meta.disclaimer,
    unknownStatusAction: rawContent.meta.unknownStatusAction ?? FALLBACK_UNKNOWN_ACTION,
    hazards: rawContent.hazards,
    indicators,
    bodySystems,
    missionProfiles,
    routine: { daily: rawContent.routine?.daily ?? [], extra: rawContent.routine?.extra ?? [] },
    moodTags: rawContent.moodTags ?? [],
  };
}

/** All app text and thresholds. Edit content.json, never hardcode guidance in components. */
export const content: Content = normalizeContent(raw as RawContent);

export function getIndicator(id: string): Indicator | undefined {
  return content.indicators.find((i) => i.id === id);
}

export function getBodySystem(id: BodySystemId): BodySystem | undefined {
  return content.bodySystems.find((b) => b.id === id);
}

export function getMissionProfile(id: string): MissionProfile | undefined {
  return content.missionProfiles.find((m) => m.id === id);
}

/** Every source in content.json, with the indicators that cite it (for the Sources page). */
export const contentSources: {
  id: string;
  title: string;
  org?: string;
  url?: string;
  usedBy: string[];
}[] = (raw as RawContent).sources.map((s) => ({
  ...s,
  usedBy: content.indicators
    .filter((i) => i.sources.some((x) => x.title === s.title))
    .map((i) => i.name),
}));

/** content.json version and date. */
export const contentMeta = {
  version: (raw as RawContent).meta.version,
  lastUpdated: (raw as RawContent).meta.lastUpdated,
};
