import { content } from '../data/content';
import type { BodySystemId } from '../lib/types';

// Owner B: placeholder figure. Replace with a proper illustration; keep the
// region → BodySystemId mapping so the Body page keeps working.

interface Props {
  selected?: BodySystemId;
  onSelect: (id: BodySystemId) => void;
}

const REGIONS: { id: BodySystemId; shape: 'circle' | 'rect'; props: Record<string, number> }[] = [
  { id: 'mind', shape: 'circle', props: { cx: 100, cy: 40, r: 26 } },
  { id: 'eyes', shape: 'rect', props: { x: 86, y: 32, width: 28, height: 10, rx: 4 } },
  { id: 'heart', shape: 'circle', props: { cx: 110, cy: 105, r: 14 } },
  { id: 'metabolic', shape: 'rect', props: { x: 78, y: 130, width: 44, height: 40, rx: 8 } },
  { id: 'muscle', shape: 'rect', props: { x: 40, y: 80, width: 22, height: 90, rx: 10 } },
  { id: 'bone', shape: 'rect', props: { x: 78, y: 180, width: 44, height: 110, rx: 10 } },
];

export function BodyFigure({ selected, onSelect }: Props) {
  const fill = (id: BodySystemId) => (id === selected ? '#38bdf8' : '#1e2742');

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 200 300" className="h-80 w-auto" role="group" aria-label="Body systems">
        {/* torso outline */}
        <rect x="66" y="70" width="68" height="110" rx="20" fill="#131a2e" stroke="#334155" />
        <rect x="138" y="80" width="22" height="90" rx="10" fill="#131a2e" stroke="#334155" />
        {REGIONS.map((r) => {
          const name = content.bodySystems.find((b) => b.id === r.id)?.name ?? r.id;
          const common = {
            fill: fill(r.id),
            stroke: '#475569',
            className: 'cursor-pointer hover:opacity-80',
            onClick: () => onSelect(r.id),
            role: 'button',
            'aria-label': name,
          };
          return r.shape === 'circle' ? (
            <circle key={r.id} {...common} {...r.props}>
              <title>{name}</title>
            </circle>
          ) : (
            <rect key={r.id} {...common} {...r.props}>
              <title>{name}</title>
            </rect>
          );
        })}
      </svg>
      {/* Accessible list of every system (some, like sleep/immune, have no region). */}
      <div className="flex flex-wrap justify-center gap-2">
        {content.bodySystems.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className={`rounded-full px-3 py-1 text-xs ${b.id === selected ? 'bg-sky-600' : 'bg-space-700 hover:bg-space-800'}`}
          >
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
