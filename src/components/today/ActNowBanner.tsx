import { IconOctagon } from '../icons';
import { btn } from '../tone';

// Owner B: act-now alert across the top of Today. role=alert; it stays until the reading is handled.
// LAYOUT TEST: text is mock (moves to content.json when wired).

export function ActNowBanner() {
  return (
    <div
      role="alert"
      className="flex shrink-0 animate-chc-in flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[18px] border border-act-l bg-act-t px-4 py-3"
    >
      <span className="shrink-0 text-act">
        <IconOctagon size={28} />
      </span>
      <div className="flex min-w-0 flex-[1_1_360px] flex-col">
        <span className="text-[13px] font-medium text-act">
          Act now · Blood pressure <span className="font-mono">156/99</span> mmHg at{' '}
          <span className="font-mono">09:04</span>
        </span>
        <span className="text-base leading-6 font-medium text-ink">
          Stop, rest, re-measure in 15 min. Still high? Flag it for your flight surgeon.
        </span>
      </div>
      <div className="flex gap-2">
        <button type="button" className={btn('primary', 'cursor-pointer !bg-act px-4')}>
          Start 15-min timer
        </button>
        <button type="button" className={btn('ghost', 'cursor-pointer !border-act-l px-4')}>
          Flag for surgeon
        </button>
      </div>
    </div>
  );
}
