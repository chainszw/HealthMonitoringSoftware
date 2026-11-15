import { Link } from 'react-router';
import { IconOctagon } from '../icons';
import { btn } from '../tone';

// Owner B: act-now alert across the top of Today. role=alert; it stays while the latest reading
// is red. The action text comes from content.json (via getAttention).

export function ActNowBanner({
  title,
  action,
  href,
  note,
}: {
  /** "Blood pressure 160/100 mmHg at 09:04" */
  title: string;
  action: string;
  /** Re-measure link. */
  href: string;
  /** e.g. "Your flight surgeon sees this after the next sync." */
  note?: string;
}) {
  return (
    <div
      role="alert"
      className="flex shrink-0 animate-chc-in flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[18px] border border-act-l bg-act-t px-4 py-3"
    >
      <span className="shrink-0 text-act">
        <IconOctagon size={28} />
      </span>
      <div className="flex min-w-0 flex-[1_1_360px] flex-col">
        <span className="text-[13px] font-medium text-act">Act now · {title}</span>
        <span className="text-base leading-6 font-medium text-ink">{action}</span>
        {note && <span className="text-[13px] text-text">{note}</span>}
      </div>
      <Link to={href} className={btn('primary', '!bg-act px-4 no-underline')}>
        Re-measure
      </Link>
    </div>
  );
}
