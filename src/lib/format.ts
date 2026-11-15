import type { Indicator } from './types';

// Display formatting shared by the screens. Pure; no guidance text here.

const decimalsOf = (step: number) => {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
};

/**
 * A value at the indicator's input precision: whole numbers stay whole, temperature keeps one
 * decimal ("37.0"), finer steps drop trailing zeros (sleep 7 → "7", 6.25 → "6.25").
 */
export function formatValue(
  indicator: Pick<Indicator, 'input'> | undefined,
  value: number,
): string {
  const d = indicator ? decimalsOf(indicator.input.step) : 1;
  const text = value.toFixed(d);
  return d > 1 ? String(Number(text)) : text;
}

/** The first green band as [low, high]. An open end falls back to the input limit. */
export function greenBand(indicator: Indicator): [number, number] {
  const g = indicator.ranges.green[0] ?? {};
  return [g.min ?? indicator.input.min, g.max ?? indicator.input.max];
}

/**
 * The green band for people: "60–100". Bands are max-exclusive, so whole-number indicators
 * show max − 1 (60–101 → 60–100); an open top shows the input limit (SpO2 96–100).
 */
export function formatRange(indicator: Indicator): string {
  const g = indicator.ranges.green[0] ?? {};
  const [lo, hi] = greenBand(indicator);
  const top = g.max !== undefined && indicator.input.step === 1 ? hi - 1 : hi;
  return `${formatValue(indicator, lo)}–${formatValue(indicator, top)}`;
}

/** One-way comms delay for the header: "<1 s", "1.3 s", "22 min". */
export function formatDelay(seconds: number): string {
  if (seconds < 1) return '<1 s';
  if (seconds < 60) return `${Number(seconds.toFixed(1))} s`;
  return `${Math.round(seconds / 60)} min`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "07:42" in local time. */
export function formatClock(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const startOfDay = (d: Date) => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
};

/** "07:42" today, "yesterday 07:42", else "Nov 12, 07:42". */
export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (days === 0) return formatClock(d);
  if (days === 1) return `yesterday ${formatClock(d)}`;
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${date}, ${formatClock(d)}`;
}
