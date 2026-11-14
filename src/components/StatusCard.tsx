import { motion } from 'motion/react';
import { content } from '../data/content';
import { getStatus } from '../lib/status';
import type { Indicator, Reading, StatusResult } from '../lib/types';

// Owner B: visual design. Logic comes from getStatus(); text from content.json.

const STATUS_CLASSES: Record<StatusResult['level'], string> = {
  green: 'bg-status-green',
  amber: 'bg-status-amber',
  red: 'bg-status-red',
  unknown: 'bg-status-unknown',
};

interface Props {
  indicator: Indicator;
  reading?: Reading;
}

export function StatusCard({ indicator, reading }: Props) {
  const status = getStatus(indicator, reading?.value, content.unknownStatusAction);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-space-700 bg-space-800 p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-300">{indicator.name}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase text-space-900 ${STATUS_CLASSES[status.level]}`}
        >
          {status.level}
        </span>
      </header>
      <p className="mt-2 text-2xl font-semibold">
        {reading ? reading.value : '—'}
        <span className="ml-1 text-sm font-normal text-slate-400">{indicator.unit}</span>
      </p>
      {reading && (
        <p className="text-xs text-slate-500">{new Date(reading.timestamp).toLocaleString()}</p>
      )}
      <p className="mt-2 text-sm text-slate-300">{status.action}</p>
    </motion.article>
  );
}
