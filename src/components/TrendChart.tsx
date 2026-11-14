import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Indicator, Reading } from '../lib/types';

// Owner B: chart styling. SVG attributes can't read CSS vars reliably, so
// colors are duplicated here; keep in sync with the tokens in index.css.
const GREEN = '#22c55e';
const LINE = '#38bdf8';

interface Props {
  indicator: Indicator;
  /** Readings for this indicator, oldest first (see readingsFor()). */
  readings: Reading[];
}

export function TrendChart({ indicator, readings }: Props) {
  const data = readings.map((r) => ({
    t: new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: r.value,
  }));

  if (data.length === 0) {
    return <p className="text-sm text-slate-400">No readings for {indicator.name} yet.</p>;
  }

  return (
    <div className="h-72 w-full rounded-xl border border-space-700 bg-space-800 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#1e2742" />
          {indicator.ranges.green.map((r, i) => (
            <ReferenceArea
              key={i}
              y1={r.min}
              y2={r.max}
              fill={GREEN}
              fillOpacity={0.1}
              ifOverflow="hidden"
            />
          ))}
          <XAxis dataKey="t" stroke="#64748b" fontSize={12} />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            domain={['auto', 'auto']}
            unit={` ${indicator.unit}`}
            width={72}
          />
          <Tooltip contentStyle={{ background: '#131a2e', border: '1px solid #1e2742' }} />
          <Line
            type="monotone"
            dataKey="value"
            name={indicator.name}
            stroke={LINE}
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
