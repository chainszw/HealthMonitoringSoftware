import { serve } from '@hono/node-server';
import { getMissionProfile } from '../../src/data/content';
import { createApp, DEFAULT_CORS_ORIGINS } from './app';
import { MISSION_IDS, commsDelaySeconds, parseScale } from './comms';
import { parseOrigins } from './cors';
import { openDb } from './db';

// Entry point: `npm run dev:server` (development) or `node dist-server/index.js` (production,
// after `npm run build:server`). Config via env vars:
//   PORT (default 8787), DB_PATH (default server/data/chc.db),
//   CORS_ORIGINS (comma-separated; * matches one part of a host name; default the Vite dev server),
//   COMMS_DELAY_SCALE (comms-delay demo: 0 = off, 1 = real time, 0.01 = 100x faster).
const port = Number(process.env.PORT ?? 8787);
const dbPath = process.env.DB_PATH ?? 'server/data/chc.db';
const corsOrigins = parseOrigins(process.env.CORS_ORIGINS) ?? DEFAULT_CORS_ORIGINS;
const commsDelayScale = parseScale(process.env.COMMS_DELAY_SCALE);

const db = openDb(dbPath);
const app = createApp(db, { corsOrigins, commsDelayScale, logRequests: true });

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Crew Health API on http://localhost:${info.port} (db: ${dbPath})`);
  console.log(`Browser origins allowed: ${corsOrigins.join(', ')}`);
  if (commsDelayScale > 0) {
    const delays = MISSION_IDS.map((m) => {
      const s = commsDelaySeconds(m, commsDelayScale);
      return `${getMissionProfile(m)?.name ?? m} ${s < 1 ? s.toFixed(3) : s.toFixed(1)} s`;
    });
    console.log(`Comms delay x${commsDelayScale}, one way: ${delays.join(', ')}`);
  } else {
    console.log('Comms delay: off (set COMMS_DELAY_SCALE to simulate it)');
  }
});

// Hosts stop containers with SIGTERM: finish open requests, then close the database cleanly.
function shutdown(signal: string) {
  console.log(`${signal}: shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
