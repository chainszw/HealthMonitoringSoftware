import { describe, expect, it } from 'vitest';
import {
  CSV_BOM,
  buildExport,
  csvField,
  exportDeviceReadings,
  toCsv,
  toExportRows,
  type ExportSource,
} from './exportData';
import type { CrewMember } from './syncProtocol';

const alex: CrewMember = { id: 'alpha', name: 'Alex Rivera', role: 'astronaut' };
const T1 = '2026-11-14T07:00:00.000Z';
const T2 = '2026-11-15T07:00:00.000Z';

const readings: ExportSource[] = [
  { id: 'b', indicatorId: 'heart_rate', value: 110, timestamp: T2, crewId: 'bravo' },
  { id: 'a2', indicatorId: 'spo2', value: 97, timestamp: T2, crewId: 'alpha', note: 'ok' },
  { id: 'a1', indicatorId: 'heart_rate', value: 72, timestamp: T1, crewId: 'alpha' },
];

describe('toExportRows', () => {
  it('adds names, units and status, ordered by crew member then time', () => {
    const rows = toExportRows(readings, {
      crewNames: { alpha: 'Alex Rivera', bravo: 'Sam Okafor' },
    });
    expect(rows.map((r) => r.readingId)).toEqual(['a1', 'a2', 'b']);
    expect(rows[0]).toEqual({
      crewId: 'alpha',
      crewName: 'Alex Rivera',
      readingId: 'a1',
      indicatorId: 'heart_rate',
      indicator: 'Heart rate',
      unit: 'bpm',
      value: 72,
      status: 'green',
      band: 'Usual adult resting range',
      measuredAt: T1,
    });
    expect(rows[2]).toMatchObject({ crewName: 'Sam Okafor', status: 'amber' });
    expect(rows[1].note).toBe('ok');
  });

  it("labels a device's own readings with the signed-in crew member", () => {
    const [row] = toExportRows([{ id: 'x', indicatorId: 'mood', value: 1, timestamp: T1 }], {
      crew: alex,
    });
    expect(row).toMatchObject({ crewId: 'alpha', crewName: 'Alex Rivera', status: 'red' });
  });

  it('keeps readings of unknown indicators, with status unknown', () => {
    const [row] = toExportRows([{ id: 'x', indicatorId: 'glucose_old', value: 5, timestamp: T1 }]);
    expect(row).toEqual({
      readingId: 'x',
      indicatorId: 'glucose_old',
      indicator: 'glucose_old',
      unit: '',
      value: 5,
      status: 'unknown',
      measuredAt: T1,
    });
  });
});

describe('csvField', () => {
  it('quotes only when needed', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a, b')).toBe('"a, b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField(97.5)).toBe('97.5');
    expect(csvField(undefined)).toBe('');
  });

  it('stops spreadsheets from running typed text as a formula', () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('+1')).toBe("'+1");
    expect(csvField('-2 felt dizzy')).toBe("'-2 felt dizzy");
    expect(csvField('@cmd')).toBe("'@cmd");
    expect(csvField('\tTab')).toBe("'\tTab");
    expect(csvField(-5)).toBe('-5');
  });
});

describe('toCsv and buildExport', () => {
  const rows = toExportRows(readings.slice(1), { crewNames: { alpha: 'Alex Rivera' } });

  it('writes a header and one CRLF line per row', () => {
    const csv = toCsv(rows);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'crew_id,crew_name,reading_id,indicator_id,indicator,unit,value,status,band,measured_at,note,updated_at,deleted_at',
    );
    expect(lines[1]).toBe(
      `alpha,Alex Rivera,a1,heart_rate,Heart rate,bpm,72,green,Usual adult resting range,${T1},,,`,
    );
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('');
    expect(toCsv([]).split('\r\n')).toHaveLength(2);
  });

  it('builds CSV and JSON files with a dated name', () => {
    const meta = { exportedAt: '2026-11-15T12:00:00.000Z', scope: 'alpha' };
    const csv = buildExport(rows, 'csv', meta);
    expect(csv.filename).toBe('crew-health-alpha-2026-11-15.csv');
    expect(csv.mimeType).toBe('text/csv; charset=utf-8');
    expect(csv.content.startsWith(`${CSV_BOM}crew_id,`)).toBe(true);

    const json = buildExport(rows, 'json', { ...meta, filters: { indicatorId: 'spo2' } });
    expect(json.filename).toBe('crew-health-alpha-2026-11-15.json');
    const doc = JSON.parse(json.content);
    expect(doc).toMatchObject({
      format: 'crew-health-export',
      version: 1,
      scope: 'alpha',
      filters: { indicatorId: 'spo2' },
      count: 2,
    });
    expect(doc.disclaimer).toMatch(/not diagnosis/);
    expect(doc).not.toHaveProperty('exportedBy');
    expect(doc.readings[1]).toMatchObject({ readingId: 'a2', note: 'ok' });
  });

  it("exports a device's readings offline", () => {
    const now = new Date('2026-11-15T12:00:00.000Z');
    const local = [{ id: 'x', indicatorId: 'mood', value: 4, timestamp: T1 }];
    expect(exportDeviceReadings(local, 'csv', undefined, now).filename).toBe(
      'crew-health-device-2026-11-15.csv',
    );
    const file = exportDeviceReadings(local, 'json', alex, now);
    expect(file.filename).toBe('crew-health-alpha-2026-11-15.json');
    expect(JSON.parse(file.content).exportedBy).toEqual(alex);
  });
});
