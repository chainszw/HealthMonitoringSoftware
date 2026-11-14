import { useState } from 'react';
import { BodyFigure } from '../components/BodyFigure';
import { StatusCard } from '../components/StatusCard';
import { getBodySystem, getIndicator } from '../data/content';
import { latestByIndicator } from '../lib/readings';
import type { BodySystemId } from '../lib/types';
import { useReadings } from '../lib/useReadings';

// Owner B: layout/animation. All text comes from content.json bodySystems.

export function Body() {
  const [selected, setSelected] = useState<BodySystemId>('heart');
  const { readings } = useReadings();
  const latest = latestByIndicator(readings);
  const system = getBodySystem(selected);

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <BodyFigure selected={selected} onSelect={setSelected} />
      {system && (
        <div className="grid content-start gap-4">
          <h2 className="text-xl font-semibold">{system.name}</h2>
          <p className="text-slate-300">{system.spaceflightEffects}</p>
          <div className="flex flex-wrap gap-2">
            {system.hazards.map((h) => (
              <span key={h} className="rounded-full bg-space-700 px-2 py-0.5 text-xs">
                {h}
              </span>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {system.indicatorIds.map((id) => {
              const indicator = getIndicator(id);
              return indicator ? (
                <StatusCard key={id} indicator={indicator} reading={latest[id]} />
              ) : null;
            })}
          </div>
        </div>
      )}
    </section>
  );
}
