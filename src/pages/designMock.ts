import type { Tone } from '../components/tone';
import type { BodySystemId, MissionProfileId } from '../lib/types';

// DESIGN MOCK (layout test only). Static data copied from the design canvas so the
// screens can be reviewed before they're wired to useReadings()/content.json.
// Replace each use with real data when connecting the screens; then delete this file.

export const SHIP = { day: 142, date: 'Sat 14 Nov', time: '09:12' };

export const MISSIONS: Record<MissionProfileId, { label: string; delay: string; sent: string }> = {
  iss: { label: 'ISS', delay: '<1 s', sent: 'Report delivered' },
  lunar: { label: 'Lunar base', delay: '1.3 s', sent: 'Report delivered' },
  mars: { label: 'Mars transit', delay: '20 min', sent: 'Queued, reaches Earth in 20 min' },
};

// ---------- Dashboard ----------

export interface VitalTile {
  label: string;
  short: string;
  unit: string;
  meaning: string;
  tone?: Tone;
  value?: string;
  time?: string;
  action?: string;
  data?: number[];
  min?: number;
  max?: number;
}

export function dashboardVitals(alert: boolean): VitalTile[] {
  return [
    alert
      ? {
          tone: 'watch',
          label: 'Heart rate',
          short: 'heart rate',
          value: '92',
          unit: 'bpm',
          meaning: 'Higher than your usual 64.',
          action: 'Rest, then re-check',
          time: '09:05',
          data: [62, 66, 63, 65, 61, 64, 92],
          min: 40,
          max: 110,
        }
      : {
          tone: 'normal',
          label: 'Heart rate',
          short: 'heart rate',
          value: '64',
          unit: 'bpm',
          meaning: 'Resting rate in your range.',
          time: '07:40',
          data: [62, 66, 63, 65, 61, 64, 64],
          min: 40,
          max: 110,
        },
    alert
      ? {
          tone: 'act',
          label: 'Blood pressure',
          short: 'blood pressure',
          value: '156/99',
          unit: 'mmHg',
          meaning: 'High for you.',
          action: 'Rest, re-measure in 15 min',
          time: '09:04',
          data: [118, 121, 120, 124, 122, 134, 156],
          min: 90,
          max: 165,
        }
      : {
          tone: 'watch',
          label: 'Blood pressure',
          short: 'blood pressure',
          value: '134/86',
          unit: 'mmHg',
          meaning: 'A little above your range.',
          action: 'Re-measure after rest',
          time: '07:42',
          data: [118, 121, 120, 124, 122, 126, 134],
          min: 90,
          max: 165,
        },
    {
      tone: 'normal',
      label: 'Blood oxygen',
      short: 'SpO₂',
      value: '98',
      unit: '% SpO₂',
      meaning: 'Oxygen level is healthy.',
      time: '07:44',
      data: [98, 97, 98, 98, 97, 98, 98],
      min: 90,
      max: 100,
    },
    {
      tone: 'normal',
      label: 'Body temperature',
      short: 'temperature',
      value: '36.7',
      unit: '°C',
      meaning: 'Normal temperature.',
      time: '07:45',
      data: [36.6, 36.8, 36.7, 36.9, 36.7, 36.6, 36.7],
      min: 35.5,
      max: 38.5,
    },
    { label: 'Glucose', short: 'glucose', unit: 'mg/dL', meaning: 'Best taken before lunch.' },
    {
      tone: 'watch',
      label: 'Sleep',
      short: 'sleep',
      value: '5.4',
      unit: 'h',
      meaning: 'Under 6 h, third night.',
      action: 'Plan a rest block',
      time: '06:30',
      data: [7, 6.6, 6.8, 6.1, 5.8, 5.6, 5.4],
      min: 4,
      max: 9,
    },
  ];
}

export function readiness(alert: boolean) {
  return alert
    ? {
        tone: 'act' as Tone,
        score: 58,
        headline: 'Limited: one alert to act on',
        sub: 'Handle blood pressure first. The score updates after your re-check.',
        parts: [
          { label: 'Vitals', value: '2 ok, 3 off', tone: 'act' as Tone | undefined },
          { label: 'Sleep', value: '5.4 of 6 h', tone: 'watch' as Tone | undefined },
          { label: 'Routine', value: '4 of 7', tone: undefined },
        ],
      }
    : {
        tone: 'watch' as Tone,
        score: 82,
        headline: 'Ready, two things to watch',
        sub: 'Fit for today’s schedule. Blood pressure and sleep are a little off.',
        parts: [
          { label: 'Vitals', value: '3 ok, 1 off', tone: undefined },
          { label: 'Sleep', value: '5.4 of 6 h', tone: 'watch' as Tone | undefined },
          { label: 'Routine', value: '3 of 7', tone: undefined },
        ],
      };
}

export function attention(alert: boolean) {
  return alert
    ? [
        {
          tone: 'watch' as Tone,
          title: 'Heart rate 92 bpm',
          detail: 'Re-check after resting.',
          cta: 'Re-check',
        },
        {
          tone: 'watch' as Tone,
          title: 'Sleep 5.4 h, third short night',
          detail: 'Rest block before 14:00.',
          cta: 'Plan rest',
        },
      ]
    : [
        {
          tone: 'watch' as Tone,
          title: 'Blood pressure 134/86',
          detail: 'Sit still 5 min, re-measure.',
          cta: 'Re-measure',
        },
        {
          tone: 'watch' as Tone,
          title: 'Sleep 5.4 h, third short night',
          detail: 'Rest block before 14:00.',
          cta: 'Plan rest',
        },
      ];
}

export const DUE_TODAY = [
  { name: 'Glucose', when: 'Before lunch, 12:30' },
  { name: 'Mood check-in', when: '18:00, takes 30 seconds' },
  { name: 'Sleep log', when: 'Before rest, 21:30' },
];

// ---------- Body systems (dashboard + body view) ----------

export type FigureSystem = Extract<BodySystemId, 'mind' | 'eyes' | 'heart' | 'immune' | 'bone'>;
export const FIGURE_SYSTEMS: FigureSystem[] = ['mind', 'eyes', 'heart', 'immune', 'bone'];

export type HazardId = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment';

export const HAZARDS: { id: HazardId; name: string; line: (delay: string) => string }[] = [
  {
    id: 'radiation',
    name: 'Radiation',
    line: () =>
      'Outside Earth’s magnetic field more radiation reaches you, and it adds up over the mission.',
  },
  {
    id: 'isolation',
    name: 'Isolation and confinement',
    line: () => 'A small crew in a small space for months. It wears on sleep, mood and teamwork.',
  },
  {
    id: 'distance',
    name: 'Distance from Earth',
    line: (d) => `Messages take ${d} each way, so you handle the first steps yourself.`,
  },
  {
    id: 'gravity',
    name: 'Altered gravity',
    line: () => 'Without gravity, fluids drift up and bones and muscles carry no load.',
  },
  {
    id: 'environment',
    name: 'Closed environment',
    line: () => 'Recycled air and water, higher CO₂, constant noise and shared microbes.',
  },
];

export interface SystemDetail {
  name: string;
  tone: Tone;
  note: string;
  hazards: HazardId[];
  what: string;
  readings: { tone: Tone; label: string; value: string; unit: string; meta: string }[];
  steps: string[];
  cta: string;
  ctaHref: string;
  source: string;
}

export function systemDetails(alert: boolean, delay: string): Record<FigureSystem, SystemDetail> {
  return {
    mind: {
      name: 'Mind',
      tone: 'normal',
      note: 'mood 4 of 5',
      hazards: ['isolation', 'distance', 'environment'],
      what: 'Months in a small space far from home can wear down mood, sleep and focus. Your check-ins look steady.',
      readings: [
        {
          tone: 'normal',
          label: 'Mood check-in',
          value: '4 of 5',
          unit: '',
          meta: 'yesterday 18:04',
        },
        { tone: 'watch', label: 'Sleep', value: '5.4', unit: 'h', meta: 'third short night' },
      ],
      steps: [
        'Do your 30-second check-in at 18:00.',
        `Record a message home. With a ${delay} delay, a recording works better than a call.`,
        'Low for three days running? Tell your crew or your flight surgeon.',
      ],
      cta: 'Do mood check-in',
      ctaHref: '/log',
      source: 'Behavioral health and performance.',
    },
    eyes: {
      name: 'Eyes and vision',
      tone: 'watch',
      note: 'check due',
      hazards: ['gravity', 'environment'],
      what: 'Without gravity, fluid drifts toward your head. Over months it can press on the back of the eye and blur near vision. Your weekly check is due.',
      readings: [
        {
          tone: 'watch',
          label: 'Near-vision card check',
          value: 'Due',
          unit: '',
          meta: 'last on day 135',
        },
        {
          tone: 'normal',
          label: 'Headaches or blur',
          value: 'None',
          unit: '',
          meta: 'logged this week',
        },
      ],
      steps: [
        'Run this week’s near-vision card check.',
        'Note any new blur or headaches.',
        'Worse than last week? Flag it for your flight surgeon.',
      ],
      cta: 'Start vision check',
      ctaHref: '/routine',
      source: 'Spaceflight-associated neuro-ocular syndrome (SANS).',
    },
    heart: alert
      ? {
          name: 'Heart',
          tone: 'act',
          note: 'BP high',
          hazards: ['gravity', 'radiation'],
          what: 'Your blood pressure is high for you right now. Rest first, then measure again before doing anything else.',
          readings: [
            {
              tone: 'act',
              label: 'Blood pressure',
              value: '156/99',
              unit: 'mmHg',
              meta: 'at 09:04',
            },
            { tone: 'watch', label: 'Heart rate', value: '92', unit: 'bpm', meta: 'at 09:05' },
          ],
          steps: [
            'Stop what you’re doing and sit or float still.',
            'Re-measure when the timer ends.',
            'Still high? Flag it for your flight surgeon.',
          ],
          cta: 'Re-measure blood pressure',
          ctaHref: '/log',
          source: 'Cardiovascular adaptation.',
        }
      : {
          name: 'Heart',
          tone: 'watch',
          note: 'BP up',
          hazards: ['gravity', 'radiation'],
          what: 'Without gravity your heart works less and blood shifts toward your head. Blood pressure is a little above your range today.',
          readings: [
            {
              tone: 'watch',
              label: 'Blood pressure',
              value: '134/86',
              unit: 'mmHg',
              meta: 'at 07:42',
            },
            { tone: 'normal', label: 'Heart rate', value: '64', unit: 'bpm', meta: 'at 07:40' },
          ],
          steps: [
            'Sit still for 5 minutes, then re-measure.',
            'Skip coffee until after the re-check.',
            'Keep today’s aerobic session on the schedule.',
          ],
          cta: 'Re-measure blood pressure',
          ctaHref: '/log',
          source: 'Cardiovascular adaptation.',
        },
    immune: {
      name: 'Immune',
      tone: 'normal',
      note: 'no symptoms',
      hazards: ['radiation', 'environment', 'isolation'],
      what: 'Stress, short sleep and radiation can weaken your defences, and dormant viruses, like the one behind cold sores, can wake up. No symptoms so far.',
      readings: [
        { tone: 'normal', label: 'Temperature', value: '36.7', unit: '°C', meta: 'at 07:45' },
        { tone: 'normal', label: 'Symptoms', value: 'None', unit: '', meta: 'logged today' },
      ],
      steps: [
        'Log your temperature each morning.',
        'Report cold sores, a rash or a fever the same day.',
        'Wash or wipe your hands before meals.',
      ],
      cta: 'Log temperature',
      ctaHref: '/log',
      source: 'Immune dysregulation.',
    },
    bone: {
      name: 'Bone and muscle',
      tone: 'normal',
      note: 'on track',
      hazards: ['gravity', 'radiation'],
      what: 'With no weight on them, hips and spine can lose 1 to 1.5% of their bone each month. Daily resistance exercise slows that. You’re on track.',
      readings: [
        {
          tone: 'normal',
          label: 'Resistance exercise',
          value: '5 of 5',
          unit: '',
          meta: 'days so far this week',
        },
        {
          tone: 'normal',
          label: 'Back or joint pain',
          value: 'None',
          unit: '',
          meta: 'logged this week',
        },
      ],
      steps: [
        'Finish today’s resistance session, 45 minutes.',
        'Eat your calcium and vitamin D portions.',
        'Report new back or joint pain.',
      ],
      cta: 'Open today’s routine',
      ctaHref: '/routine',
      source: 'Bone and muscle loss.',
    },
  };
}

// ---------- Log vitals ----------

export type VitalKey = 'bp' | 'glu' | 'sleep' | 'hr' | 'spo2' | 'temp';
export type LogKey = VitalKey | 'mood';

export interface VitalDef {
  name: string;
  unit: string;
  range: string;
  due?: string;
  step: number;
  fields: { k: string; label: string; ph: string }[];
  hint: string;
  bars: {
    label: string;
    k: string;
    min: number;
    max: number;
    lo: number;
    hi: number;
    hist: (number | null)[];
  }[];
  time: string;
}

export const VITALS: Record<VitalKey, VitalDef> = {
  bp: {
    name: 'Blood pressure',
    unit: 'mmHg',
    range: 'under 130/85',
    due: 'Re-measure now · last 134/86',
    step: 1,
    fields: [
      { k: 'sys', label: 'Top number', ph: '120' },
      { k: 'dia', label: 'Bottom number', ph: '80' },
    ],
    hint: 'Hook your feet in the loops, strap the cuff arm at heart level and stay still for 5 minutes first.',
    bars: [
      {
        label: 'Top number',
        k: 'sys',
        min: 90,
        max: 170,
        lo: 100,
        hi: 130,
        hist: [118, 121, 120, 124, 122, 126, 134],
      },
      {
        label: 'Bottom number',
        k: 'dia',
        min: 50,
        max: 110,
        lo: 60,
        hi: 85,
        hist: [76, 78, 77, 80, 79, 82, 86],
      },
    ],
    time: '07:42',
  },
  glu: {
    name: 'Glucose',
    unit: 'mg/dL',
    range: '70–99 before meals',
    due: 'Before lunch, 12:30',
    step: 1,
    fields: [{ k: 'glu', label: 'Glucose, before a meal', ph: '90' }],
    hint: 'Blood won’t drip in microgravity, it beads and clings. Touch the strip to the drop, then bag the lancet straight away.',
    bars: [
      {
        label: 'Before-meal glucose, mg/dL',
        k: 'glu',
        min: 50,
        max: 200,
        lo: 70,
        hi: 99,
        hist: [null, 92, null, 88, null, 104, null],
      },
    ],
    time: '12:34',
  },
  sleep: {
    name: 'Sleep',
    unit: 'h',
    range: '6–9 h',
    due: 'Before rest, 21:30',
    step: 0.25,
    fields: [{ k: 'sleep', label: 'Hours slept', ph: '7' }],
    hint: 'Count from when you zipped into the sleeping bag to when you woke. Leave out time awake in the night.',
    bars: [
      {
        label: 'Hours slept',
        k: 'sleep',
        min: 3,
        max: 10,
        lo: 6,
        hi: 9,
        hist: [7, 6.6, 6.8, 6.1, 5.8, 5.6, 5.4],
      },
    ],
    time: '06:30',
  },
  hr: {
    name: 'Heart rate',
    unit: 'bpm',
    range: '50–90',
    step: 1,
    fields: [{ k: 'hr', label: 'Resting beats per minute', ph: '64' }],
    hint: 'Float still with your feet in the loops for 5 minutes. Rest the finger sensor; don’t grip a handrail.',
    bars: [
      {
        label: 'Beats per minute',
        k: 'hr',
        min: 40,
        max: 120,
        lo: 50,
        hi: 90,
        hist: [62, 66, 63, 65, 61, 64, 64],
      },
    ],
    time: '07:40',
  },
  spo2: {
    name: 'Blood oxygen',
    unit: '%',
    range: '95–100%',
    step: 1,
    fields: [{ k: 'spo2', label: 'Oxygen saturation', ph: '98' }],
    hint: 'Warm your hands first: cold fingers read low. Keep the clip hand relaxed and still, not drifting.',
    bars: [
      {
        label: 'Oxygen, %',
        k: 'spo2',
        min: 88,
        max: 100,
        lo: 95,
        hi: 100,
        hist: [98, 97, 98, 98, 97, 98, 98],
      },
    ],
    time: '07:44',
  },
  temp: {
    name: 'Body temperature',
    unit: '°C',
    range: '36.1–37.2 °C',
    step: 0.1,
    fields: [{ k: 'temp', label: 'Temperature', ph: '36.7' }],
    hint: 'Measure in the ear, away from the air vents. Wait 15 minutes after eating, drinking or exercise.',
    bars: [
      {
        label: 'Temperature, °C',
        k: 'temp',
        min: 35.5,
        max: 38.5,
        lo: 36.1,
        hi: 37.2,
        hist: [36.6, 36.8, 36.7, 36.9, 36.7, 36.6, 36.7],
      },
    ],
    time: '07:45',
  },
};

/** Already logged this morning (matches the dashboard). */
export const PRE_LOGGED: Partial<Record<VitalKey, { vals: Record<string, string>; time: string }>> =
  {
    hr: { vals: { hr: '64' }, time: '07:40' },
    spo2: { vals: { spo2: '98' }, time: '07:44' },
    temp: { vals: { temp: '36.7' }, time: '07:45' },
  };

export const DUE_KEYS: LogKey[] = ['bp', 'glu', 'mood', 'sleep'];
export const DONE_BASE: VitalKey[] = ['hr', 'spo2', 'temp'];

export type EvalResult =
  | { ok: false; err?: string }
  | {
      ok: true;
      tone: Tone;
      value: string;
      meaning: string;
      action: string;
      timer: number;
      recheck: boolean;
    };

/** Mock thresholds from the design (the real ones come from getStatus + content.json). */
export function evalVital(k: VitalKey, v: Record<string, string | undefined>): EvalResult {
  const num = (x?: string) => (x == null || x === '' || isNaN(Number(x)) ? null : Number(x));
  const R = (
    tone: Tone,
    value: string,
    meaning: string,
    action: string,
    timer = 0,
    recheck = false,
  ): EvalResult => ({ ok: true, tone, value, meaning, action, timer, recheck });
  const DONE = 'Nothing to do. Next check tomorrow morning.';

  if (k === 'bp') {
    const a = num(v.sys);
    const b = num(v.dia);
    if (a == null || b == null) return { ok: false };
    if (a < 60 || a > 260 || b < 30 || b > 160 || b >= a)
      return {
        ok: false,
        err: 'Check the numbers: the top is usually 90–180 and always higher than the bottom.',
      };
    const val = `${a}/${b}`;
    if (a >= 150 || b >= 95)
      return R(
        'act',
        val,
        'High for you.',
        'Stop and rest, then re-measure in 15 minutes. Still high? Flag it for your flight surgeon.',
        15,
      );
    if (a < 90)
      return R(
        'watch',
        val,
        'Lower than usual for you. Move slowly when you change position.',
        'Drink water and re-check in an hour.',
        0,
        true,
      );
    if (a >= 130 || b >= 85)
      return R(
        'watch',
        val,
        'A little above your range of under 130/85. Activity or caffeine can do this.',
        'Sit or float still for 5 minutes, then re-measure.',
        5,
      );
    return R('normal', val, 'In your range of under 130/85.', DONE);
  }
  if (k === 'hr') {
    const a = num(v.hr);
    if (a == null) return { ok: false };
    if (a < 25 || a > 250)
      return { ok: false, err: 'Check the number: a resting heart rate is usually 40–120.' };
    if (a >= 120 || a < 40)
      return R(
        'act',
        String(a),
        'Far outside your range of 50–90.',
        'Stop and rest. Re-check in 15 minutes. Still out of range? Flag it for your flight surgeon.',
        15,
      );
    if (a > 90)
      return R(
        'watch',
        String(a),
        'Higher than your range of 50–90.',
        'Rest for 5 minutes, then re-check.',
        5,
      );
    if (a < 50)
      return R(
        'watch',
        String(a),
        'Lower than your range of 50–90. Fine if you feel well.',
        'Re-check later. Dizzy or faint? Tell your crew.',
        0,
        true,
      );
    return R('normal', String(a), 'Resting rate in your range of 50–90.', DONE);
  }
  if (k === 'spo2') {
    const a = num(v.spo2);
    if (a == null) return { ok: false };
    if (a < 50 || a > 100)
      return { ok: false, err: 'Check the number: oxygen saturation can’t be over 100%.' };
    if (a < 92)
      return R(
        'act',
        String(a),
        'Low oxygen.',
        'Re-check now. Still under 92? Alert your crew: it could be you or the cabin air.',
        0,
        true,
      );
    if (a < 95)
      return R(
        'watch',
        String(a),
        'A little low. Cold hands or movement can do this.',
        'Warm your hands and re-check now.',
        0,
        true,
      );
    return R('normal', String(a), 'Oxygen level is healthy.', DONE);
  }
  if (k === 'temp') {
    const a = num(v.temp);
    if (a == null) return { ok: false };
    if (a < 30 || a > 45)
      return { ok: false, err: 'Check the number: body temperature is usually 35–40 °C.' };
    const t = a.toFixed(1);
    if (a >= 38)
      return R(
        'act',
        t,
        'You have a fever.',
        'Rest, drink water and flag it for your flight surgeon today.',
      );
    if (a < 35.5)
      return R(
        'act',
        t,
        'Very low for you.',
        'Re-check in the ear. Still low? Warm up and tell your crew.',
        0,
        true,
      );
    if (a >= 37.3)
      return R(
        'watch',
        t,
        'Slightly raised.',
        'Drink water, rest, and re-check in 2 hours. Note any other symptoms.',
      );
    if (a < 36.1)
      return R(
        'watch',
        t,
        'A little low. Cabin airflow can cool the sensor.',
        'Re-check away from the air vents.',
        0,
        true,
      );
    return R('normal', t, 'Normal temperature.', DONE);
  }
  if (k === 'glu') {
    const a = num(v.glu);
    if (a == null) return { ok: false };
    if (a < 20 || a > 600)
      return { ok: false, err: 'Check the number: before a meal it’s usually 60–200 mg/dL.' };
    if (a < 54)
      return R(
        'act',
        String(a),
        'Low blood sugar.',
        'Take 15 g of fast sugar now and re-check in 15 minutes.',
        15,
      );
    if (a >= 180)
      return R(
        'act',
        String(a),
        'High for you.',
        'Re-check in 15 minutes. Still high? Flag it for your flight surgeon.',
        15,
      );
    if (a < 70)
      return R(
        'watch',
        String(a),
        'A little low.',
        'Have a snack with your next meal. Re-check if you feel shaky.',
      );
    if (a >= 100)
      return R(
        'watch',
        String(a),
        'Above your before-meal range of 70–99.',
        'Re-check before your next meal.',
      );
    return R(
      'normal',
      String(a),
      'In your before-meal range of 70–99.',
      'Nothing to do. Next check tomorrow before lunch.',
    );
  }
  const a = num(v.sleep);
  if (a == null) return { ok: false };
  if (a < 0 || a > 16) return { ok: false, err: 'Check the number: hours slept, from 0 to 16.' };
  const t = String(Math.round(a * 10) / 10);
  if (a < 4.5)
    return R(
      'act',
      t,
      'Very short sleep.',
      'Take a rest block now and hold off on hazardous tasks until you’ve rested. Tell your crew.',
    );
  if (a < 6)
    return R(
      'watch',
      t,
      'Under 6 h.',
      'Plan a rest block before 14:00 and keep tonight’s lights-out time.',
    );
  return R('normal', t, 'Enough rest.', 'Nothing to do. Keep the same lights-out time.');
}

export const MOOD_WORDS = ['Very low', 'Low', 'Okay', 'Good', 'Very good'];
export const MOOD_TAGS: [string, string][] = [
  ['tired', 'Tired'],
  ['stressed', 'Stressed'],
  ['homesick', 'Homesick'],
  ['bored', 'Bored'],
  ['crew', 'Crew friction'],
  ['pain', 'Aches or pain'],
];
export const MOOD_HISTORY = {
  values: [3, 4, 4, 2, 3, 4, 4],
  days: [135, 136, 137, 138, 139, 140, 141],
};

// ---------- Trends ----------

export type TrendKey = 'bp' | 'hr' | 'sleep' | 'spo2' | 'temp' | 'glu';

/** 90 days of mock readings (days 53–142); the last week matches Dashboard and Log. */
function makeTrendData() {
  let seed = 1427;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const noise = (a: number) => (rnd() + rnd() + rnd() - 1.5) * a;
  const days: number[] = [];
  for (let d = 53; d <= 142; d++) days.push(d);
  const fill = (
    base: number,
    amp: number,
    dec: boolean,
    last: number[],
    fixes: Record<number, number>,
  ) =>
    days.map((d, i) => {
      if (fixes[d] !== undefined) return fixes[d];
      if (i >= 83) return last[i - 83];
      const v = base + noise(amp);
      return dec ? Math.round(v * 10) / 10 : Math.round(v);
    });
  const gluLast: Record<number, number | null> = {
    136: null,
    137: 92,
    138: null,
    139: 88,
    140: null,
    141: 104,
    142: null,
  };
  return {
    days,
    hr: fill(64, 4, false, [62, 66, 63, 65, 61, 64, 64], { 120: 96 }),
    sys: fill(119, 5, false, [118, 121, 120, 124, 122, 126, 134], { 104: 132 }),
    dia: fill(77, 3.5, false, [76, 78, 77, 80, 79, 82, 86], { 104: 84 }),
    spo2: days.map((d, i) =>
      d === 110
        ? 94
        : i >= 83
          ? [98, 97, 98, 98, 97, 98, 98][i - 83]
          : Math.min(100, Math.max(96, Math.round(97.6 + noise(1.2)))),
    ),
    temp: fill(36.7, 0.25, true, [36.6, 36.8, 36.7, 36.9, 36.7, 36.6, 36.7], {
      88: 37.4,
      89: 36.8,
    }),
    glu: days.map((d): number | null => {
      if (d in gluLast) return gluLast[d];
      if (d === 115) return 104;
      if (d % 3 !== 0) return null;
      return Math.round(88 + noise(7));
    }),
    sleep: fill(6.9, 0.6, true, [7, 6.6, 6.8, 6.1, 5.8, 5.6, 5.4], { 95: 5.6, 96: 5.2, 97: 5.8 }),
  };
}

export const TREND_DATA = makeTrendData();

export interface TrendDef {
  name: string;
  short: string;
  unit: string;
  min: number;
  max: number;
  ranges: [number, number][];
  series: (number | null)[][];
  status: (...v: number[]) => Tone;
  fmt: (...v: number[]) => string;
}

export const TRENDS: Record<TrendKey, TrendDef> = {
  hr: {
    name: 'Heart rate',
    short: 'heart rate',
    unit: 'bpm',
    min: 40,
    max: 110,
    ranges: [[50, 90]],
    series: [TREND_DATA.hr],
    status: (v) => (v >= 120 || v < 40 ? 'act' : v > 90 || v < 50 ? 'watch' : 'normal'),
    fmt: (v) => String(v),
  },
  bp: {
    name: 'Blood pressure',
    short: 'blood pressure',
    unit: 'mmHg',
    min: 50,
    max: 165,
    ranges: [
      [100, 130],
      [60, 85],
    ],
    series: [TREND_DATA.sys, TREND_DATA.dia],
    status: (s, d) =>
      s >= 150 || d >= 95 ? 'act' : s >= 130 || d >= 85 || s < 90 ? 'watch' : 'normal',
    fmt: (s, d) => `${s}/${d}`,
  },
  spo2: {
    name: 'Blood oxygen',
    short: 'SpO₂',
    unit: '%',
    min: 88,
    max: 100,
    ranges: [[95, 100]],
    series: [TREND_DATA.spo2],
    status: (v) => (v < 92 ? 'act' : v < 95 ? 'watch' : 'normal'),
    fmt: (v) => String(v),
  },
  temp: {
    name: 'Temperature',
    short: 'temperature',
    unit: '°C',
    min: 35.5,
    max: 38.5,
    ranges: [[36.1, 37.2]],
    series: [TREND_DATA.temp],
    status: (v) => (v >= 38 || v < 35.5 ? 'act' : v >= 37.3 || v < 36.1 ? 'watch' : 'normal'),
    fmt: (v) => v.toFixed(1),
  },
  glu: {
    name: 'Glucose',
    short: 'glucose',
    unit: 'mg/dL',
    min: 50,
    max: 160,
    ranges: [[70, 99]],
    series: [TREND_DATA.glu],
    status: (v) => (v < 54 || v >= 180 ? 'act' : v < 70 || v >= 100 ? 'watch' : 'normal'),
    fmt: (v) => String(v),
  },
  sleep: {
    name: 'Sleep',
    short: 'sleep',
    unit: 'h',
    min: 3,
    max: 10,
    ranges: [[6, 9]],
    series: [TREND_DATA.sleep],
    status: (v) => (v < 4.5 ? 'act' : v < 6 ? 'watch' : 'normal'),
    fmt: (v) => String(v),
  },
};

export const TREND_KEYS: TrendKey[] = ['bp', 'hr', 'sleep', 'spo2', 'temp', 'glu'];

/** "What changed" notes per range (glucose text is filled in by the page). */
export const TREND_NOTES: Record<number, [Tone, TrendKey, string, string][]> = {
  7: [
    [
      'watch',
      'bp',
      'Blood pressure is rising',
      'Up most days this week and just over your range today.',
    ],
    [
      'watch',
      'sleep',
      'Three short nights in a row',
      'Short sleep can push blood pressure up. A rest block today helps.',
    ],
    ['normal', 'spo2', 'Oxygen steady', 'Every reading 97–98%.'],
  ],
  30: [
    [
      'watch',
      'bp',
      'Blood pressure is creeping up',
      'Rising this week and just over your range today. Day 104 was the last time it was high.',
    ],
    [
      'watch',
      'sleep',
      'Three short nights in a row',
      'Short sleep can push blood pressure up. A rest block today helps.',
    ],
    ['normal', 'hr', 'Heart rate steady', 'One spike on day 120, after a hard exercise session.'],
    ['normal', 'glu', 'Glucose mostly in range', ''],
  ],
  90: [
    [
      'watch',
      'bp',
      'Blood pressure is creeping up',
      'Two high readings in 90 days: day 104 and today.',
    ],
    [
      'watch',
      'sleep',
      'Short nights came in two runs',
      'Days 95–97 and again this week. Both followed busy schedules.',
    ],
    ['normal', 'temp', 'Temperature normal', 'One mild rise on day 88, gone the next morning.'],
    ['normal', 'hr', 'Heart rate steady', 'One spike on day 120, after a hard exercise session.'],
  ],
};

// ---------- Routine ----------

export interface RoutineItem {
  id: string;
  time: string;
  title: string;
  short?: string;
  why: string;
  cat: string;
  dur: string;
  flag?: Tone;
  flagText?: string;
}

export const DAILY: RoutineItem[] = [
  {
    id: 'sleeplog',
    time: '06:30',
    title: 'Sleep log',
    why: '5.4 h logged. Third short night in a row.',
    cat: 'Sleep',
    dur: '1 min',
  },
  {
    id: 'water',
    time: '07:00',
    title: 'Morning water, 500 ml',
    why: 'Your body sheds fluid early in flight. Drink to your daily target.',
    cat: 'Fluids',
    dur: '',
  },
  {
    id: 'vitals',
    time: '07:40',
    title: 'Morning vitals',
    why: 'Heart rate, blood pressure, oxygen and temperature.',
    cat: 'Vitals',
    dur: '5 min',
  },
  {
    id: 'resist',
    time: '09:30',
    title: 'Resistance exercise',
    short: 'resistance session',
    why: 'Squats, deadlifts and heel raises load your hips and spine to protect bone.',
    cat: 'Exercise',
    dur: '45 min',
  },
  {
    id: 'glucose',
    time: '12:30',
    title: 'Glucose before lunch',
    short: 'glucose check',
    why: 'One finger-stick before you eat.',
    cat: 'Vitals',
    dur: '2 min',
  },
  {
    id: 'aerobic',
    time: '15:30',
    title: 'Aerobic exercise',
    short: 'aerobic session',
    why: 'Cycle or treadmill. Keeps your heart and lungs ready for landing.',
    cat: 'Exercise',
    dur: '30 min',
  },
  {
    id: 'mood',
    time: '18:00',
    title: 'Mood check-in',
    short: 'mood check-in',
    why: 'One number and optional notes. Private to you and your surgeon.',
    cat: 'Mind',
    dur: '30 s',
  },
];

export const extraRoutine = (delay: string): RoutineItem[] => [
  {
    id: 'rest',
    time: '13:00',
    title: 'Rest block',
    why: 'Added today after three short nights.',
    cat: 'Sleep',
    dur: '30 min',
    flag: 'watch',
    flagText: 'Added',
  },
  {
    id: 'message',
    time: '19:30',
    title: 'Record a message home',
    why: `With a ${delay} delay, a recording works better than a call.`,
    cat: 'Mind',
    dur: '',
  },
  {
    id: 'vision',
    time: '21:00',
    title: 'Near-vision card check',
    why: 'Weekly. Last done on day 135.',
    cat: 'Eyes',
    dur: '5 min',
    flag: 'watch',
    flagText: 'Due',
  },
];

export const INITIAL_DONE: Record<string, string> = {
  sleeplog: '06:32',
  water: '07:05',
  vitals: '07:45',
};

/** Last 14 days, oldest first. 1 = done, 0 = missed, 2 = today (filled by the page). */
export const STREAKS = [
  { name: 'Morning vitals', n: 18, best: 31, past: Array<number>(13).fill(1), today: ['vitals'] },
  {
    name: 'Exercise, both sessions',
    n: 42,
    best: 42,
    past: Array<number>(13).fill(1),
    today: ['resist', 'aerobic'],
  },
  {
    name: 'Mood check-in',
    n: 9,
    best: 27,
    past: [1, 1, 1, 0, ...Array<number>(9).fill(1)],
    today: ['mood'],
  },
  {
    name: 'Sleep, 6 h or more',
    n: 0,
    best: 23,
    past: [...Array<number>(10).fill(1), 0, 0, 0],
    today: [],
  },
];

export const WEEK: [string, number | null][] = [
  ['Mon', 7],
  ['Tue', 7],
  ['Wed', 6],
  ['Thu', 7],
  ['Fri', 7],
  ['Sat', null], // today: filled with done count
  ['Sun', 0],
];

export const PATCHES: {
  name: string;
  state: string;
  have?: number;
  need?: number;
  motif: string;
}[] = [
  {
    name: 'Day 100',
    state: 'Earned day 100',
    motif:
      'M30 44a14 14 0 1 0 28 0a14 14 0 1 0 -28 0M20 52c10 4 38-6 48-18M61.5 30a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0',
  },
  {
    name: 'Six-week mover',
    state: 'Earned day 141',
    motif: 'M30 54l14-11 14 11M30 41l14-11 14 11',
  },
  { name: 'Clean sweep', state: 'Earned day 126', motif: ringOfSeven() },
  {
    name: 'Steady eyes',
    state: '6 of 8 weekly checks',
    have: 6,
    need: 8,
    motif: 'M22 44q22-20 44 0q-22 20-44 0zM39 44a5 5 0 1 0 10 0a5 5 0 1 0 -10 0',
  },
  {
    name: 'Day 200',
    state: 'Day 142 of 200',
    have: 142,
    need: 200,
    motif: 'M44 28v32M28 44h32M34 34l20 20M54 34L34 54',
  },
  {
    name: 'Sleep reset',
    state: '0 of 7 nights over 6 h',
    have: 0,
    need: 7,
    motif: 'M50 28a16 16 0 1 0 8 26a12 12 0 1 1 -8 -26z',
  },
];

function ringOfSeven() {
  const dot = (x: number, y: number, r: number) =>
    `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  return [0, 1, 2, 3, 4, 5, 6]
    .map((i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
      return dot(+(44 + 16 * Math.cos(a)).toFixed(1), +(44 + 16 * Math.sin(a)).toFixed(1), 3);
    })
    .join('');
}
