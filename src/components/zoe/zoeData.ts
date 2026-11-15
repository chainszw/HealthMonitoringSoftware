// Owner B: data for the ZOĒ concept device (ported from the team's ZOĒ wearable cube artifact).
// The immune index and bars are simulated demo values, not measurements. Environment notes cite
// NASA and CSA; hazard levels are the team's estimate (NASA names the hazards, it doesn't rate them).

export type ZoeEnvId = 'space' | 'earth' | 'mars' | 'moon';

export interface ZoeEnv {
  id: ZoeEnvId;
  label: string;
  name: string;
  gravityLabel: string;
  /** Gravity in g (0 = weightless). */
  g: number;
  /** Simulated immune index, 0–100. */
  idx: number;
  /** T-cell, inflammation, stress, virus, surroundings (simulated, 0–100). */
  bars: number[];
  /** Hazard levels 0–3, in ZOE_HAZARDS order. */
  haz: number[];
  status: string;
  color: number;
  planet: number | null;
  text: string;
}

export const ZOE_HAZARDS = [
  'Space radiation',
  'Isolation and confinement',
  'Distance from Earth',
  'Gravity fields',
  'Closed environment',
];

export const ZOE_BARS = ['T-cell', 'Inflam.', 'Stress', 'Virus', 'Surround.'];

export const ZOE_ENVS: ZoeEnv[] = [
  {
    id: 'space',
    label: 'Space',
    name: 'Space, in orbit',
    gravityLabel: 'about 0 g',
    g: 0,
    idx: 72,
    bars: [66, 58, 62, 55, 73],
    haz: [2, 2, 1, 3, 3],
    status: 'Review advised',
    color: 0xff7a45,
    planet: null,
    text: 'Weightless, as on the space station. NASA lists altered immune responses as a risk: flight stress can wake dormant viruses, and skin and gut microbes may shift. About 30% of station radiation is neutrons (CSA).',
  },
  {
    id: 'earth',
    label: 'Earth',
    name: 'Earth',
    gravityLabel: '1 g, 9.81 m/s²',
    g: 1,
    idx: 96,
    bars: [95, 20, 22, 10, 0],
    haz: [0, 0, 0, 0, 0],
    status: 'Within baseline',
    color: 0x3fe0c5,
    planet: 0x2f6fd0,
    text: 'The reference. ZOĒ learns each astronaut’s normal here before launch. Space health research also helps people on Earth, for example with osteoporosis and heart conditions (CSA).',
  },
  {
    id: 'mars',
    label: 'Mars',
    name: 'Mars',
    gravityLabel: '0.38 g, 3.71 m/s²',
    g: 0.38,
    idx: 86,
    bars: [84, 35, 38, 30, 93],
    haz: [3, 3, 3, 2, 3],
    status: 'Watch',
    color: 0xffc247,
    planet: 0xb5532e,
    text: 'About 140 million miles away on average, a trip of roughly three years, with three-eighths of Earth gravity for up to two years (NASA). Medical help is far away, so on-body monitoring matters most here.',
  },
  {
    id: 'moon',
    label: 'Moon',
    name: 'Moon',
    gravityLabel: '0.17 g, 1.62 m/s²',
    g: 0.166,
    idx: 80,
    bars: [78, 42, 45, 38, 80],
    haz: [3, 2, 2, 2, 3],
    status: 'Watch',
    color: 0xffc247,
    planet: 0x9a9aa0,
    text: 'About three days from Earth (NASA). Partial gravity and deep-space radiation. Artemis II crew gave blood and saliva so scientists could study how deep space changes the immune system.',
  },
];

export const zoeEnv = (id: ZoeEnvId): ZoeEnv => ZOE_ENVS.find((e) => e.id === id) ?? ZOE_ENVS[0];

export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Numbered sensors and parts on the clear-case model (marker numbers follow this order). */
export const ZOE_MARK_SECTIONS: { title: string; items: { name: string; desc?: string }[] }[] = [
  {
    title: 'Finger well sensors',
    items: [
      { name: 'Pulse light emitter', desc: 'red and infrared light for pulse and blood oxygen' },
      { name: 'Light detector', desc: 'reads the light that passes through the fingertip' },
      { name: 'Skin temperature sensor' },
      { name: 'Skin conductance pads', desc: 'stress response' },
      { name: 'Micro blood sampler', desc: 'immune markers, concept stage' },
    ],
  },
  {
    title: 'Surroundings sensors',
    items: [
      { name: 'Radiation dosimeter' },
      { name: 'Motion and gravity sensor' },
      { name: 'Temperature and pressure sensor' },
      { name: 'Air sensor', desc: 'CO₂ and humidity, behind the vent' },
      { name: 'Light sensor' },
      { name: 'Microphone', desc: 'cabin noise' },
      { name: 'Saliva strip reader', desc: 'behind the side slot' },
    ],
  },
  {
    title: 'Other parts',
    items: [
      { name: 'Finger port collar' },
      { name: 'Screen' },
      { name: 'Main processor' },
      { name: 'Radio and antenna' },
      { name: 'Status ring', desc: 'glows with the alert level' },
      { name: 'Batteries', desc: 'two cells, one each side of the well' },
      { name: 'Button' },
    ],
  },
];
