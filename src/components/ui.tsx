import type { ReactNode } from 'react';
import { IconCheckCircle, IconMinus, IconOctagon, IconTriangle } from './icons';
import { TONE, type Tone } from './tone';

// Owner B: small building blocks shared by every screen of the design.

export function StatusIcon({
  tone,
  size = 14,
  strokeWidth = 2.6,
}: {
  tone: Tone;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = tone === 'normal' ? IconCheckCircle : tone === 'watch' ? IconTriangle : IconOctagon;
  return <Icon size={size} strokeWidth={strokeWidth} />;
}

/** Coloured badge: icon + word. */
export function StatusPill({ tone, label }: { tone: Tone; label?: string }) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-lg pr-2 pl-1.5 text-[13px] font-medium ${t.bg} ${t.text}`}
    >
      <StatusIcon tone={tone} />
      {label ?? t.label}
    </span>
  );
}

/** Neutral badge for "no reading": a dash + word, no status colour. */
export function NoDataPill({ label = 'No data' }: { label?: string }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-lg bg-raised pr-2 pl-1.5 text-[13px] font-medium text-muted">
      <IconMinus size={14} strokeWidth={2.6} />
      {label}
    </span>
  );
}

/** StatusPill for a known tone, NoDataPill otherwise. */
export function TonePill({ tone, label }: { tone: Tone | null; label?: string }) {
  return tone ? <StatusPill tone={tone} label={label} /> : <NoDataPill />;
}

/** Square icon tile used in alert and list rows. */
export function StatusTile({ tone, size = 36 }: { tone: Tone; size?: number }) {
  const t = TONE[tone];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg ${t.bg} ${t.text}`}
      style={{ width: size, height: size }}
    >
      <StatusIcon tone={tone} size={20} strokeWidth={2} />
    </span>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-3.5 text-[13px] font-medium text-muted">
      {(['normal', 'watch', 'act'] as const).map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className={TONE[t].text}>
            <StatusIcon tone={t} />
          </span>
          {TONE[t].label}
        </span>
      ))}
    </div>
  );
}

export function Panel({
  title,
  aside,
  children,
  className = '',
  sunk = false,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  sunk?: boolean;
}) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-[20px] border border-line p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${sunk ? 'bg-sunk' : 'bg-surface'} ${className}`}
    >
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {title && <h2 className="m-0 text-xl font-medium tracking-[-0.015em]">{title}</h2>}
          {aside && <span className="font-mono text-[13px] text-muted">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Page title with the small mission-day / date / time table beside it. */
export function PageTitle({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: { label: string; value: ReactNode }[];
  children?: ReactNode;
}) {
  return (
    <div className="flex animate-chc-in flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-4">
        <h1 className="m-0 text-[32px] leading-10 font-medium tracking-[-0.028em]">{title}</h1>
        {meta && (
          <table className="border-y border-line tabular-nums">
            <thead>
              <tr>
                {meta.map((m, i) => (
                  <th
                    key={m.label}
                    scope="col"
                    className={`pt-2.5 pb-1 text-left text-[13px] font-medium text-muted ${i < meta.length - 1 ? 'pr-8' : ''}`}
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {meta.map((m, i) => (
                  <td
                    key={m.label}
                    className={`pb-2.5 font-mono text-xl font-medium text-ink ${i < meta.length - 1 ? 'pr-8' : ''}`}
                  >
                    {m.value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
      {children}
    </div>
  );
}

/** Compact page header (about 44px): title, inline meta (mono values), actions on the right. */
export function PageHeader({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: { label: string; value: ReactNode }[];
  children?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 animate-chc-in flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 className="m-0 text-[28px] leading-9 font-medium tracking-[-0.025em]">{title}</h1>
        {meta && (
          <dl className="m-0 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            {meta.map((m) => (
              <div key={m.label} className="flex items-baseline gap-1.5">
                <dt>{m.label}</dt>
                <dd className="m-0 font-mono text-[15px] font-medium text-ink tabular-nums">
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  label,
  className = '',
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={`h-1.5 overflow-hidden rounded-full bg-raised ${className}`}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500"
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="m-0 text-[13px] font-medium text-muted">{children}</h3>;
}
