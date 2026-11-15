import type { BodySystemId } from '../../lib/types';

// Owner B: organ labels and notes for the 3D anatomy models (from the team's crew-anatomy kit,
// Human Reference Atlas v1.5, CC BY 4.0: see public/models/ATTRIBUTION.md). The notes say what
// each of the app's indicators can and cannot tell about an organ; they are not diagnoses.

export type Sex = 'male' | 'female';
export type Layer = 'xray' | 'surface' | 'organs' | 'bones' | 'muscles' | 'nervous' | 'circulatory';

export interface OrganInfo {
  id: string;
  label: string;
  indicators: string[];
  note: string;
}

const info: Record<string, [string, string[], string]> = {
  heart: [
    'Heart',
    ['heart_rate', 'bp_systolic', 'bp_diastolic'],
    'Pulse and blood pressure describe circulation. They do not diagnose a specific heart condition.',
  ],
  blood_vessels: [
    'Blood vessels',
    ['bp_systolic', 'bp_diastolic'],
    'Altered gravity changes fluid distribution and cardiovascular regulation.',
  ],
  lung_left: [
    'Left lung',
    ['spo2'],
    'SpO₂ estimates blood oxygen saturation. It does not measure lung capacity or cabin CO₂.',
  ],
  lung_right: [
    'Right lung',
    ['spo2'],
    'Oxygen saturation is a whole-body reading; it cannot identify a problem in one lung.',
  ],
  airways: [
    'Airways',
    ['spo2'],
    'Airways carry air to the lungs. This model does not measure breathing or cabin air quality.',
  ],
  brain: [
    'Brain',
    ['sleep_hours', 'mood'],
    'Sleep and mood check-ins support behavioral health. They are not measurements of brain activity.',
  ],
  eyes: [
    'Eyes & optic nerves',
    [],
    'Spaceflight-associated neuro-ocular changes need dedicated eye assessments. None of the eight v1 indicators measures them.',
  ],
  skin: [
    'Body surface',
    ['body_temp'],
    'Temperature depends on measurement site. Skin temperature is not interchangeable with core body temperature.',
  ],
  pancreas: [
    'Pancreas',
    ['blood_glucose'],
    'Insulin helps regulate glucose. A glucose reading does not directly measure pancreatic health.',
  ],
  liver: [
    'Liver',
    ['blood_glucose'],
    'The liver helps regulate fuel availability. Glucose is not a liver-function test.',
  ],
  kidney_left: [
    'Left kidney',
    [],
    'Fluid balance and kidney-stone risk matter during flight. Kidney function needs additional tests beyond v1.',
  ],
  kidney_right: [
    'Right kidney',
    [],
    'Urine and blood tests may support kidney assessment. No v1 value identifies the health of this kidney.',
  ],
  spine: [
    'Vertebral column',
    [],
    'Weight-bearing bone can lose mineral during spaceflight. Bone health needs dedicated assessment.',
  ],
  pelvis: [
    'Pelvic bones',
    [],
    'Bone structure is shown as anatomical context. The model cannot estimate bone density.',
  ],
  knee_left: [
    'Left knee structures',
    [],
    'Available atlas knee structures are shown; this is not a complete lower-limb skeleton.',
  ],
  knee_right: [
    'Right knee structures',
    [],
    'Joint and bone context for movement and countermeasure discussions; no direct v1 measurement.',
  ],
  muscles: [
    'Available muscle structures',
    [],
    'Long missions can reduce muscle strength. This atlas subset is not a whole-body muscle model.',
  ],
  spleen: [
    'Spleen',
    [],
    'The spleen participates in immune function. Temperature alone cannot assess immune health.',
  ],
  thymus: ['Thymus', [], 'Immune-system anatomy for context; no direct v1 measurement.'],
  spinal_cord: [
    'Spinal cord',
    [],
    'Nervous-system anatomy for orientation; not assessed by a mood score or vital sign.',
  ],
  stomach: ['Stomach', [], 'Digestive anatomy for context; no direct v1 measurement.'],
  intestines: [
    'Intestines',
    [],
    'Nutrition and gastrointestinal symptoms can affect crew health; v1 does not directly assess this organ.',
  ],
  urinary_bladder: [
    'Urinary bladder',
    [],
    'Urinary anatomy for context; no direct v1 measurement.',
  ],
  reproductive: [
    'Reproductive anatomy',
    [],
    'Sex-specific reference anatomy, not a patient-specific model. No reproductive health inference is made.',
  ],
};

export const organs: Record<string, OrganInfo> = Object.fromEntries(
  Object.entries(info).map(([id, [label, indicators, note]]) => [
    id,
    { id, label, indicators, note },
  ]),
);

/** Which of the app's body systems each organ belongs to (for status tint and selection). */
export const ORGAN_SYSTEM: Record<string, BodySystemId> = {
  heart: 'heart',
  blood_vessels: 'heart',
  lung_left: 'respiratory',
  lung_right: 'respiratory',
  airways: 'respiratory',
  brain: 'mind',
  spinal_cord: 'mind',
  eyes: 'eyes',
  skin: 'immune',
  spleen: 'immune',
  thymus: 'immune',
  pancreas: 'metabolic',
  liver: 'metabolic',
  spine: 'bone',
  pelvis: 'bone',
  knee_left: 'bone',
  knee_right: 'bone',
  muscles: 'muscle',
};

/** The organ to highlight for a body system (Body view selection). */
export const SYSTEM_ORGAN: Partial<Record<BodySystemId, string>> = {
  heart: 'heart',
  respiratory: 'lung_right',
  mind: 'brain',
  eyes: 'eyes',
  immune: 'spleen',
  metabolic: 'pancreas',
  bone: 'spine',
  muscle: 'muscles',
};

/** Status hex per tone (kept in sync with tone.ts / index.css). */
const TINT: Record<'watch' | 'act', string> = { watch: '#ffd23f', act: '#ff4d6d' };

/** Organ tint from body-system tones: organs of a Watch / Act now system take its colour. */
export function organTint(
  tones: Partial<Record<BodySystemId, 'normal' | 'watch' | 'act' | null>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [organ, system] of Object.entries(ORGAN_SYSTEM)) {
    const t = tones[system];
    if (t === 'watch' || t === 'act') out[organ] = TINT[t];
  }
  return out;
}
