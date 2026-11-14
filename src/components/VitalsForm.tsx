import { useState, type FormEvent } from 'react';
import { content, getIndicator } from '../data/content';
import type { NewReading } from '../lib/storage';

// Owner B: form UX (validation messages, per-indicator inputs, mood picker, ...).

interface Props {
  onSubmit: (reading: NewReading) => void;
}

export function VitalsForm({ onSubmit }: Props) {
  const [indicatorId, setIndicatorId] = useState(content.indicators[0].id);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const indicator = getIndicator(indicatorId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const num = Number(value);
    if (value === '' || !Number.isFinite(num)) return;
    onSubmit({ indicatorId, value: num, note: note.trim() || undefined });
    setValue('');
    setNote('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-xl border border-space-700 bg-space-800 p-4 sm:grid-cols-2"
    >
      <label className="grid gap-1 text-sm">
        Indicator
        <select
          value={indicatorId}
          onChange={(e) => setIndicatorId(e.target.value)}
          className="rounded-md bg-space-900 px-2 py-1.5"
        >
          {content.indicators.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Value {indicator && <span className="text-slate-400">({indicator.unit})</span>}
        <input
          type="number"
          required
          value={value}
          min={indicator?.input?.min}
          max={indicator?.input?.max}
          step={indicator?.input?.step ?? 'any'}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-md bg-space-900 px-2 py-1.5"
        />
      </label>
      {indicator && (
        <p className="text-xs text-slate-400 sm:col-span-2">{indicator.howToMeasureInSpace}</p>
      )}
      <label className="grid gap-1 text-sm sm:col-span-2">
        Note (optional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-md bg-space-900 px-2 py-1.5"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500 sm:col-span-2"
      >
        Save reading
      </button>
    </form>
  );
}
