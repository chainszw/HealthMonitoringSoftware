import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { content } from '../data/content';
import type { MissionProfileId } from '../lib/types';
import { useMission } from '../lib/useReadings';
import { Disclaimer } from './Disclaimer';

// Owner B: app shell. Keep routes in App.tsx; restyle freely here.

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/log', label: 'Log' },
  { to: '/body', label: 'Body' },
  { to: '/trends', label: 'Trends' },
];

export function Layout() {
  const { mission, setMission } = useMission();

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-space-700 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Crew Health Console</h1>
        <nav className="flex gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-space-700 text-white' : 'text-slate-400 hover:text-white'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          Mission
          <select
            value={mission}
            onChange={(e) => setMission(e.target.value as MissionProfileId)}
            className="rounded-md bg-space-800 px-2 py-1 text-slate-100"
          >
            {content.missionProfiles.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="flex-1 py-6">
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Outlet context={{ mission }} />
        </Suspense>
      </main>

      <footer className="border-t border-space-700 py-4">
        <Disclaimer />
      </footer>
    </div>
  );
}
