import { randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { getIndicator } from '../../src/data/content';
import { buildExport, toExportRows, type ExportFormat } from '../../src/lib/exportData';
import { CURRENT_WINDOW_HOURS, getTrend } from '../../src/lib/insights';
import type {
  CrewMember,
  CrewMemberOverviewResponse,
  CrewOverviewResponse,
  CrewTrendResponse,
  SyncChange,
  SyncResponse,
} from '../../src/lib/syncProtocol';
import { bearerToken } from './auth';
import { arrivalTime, commsDelaySeconds, isMissionId } from './comms';
import { crewRepo } from './crewRepo';
import type { Db } from './db';
import { buildCrewOverview, byUrgency } from './overview';
import { readingsRepo, toSyncChange } from './readingsRepo';
import { checkNewReading, checkPatch, checkSyncRequest, isIsoTimestamp, toIso } from './validate';

export interface AppOptions {
  /** Origins allowed to call the API from a browser. */
  corsOrigins?: string[];
  now?: () => string;
  makeId?: () => string;
  /** Comms-delay simulation speed: 0 = off (default), 1 = real time, 0.01 = 100x faster. */
  commsDelayScale?: number;
}

export const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const MAX_SYNC_BODY_BYTES = 2 * 1024 * 1024;

type Env = { Variables: { crew: CrewMember } };
type Ctx = Context<Env>;

const READ_ONLY = 'Flight surgeons have read-only access to crew readings.';
const MAX_DAYS = 90;

/** A whole number of days from the query string, 1–90, or the fallback when absent. */
function parseDays(raw: string | undefined, fallback: number): number | undefined {
  if (raw === undefined || raw === '') return fallback;
  const days = Number(raw);
  return Number.isInteger(days) && days >= 1 && days <= MAX_DAYS ? days : undefined;
}

/**
 * The HTTP API. Optional for the app: the frontend works offline from localStorage and syncs
 * through POST /sync when it can reach the server.
 *
 * Access: every route except GET /health needs "Authorization: Bearer <crew token>".
 * Astronauts read and write only their own readings. Flight surgeons read every crew member's
 * readings (filter with ?crewId=) and cannot change them.
 *
 * Comms delay (commsDelayScale > 0): the server stands for Earth. An astronaut's writes reach
 * Earth after their mission's delay, so flight surgeons' views leave them out until then.
 */
export function createApp(db: Db, opts: AppOptions = {}) {
  const now = opts.now ?? (() => new Date().toISOString());
  const makeId = opts.makeId ?? randomUUID;
  const scale = opts.commsDelayScale ?? 0;
  const readings = readingsRepo(db, now);
  const crew = crewRepo(db, now);
  const app = new Hono<Env>();

  app.use(
    '*',
    cors({
      origin: opts.corsOrigins ?? DEFAULT_CORS_ORIGINS,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Internal server error.' }, 500);
  });
  app.notFound((c) => c.json({ error: 'Not found.' }, 404));

  app.get('/health', (c) => c.json({ ok: true, time: now() }));

  // Everything registered below needs a valid crew token.
  app.use('*', async (c, next) => {
    const token = bearerToken(c.req.header('Authorization'));
    const member = token ? crew.findByToken(token) : undefined;
    if (!member) {
      c.header('WWW-Authenticate', 'Bearer');
      return c.json({ error: 'Sign in: send "Authorization: Bearer <crew token>".' }, 401);
    }
    c.set('crew', member);
    await next();
  });

  const me = (c: Ctx) => c.get('crew');
  const isSurgeon = (c: Ctx) => me(c).role === 'flight_surgeon';

  /** Whose readings this request may read. Astronauts: their own. Flight surgeons: ?crewId= or all. */
  function readScope(c: Ctx): { crewId?: string; error?: Response } {
    const asked = c.req.query('crewId');
    if (isSurgeon(c)) return { crewId: asked || undefined };
    if (asked && asked !== me(c).id) {
      return { error: c.json({ error: 'Astronauts can only read their own readings.' }, 403) };
    }
    return { crewId: me(c).id };
  }

  /** Earth-side views see only what has arrived: flight surgeons are on Earth. */
  const arrivedBy = (c: Ctx) => (isSurgeon(c) ? now() : undefined);
  /** When a write by this astronaut reaches Earth (null when there is no delay). */
  const arrivesAtFor = (member: CrewMember) => {
    const seconds = commsDelaySeconds(member.mission, scale);
    return seconds > 0 ? arrivalTime(now(), seconds) : null;
  };
  const commsFor = (member: CrewMember, at: string) => ({
    delaySeconds: commsDelaySeconds(member.mission, scale),
    inTransit: readings.inTransit(member.id, at),
  });

  app.get('/me', (c) => c.json({ crew: me(c) }));

  app.get('/crew', (c) =>
    isSurgeon(c)
      ? c.json({ crew: crew.list() })
      : c.json({ error: 'Only flight surgeons can list the crew.' }, 403),
  );

  // --- Flight-surgeon views. Built from the same rules as the crew app (src/lib/insights).

  const badDays = (c: Ctx) =>
    c.json({ error: `days must be a whole number from 1 to ${MAX_DAYS}.`, field: 'days' }, 400);

  /** The astronaut a request may look at: flight surgeons any, astronauts only themselves. */
  function astronautFor(c: Ctx, crewId: string): { member?: CrewMember; error?: Response } {
    if (!isSurgeon(c) && crewId !== me(c).id) {
      return { error: c.json({ error: 'Astronauts can only see their own data.' }, 403) };
    }
    const member = crew.get(crewId);
    if (!member) return { error: c.json({ error: 'Crew member not found.' }, 404) };
    if (member.role !== 'astronaut') {
      return { error: c.json({ error: 'Only astronauts have health readings.' }, 404) };
    }
    return { member };
  }

  // Every astronaut at a glance, most urgent first. ?days= sets the alert window (default 7).
  app.get('/crew/overview', (c) => {
    if (!isSurgeon(c)) {
      return c.json({ error: 'Only flight surgeons can see the crew overview.' }, 403);
    }
    const alertDays = parseDays(c.req.query('days'), 7);
    if (alertDays === undefined) return badDays(c);
    const at = new Date(now());
    const t = at.toISOString();
    const items = crew
      .list()
      .filter((m) => m.role === 'astronaut')
      .map((m) =>
        buildCrewOverview(
          m,
          readings.list({ crewId: m.id, arrivedBy: t }),
          at,
          alertDays,
          commsFor(m, t),
        ),
      )
      .sort(byUrgency);
    const response: CrewOverviewResponse = {
      generatedAt: t,
      commsDelayScale: scale,
      currentWindowHours: CURRENT_WINDOW_HOURS,
      alertDays,
      crew: items,
    };
    return c.json(response);
  });

  // One astronaut's overview (flight surgeons, or the astronaut themselves).
  app.get('/crew/:crewId/overview', (c) => {
    const { member, error } = astronautFor(c, c.req.param('crewId'));
    if (error) return error;
    const alertDays = parseDays(c.req.query('days'), 7);
    if (alertDays === undefined) return badDays(c);
    const at = new Date(now());
    const t = at.toISOString();
    // The astronaut sees all of their own readings; a flight surgeon only what reached Earth.
    const list = readings.list({ crewId: member!.id, arrivedBy: arrivedBy(c) && t });
    const response: CrewMemberOverviewResponse = {
      generatedAt: t,
      commsDelayScale: scale,
      currentWindowHours: CURRENT_WINDOW_HOURS,
      alertDays,
      overview: buildCrewOverview(member!, list, at, alertDays, commsFor(member!, t)),
    };
    return c.json(response);
  });

  // Chart data for one indicator: same points as getTrend() in the app. ?days= (default 30).
  app.get('/crew/:crewId/trend/:indicatorId', (c) => {
    const { member, error } = astronautFor(c, c.req.param('crewId'));
    if (error) return error;
    const indicatorId = c.req.param('indicatorId');
    if (!getIndicator(indicatorId)) {
      return c.json({ error: `Unknown indicatorId "${indicatorId}".`, field: 'indicatorId' }, 404);
    }
    const days = parseDays(c.req.query('days'), 30);
    if (days === undefined) return badDays(c);
    const list = readings.list({ crewId: member!.id, indicatorId, arrivedBy: arrivedBy(c) });
    const response: CrewTrendResponse = {
      crewId: member!.id,
      indicatorId,
      days,
      points: getTrend(indicatorId, days, list, new Date(now())),
    };
    return c.json(response);
  });

  // GET /readings?crewId=&indicatorId=&from=&to=&includeDeleted=true
  app.get('/readings', (c) => {
    const scope = readScope(c);
    if (scope.error) return scope.error;
    const { indicatorId, from, to, includeDeleted } = c.req.query();
    for (const [field, v] of Object.entries({ from, to })) {
      if (v !== undefined && !isIsoTimestamp(v)) {
        return c.json({ error: `${field} must be an ISO 8601 string.`, field }, 400);
      }
    }
    const list = readings.list({
      crewId: scope.crewId,
      indicatorId,
      from: from && toIso(from),
      to: to && toIso(to),
      includeDeleted: includeDeleted === 'true',
      arrivedBy: arrivedBy(c),
    });
    return c.json({ readings: list });
  });

  // Reading ids are unique per crew member, so flight surgeons must say whose (?crewId=).
  app.get('/readings/:id', (c) => {
    const scope = readScope(c);
    if (scope.error) return scope.error;
    if (!scope.crewId) {
      return c.json({ error: 'crewId is required for flight surgeons.', field: 'crewId' }, 400);
    }
    const reading = readings.get(scope.crewId, c.req.param('id'));
    if (!reading) return c.json({ error: 'Reading not found.' }, 404);
    const cutoff = arrivedBy(c);
    if (cutoff && reading.arrivesAt && reading.arrivesAt > cutoff) {
      return c.json({ error: 'Not received on Earth yet (still in transit).' }, 404);
    }
    return c.json({ reading });
  });

  // Create. Clients may send their own id (the app already generates UUIDs);
  // re-sending the same id returns the stored reading instead of a duplicate.
  app.post('/readings', async (c) => {
    if (isSurgeon(c)) return c.json({ error: READ_ONLY }, 403);
    const body: unknown = await c.req.json().catch(() => undefined);
    const check = checkNewReading(body, makeId, now);
    if (!check.ok) return c.json({ error: check.error, field: check.field }, 400);
    const created = readings.insert(me(c).id, check.value, arrivesAtFor(me(c)));
    if (created) return c.json({ reading: created }, 201);
    const existing = readings.get(me(c).id, check.value.id)!;
    return c.json({ reading: existing }, 200);
  });

  app.patch('/readings/:id', async (c) => {
    if (isSurgeon(c)) return c.json({ error: READ_ONLY }, 403);
    const id = c.req.param('id');
    const cur = readings.get(me(c).id, id);
    if (!cur || cur.deletedAt) return c.json({ error: 'Reading not found.' }, 404);
    const body: unknown = await c.req.json().catch(() => undefined);
    const check = checkPatch(body, cur.indicatorId);
    if (!check.ok) return c.json({ error: check.error, field: check.field }, 400);
    return c.json({ reading: readings.update(me(c).id, id, check.value, arrivesAtFor(me(c))) });
  });

  app.delete('/readings/:id', (c) => {
    if (isSurgeon(c)) return c.json({ error: READ_ONLY }, 403);
    return readings.remove(me(c).id, c.req.param('id'), arrivesAtFor(me(c)))
      ? c.body(null, 204)
      : c.json({ error: 'Reading not found.' }, 404);
  });

  // --- Export: the same rows as the offline app's export (src/lib/exportData.ts).
  // Astronauts export their own readings; flight surgeons everyone's, or one crew member's with
  // ?crewId=. Filters: indicatorId, from, to (ISO, inclusive), includeDeleted=true.
  function exportReadings(c: Ctx, format: ExportFormat) {
    const scope = readScope(c);
    if (scope.error) return scope.error;
    if (scope.crewId && !crew.get(scope.crewId) && scope.crewId !== 'local') {
      return c.json({ error: 'Crew member not found.' }, 404);
    }
    const { indicatorId, from, to, includeDeleted } = c.req.query();
    if (indicatorId && !getIndicator(indicatorId)) {
      return c.json({ error: `Unknown indicatorId "${indicatorId}".`, field: 'indicatorId' }, 400);
    }
    for (const [field, v] of Object.entries({ from, to })) {
      if (v !== undefined && !isIsoTimestamp(v)) {
        return c.json({ error: `${field} must be an ISO 8601 string.`, field }, 400);
      }
    }
    const list = readings.list({
      crewId: scope.crewId,
      indicatorId,
      from: from && toIso(from),
      to: to && toIso(to),
      includeDeleted: includeDeleted === 'true',
      arrivedBy: arrivedBy(c),
    });
    const crewNames = Object.fromEntries(crew.list().map((m) => [m.id, m.name]));
    const filters = Object.fromEntries(
      Object.entries({ crewId: scope.crewId, indicatorId, from, to, includeDeleted }).filter(
        (e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '',
      ),
    );
    const file = buildExport(toExportRows(list, { crewNames }), format, {
      exportedAt: now(),
      exportedBy: me(c),
      scope: scope.crewId ?? 'all-crew',
      filters,
    });
    return c.body(file.content, 200, {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
    });
  }

  app.get('/export.csv', (c) => exportReadings(c, 'csv'));
  app.get('/export.json', (c) => exportReadings(c, 'json'));

  // Two-way sync for an astronaut's devices. The device sends its pending changes and the
  // cursor from its last sync; the server applies them (newest updatedAt wins) and returns
  // everything of this crew member's that changed since.
  app.post(
    '/sync',
    bodyLimit({
      maxSize: MAX_SYNC_BODY_BYTES,
      onError: (c) => c.json({ error: 'Request body too large.' }, 413),
    }),
    async (c) => {
      if (isSurgeon(c)) {
        return c.json(
          { error: 'Sync is for astronauts. Flight surgeons read with GET /readings and /crew.' },
          403,
        );
      }
      const crewId = me(c).id;
      const body: unknown = await c.req.json().catch(() => undefined);
      const check = checkSyncRequest(body, now);
      if (!check.ok) return c.json({ error: check.error, field: check.field }, 400);
      const { changes, rejected } = check.value;

      // The device's mission selector sets this astronaut's comms delay from now on.
      const mission = (body as { mission?: unknown }).mission;
      if (mission !== undefined && mission !== null && !isMissionId(mission)) {
        return c.json({ error: 'mission must be iss, lunar or mars.', field: 'mission' }, 400);
      }
      let member = me(c);
      if (isMissionId(mission) && mission !== member.mission) {
        crew.setMission(crewId, mission);
        member = { ...member, mission };
      }
      const arrivesAt = arrivesAtFor(member);

      // A cursor ahead of the server means the server data was reset: send everything.
      const since = check.value.since > readings.cursor() ? 0 : check.value.since;
      const staleIds: string[] = [];
      db.exec('BEGIN');
      try {
        for (const change of changes) {
          const result = readings.applyChange(crewId, change, arrivesAt);
          if (result === 'stale') staleIds.push(change.id);
          if (result === 'indicator-mismatch') {
            rejected.push({ id: change.id, error: 'indicatorId cannot change.' });
          }
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      // Everything newer than the device's cursor, plus the winning version of any stale
      // change, so the device converges on the server's copy.
      const out = new Map<string, SyncChange>();
      for (const r of readings.changesSince(crewId, since)) out.set(r.id, toSyncChange(r));
      for (const id of staleIds) {
        const r = readings.get(crewId, id);
        if (r) out.set(id, toSyncChange(r));
      }
      const response: SyncResponse = {
        changes: [...out.values()],
        cursor: readings.cursor(),
        rejected,
      };
      return c.json(response);
    },
  );

  return app;
}
