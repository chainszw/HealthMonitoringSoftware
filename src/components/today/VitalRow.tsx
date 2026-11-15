import { Link } from 'react-router';
import { TONE } from '../tone';
import { StatusPill } from '../ui';
import { NeonChart } from './NeonChart';
import type { VitalTile } from './VitalCard';

// Owner B: one vital on Today as a floating neon read-out line (no tile): name and status,
// the big number, then a flowing chart across the rest of the row.

export function VitalRow({ t, tickAt, live }: { t: VitalTile; tickAt?: number; live?: boolean }) {
  const tone = t.tone ?? 'normal';
  const color = tone === 'normal' ? '#29f0ff' : TONE[tone].hex;
  if (!t.value) {
    return (
      <div className="grid min-h-[64px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2 xl:min-h-0 xl:flex-1">
        <span className="flex min-w-0 flex-col">
          <span className="font-mono text-[12px] tracking-[0.18em] text-muted uppercase">
            {t.label}
          </span>
          <span className="text-[14px] text-faint">Not logged yet</span>
        </span>
        <Link
          to={t.href}
          className="font-mono text-[13px] tracking-[0.12em] text-accent uppercase no-underline hover:underline"
        >
          Log {t.short} →
        </Link>
      </div>
    );
  }
  return (
    <article
      aria-label={`${t.label} ${t.value} ${t.unit}, ${TONE[tone].label}${t.time ? `, at ${t.time}` : ''}. ${t.meaning}`}
      className="grid min-h-[84px] grid-cols-[minmax(0,150px)_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-1.5 sm:grid-cols-[minmax(0,160px)_minmax(150px,auto)_minmax(0,1fr)] xl:min-h-0 xl:flex-1"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-mono text-[12px] tracking-[0.18em] text-muted uppercase">
          {t.label}
        </span>
        <StatusPill tone={tone} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="flex items-baseline gap-1.5">
          <span
            aria-live={live ? 'off' : undefined}
            className={`font-mono text-[clamp(30px,2.8vw,50px)] leading-none font-medium tracking-[-0.04em] tabular-nums ${tone === 'normal' ? 'chc-neon text-ink' : `${TONE[tone].text}`}`}
            style={
              tone === 'normal'
                ? undefined
                : { textShadow: `0 0 10px ${color}88, 0 0 1px ${color}` }
            }
          >
            {t.value}
          </span>
          <span className="font-mono text-[13px] text-muted">{t.unit}</span>
        </span>
        <span className="truncate text-[12px] text-muted" title={t.meaning}>
          {live ? (
            <span className="text-pink">● live</span>
          ) : (
            <span className="font-mono">{t.time}</span>
          )}{' '}
          · {t.meaning}
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
