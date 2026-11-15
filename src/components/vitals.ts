import { getIndicator } from '../data/content';
import { formatRange, formatValue } from '../lib/format';
import { latestByIndicator } from '../lib/readings';
import { getStatus } from '../lib/status';
import {
  bloodPressureStatus,
  DAILY_INDICATORS,
  getDueChecks,
  type AttentionItem,
} from '../lib/today';
import type { Indicator, Reading, StatusResult } from '../lib/types';
import { toneOf, type Tone } from './tone';

// Owner B: view helpers shared by the screens. An "entry" is what the crew logs in one go:
// an indicator id, or 'bp' for systolic + diastolic together. Status and text come from
// src/lib (getStatus, content.json); this file only shapes them for display.

export type EntryKey = string;

/** Short screen labels and units (content.json names are the full medical names). */
const LABELS: Record<string, { label: string; unit?: string }> = {
  bp: { label: 'Blood pressure', unit: 'mmHg' },
  heart_rate: { label: 'Heart rate' },
  spo2: { label: 'Blood oxygen', unit: '%' },
  body_temp: { label: 'Body temperature' },
  blood_glucose: { label: 'Glucose' },
  sleep_hours: { label: 'Sleep', unit: 'h' },
  mood: { label: 'Mood check-in', unit: 'of 5' },
};

/** The order entries appear in on Today, Log and Trends. */
export const ENTRY_KEYS: EntryKey[] = [
  'bp',
  'heart_rate',
  'spo2',
  'body_temp',
  'sleep_hours',
  'blood_glucose',
  'mood',
];

export const entryKeyOf = (indicatorId: string): EntryKey =>
  indicatorId.startsWith('bp_') ? 'bp' : indicatorId;

export const entryIndicatorIds = (key: EntryKey): string[] =>
  key === 'bp' ? ['bp_systolic', 'bp_diastolic'] : [key];

/** The indicator that drives bands and charts (systolic for blood pressure). */
export const primaryIndicator = (key: EntryKey): Indicator | undefined =>
  getIndicator(entryIndicatorIds(key)[0]);

export const entryLabel = (key: EntryKey) => LABELS[key]?.label ?? getIndicator(key)?.name ?? key;

export const entryUnit = (key: EntryKey) => LABELS[key]?.unit ?? primaryIndicator(key)?.unit ?? '';

/** The green range for people: "60–100", or "101–119 / 60–79" for blood pressure. */
export const entryRange = (key: EntryKey) =>
  entryIndicatorIds(key)
    .map((id) => getIndicator(id))
    .filter((i) => i !== undefined)
    .map(formatRange)
    .join(' / ');

export interface EntryStatus {
  key: EntryKey;
  label: string;
  unit: string;
  level: StatusResult['level'];
  tone: Tone | null;
  /** "64", "134/86". Undefined when nothing is logged. */
  value?: string;
  timestamp?: string;
  /** Band label from content.json, e.g. "High resting pulse". */
  bandLabel?: string;
  /** What to do at this level (content.json actions). */
  steps: string[];
  escalation?: string;
  /** The reading ids behind the value. */
  ids: string[];
}

/** Latest status of an entry, with blood pressure as one (the worse of its two numbers). */
export function entryStatus(key: EntryKey, readings: Reading[]): EntryStatus {
  const base = { key, label: entryLabel(key), unit: entryUnit(key) };
  if (key === 'bp') {
    const bp = bloodPressureStatus(readings);
    const sides = [bp.systolic, bp.diastolic].filter((s) => s !== undefined);
    if (!sides.length) return { ...base, level: 'unknown', tone: null, steps: [], ids: [] };
    const worse = sides.find((s) => s.status.level === bp.level) ?? sides[0];
    const indicator = getIndicator(worse.indicatorId)!;
    const level = bp.level as Exclude<StatusResult['level'], 'unknown'>;
    return {
      ...base,
      level: bp.level,
      tone: toneOf(bp.level),
      value: bp.display,
      timestamp: sides.map((s) => s.timestamp).reduce((a, b) => (b > a ? b : a)),
      bandLabel: worse.status.label,
      steps: indicator.actionSteps[level] ?? [],
      escalation: indicator.escalation,
      ids: sides.map((s) => s.id),
    };
  }
  const indicator = getIndicator(key);
  const r = latestByIndicator(readings)[key];
  if (!indicator || !r) return { ...base, level: 'unknown', tone: null, steps: [], ids: [] };
  const status = getStatus(indicator, r.value);
  const level = status.level === 'unknown' ? null : status.level;
  return {
    ...base,
    level: status.level,
    tone: toneOf(status.level),
    value: formatValue(indicator, r.value),
    timestamp: r.timestamp,
    bandLabel: status.label,
    steps: level ? indicator.actionSteps[level] : [],
    escalation: indicator.escalation,
    ids: [r.id],
  };
}

/** Daily entries (blood pressure counted once). */
export const DAILY_ENTRIES: EntryKey[] = [...new Set(DAILY_INDICATORS.map(entryKeyOf))];

export interface DueEntry {
  key: EntryKey;
  label: string;
  lastAt?: string;
}

/** Daily entries with nothing logged today, blood pressure grouped. */
export function dueEntries(readings: Reading[], now = new Date()): DueEntry[] {
  const out: DueEntry[] = [];
  for (const d of getDueChecks(readings, now)) {
    const key = entryKeyOf(d.indicatorId);
    if (out.some((e) => e.key === key)) continue;
    const entry: DueEntry = { key, label: entryLabel(key) };
    if (d.lastAt) entry.lastAt = d.lastAt;
    out.push(entry);
  }
  return out;
}

/** Link to the Log screen with an entry picked. */
export const logHref = (key: EntryKey) => `/log?i=${encodeURIComponent(key)}`;

/** "Blood pressure 134/86 mmHg" from a getAttention() item. */
export function attentionTitle(a: AttentionItem): string {
  const key = entryKeyOf(a.key);
  const indicator = getIndicator(a.key);
  const value = indicator ? formatValue(indicator, Number(a.value)) : a.value;
  return `${entryLabel(key)} ${value} ${entryUnit(key)}`;
}
