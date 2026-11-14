// Owner B: status tones from the design. Status is always shape + word + colour.
// Normal stays neutral (badge only); Act now also colours the card border.
// SVG needs literal colours, so hexes are kept here in sync with index.css.

export type Tone = 'normal' | 'watch' | 'act';

export const TONE: Record<
  Tone,
  { label: string; hex: string; text: string; bg: string; border: string; line: string }
> = {
  normal: {
    label: 'Normal',
    hex: '#4ade9b',
    text: 'text-ok',
    bg: 'bg-ok-t',
    border: 'border-line',
    line: 'rgba(233,237,243,0.55)',
  },
  watch: {
    label: 'Watch',
    hex: '#fbbf4a',
    text: 'text-watch',
    bg: 'bg-watch-t',
    border: 'border-line',
    line: '#fbbf4a',
  },
  act: {
    label: 'Act now',
    hex: '#ff8a8a',
    text: 'text-act',
    bg: 'bg-act-t',
    border: 'border-act-l',
    line: '#ff8a8a',
  },
};

/** Shared button looks. */
export const BTN = {
  base: 'inline-flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-medium transition-[transform,filter] duration-150 ease-out-soft hover:-translate-y-px hover:brightness-110 active:translate-y-px active:scale-[0.985] disabled:pointer-events-none',
  primary: 'bg-accent text-accent-ink',
  secondary: 'border border-line-2 bg-raised text-ink',
  ghost: 'border border-line-2 bg-transparent text-ink',
} as const;

export const btn = (kind: keyof Omit<typeof BTN, 'base'> = 'secondary', extra = '') =>
  `${BTN.base} ${BTN[kind]} ${extra}`;

/** A selectable list row (system list, today's list, what changed). */
export const ROW =
  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-hover aria-pressed:bg-raised';
