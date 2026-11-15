import { latestByIndicator } from '../lib/readings';
import type { BodySystemId, Reading } from '../lib/types';

/**
 * Seconds per heartbeat for the animated figure, from the latest heart rate
 * (60 / bpm, kept to 40–180 bpm so a typo can't freeze or strobe it). Undefined without one.
 */
export function heartbeatSeconds(readings: Reading[]): number | undefined {
  const bpm = latestByIndicator(readings)['heart_rate']?.value;
  if (!bpm) return undefined;
  return 60 / Math.min(180, Math.max(40, bpm));
}

/** Systems drawn on the body figure (the others are only listed beside it). */
export type FigureSystem = Extract<
  BodySystemId,
  'mind' | 'eyes' | 'heart' | 'respiratory' | 'immune' | 'bone'
>;

export const FIGURE_SYSTEMS: FigureSystem[] = [
  'mind',
  'eyes',
  'heart',
  'respiratory',
  'immune',
  'bone',
];

/** Short callout names (content.json's system names are too long for the figure). */
export const FIGURE_LABEL: Record<FigureSystem, string> = {
  mind: 'Mind',
  eyes: 'Eyes',
  heart: 'Heart',
  respiratory: 'Lungs',
  immune: 'Immune',
  bone: 'Bones',
};

/** The figure is drawn in this box (FigureArt); BodyFigure's anchors use it too. */
export const FIGURE_VB = { w: 400, h: 600 };
