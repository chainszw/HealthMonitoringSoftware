import { useEffect, useRef, useState, type FormEvent } from 'react';
import { exportDeviceReadings, type ExportFormat } from '../lib/exportData';
import { formatWhen } from '../lib/format';
import type { SyncStatus } from '../lib/sync';
import { useReadings, useSession } from '../lib/useReadings';
import { saveFile } from './download';
import { btn } from './tone';

// Owner B: the avatar in the header. Crew sign-in for sync (a token from `npm run crew`),
// sync state, sign out, and "Reset demo data". Works with sync off: then it only says the data
// stays on this device. Server access goes through src/lib (useSession), never fetch here.

const ROLE = { astronaut: 'Astronaut', flight_surgeon: 'Flight surgeon' } as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

function syncText(sync: SyncStatus): string {
  switch (sync.status) {
    case 'disabled':
      return 'Saved on this device only';
    case 'signed-out':
      return 'Not signed in, nothing is sent';
    case 'offline':
      return `Offline${sync.pending ? `, ${sync.pending} waiting to send` : ''}`;
    case 'syncing':
      return 'Sending…';
    case 'error':
      return sync.error ?? 'Sync problem';
    case 'synced':
      return sync.pending ? `${sync.pending} waiting to send` : 'Up to date';
  }
}

export function AccountMenu({
  sync,
  open,
  onOpenChange,
}: {
  sync: SyncStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session, signIn, signOut } = useSession();
  const { readings, reset } = useReadings();
  const exportAs = (format: ExportFormat) =>
    saveFile(exportDeviceReadings(readings, format, session?.crew));
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn(token.trim());
    setBusy(false);
    if (result.ok) {
      setToken('');
      onOpenChange(false);
    } else setError(result.error);
  };

  const crew = session?.crew;
  const label = crew ? `Signed in as ${crew.name}` : 'Account and sync';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => onOpenChange(!open)}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-line bg-raised font-mono text-[13px] font-medium text-text transition-colors hover:border-line-2 hover:text-ink"
      >
        {crew ? initials(crew.name) : '--'}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Account and sync"
          className="absolute top-full right-0 z-30 mt-2 flex w-[320px] max-w-[calc(100vw-32px)] flex-col gap-3 rounded-[16px] border border-line-2 bg-raised p-4 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-medium text-ink">
              {crew ? crew.name : 'Not signed in'}
            </span>
            <span className="text-[13px] text-muted">
              {crew
                ? `${ROLE[crew.role]} · ${crew.id}`
                : 'Sign in to share readings with your flight surgeon.'}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-sunk px-3 py-2">
            <span className="text-[13px] font-medium text-text">{syncText(sync)}</span>
            {sync.lastSyncedAt && (
              <span className="font-mono text-[12px] text-muted">
                Last synced {formatWhen(sync.lastSyncedAt)}
              </span>
            )}
          </div>

          {sync.status !== 'disabled' && !crew && (
            <form onSubmit={submit} className="flex flex-col gap-2">
              <label htmlFor="crew-token" className="text-[13px] font-medium text-text">
                Crew token
              </label>
              <input
                id="crew-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="chc_…"
                className="h-11 rounded-xl border border-line-2 bg-sunk px-3 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-accent"
              />
              {error && (
                <span role="alert" className="text-[13px] text-watch">
                  {error}
                </span>
              )}
              <button
                type="submit"
                disabled={busy || !token.trim()}
                className={`${btn('primary', 'cursor-pointer')} disabled:!bg-surface disabled:!text-muted`}
              >
                {busy ? 'Checking…' : 'Sign in'}
              </button>
            </form>
          )}

          {crew && (
            <button
              type="button"
              onClick={() => {
                signOut();
                onOpenChange(false);
              }}
              className={btn('secondary', 'cursor-pointer')}
            >
              Sign out (clears this device)
            </button>
          )}

          <div className="flex flex-col gap-1.5 border-t border-line pt-3">
            <span className="text-[13px] font-medium text-text">
              Export your readings ({readings.length})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => exportAs('csv')}
                className={btn('secondary', 'h-10 flex-1 cursor-pointer text-sm')}
              >
                CSV (Excel)
              </button>
              <button
                type="button"
                onClick={() => exportAs('json')}
                className={btn('secondary', 'h-10 flex-1 cursor-pointer text-sm')}
              >
                JSON
              </button>
            </div>
            <span className="text-[12px] text-muted">Made on this device; works offline.</span>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => {
                if (!confirmReset) return setConfirmReset(true);
                reset();
                setConfirmReset(false);
                onOpenChange(false);
              }}
              onBlur={() => setConfirmReset(false)}
              className={btn('ghost', `cursor-pointer ${confirmReset ? '!border-act-l' : ''}`)}
            >
              {confirmReset ? 'Tap again to replace your readings' : 'Reset demo data'}
            </button>
            <span className="text-[12px] text-muted">
              Replaces this device’s readings with 30 days of demo data.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
