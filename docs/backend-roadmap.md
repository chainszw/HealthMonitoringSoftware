# Backend roadmap

Owner: Person A. The backend is **optional sync**. The app keeps working offline from `localStorage`
(on Mars the server is up to 22 minutes away) and syncs with the server when it can reach it. B's
components never call the server: everything goes through `src/lib` behind `useReadings()`.

Code lives in `server/` in this repo, so it imports the app's types, `validateValue()` and the status
rules directly instead of copying them.

| Phase | What                                                               | Status |
| ----- | ------------------------------------------------------------------ | ------ |
| 0     | Skeleton: Hono server, `GET /health`, tests, CI                    | Done   |
| 1     | Readings API: list, get, create, edit, soft delete                 | Done   |
| 2     | Crew members and roles (astronaut, flight surgeon), bearer tokens  | Done   |
| 3     | `POST /sync` plus a sync queue behind `storage.ts` / `useReadings` | Done   |
| 4     | Flight-surgeon endpoints: crew overview, per-crew trends           | Done   |
| 5     | Export: `GET /export.json`, `GET /export.csv`                      | Done   |
| 6     | Comms-delay demo: Earth sees data after the mission's delay        | Done   |
| 7     | Deploy (Render or Fly.io), `VITE_API_URL` on Vercel, CORS          | Next   |

The minimum that demos is phases 0, 1, 3 and 7. Without `VITE_API_URL` the app stays local-only.

## Run it

```bash
npm run dev:server   # http://localhost:8787, SQLite file in server/data/chc.db
npm run crew -- demo # demo crew: 1 flight surgeon + 3 astronauts with 30 days of readings; prints tokens
# then, in PowerShell: $env:API_TOKEN = 'chc_…'; $env:SURGEON_TOKEN = 'chc_…'; npm run demo:server
# comms delay: start the server with $env:COMMS_DELAY_SCALE = '0.01', then run npm run demo:comms
# with Mira Lindqvist's token (she is on Mars) as API_TOKEN
```

Environment variables: `PORT` (default 8787), `DB_PATH` (default `server/data/chc.db`),
`CORS_ORIGINS` (comma-separated, default the Vite dev server on :5173).

To make the app in this repo sync with it, copy `.env.example` to `.env.local`
(`VITE_API_URL=http://localhost:8787`) and restart `npm run dev`. The app then needs a crew token:
a sign-in screen calls `signIn(token)` from `useSession()`. For quick local tests, set
`VITE_API_TOKEN` to an astronaut token instead (never in a public build: it ends up in the JS bundle).

## Crew and access (phase 2)

Every request except `GET /health` sends `Authorization: Bearer <token>`. Without a valid token the
API answers 401. Each crew member has their own token, made with the command line on the server:

```bash
npm run crew -- list
npm run crew -- add "Alex Rivera" astronaut        # prints the token once
npm run crew -- add "Dr. Jordan Lee" flight_surgeon surgeon
npm run crew -- token alex-rivera                  # new token; the old one stops working
npm run crew -- demo                               # demo crew (fictional), new tokens each run
```

Only a hash of each token is stored, so a lost token is replaced, not recovered.

| Role             | Readings                                                   | Sync     | `/crew` |
| ---------------- | ---------------------------------------------------------- | -------- | ------- |
| `astronaut`      | Reads and writes only their own                            | Yes      | No      |
| `flight_surgeon` | Reads everyone's (`?crewId=` to filter); cannot change any | No (403) | Yes     |

Reading ids only need to be unique per crew member. Readings stored before phase 2 belong to crew
`local`, which only flight surgeons see.

## API

All bodies are JSON. Errors return `{ "error": "..." }` (plus `"field"` for validation) with status
400, 401 (no or bad token), 403 (role not allowed) or 404.

| Method | Path                           | Notes                                                                     |
| ------ | ------------------------------ | ------------------------------------------------------------------------- |
| GET    | `/health`                      | `{ ok: true, time }`; no token needed                                     |
| GET    | `/me`                          | `{ crew: { id, name, role } }` for the token                              |
| GET    | `/crew`                        | Flight surgeons: `{ crew: [...] }`                                        |
| GET    | `/crew/overview`               | Flight surgeons: every astronaut at a glance, most urgent first (below)   |
| GET    | `/crew/:id/overview`           | One astronaut (flight surgeons, or that astronaut)                        |
| GET    | `/crew/:id/trend/:indicatorId` | Chart points, `?days=` 1–90 (default 30)                                  |
| GET    | `/readings`                    | Query: `crewId` (surgeons), `indicatorId`, `from`, `to`, `includeDeleted` |
| GET    | `/readings/:id`                | Includes soft-deleted readings; flight surgeons add `?crewId=`            |
| POST   | `/readings`                    | `{ id?, indicatorId, value, timestamp?, note? }` → 201                    |
| PATCH  | `/readings/:id`                | Any of `{ value, timestamp, note }`; `note: null` clears it               |
| DELETE | `/readings/:id`                | Soft delete → 204; the row is kept as a tombstone for sync                |
| POST   | `/sync`                        | Two-way sync for offline devices (see below)                              |
| GET    | `/export.csv`, `/export.json`  | Download readings; same filters as `/readings` (see Export below)         |

Rules:

- `value` is checked with the same `validateValue()` the log form uses (whole numbers, SpO2 0–100,
  sleep 0–24, mood 1–5, and so on), against the indicator in `content.json`.
- `id` is optional; the app already generates UUIDs. Re-sending an existing `id` returns the stored
  reading with 200 instead of creating a duplicate, so offline retries are safe.
- A reading's `indicatorId` can't be changed; delete it and create a new one.
- Stored readings add `crewId`, `createdAt`, `updatedAt` and, once deleted, `deletedAt`.
- Writes (`POST`, `PATCH`, `DELETE`, `/sync`) always act on the token owner's own readings.

## Flight-surgeon views (phase 4)

Types: `CrewOverviewResponse`, `CrewMemberOverviewResponse` and `CrewTrendResponse` in
`src/lib/syncProtocol.ts`. Typed calls that never throw: `fetchMe`, `fetchCrewOverview`,
`fetchCrewMemberOverview` and `fetchCrewTrend` in `src/lib/crewApi.ts`.

`GET /crew/overview?days=7` returns `{ generatedAt, currentWindowHours: 48, alertDays, crew: [...] }`.
Each astronaut in `crew` has:

| Field               | Meaning                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `crew`              | `{ id, name, role }`                                                                              |
| `status`            | Worst current status: `red`, `amber`, `green`, or `unknown` (nothing current)                     |
| `readiness`         | `{ score, streak }`, same rules as the crew app                                                   |
| `systems`           | Status per body system, e.g. `{ heart: 'green', mind: 'red', bone: 'unknown' }`                   |
| `latest`            | Per indicator: `{ readingId, value, timestamp, level, label?, current }`                          |
| `overdue`           | Indicator ids with no reading in the last 48h (missed checks)                                     |
| `alerts`            | Amber/red readings in the last `days` days, newest first (max 50), with name, unit and band label |
| `lastReadingAt`     | Newest reading time                                                                               |
| `commsDelaySeconds` | One-way delay to Earth for the astronaut's mission at the current scale (0 = none)                |
| `inTransit`         | `{ count, nextArrivalAt? }`: changes sent from space that have not reached Earth yet              |

- Sorted most urgent first: red, amber, unknown, green; then by name.
- Statuses come from the same shared code as the crew app (`getStatus`, `getSystemStatus`,
  `getReadiness`, `getTrend` in `src/lib`), so the surgeon and the astronaut always see the same
  colour.
- A reading counts as current for 48h. Deleted readings are left out.
- `npm run crew -- demo` stamps a few readings with the current time so the demo shows Mira
  Lindqvist red, Sam Okafor amber and Alex Rivera green.

## Export (phase 5)

`GET /export.csv` and `GET /export.json` download readings as a file (`Content-Disposition:
attachment`, `Cache-Control: no-store`), named like `crew-health-<crewId|all-crew>-<date>.csv`.

- **Who:** astronauts export their own readings. Flight surgeons export everyone's, or one crew
  member's with `?crewId=`.
- **Filters:** `indicatorId`, `from`, `to` (ISO, inclusive) and `includeDeleted=true`. An unknown
  indicator or a bad date is a 400.
- **One row per reading:** crew id and name, reading id, indicator id, name and unit, value,
  `status` (green/amber/red at export time) and `band` label, `measured_at`, note, `updated_at`,
  `deleted_at`.
- **CSV** follows RFC 4180 (CRLF, quotes where needed) and starts with a UTF-8 byte-order mark so
  Excel shows units like °C. Text starting with `=`, `+`, `-` or `@` gets a leading apostrophe, so
  a note can never run as a spreadsheet formula.
- **JSON** is `{ format: 'crew-health-export', version: 1, exportedAt, exportedBy, scope, filters,
disclaimer, count, readings }`.

The same builder (`src/lib/exportData.ts`) works offline: `exportDeviceReadings(readings, 'csv',
crew?)` returns `{ filename, mimeType, content }` for a device's own readings, with no server
needed. A console downloads server exports with `fetchExport(apiUrl, token, format, filters)` from
`src/lib/crewApi.ts`.

## Comms delay (phase 6)

The server stands for Earth. Data an astronaut sends reaches Earth after their mission's one-way
light-time, so the flight surgeon sees it late. The astronaut's app keeps working on its own the
whole time.

- **Speed:** `COMMS_DELAY_SCALE` when starting the server. `0` = off (the default, no behaviour
  change), `1` = real time, `0.01` = 100x faster. The delay is the mission's worst case from
  `content.json`, so at `0.01`: ISS 0.01 s, Moon 0.013 s, Mars 13.2 s.
- **Mission:** each astronaut has one (`iss`, `lunar`, `mars`). The app sends the mission selected
  on the device with every `/sync`; `npm run crew -- mission <id> <mission|none>` sets it too. The
  demo crew is Alex on the ISS, Sam on the Moon and Mira on Mars.
- **What is delayed:** every write by an astronaut (`POST`/`PATCH`/`DELETE /readings` and `/sync`)
  gets an arrival time. Flight surgeons' reads (`/readings`, overview, trend, export) only include
  readings that have arrived. A reading whose newest version is still in transit is hidden until it
  arrives (an edit hides the older version too; a deliberate simplification).
- **What is not delayed:** the astronaut's own views and their `/sync` replies. Their devices are
  with them.
- **What the surgeon sees:** each astronaut in the overview has `commsDelaySeconds` and
  `inTransit: { count, nextArrivalAt }`; stored readings show `arrivesAt` while it is in the future.

`npm run demo:comms` shows it end to end: Mira logs 118 bpm on Mars, and the flight surgeon's view
shows "1 change in transit" with a countdown until the reading arrives about 13 s later.

## Sync (phase 3)

Types: `src/lib/syncProtocol.ts`. A device sends the changes it made offline and the cursor from its
last sync, and gets back everything that changed on the server since then.

```jsonc
// POST /sync
{
  "since": 0, // cursor from the last reply; 0 on the first sync
  "changes": [
    {
      "id": "8c5b…", // the device's UUID for the reading
      "indicatorId": "heart_rate",
      "value": 72,
      "timestamp": "2026-11-15T07:00:00.000Z", // when it was measured
      "note": "after rest", // optional
      "updatedAt": "2026-11-15T07:00:05.000Z", // when this version was written
      "deletedAt": "2026-11-15T09:00:00.000Z", // only for a deletion
    },
  ],
}
// 200 reply
{ "changes": [/* same shape */], "cursor": 42, "rejected": [{ "id": "…", "error": "…" }] }
```

Rules:

- **Cursor:** every server write gets the next number in a change counter. The reply holds every
  reading with a higher number than `since` (tombstones included) and the new `cursor`. A `since`
  ahead of the server (its data was reset) returns everything.
- **Conflicts:** last write wins on `updatedAt`. If a sent change is not newer than the server's copy,
  the server keeps its copy and includes it in the reply, so the device converges. Ties go to the
  server.
- **Validation:** each change is checked like `POST /readings`. An invalid change is listed in
  `rejected` and the rest are still applied. A whole request fails (400) only if `since` or `changes`
  is malformed, or if there are more than 1000 changes. `updatedAt` more than 24h in the future is
  refused (wrong device clock).
- **Deletes** travel as changes with `deletedAt`. A newer change without `deletedAt` restores the
  reading.
- **Who:** sync is for astronauts and covers only the token owner's readings. Flight surgeons get 403
  and read with `GET /readings` instead.

The app in this repo already does this in `src/lib/sync.ts` and `src/lib/session.ts`:

- Local edits go into an outbox (`chc:v1:outbox`).
- It syncs on start, about 1s after a change, every 30s, and when the browser comes back online.
- It sends the signed-in crew member's token (`chc:v1:session`).
- `useSync()` reports `{ status, pending, lastSyncedAt, error }`, with status `'signed-out'` when there
  is no valid token.
- `useSession()` gives a sign-in screen `{ session, signIn(token), signOut() }`.
