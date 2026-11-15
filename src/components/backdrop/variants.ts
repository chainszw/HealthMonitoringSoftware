/** Background variants (switch in the dev panel, or with `?bg=`). */
export type BackdropVariant = 'sky' | 'grid' | 'aurora';

export const BACKDROP_LABELS: Record<BackdropVariant, string> = {
  sky: 'Mission sky',
  grid: 'Grid',
  aurora: 'Aurora',
};

export const BACKDROP_VARIANTS = Object.keys(BACKDROP_LABELS) as BackdropVariant[];

const isBackdrop = (v: unknown): v is BackdropVariant => BACKDROP_VARIANTS.some((b) => b === v);

/** `?bg=` wins, then the saved dev setting, then 'sky'. */
export function initialBackdrop(search: string, saved: string | undefined): BackdropVariant {
  const fromUrl = new URLSearchParams(search).get('bg');
  if (isBackdrop(fromUrl)) return fromUrl;
  return isBackdrop(saved) ? saved : 'sky';
}
