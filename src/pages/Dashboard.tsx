import { useOutletContext } from 'react-router';
import { StatusCard } from '../components/StatusCard';
import { Streak } from '../components/Streak';
import { content, getMissionProfile } from '../data/content';
import { latestByIndicator, loggingStreak } from '../lib/readings';
import { getStatus, worstStatus } from '../lib/status';
import type { MissionProfileId } from '../lib/types';
import { useReadings } from '../lib/useReadings';

// Owner B: layout/visuals. Owner A: data wiring.

export function Dashboard() {
  const { mission } = useOutletContext<{ mission: MissionProfileId }>();
  const { readings, reset } = useReadings();
  const latest = latestByIndicator(readings);
  const overall = worstStatus(
    content.indicators.map((i) => getStatus(i, latest[i.id]?.value).level),
  );
  const profile = getMissionProfile(mission);

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-space-700 bg-space-800 p-4">
          <p className="text-sm text-slate-400">Overall status</p>
          <p className="text-2xl font-semibold uppercase">{overall}</p>
        </div>
        <Streak days={loggingStreak(readings)} />
        {profile && (
          <div className="rounded-xl border border-space-700 bg-space-800 p-4">
            <p className="text-sm text-slate-400">{profile.name}</p>
            <p className="text-sm">{profile.description}</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {content.indicators.map((i) => (
          <StatusCard key={i.id} indicator={i} reading={latest[i.id]} />
        ))}
      </div>

      <button onClick={reset} className="justify-self-start text-xs text-slate-500 underline">
        Reset to demo data
      </button>
    </section>
  );
}
