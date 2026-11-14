import { content, getIndicator } from '../data/content';
import { getStatus } from './status';
import type { CrewMember, Level } from './syncProtocol';
import type { Reading } from './types';

// Export readings as CSV or JSON. Pure and shared: the offline app exports a device's readings
// with exportDeviceReadings(), and the server's GET /export.csv and /export.json use the same
// builder, so both produce the same file.

export type ExportFormat = 'csv' | 'json';

/** A reading to export. Server readings also carry crewId, updatedAt and deletedAt. */
export type ExportSource = Reading & { crewId?: string; updatedAt?: string; deletedAt?: string };

/** One exported reading. Optional fields are left out of JSON and empty in CSV. */
export interface ExportRow {
  crewId?: string;
  crewName?: string;
  readingId: string;
  indicatorId: string;
  /** Indicator name from content.json (the id if the indicator is unknown). */
  indicator: string;
  unit: string;
  value: number;
  /** Status at export time, from content.json's bands. */
  status: Level;
  /** Band label, e.g. "High resting pulse". */
  band?: string;
  measuredAt: string;
  note?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface ExportFile {
  filename: string;
  mimeType: string;
  content: string;
}

export interface ExportMeta {
  exportedAt: string;
  exportedBy?: CrewMember;
  /** A crew id, 'all-crew' or 'device'; used in the file name. */
  scope: string;
  /** The filters that produced the file, recorded in JSON exports. */
  filters?: Record<string, string>;
}

/**
 * Turn readings into export rows, ordered by crew member, then time of measurement.
 * `crew` labels readings that have no crewId (a device's own readings).
 */
export function toExportRows(
  readings: ExportSource[],
  { crewNames = {}, crew }: { crewNames?: Record<string, string>; crew?: CrewMember } = {},
): ExportRow[] {
  const rows = readings.map((r) => {
    const indicator = getIndicator(r.indicatorId);
    const status = indicator ? getStatus(indicator, r.value) : { level: 'unknown' as const };
    const crewId = r.crewId ?? crew?.id;
    const crewName = crewId
      ? (crewNames[crewId] ?? (crewId === crew?.id ? crew.name : undefined))
      : undefined;
    const row: ExportRow = {
      readingId: r.id,
      indicatorId: r.indicatorId,
      indicator: indicator?.name ?? r.indicatorId,
      unit: indicator?.unit ?? '',
      value: r.value,
      status: status.level,
      measuredAt: r.timestamp,
    };
    if (crewId !== undefined) row.crewId = crewId;
    if (crewName !== undefined) row.crewName = crewName;
    if ('label' in status && status.label !== undefined) row.band = status.label;
    if (r.note !== undefined) row.note = r.note;
    if (r.updatedAt !== undefined) row.updatedAt = r.updatedAt;
    if (r.deletedAt !== undefined) row.deletedAt = r.deletedAt;
    return row;
  });
  return rows.sort(
    (a, b) =>
      (a.crewId ?? '').localeCompare(b.crewId ?? '') ||
      a.measuredAt.localeCompare(b.measuredAt) ||
      a.readingId.localeCompare(b.readingId),
  );
}

/** CSV columns, in order: [row field, header]. */
export const CSV_COLUMNS: [keyof ExportRow, string][] = [
  ['crewId', 'crew_id'],
  ['crewName', 'crew_name'],
  ['readingId', 'reading_id'],
  ['indicatorId', 'indicator_id'],
  ['indicator', 'indicator'],
  ['unit', 'unit'],
  ['value', 'value'],
  ['status', 'status'],
  ['band', 'band'],
  ['measuredAt', 'measured_at'],
  ['note', 'note'],
  ['updatedAt', 'updated_at'],
  ['deletedAt', 'deleted_at'],
];

/** Lets Excel detect UTF-8 (units like °C). */
export const CSV_BOM = String.fromCharCode(0xfeff);

/**
 * One CSV field. Quoted per RFC 4180 when needed. Text starting with = + - @ (or a tab or
 * carriage return) gets a leading apostrophe so a spreadsheet shows it instead of running it as
 * a formula: notes and names are typed by people.
 */
export function csvField(value: string | number | undefined): string {
  if (value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header plus one line per row, CRLF line endings (RFC 4180). */
export function toCsv(rows: ExportRow[]): string {
  const lines = [CSV_COLUMNS.map(([, header]) => header).join(',')];
  for (const row of rows) lines.push(CSV_COLUMNS.map(([key]) => csvField(row[key])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

/** The finished file: name, MIME type and text. */
export function buildExport(rows: ExportRow[], format: ExportFormat, meta: ExportMeta): ExportFile {
  const base = `crew-health-${meta.scope}-${meta.exportedAt.slice(0, 10)}`;
  if (format === 'csv') {
    return {
      filename: `${base}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      content: CSV_BOM + toCsv(rows),
    };
  }
  const document = {
    format: 'crew-health-export',
    version: 1,
    exportedAt: meta.exportedAt,
    ...(meta.exportedBy ? { exportedBy: meta.exportedBy } : {}),
    scope: meta.scope,
    filters: meta.filters ?? {},
    disclaimer: content.disclaimer,
    count: rows.length,
    readings: rows,
  };
  return {
    filename: `${base}.json`,
    mimeType: 'application/json; charset=utf-8',
    content: `${JSON.stringify(document, null, 2)}\n`,
  };
}

/**
 * Export this device's readings, offline. Pass the signed-in crew member (if any) to label the
 * rows. A screen can save the result with a Blob download; that part is UI.
 */
export function exportDeviceReadings(
  readings: Reading[],
  format: ExportFormat,
  crew?: CrewMember,
  now = new Date(),
): ExportFile {
  return buildExport(toExportRows(readings, { crew }), format, {
    exportedAt: now.toISOString(),
    exportedBy: crew,
    scope: crew?.id ?? 'device',
  });
}
