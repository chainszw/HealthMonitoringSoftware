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
| 2     | Crew members and roles (astronaut, flight surgeon), bearer tokens  | Next   |
| 3     | `POST /sync` plus a sync queue behind `storage.ts` / `useReadings` | Done   |
| 4     | Flight-surgeon endpoints: crew overview, per-crew trends           |        |
| 5     | Export: `GET /export.json`, `GET /export.csv`                      |        |
| 6     | Optional demo: hold sync replies for the mission's comms delay     |        |
| 7     | Deploy (Render or Fly.io), `VITE_API_URL` on Vercel, CORS          |        |

The minimum that demos is phases 0, 1, 3 and 7. Without `VITE_API_URL` the app stays local-only.
Do phase 2 before a public deploy: until then every device shares one log.

## Run it

```bash
npm run dev:server   # http://localhost:8787, SQLite file in server/data/chc.db
npm run demo:server  # in a second terminal: walks through every endpoint
```

Environment variables: `PORT` (default 8787), `DB_PATH` (default `server/data/chc.db`),
`CORS_ORIGINS` (comma-separated, default the Vite dev server on :5173).

To make the app in this repo sync with it, copy `.env.example` to `.env.local`
(`VITE_API_URL=http://localhost:8787`) and restart `npm run dev`.

## API

All bodies are JSON. Errors return `{ "error": "...", "field": "value" }` with status 400 or 404.

| Method | Path            | Notes                                                                 |
| ------ | --------------- | --------------------------------------------------------------------- |
| GET    | `/health`       | `{ ok: true, time }`                                                  |
| GET    | `/readings`     | Query: `indicatorId`, `from`, `to` (ISO, inclusive), `includeDeleted` |
| GET    | `/readings/:id` | Also returns soft-deleted readings (with `deletedAt`)                 |
| POST   | `/readings`     | `{ id?, indicatorId, value, timestamp?, note? }` → 201                |
| PATCH  | `/readings/:id` | Any of `{ value, timestamp, note }`; `note: null` clears it           |
| DELETE | `/readings/:id` | Soft delete → 204; the row is kept as a tombstone for sync            |
| POST   | `/sync`         | Two-way sync for offline devices (see below)                          |

Rules:

- `value` is checked with the same `validateValue()` the log form uses (whole numbers, SpO2 0–100,
  sleep 0–24, mood 1–5, and so on), against the indicator in `content.json`.
- `id` is optional; the app already generates UUIDs. Re-sending an existing `id` returns the stored
  reading with 200 instead of creating a duplicate, so offline retries are safe.
- A reading's `indicatorId` can't be changed; delete it and create a new one.
- Stored readings add `createdAt`, `updatedAt` and, once deleted, `deletedAt`.

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

The app in this repo already does this in `src/lib/sync.ts`:

- Local edits go into an outbox (`chc:v1:outbox`).
- It syncs on start, about 1s after a change, every 30s, and when the browser comes back online.
- `useSync()` reports `{ status, pending, lastSyncedAt, error }`.
