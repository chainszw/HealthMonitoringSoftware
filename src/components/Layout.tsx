import { Suspense, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { content } from '../data/content';
import { getScenario } from '../data/scenarios';
import { formatDelay } from '../lib/format';
import { requestSync } from '../lib/sync';
import type { MissionProfileId } from '../lib/types';
import { useMission, useReadings, useSync } from '../lib/useReadings';
import { AccountMenu } from './AccountMenu';
import { CalmDots } from './CalmDots';
import {
  IconBody,
  IconCalendarCheck,
  IconCheckCircle,
  IconCube,
  IconGrid,
  IconPlusCircle,
  IconSend,
  IconSignal,
  IconTrend,
  Logo,
} from './icons';
import { openStart, useStart } from './startGate';
import { BTN } from './tone';
import { useNow } from './useNow';
import { dueEntries } from './vitals';

// Owner B: app shell from the design: header (mission switch, Earth delay, send report,
// account), left rail, page, disclaimer footer. Keep routes in App.tsx.

/** Short tab labels (content.json has the full mission names). */
const MISSION_LABEL: Record<MissionProfileId, string> = {
  iss: 'ISS',
  lunar: 'Lunar base',
  mars: 'Mars transit',
};

const NAV: {
  to: string;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}[] = [
  { to: '/', label: 'Today', Icon: IconGrid },
  { to: '/zoe', label: 'ZOĒ device', Icon: IconCube },
  { to: '/log', label: 'Log vitals', Icon: IconPlusCircle },
  { to: '/body', label: 'Body view', Icon: IconBody },
  { to: '/trends', label: 'Trends', Icon: IconTrend },
  { to: '/routine', label: 'Routine', Icon: IconCalendarCheck },
];

export function Layout() {
  const { mission, setMission } = useMission();
  const { readings } = useReadings();
  const sync = useSync();
  const now = useNow();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const start = useStart();
  const dataChip =
    start.mode === 'live'
      ? { dot: 'bg-ok', text: 'Live data' }
      : start.mode === 'offline'
        ? { dot: 'bg-watch', text: 'Offline, saved data' }
        : start.mode === 'demo'
          ? {
              dot: 'bg-watch',
              text: `Demo: ${start.scenario ? getScenario(start.scenario).name : 'scenario'}`,
            }
          : null;
  const profile = content.missionProfiles.find((p) => p.id === mission);
  const delaySeconds = profile?.commsDelaySeconds.max ?? 0;
  const delay = formatDelay(delaySeconds);
  const dueCount = dueEntries(readings, now).length;
  const sent = sync.status === 'synced' && sync.pending === 0;
  const sendLabel =
    sync.status === 'syncing'
      ? 'Sending…'
      : sync.status === 'signed-out'
        ? 'Sign in to send'
        : sync.status === 'offline'
          ? `Offline${sync.pending ? `, ${sync.pending} waiting` : ''}`
          : sync.status === 'error'
            ? 'Send failed, try again'
            : sent
              ? delaySeconds >= 60
                ? `Sent, reaches Earth in ${delay}`
                : 'Report delivered'
              : `Send report to ground (${sync.pending})`;
  const send = () => {
    if (sync.status === 'signed-out') setMenuOpen(true);
    else requestSync();
  };

  return (
    <div className="chc-fit flex min-h-screen flex-col text-base text-ink">
      <CalmDots />
      <header className="chc-glass relative z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <NavLink to="/" className="flex items-center gap-3 text-ink no-underline">
            <Logo />
            <span className="text-[19px] font-medium tracking-[-0.02em]">Aegis Health Console</span>
          </NavLink>
          {dataChip && (
            <button
              type="button"
              onClick={openStart}
              title="Back to the start screen: change data source or view"
              className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-line-2 bg-raised px-3 text-[13px] text-text transition-colors hover:border-accent/60"
            >
              <span className={`size-2 rounded-full ${dataChip.dot}`} />
              {dataChip.text}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Mission profile"
            className="inline-flex gap-0.5 rounded-xl border border-line bg-surface p-1"
          >
            {content.missionProfiles.map(({ id, name }) => (
              <button
                key={id}
                type="button"
                title={name}
                aria-pressed={id === mission}
                onClick={() => setMission(id)}
                className="h-10 cursor-pointer rounded-lg px-3.5 text-[15px] font-medium text-muted transition-colors hover:text-ink aria-pressed:bg-ink aria-pressed:text-bg"
              >
                {MISSION_LABEL[id]}
              </button>
            ))}
          </div>
          <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-3.5 text-[15px] text-muted">
            <span className="text-accent">
              <IconSignal size={16} />
            </span>
            Earth delay <strong className="font-mono font-medium text-ink">{delay}</strong>
          </span>
          {sync.status !== 'disabled' && (
            <button
              type="button"
              onClick={send}
              aria-live="polite"
              className={`${BTN.base} cursor-pointer border bg-raised pr-4 pl-3.5 text-ink ${sent ? 'border-ok/45' : sync.status === 'error' || sync.status === 'offline' ? 'border-watch/45' : 'border-line-2'}`}
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
              {sendLabel}
            </button>
          )}
          <AccountMenu sync={sync} open={menuOpen} onOpenChange={setMenuOpen} />
        </div>
      </header>

      <div className="chc-fit-row flex flex-1 flex-wrap items-stretch">
        <nav
          aria-label="Main"
          className="box-border flex max-w-full flex-[1_1_96px] flex-wrap content-start gap-1.5 border-r border-line bg-sunk px-2.5 py-4"
        >
          {NAV.map(({ to, label, Icon }) => {
            const count = to === '/log' && dueCount ? String(dueCount) : undefined;
            return (
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
            );
          })}
        </nav>

        <main className="box-border flex min-w-0 flex-[999_1_560px] flex-col gap-4 px-6 py-4">
          <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
            {/* Keyed on the route so each screen glides in when you switch. */}
            <div key={pathname} className="flex animate-chc-in flex-col gap-4 xl:min-h-0 xl:flex-1">
              <Outlet context={{ mission }} />
            </div>
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
