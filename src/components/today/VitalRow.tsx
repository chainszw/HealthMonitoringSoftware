import { Link } from 'react-router';
import { TONE } from '../tone';
import { StatusPill } from '../ui';
import { NeonChart } from './NeonChart';
import type { VitalTile } from './VitalCard';

// Owner B: one vital on Today as a card row: name and status, the big number, then a flowing
// chart across the rest of the row. Normal values stay neutral; only Watch/Act colour the card.

export function VitalRow({ t, tickAt, live }: { t: VitalTile; tickAt?: number; live?: boolean }) {
  const tone = t.tone ?? 'normal';
  const color = TONE[tone].line;
  const card = `rounded-2xl border bg-surface/85 px-4 backdrop-blur-sm ${tone === 'act' ? 'border-act-l' : tone === 'watch' ? 'border-watch/45' : 'border-line'}`;
  if (!t.value) {
    return (
      <div className="grid min-h-[64px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-dashed border-line-2 bg-surface/60 px-4 py-2 xl:min-h-0 xl:flex-1">
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-medium text-ink">{t.label}</span>
          <span className="text-[14px] text-faint">Not logged yet</span>
        </span>
        <Link
          to={t.href}
          className="text-[14px] font-medium text-accent no-underline hover:underline"
        >
          Log {t.short} →
        </Link>
      </div>
    );
  }
  return (
    <article
      aria-label={`${t.label} ${t.value} ${t.unit}, ${TONE[tone].label}${t.time ? `, at ${t.time}` : ''}. ${t.meaning}`}
      className={`${card} grid min-h-[84px] grid-cols-[minmax(0,150px)_minmax(0,1fr)] items-center gap-x-4 py-2 sm:grid-cols-[minmax(0,160px)_minmax(150px,auto)_minmax(0,1fr)] xl:min-h-0 xl:flex-1`}
    >
      <div className="flex min-w-0 flex-col items-start gap-1">
        <span className="truncate text-[15px] font-medium text-ink">{t.label}</span>
        <StatusPill tone={tone} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="flex items-baseline gap-1.5">
          <span
            aria-live={live ? 'off' : undefined}
            className="font-mono text-[clamp(30px,2.8vw,50px)] leading-none font-medium tracking-[-0.04em] text-ink tabular-nums"
          >
            {t.value}
          </span>
          <span className="font-mono text-[13px] text-muted">{t.unit}</span>
        </span>
        <span className="truncate text-[13px] text-muted" title={t.meaning}>
          {live ? (
            <span className="inline-flex items-center gap-1 text-accent">
              <span className="size-1.5 animate-chc-pulse rounded-full bg-accent" />
              live
            </span>
          ) : (
            <span className="font-mono">{t.time}</span>
          )}{' '}
          · <span className={tone === 'normal' ? undefined : TONE[tone].text}>{t.meaning}</span>
        </span>
      </div>
      <div className="col-span-2 h-[54px] min-w-0 sm:col-span-1 sm:h-full sm:max-h-[96px] sm:min-h-[44px]">
        <NeonChart
          data={t.data ?? []}
          min={t.min ?? 0}
          max={t.max ?? 1}
          band={t.band}
          color={color}
          tickAt={tickAt}
          label={`${t.label} ${live ? 'live stream' : 'last 7 days'}`}
        />
      </div>
    </article>
  );
}
