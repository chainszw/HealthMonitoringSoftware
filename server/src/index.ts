import { serve } from '@hono/node-server';
import { createApp, DEFAULT_CORS_ORIGINS } from './app';
import { openDb } from './db';

// Entry point: `npm run dev:server`. Config via env vars:
//   PORT (default 8787), DB_PATH (default server/data/chc.db),
//   CORS_ORIGINS (comma-separated, default the Vite dev server).
const port = Number(process.env.PORT ?? 8787);
const dbPath = process.env.DB_PATH ?? 'server/data/chc.db';
const corsOrigins =
  process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()) ?? DEFAULT_CORS_ORIGINS;

const db = openDb(dbPath);
const app = createApp(db, { corsOrigins });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Crew Health API on http://localhost:${info.port} (db: ${dbPath})`);
});
