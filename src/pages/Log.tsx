import { StatusCard } from '../components/StatusCard';
import { VitalsForm } from '../components/VitalsForm';
import { getIndicator } from '../data/content';
import { useReadings } from '../lib/useReadings';

// Owner B: page layout. TODO: confirmation animation, edit/delete readings.

export function Log() {
  const { readings, add } = useReadings();
  const recent = [...readings].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 6);

  return (
    <section className="grid gap-6">
      <h2 className="text-xl font-semibold">Log vitals</h2>
      <VitalsForm onSubmit={add} />
      <h3 className="text-sm font-medium text-slate-400">Most recent</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recent.map((r) => {
          const indicator = getIndicator(r.indicatorId);
          return indicator ? <StatusCard key={r.id} indicator={indicator} reading={r} /> : null;
        })}
      </div>
    </section>
  );
}
