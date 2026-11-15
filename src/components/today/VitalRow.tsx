import { Link } from 'react-router';
import { TONE } from '../tone';
import { StatusPill } from '../ui';
import { NeonChart } from './NeonChart';
import type { VitalTile } from './VitalCard';

// Owner B: one vital on Today as a card tile (3×2 grid): name and status on top, the big number
// and what it means, then a flowing chart filling the rest. Normal values stay neutral; only
// Watch/Act colour the card border and the meaning text.

export function VitalRow({ t, tickAt, live }: { t: VitalTile; tickAt?: number; live?: boolean }) {
  const tone = t.tone ?? 'normal';
  const color = TONE[tone].line;
  if (!t.value) {
    return (
      <div className="flex min-h-[180px] min-w-0 flex-col justify-between gap-3 rounded-2xl border border-dashed border-line-2 bg-surface/60 p-4 xl:min-h-0">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[16px] font-medium text-ink">{t.label}</span>
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
      className={`flex min-h-[220px] min-w-0 flex-col gap-1.5 rounded-2xl border bg-surface/85 p-4 backdrop-blur-sm xl:min-h-0 ${tone === 'act' ? 'border-act-l' : tone === 'watch' ? 'border-watch/45' : 'border-line'}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-[16px] font-medium text-ink">{t.label}</span>
        <StatusPill tone={tone} />
      </div>
      <span className="flex items-baseline gap-1.5">
        <span
          aria-live={live ? 'off' : undefined}
          className="font-mono text-[clamp(30px,2.6vw,46px)] leading-none font-medium tracking-[-0.04em] text-ink tabular-nums"
        >
          {t.value}
        </span>
        <span className="font-mono text-[14px] text-muted">{t.unit}</span>
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
      <div className="mt-1.5 h-[96px] min-h-0 min-w-0 xl:h-auto xl:flex-1">
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
