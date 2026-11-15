import type { readiness } from '../../pages/designMock';
import { IconInfo } from '../icons';
import { TONE } from '../tone';
import { StatusPill } from '../ui';

// Owner B: compact mission readiness. The ring is neutral; status is carried by the pill (icon + word).

type Readiness = ReturnType<typeof readiness>;

export function ReadinessSummary({ ready }: { ready: Readiness }) {
  return (
    <section
      aria-labelledby="ready-h"
      className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4"
    >
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative h-[84px] w-[152px] shrink-0">
          <svg
            viewBox="0 0 152 84"
            className="size-full"
            role="img"
            aria-label={`Readiness ${ready.score} out of 100`}
          >
            <path
              d="M 11 76 A 65 65 0 0 1 141 76"
              fill="none"
              stroke="#1a2131"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <path
              d="M 11 76 A 65 65 0 0 1 141 76"
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="9"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${ready.score} 100`}
            />
          </svg>
          <span className="absolute inset-x-0 bottom-0 flex justify-center font-mono text-[34px] leading-9 font-medium text-ink tabular-nums">
            {ready.score}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <h2 id="ready-h" className="m-0 text-base font-medium text-text">
            Overall Score
          </h2>
          <span
            tabIndex={0}
            title={ready.sub}
            aria-label={ready.sub}
            className="inline-flex cursor-help text-muted hover:text-ink"
          >
            <IconInfo size={16} />
          </span>
        </div>
        <span className="group relative inline-flex" tabIndex={0} aria-label={ready.headline}>
          <StatusPill tone={ready.tone} />
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg border border-line-2 bg-raised px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-ink opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100"
          >
            {ready.headline}
          </span>
        </span>
      </div>
      <dl className="m-0 grid grid-cols-3 gap-2 border-t border-line pt-3">
        {ready.parts.map((p) => (
          <div key={p.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-[13px] text-muted">{p.label}</dt>
            <dd
              className={`m-0 truncate font-mono text-sm font-medium tabular-nums ${p.tone ? TONE[p.tone].text : 'text-ink'}`}
            >
              {p.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
