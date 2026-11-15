import { Link } from 'react-router';
import type { VitalTile } from '../../pages/designMock';
import { IconArrowDown, IconArrowRight, IconArrowUp } from '../icons';
import { btn, TONE } from '../tone';
import { StatusPill } from '../ui';
import { Sparkline } from './Sparkline';

// Owner B: one vital on Today. Status = pill (icon + word) + border; value always with its unit.
// Actions live in "Needs attention" and the act-now banner, so the card stays a pure status read-out.

const CARD =
  '[&>*]:shrink-0 flex min-h-[176px] min-w-0 flex-col gap-1.5 overflow-hidden rounded-[18px] border bg-surface px-4 pt-3 pb-3.5 xl:min-h-0';

const BORDER = {
  normal: 'border-line',
  watch: 'border-watch/45',
  act: 'border-act-l shadow-[inset_0_0_0_1px_var(--color-act-l)]',
} as const;

/** Latest value vs the average of the earlier days, formatted to the data's precision. */
function delta(data: number[]) {
  if (data.length < 2) return null;
  const prev = data.slice(0, -1);
  const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
  const decimals = data.some((v) => !Number.isInteger(v)) ? 1 : 0;
  const diff = Number((data[data.length - 1] - avg).toFixed(decimals));
  const dir = diff === 0 ? 'flat' : diff > 0 ? 'up' : 'down';
  const text = `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff).toFixed(decimals)}`;
  return { dir, text } as const;
}

function DeltaArrow({ dir }: { dir: 'up' | 'down' | 'flat' }) {
  if (dir === 'up') return <IconArrowUp size={14} />;
  if (dir === 'down') return <IconArrowDown size={14} />;
  return <IconArrowRight size={14} />;
}

export function VitalCard({ t }: { t: VitalTile }) {
  if (!t.value) return <EmptyVitalCard t={t} />;
  const tone = t.tone ?? 'normal';
  const d = delta(t.data ?? []);
  return (
    <article
      aria-label={`${t.label} ${t.value} ${t.unit}, ${TONE[tone].label}, at ${t.time}. ${t.meaning}`}
      className={`${CARD} ${BORDER[tone]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 truncate text-base font-medium text-text">{t.label}</h3>
        <StatusPill tone={tone} />
      </div>

      <div className="flex items-end justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="font-mono text-[clamp(30px,2.6vw,52px)] leading-none font-medium tracking-[-0.04em] text-ink tabular-nums">
            {t.value}
          </span>
          <span className="truncate font-mono text-[15px] text-text">{t.unit}</span>
        </span>
        {d && (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 pb-0.5 font-mono text-[13px] text-text tabular-nums"
            title="Change vs your 6-day average"
          >
            <DeltaArrow dir={d.dir} />
            {d.text}
          </span>
        )}
      </div>

      <p className="m-0 truncate text-sm text-text" title={t.meaning}>
        <span className="font-mono text-muted tabular-nums">{t.time}</span>
        <span className="text-muted"> · </span>
        <span className={tone === 'normal' ? '' : TONE[tone].text}>{t.meaning}</span>
      </p>

      <div className="mt-1.5 min-h-7 flex-1 !shrink">
        <Sparkline
          data={t.data ?? []}
          min={t.min ?? 0}
          max={t.max ?? 1}
          band={t.band}
          tone={tone}
        />
      </div>
    </article>
  );
}

function EmptyVitalCard({ t }: { t: VitalTile }) {
  return (
    <article
      aria-label={`${t.label}: not logged yet. ${t.meaning}`}
      className={`${CARD} border-dashed border-line-2`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 truncate text-base font-medium text-text">{t.label}</h3>
        <span className="text-[13px] text-muted">Not logged</span>
      </div>
      <span className="flex items-baseline gap-1.5">
        <span className="font-mono text-[clamp(30px,2.6vw,52px)] leading-none font-medium text-muted">
          --
        </span>
        <span className="font-mono text-[15px] text-text">{t.unit}</span>
      </span>
      <p className="m-0 truncate text-sm text-text">{t.meaning}</p>
      <div className="mt-auto">
        <Link to="/log" className={btn('secondary', 'h-9 px-4 no-underline')}>
          Log {t.short}
        </Link>
      </div>
    </article>
  );
}
