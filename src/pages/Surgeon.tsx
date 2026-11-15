import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { saveFile } from '../components/download';
import { NeonChart } from '../components/today/NeonChart';
import { TONE, btn, toneOf } from '../components/tone';
import { PageHeader, Panel, TonePill } from '../components/ui';
import { useNow } from '../components/useNow';
import { content, getIndicator } from '../data/content';
import { API_URL } from '../lib/apiConfig';
import { fetchCrewOverview, fetchCrewTrend, fetchExport, fetchMe } from '../lib/crewApi';
import { formatDelay, formatValue, formatWhen, greenBand } from '../lib/format';
import type { CrewMember, CrewOverviewItem, CrewOverviewResponse } from '../lib/syncProtocol';
import { chartDomain } from '../lib/trends';
import type { TrendPoint } from '../lib/insights';

// Owner B: the flight-surgeon console (Earth side). Signs in with a flight-surgeon token (kept in
// memory only, never stored), then shows every astronaut most urgent first from GET /crew/overview,
// refreshed every 15 s: status, readiness, systems, missed checks, alerts, and what is still in
// transit from space (comms delay). Pick an astronaut and indicator for a trend chart
// (GET /crew/:id/trend) and download their data (GET /export.csv|json). Read-only by design.

const REFRESH_MS = 15_000;
const SYSTEM_LABEL: Record<string, string> = Object.fromEntries(
  content.bodySystems.map((s) => [s.id, s.name]),
);

export function Surgeon() {
  const [token, setToken] = useState('');
  const [draft, setDraft] = useState('');
  const [me, setMe] = useState<CrewMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<CrewOverviewResponse | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [indicatorId, setIndicatorId] = useState('heart_rate');
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const now = useNow(1000);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetchMe(API_URL, draft.trim());
    setBusy(false);
    if (!res.ok) return setError(res.status === 401 ? 'That token is not valid.' : res.error);
    if (res.data.crew.role !== 'flight_surgeon')
      return setError('This is an astronaut token. The console needs a flight-surgeon token.');
    setMe(res.data.crew);
    setToken(draft.trim());
    setDraft('');
  };

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetchCrewOverview(API_URL, token, 7);
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else setError(res.error);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [token, load]);

  const crew = data?.crew ?? [];
  const sel = crew.find((c) => c.crew.id === selId) ?? crew[0];

  useEffect(() => {
    if (!token || !sel) return;
    let live = true;
    void fetchCrewTrend(API_URL, token, sel.crew.id, indicatorId, 14).then((res) => {
      if (live) setTrend(res.ok ? res.data.points : []);
    });
    return () => {
      live = false;
    };
  }, [token, sel?.crew.id, indicatorId, sel, data?.generatedAt]);

  const download = async (format: 'csv' | 'json') => {
    if (!sel) return;
    const res = await fetchExport(API_URL, token, format, { crewId: sel.crew.id });
    if (res.ok) saveFile(res.data);
    else setError(res.error);
  };

  const indicator = getIndicator(indicatorId);
  const chart = useMemo(() => {
    const values = (trend ?? []).map((p) => p.value);
    const band = indicator ? greenBand(indicator) : undefined;
    const [min, max] = chartDomain(values, band);
    return { values, band, min, max };
  }, [trend, indicator]);

  if (!API_URL) {
    return (
      <div className="flex flex-col gap-3.5">
        <PageHeader title="Flight surgeon" />
        <Panel title="No server set up">
          <p className="m-0 text-[14px] text-muted">
            The flight-surgeon console reads the crew’s data from the Aegis server. Set VITE_API_URL
            (see .env.example) and run the server to use it.
          </p>
        </Panel>
      </div>
    );
  }

  if (!token || !me) {
    return (
      <div className="flex flex-col gap-3.5">
        <PageHeader title="Flight surgeon" />
        <Panel title="Sign in as a flight surgeon" className="max-w-[520px]">
          <p className="m-0 text-[14px] text-muted">
            Earth-side view of the whole crew, read-only. Use a flight-surgeon token from{' '}
            <code className="font-mono text-ink">npm run crew -- demo</code>. It stays in memory
            only and is forgotten when you leave this page.
          </p>
          <form onSubmit={signIn} className="flex flex-wrap gap-2">
            <label htmlFor="fs-token" className="sr-only">
              Flight-surgeon token
            </label>
            <input
              id="fs-token"
              type="password"
              autoComplete="off"
              placeholder="chc_…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line-2 bg-sunk px-3 font-mono text-sm text-ink outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className={btn('primary', 'cursor-pointer px-5')}
            >
              {busy ? 'Checking…' : 'Open console'}
            </button>
          </form>
          {error && (
            <p role="alert" className="m-0 text-[13px] text-watch">
              {error}
            </p>
          )}
        </Panel>
      </div>
    );
  }

  const red = crew.filter((c) => c.status === 'red').length;
  const amber = crew.filter((c) => c.status === 'amber').length;

  return (
    <div className="flex flex-col gap-3.5 xl:min-h-0 xl:flex-1">
      <PageHeader
        title="Flight surgeon"
        meta={[
          { label: 'Signed in', value: me.name },
          { label: 'Crew', value: String(crew.length) },
          { label: 'Act now / watch', value: `${red} / ${amber}` },
          {
            label: 'Updated',
            value: data ? formatWhen(data.generatedAt, now) : '--',
          },
        ]}
      >
        <button
          type="button"
          onClick={() => {
            setToken('');
            setMe(null);
            setData(null);
          }}
          className={btn('ghost', 'h-10 cursor-pointer px-4 text-sm')}
        >
          Sign out
        </button>
      </PageHeader>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-watch">
          {error}
        </p>
      )}

      <div className="chc-fit-cols flex flex-col gap-3.5 xl:min-h-0 xl:flex-1 xl:flex-row">
        {/* Crew list, most urgent first */}
        <Panel
          title="Crew"
          aside="most urgent first"
          className="chc-scroll min-w-0 xl:w-[clamp(300px,28vw,420px)] xl:shrink-0"
        >
          {crew.map((c) => (
            <CrewRow
              key={c.crew.id}
              c={c}
              now={now}
              selected={c.crew.id === sel?.crew.id}
              onSelect={() => setSelId(c.crew.id)}
            />
          ))}
          {!crew.length && <p className="m-0 text-[14px] text-muted">No astronauts yet.</p>}
        </Panel>

        {/* Selected astronaut */}
        {sel && (
          <div className="chc-scroll flex min-w-0 flex-col gap-3.5 xl:flex-1">
            <Panel
              title={sel.crew.name}
              aside={`readiness ${sel.readiness.score} · ${sel.readiness.streak}-day streak`}
            >
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(sel.systems).map(([id, level]) => (
                  <span
                    key={id}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] ${level === 'red' ? 'border-act-l text-act' : level === 'amber' ? 'border-watch/45 text-watch' : 'border-line text-text'}`}
                  >
                    {SYSTEM_LABEL[id] ?? id}
                  </span>
                ))}
              </div>
              <Transit c={sel} now={now} />
              {sel.overdue.length > 0 && (
                <p className="m-0 text-[13px] text-muted">
                  Missed checks: {sel.overdue.map((id) => getIndicator(id)?.name ?? id).join(', ')}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void download('csv')}
                  className={btn('secondary', 'h-10 cursor-pointer px-4 text-sm')}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => void download('json')}
                  className={btn('secondary', 'h-10 cursor-pointer px-4 text-sm')}
                >
                  Export JSON
                </button>
              </div>
            </Panel>

            <Panel
              title="Trend, last 14 days"
              aside={
                <select
                  aria-label="Indicator"
                  value={indicatorId}
                  onChange={(e) => setIndicatorId(e.target.value)}
                  className="h-8 rounded-lg border border-line-2 bg-sunk px-2 font-display text-[13px] text-ink"
                >
                  {content.indicators.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              }
            >
              <div className="h-[180px]">
                {chart.values.length > 1 ? (
                  <NeonChart
                    data={chart.values}
                    min={chart.min}
                    max={chart.max}
                    band={chart.band}
                    color={TONE.normal.line}
                    label={`${indicator?.name ?? indicatorId} for ${sel.crew.name}, last 14 days`}
                  />
                ) : (
                  <p className="m-0 text-[14px] text-muted">
                    {trend === null ? 'Loading…' : 'Not enough readings that reached Earth yet.'}
                  </p>
                )}
              </div>
            </Panel>

            <Panel title="Alerts, last 7 days" aside={`${sel.alerts.length}`}>
              {sel.alerts.length ? (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {sel.alerts.slice(0, 12).map((a) => {
                    const tone = toneOf(a.level);
                    return (
                      <li
                        key={a.readingId}
                        className="flex items-center justify-between gap-2 border-b border-line pb-1.5 text-[14px] last:border-0"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{a.indicatorName}</span>{' '}
                          <span className="font-mono">
                            {formatValue(getIndicator(a.indicatorId), a.value)} {a.unit}
                          </span>
                          <span className="text-muted"> · {formatWhen(a.timestamp, now)}</span>
                          {a.label && (
                            <span className="block text-[12px] text-muted">{a.label}</span>
                          )}
                        </span>
                        <TonePill tone={tone} />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="m-0 text-[14px] text-muted">No amber or red readings.</p>
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function CrewRow({
  c,
  now,
  selected,
  onSelect,
}: {
  c: CrewOverviewItem;
  now: Date;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = toneOf(c.status);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex w-full cursor-pointer flex-col gap-1 rounded-xl border px-3 py-2.5 text-left text-ink transition-colors hover:bg-hover aria-pressed:bg-raised ${tone === 'act' ? 'border-act-l' : tone === 'watch' ? 'border-watch/45' : 'border-line'}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-medium">{c.crew.name}</span>
        <TonePill tone={tone} />
      </span>
      <span className="text-[13px] text-muted">
        Readiness {c.readiness.score}
        {c.lastReadingAt ? ` · last reading ${formatWhen(c.lastReadingAt, now)}` : ''}
        {c.alerts.length ? ` · ${c.alerts.length} alerts` : ''}
      </span>
      <Transit c={c} now={now} compact />
    </button>
  );
}

/** Comms delay: what this astronaut sent that has not reached Earth yet. */
function Transit({ c, now, compact }: { c: CrewOverviewItem; now: Date; compact?: boolean }) {
  if (!c.commsDelaySeconds) return null;
  const n = c.inTransit.count;
  const next = c.inTransit.nextArrivalAt
    ? Math.max(0, Math.round((Date.parse(c.inTransit.nextArrivalAt) - now.getTime()) / 1000))
    : null;
  const where =
    c.crew.mission === 'mars' ? 'Mars' : c.crew.mission === 'lunar' ? 'the Moon' : 'orbit';
  return (
    <span className={`text-[13px] ${n ? 'text-accent' : 'text-muted'}`}>
      {n
        ? `${n} reading${n === 1 ? '' : 's'} in transit from ${where}${next !== null ? `, next arrives in ${formatDelay(next)}` : ''}`
        : compact
          ? `${formatDelay(c.commsDelaySeconds)} delay, nothing in transit`
          : `Comms delay ${formatDelay(c.commsDelaySeconds)} one way. Everything sent has arrived.`}
    </span>
  );
}
