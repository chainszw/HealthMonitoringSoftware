import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import type { SyncChange, SyncResponse } from '../../src/lib/syncProtocol';
import type { Db } from './db';
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

/**
 * The HTTP API. Optional for the app: the frontend works offline from localStorage
 * and syncs with this server through POST /sync when it can reach it.
 */
export function createApp(db: Db, opts: AppOptions = {}) {
  const now = opts.now ?? (() => new Date().toISOString());
  const makeId = opts.makeId ?? randomUUID;
  const repo = readingsRepo(db, now);
  const app = new Hono();

  app.use('*', cors({ origin: opts.corsOrigins ?? DEFAULT_CORS_ORIGINS }));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Internal server error.' }, 500);
  });
  app.notFound((c) => c.json({ error: 'Not found.' }, 404));

  app.get('/health', (c) => c.json({ ok: true, time: now() }));

  // GET /readings?indicatorId=&from=&to=&includeDeleted=true
  app.get('/readings', (c) => {
    const { indicatorId, from, to, includeDeleted } = c.req.query();
    for (const [field, v] of Object.entries({ from, to })) {
      if (v !== undefined && !isIsoTimestamp(v)) {
        return c.json({ error: `${field} must be an ISO 8601 string.`, field }, 400);
      }
    }
    const readings = repo.list({
      indicatorId,
      from: from && toIso(from),
      to: to && toIso(to),
      includeDeleted: includeDeleted === 'true',
    });
    return c.json({ readings });
  });

  app.get('/readings/:id', (c) => {
    const reading = repo.get(c.req.param('id'));
    return reading ? c.json({ reading }) : c.json({ error: 'Reading not found.' }, 404);
  });

  // Create. Clients may send their own id (the app already generates UUIDs);
  // re-sending the same id returns the stored reading instead of a duplicate.
  app.post('/readings', async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const check = checkNewReading(body, makeId, now);
    if (!check.ok) return c.json({ error: check.error, field: check.field }, 400);
    const created = repo.insert(check.value);
    if (created) return c.json({ reading: created }, 201);
    const existing = repo.get(check.value.id)!;
    return c.json({ reading: existing }, 200);
  });

  app.patch('/readings/:id', async (c) => {
    const id = c.req.param('id');
    const cur = repo.get(id);
    if (!cur || cur.deletedAt) return c.json({ error: 'Reading not found.' }, 404);
    const body: unknown = await c.req.json().catch(() => undefined);
    const check = checkPatch(body, cur.indicatorId);
    if (!check.ok) return c.json({ error: check.error, field: check.field }, 400);
    return c.json({ reading: repo.update(id, check.value) });
  });

  app.delete('/readings/:id', (c) =>
    repo.remove(c.req.param('id'))
      ? c.body(null, 204)
      : c.json({ error: 'Reading not found.' }, 404),
  );

  // Two-way sync. The device sends its pending changes and the cursor from its last sync;
  // the server applies them (newest updatedAt wins) and returns everything changed since.
  app.post(
    '/sync',
    bodyLimit({
      maxSize: MAX_SYNC_BODY_BYTES,
      onError: (c) => c.json({ error: 'Request body too large.' }, 413),
    }),
    async (c) => {
      const body: unknown = await c.req.json().catch(() => undefined);
      const check = checkSyncRequest(body, now);
      if (!check.ok) return c.json({ error: check.error, field: check.field }, 400);
      const { changes, rejected } = check.value;

      // A cursor ahead of the server means the server data was reset: send everything.
      const since = check.value.since > repo.cursor() ? 0 : check.value.since;
      const staleIds: string[] = [];
      db.exec('BEGIN');
      try {
        for (const change of changes) {
          const result = repo.applyChange(change);
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
      for (const r of repo.changesSince(since)) out.set(r.id, toSyncChange(r));
      for (const id of staleIds) {
        const r = repo.get(id);
        if (r) out.set(id, toSyncChange(r));
      }
      const response: SyncResponse = {
        changes: [...out.values()],
        cursor: repo.cursor(),
        rejected,
      };
      return c.json(response);
    },
  );

  return app;
}
