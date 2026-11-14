import { useState } from 'react';
import { TrendChart } from '../components/TrendChart';
import { content, getIndicator } from '../data/content';
import { readingsFor } from '../lib/readings';
import { useReadings } from '../lib/useReadings';

// Owner B: page layout. TODO: amber/red markers, date range filter.

export function Trends() {
  const [indicatorId, setIndicatorId] = useState(content.indicators[0].id);
  const { readings } = useReadings();
  const indicator = getIndicator(indicatorId);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Trends</h2>
        <select
          value={indicatorId}
          onChange={(e) => setIndicatorId(e.target.value)}
          className="rounded-md bg-space-800 px-2 py-1.5 text-sm"
        >
          {content.indicators.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      {indicator && (
        <TrendChart indicator={indicator} readings={readingsFor(readings, indicatorId)} />
      )}
    </section>
  );
}
