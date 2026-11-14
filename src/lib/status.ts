import type { Indicator, Range, StatusLevel, StatusResult } from './types';

const SEVERITY: Record<StatusResult['level'], number> = { unknown: 0, green: 1, amber: 2, red: 3 };
const CHECK_ORDER: StatusLevel[] = ['green', 'amber', 'red'];

function inRange(value: number, range: Range): boolean {
  return (
    (range.min === undefined || value >= range.min) &&
    (range.max === undefined || value <= range.max)
  );
}

/**
 * Pure status lookup. Bands are inclusive and may share edges
 * (green 50–90, amber 90–110): checked green → amber → red, first match wins,
 * so a shared edge resolves to the less severe level.
 * A value outside every band is treated as red (conservative).
 * Action text always comes from the indicator (content.json).
 */
export function getStatus(
  indicator: Indicator,
  value: number | null | undefined,
  unknownAction = '',
): StatusResult {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { level: 'unknown', action: unknownAction };
  }
  const level =
    CHECK_ORDER.find((l) => indicator.ranges[l].some((r) => inRange(value, r))) ?? 'red';
  return { level, action: indicator.actions[level] };
}

/** Most severe level in a list (red > amber > green > unknown). */
export function worstStatus(levels: StatusResult['level'][]): StatusResult['level'] {
  return levels.reduce<StatusResult['level']>(
    (worst, l) => (SEVERITY[l] > SEVERITY[worst] ? l : worst),
    'unknown',
  );
}
