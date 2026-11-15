import type { Indicator, Range, StatusLevel, StatusResult } from './types';

const SEVERITY: Record<StatusResult['level'], number> = { unknown: 0, green: 1, amber: 2, red: 3 };
const CHECK_ORDER: StatusLevel[] = ['green', 'amber', 'red'];

function inRange(value: number, range: Range): boolean {
  return (
    (range.min === undefined || value >= range.min) &&
    (range.max === undefined || value < range.max)
  );
}

/**
 * Pure status lookup. Bands are half-open, as in content.json: min inclusive, max exclusive
 * (green 60–101 and amber 101–131 means 101 is amber). Bands are checked green → amber → red
 * and the first match wins, so overlapping bands resolve to the less severe level.
 * A value outside every band is treated as red (conservative).
 * Action text and band label always come from the indicator (content.json).
 */
export function getStatus(
  indicator: Indicator,
  value: number | null | undefined,
  unknownAction = '',
): StatusResult {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { level: 'unknown', action: unknownAction };
  }
  for (const level of CHECK_ORDER) {
    const band = indicator.ranges[level].find((r) => inRange(value, r));
    if (band) return { level, action: indicator.actions[level], label: band.label };
  }
  return { level: 'red', action: indicator.actions.red };
}

/** Most severe level in a list (red > amber > green > unknown). */
export function worstStatus(levels: StatusResult['level'][]): StatusResult['level'] {
  return levels.reduce<StatusResult['level']>(
    (worst, l) => (SEVERITY[l] > SEVERITY[worst] ? l : worst),
    'unknown',
  );
}
