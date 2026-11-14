import type { ExportFile, ExportFormat } from './exportData';
import { defaultFetch, type FetchLike } from './sync';
import type {
  CrewMember,
  CrewMemberOverviewResponse,
  CrewOverviewResponse,
  CrewTrendResponse,
} from './syncProtocol';

// Typed calls for a flight-surgeon console (logic only; the screens are B's). Each function takes
// the server URL and the flight surgeon's token, and never throws: it resolves to the data or to
// an error message to show. Server-side rules: docs/backend-roadmap.md.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export interface CallOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

async function getJson<T>(
  apiUrl: string,
  path: string,
  token: string,
  { fetchImpl = defaultFetch, timeoutMs = 20_000 }: CallOptions,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetchImpl(`${apiUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, status: 0, error: 'Cannot reach the server.' };
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || body === null) {
    return { ok: false, status: res.status, error: body?.error ?? `Server error ${res.status}.` };
  }
  return { ok: true, data: body };
}

const query = (days: number | undefined) => (days === undefined ? '' : `?days=${days}`);

/** Who the token belongs to (use it to check a flight surgeon's sign-in). */
export function fetchMe(apiUrl: string, token: string, opts: CallOptions = {}) {
  return getJson<{ crew: CrewMember }>(apiUrl, '/me', token, opts);
}

/** Every astronaut at a glance, most urgent first. `alertDays`: 1–90, default 7. */
export function fetchCrewOverview(
  apiUrl: string,
  token: string,
  alertDays?: number,
  opts: CallOptions = {},
) {
  return getJson<CrewOverviewResponse>(apiUrl, `/crew/overview${query(alertDays)}`, token, opts);
}

/** One astronaut's overview. */
export function fetchCrewMemberOverview(
  apiUrl: string,
  token: string,
  crewId: string,
  alertDays?: number,
  opts: CallOptions = {},
) {
  const path = `/crew/${encodeURIComponent(crewId)}/overview${query(alertDays)}`;
  return getJson<CrewMemberOverviewResponse>(apiUrl, path, token, opts);
}

/** Chart points for one astronaut and indicator (same shape as getTrend). `days`: 1–90, default 30. */
export function fetchCrewTrend(
  apiUrl: string,
  token: string,
  crewId: string,
  indicatorId: string,
  days?: number,
  opts: CallOptions = {},
) {
  const path = `/crew/${encodeURIComponent(crewId)}/trend/${encodeURIComponent(indicatorId)}${query(days)}`;
  return getJson<CrewTrendResponse>(apiUrl, path, token, opts);
}

export interface ExportFilters {
  /** Flight surgeons: one crew member; omit for the whole crew. */
  crewId?: string;
  indicatorId?: string;
  /** ISO 8601, inclusive. */
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

/**
 * Download an export (GET /export.csv or /export.json) as a file to save. Resolves to
 * { filename, mimeType, content }; a screen can save it with a Blob download.
 */
export async function fetchExport(
  apiUrl: string,
  token: string,
  format: ExportFormat,
  filters: ExportFilters = {},
  { fetchImpl = defaultFetch, timeoutMs = 60_000 }: CallOptions = {},
): Promise<ApiResult<ExportFile>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== false) params.set(key, String(value));
  }
  const qs = params.toString();
  let res: Response;
  try {
    res = await fetchImpl(`${apiUrl}/export.${format}${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, status: 0, error: 'Cannot reach the server.' };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, status: res.status, error: body?.error ?? `Server error ${res.status}.` };
  }
  const disposition = res.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `crew-health-export.${format}`;
  const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';
  // Keep the CSV's byte-order mark (text() would drop it) so a saved file opens right in Excel.
  const content = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await res.arrayBuffer());
  return { ok: true, data: { filename, mimeType, content } };
}
