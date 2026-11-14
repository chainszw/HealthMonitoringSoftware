// Owner B: logging streak badge. Count comes from loggingStreak() in lib/readings.ts.

export function Streak({ days }: { days: number }) {
  return (
    <div className="rounded-xl border border-space-700 bg-space-800 p-4">
      <p className="text-sm text-slate-400">Logging streak</p>
      <p className="text-2xl font-semibold">
        🔥 {days} <span className="text-sm font-normal text-slate-400">days</span>
      </p>
    </div>
  );
}
