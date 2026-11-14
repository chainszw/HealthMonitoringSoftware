import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Db } from './db';
import { readingsRepo } from './readingsRepo';
import { checkNewReading, checkPatch, isIsoTimestamp } from './validate';

export interface AppOptions {
  /** Origins allowed to call the API from a browser. */
  corsOrigins?: string[];
  now?: () => string;
  makeId?: () => string;
}

export const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

/**
 * The HTTP API. Optional for the app: the frontend works offline from localStorage
 * and will sync with this server when it can (roadmap phase 3).
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
      from,
      to,
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

  return app;
}
