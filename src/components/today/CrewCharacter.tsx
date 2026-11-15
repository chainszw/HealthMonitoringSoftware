import { Suspense, type ReactNode } from 'react';
import { LazyAnatomyStage } from '../anatomy/lazy';
import { Link } from 'react-router';
import type { FigureSystem } from '../figure';
import { FigureArt } from '../FigureArt';
import { IconChevronRight } from '../icons';
import { TONE, type Tone } from '../tone';

// Owner B: Today's live crew character: the 3D anatomy model (HRA atlas, public/models), slowly
// turning, with organs tinted by their system's status. The animated 2D figure shows while the
// model loads. Pass `model` to put something else on the stage.

export interface CharacterView {
  /** Signed-in crew member's name, if any. */
  name?: string;
  /** Status tone per figure system (null = no current reading). */
  tones: Partial<Record<FigureSystem, Tone | null>>;
  /** Latest heart rate as shown on the vitals card, e.g. "73". */
  heartRate?: string;
  beatSeconds?: number;
  flagged: number;
  /** organ id → status colour for the 3D model. */
  tint?: Record<string, string>;
}

const NEUTRAL_ZONE = '#1f6f8b';

export function CrewCharacter({ view, model }: { view: CharacterView; model?: ReactNode }) {
  const zoneFill = (id: FigureSystem) => {
    const t = view.tones[id];
    return !t || t === 'normal' ? NEUTRAL_ZONE : TONE[t].hex;
  };
  const beat = view.beatSeconds ?? 0.85;
  const summary = view.flagged
    ? `${view.flagged} ${view.flagged === 1 ? 'system' : 'systems'} to watch`
    : 'All systems in range';

  return (
    <section
      aria-labelledby="char-h"
      className="relative flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-[20px] border border-line bg-surface p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] xl:min-h-0"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="char-h" className="m-0 text-lg font-medium tracking-[-0.01em]">
          {view.name ?? 'Crew member'}
        </h2>
        <span className="inline-flex items-center gap-1.5 font-mono text-[13px] text-muted">
          <span className="relative inline-flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          Live
        </span>
      </div>

      {/* Stage: the 3D model slot */}
      <div
        data-slot="3d-character"
        className="relative my-2 min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-sunk"
      >
        {/* Faint holo grid */}
        <div
          aria-hidden="true"
          className="chc-holo-grid pointer-events-none absolute inset-0 opacity-50"
        />
        {model ?? (
          <>
            <Suspense
              fallback={
                <FigureArt
                  zoneFill={zoneFill}
                  beatSeconds={view.beatSeconds}
                  label={`Animated crew figure. ${summary}.`}
                  className="absolute inset-x-0 top-[4%] bottom-[2%] mx-auto h-[94%] w-full"
                />
              }
            >
              <LazyAnatomyStage
                autoRotate
                interactive={false}
                tint={view.tint}
                className="absolute inset-0"
              />
            </Suspense>
            {/* Scan line sweeping the body */}
            <div
              aria-hidden="true"
              className="chc-fig-scan pointer-events-none absolute inset-x-[14%] h-0.5 bg-accent shadow-[0_0_10px_rgba(41,240,255,0.8),0_6px_0_rgba(255,47,208,0.45)]"
            />
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-raised px-2.5 text-[14px]">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
            className="chc-fig-beat text-act"
            style={{ ['--beat' as string]: `${beat}s` }}
          >
            <path
              fill="currentColor"
              d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.4 3.3 5 6.7 5c2 0 3.4 1.1 4.3 2.4h2C13.9 6.1 15.3 5 17.3 5c3.4 0 5.5 3.4 4.2 6.7C19.5 16.4 12 21 12 21z"
            />
          </svg>
          <span className="font-mono font-medium text-ink">{view.heartRate ?? '--'}</span>
          <span className="text-muted">bpm</span>
        </span>
        <Link
          to="/body"
          className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[14px] text-accent no-underline transition-colors hover:bg-hover"
        >
          {summary}
          <IconChevronRight size={16} />
        </Link>
      </div>
    </section>
  );
}
