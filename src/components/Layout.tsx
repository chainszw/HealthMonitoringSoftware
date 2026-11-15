import { Suspense, useState, type ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router';
import type { MissionProfileId } from '../lib/types';
import { useMission } from '../lib/useReadings';
import { MISSIONS } from '../pages/designMock';
import {
  IconBody,
  IconCalendarCheck,
  IconCheckCircle,
  IconGrid,
  IconPlusCircle,
  IconSend,
  IconSignal,
  IconTrend,
  Logo,
} from './icons';
import { BTN } from './tone';

// Owner B: app shell from the design: header (mission switch, Earth delay, send report),
// left rail, page, disclaimer footer. Keep routes in App.tsx.

const NAV: {
  to: string;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  count?: string;
}[] = [
  { to: '/', label: 'Today', Icon: IconGrid },
  { to: '/log', label: 'Log vitals', Icon: IconPlusCircle, count: '4' },
  { to: '/body', label: 'Body view', Icon: IconBody },
  { to: '/trends', label: 'Trends', Icon: IconTrend },
  { to: '/routine', label: 'Routine', Icon: IconCalendarCheck },
];

export function Layout() {
  const { mission, setMission } = useMission();
  const [sentFor, setSentFor] = useState<MissionProfileId | null>(null);
  const m = MISSIONS[mission];
  const sent = sentFor === mission;

  return (
    <div className="chc-fit flex min-h-screen flex-col bg-bg text-base text-ink">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line px-6 py-3.5">
        <NavLink to="/" className="flex items-center gap-3 text-ink no-underline">
          <Logo />
          <span className="text-[19px] font-medium tracking-[-0.02em]">Crew Health Console</span>
        </NavLink>
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Mission profile"
            className="inline-flex gap-0.5 rounded-xl border border-line bg-surface p-1"
          >
            {(Object.keys(MISSIONS) as MissionProfileId[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={id === mission}
                onClick={() => setMission(id)}
                className="h-10 cursor-pointer rounded-lg px-3.5 text-[15px] font-medium text-muted transition-colors hover:text-ink aria-pressed:bg-ink aria-pressed:text-bg"
              >
                {MISSIONS[id].label}
              </button>
            ))}
          </div>
          <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-3.5 text-[15px] text-muted">
            <span className="text-accent">
              <IconSignal size={16} />
            </span>
            Earth delay <strong className="font-mono font-medium text-ink">{m.delay}</strong>
          </span>
          <button
            type="button"
            onClick={() => setSentFor(mission)}
            className={`${BTN.base} cursor-pointer border bg-raised pr-4 pl-3.5 text-ink ${sent ? 'border-ok/45' : 'border-line-2'}`}
          >
            {sent ? (
              <span className="text-ok">
                <IconCheckCircle size={18} strokeWidth={2.4} />
              </span>
            ) : (
              <span className="text-accent">
                <IconSend size={18} />
              </span>
            )}
            {sent ? m.sent : 'Send report to ground'}
          </button>
          <span
            aria-label="Signed in as crew member CM-2"
            className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-raised font-mono text-[13px] font-medium text-text"
          >
            CM2
          </span>
        </div>
      </header>

      <div className="chc-fit-row flex flex-1 flex-wrap items-stretch">
        <nav
          aria-label="Main"
          className="box-border flex max-w-full flex-[1_1_96px] flex-wrap content-start gap-1.5 border-r border-line px-2.5 py-4"
        >
          {NAV.map(({ to, label, Icon, count }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative box-border flex min-h-[72px] flex-[1_1_72px] flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-center text-[13px] leading-4 font-medium no-underline transition-colors ${isActive ? 'bg-raised text-ink' : 'text-muted hover:bg-hover hover:text-ink'}`
              }
            >
              <Icon size={22} strokeWidth={1.8} />
              <span>{label}</span>
              {count && (
                <span
                  aria-label={`${count} due`}
                  className="absolute top-1.5 right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 font-mono text-[13px] font-medium text-accent-ink"
                >
                  {count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <main className="box-border flex min-w-0 flex-[999_1_560px] flex-col gap-4 px-6 py-4">
          <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
            <Outlet context={{ mission }} />
          </Suspense>
          <footer className="flex flex-wrap justify-between gap-x-4 gap-y-1.5 border-t border-line px-0.5 pt-2.5 text-[13px] leading-[19px] text-muted">
            <span>
              Decision support only, not a diagnosis. Your flight surgeon has the final say.
            </span>
            <a
              href="#sources"
              className="whitespace-nowrap text-accent no-underline hover:text-[#8fd0fd]"
            >
              Sources and credits: NASA HRP, ESA
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
