import { Link } from 'react-router';
import { IconCheckCircle, IconClock } from '../icons';
import { btn, TONE, type Tone } from '../tone';
import { ProgressBar, StatusTile } from '../ui';

// Owner B: what to do next on Today: flagged readings (act first, then watch) and today's due checks.
// The list scrolls inside the panel so the page itself never scrolls on laptop screens.

export interface AttentionView {
  key: string;
  tone: Exclude<Tone, 'normal'>;
  /** "Blood pressure 134/86 mmHg" */
  title: string;
  /** First action step from content.json. */
  detail: string;
  /** Button label, e.g. "Re-measure". */
  cta: string;
  href: string;
}

export interface DueView {
  key: string;
  name: string;
  /** "Last logged yesterday 07:40" */
  when: string;
  href: string;
}

const RANK = { act: 0, watch: 1 } as const;

export function AttentionPanel({
  items,
  due,
  logged,
  total,
}: {
  items: AttentionView[];
  due: DueView[];
  logged: number;
  total: number;
}) {
  const sorted = [...items].sort((a, b) => RANK[a.tone] - RANK[b.tone]);
  return (
    <section
      aria-labelledby="attn-h"
      className="flex min-h-0 flex-1 flex-col rounded-[18px] border border-line bg-surface"
    >
      <div className="flex items-baseline justify-between gap-2 px-4 pt-3.5 pb-2">
        <h2 id="attn-h" className="m-0 text-base font-medium text-ink">
          Needs your attention
        </h2>
        <span className="font-mono text-[13px] text-muted">
          {sorted.length} flagged · {due.length} due
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <ul className="m-0 flex list-none flex-col p-0">
          {sorted.map((a) => (
            <li key={a.key} className="flex items-center gap-3 border-t border-line py-2.5">
              <StatusTile tone={a.tone} size={34} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] leading-5 font-medium text-ink">{a.title}</span>
                <span className="text-[13px] leading-[18px] text-text">
                  <span className={TONE[a.tone].text}>{TONE[a.tone].label}</span> · {a.detail}
                </span>
              </div>
              <Link
                to={a.href}
                className={btn('secondary', 'h-10 px-3 whitespace-nowrap no-underline')}
              >
                {a.cta}
              </Link>
            </li>
          ))}
          {sorted.length === 0 && (
            <li className="flex items-center gap-3 border-t border-line py-2.5 text-[15px] text-text">
              <span className="text-ok">
                <IconCheckCircle size={20} strokeWidth={2.2} />
              </span>
              Nothing flagged in your recent readings.
            </li>
          )}
        </ul>

        <div className="flex items-center gap-3 border-t border-line pt-3 pb-1">
          <h3 className="m-0 text-[13px] font-medium whitespace-nowrap text-muted">Due today</h3>
          <ProgressBar
            value={logged}
            max={total}
            label="Measurements logged today"
            className="flex-1"
          />
          <span className="font-mono text-[13px] whitespace-nowrap text-muted">
            {logged} of {total}
          </span>
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {due.map((d) => (
            <li key={d.key} className="flex items-center gap-3 py-1.5">
              <span className="flex size-[34px] shrink-0 items-center justify-center text-muted">
                <IconClock size={18} strokeWidth={1.8} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] leading-5 font-medium text-ink">{d.name}</span>
                <span className="text-[13px] leading-[18px] text-muted">{d.when}</span>
              </div>
              <Link
                to={d.href}
                aria-label={`Log ${d.name}`}
                className={btn('secondary', 'h-10 min-w-[56px] px-3 no-underline')}
              >
                Log
              </Link>
            </li>
          ))}
          {due.length === 0 && (
            <li className="py-1.5 text-[13px] text-muted">All of today’s checks are logged.</li>
          )}
        </ul>
      </div>
    </section>
  );
}
