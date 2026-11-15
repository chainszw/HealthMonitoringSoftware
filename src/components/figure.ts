import type { BodySystemId } from '../lib/types';

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
