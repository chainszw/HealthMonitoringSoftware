import { randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { getIndicator } from '../../src/data/content';
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
 */
export function createApp(db: Db, opts: AppOptions = {}) {
  const now = opts.now ?? (() => new Date().toISOString());
  const makeId = opts.makeId ?? randomUUID;
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
    const items = crew
      .list()
      .filter((m) => m.role === 'astronaut')
      .map((m) => buildCrewOverview(m, readings.list({ crewId: m.id }), at, alertDays))
      .sort(byUrgency);
    const response: CrewOverviewResponse = {
      generatedAt: at.toISOString(),
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
    const response: CrewMemberOverviewResponse = {
      generatedAt: at.toISOString(),
      currentWindowHours: CURRENT_WINDOW_HOURS,
      alertDays,
      overview: buildCrewOverview(member!, readings.list({ crewId: member!.id }), at, alertDays),
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
    const list = readings.list({ crewId: member!.id, indicatorId });
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
    return reading ? c.json({ reading }) : c.json({ error: 'Reading not found.' }, 404);
  });

  // Create. Clients may send their own id (the app already generates UUIDs);
  // re-sending the same id returns the stored reading instead of a duplicate.
  app.post('/readings', async (c) => {
    if (isSurgeon(c)) return c.json({ error: READ_ONLY }, 403);
    const body: unknown = await c.req.json().catch(() => undefined);
    const check = checkNewReading(body, makeId, now);
    if (!check.ok) return c.json({ error: check.error, field: check.field }, 400);
    const created = readings.insert(me(c).id, check.value);
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
    return c.json({ reading: readings.update(me(c).id, id, check.value) });
  });

  app.delete('/readings/:id', (c) => {
    if (isSurgeon(c)) return c.json({ error: READ_ONLY }, 403);
    return readings.remove(me(c).id, c.req.param('id'))
      ? c.body(null, 204)
      : c.json({ error: 'Reading not found.' }, 404);
  });

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

      // A cursor ahead of the server means the server data was reset: send everything.
      const since = check.value.since > readings.cursor() ? 0 : check.value.since;
      const staleIds: string[] = [];
      db.exec('BEGIN');
      try {
        for (const change of changes) {
          const result = readings.applyChange(crewId, change);
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
