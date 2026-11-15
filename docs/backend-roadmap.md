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
| 3     | `POST /sync` plus a sync queue behind `storage.ts` / `useReadings` |        |
| 4     | Flight-surgeon endpoints: crew overview, per-crew trends           |        |
| 5     | Export: `GET /export.json`, `GET /export.csv`                      |        |
| 6     | Optional demo: hold sync replies for the mission's comms delay     |        |
| 7     | Deploy (Render or Fly.io), `VITE_API_URL` on Vercel, CORS          |        |

The minimum that demos is phases 0, 1, 3 and 7. Without `VITE_API_URL` the app stays local-only.

## Run it

```bash
npm run dev:server   # http://localhost:8787, SQLite file in server/data/chc.db
npm run demo:server  # in a second terminal: walks through every endpoint
```

Environment variables: `PORT` (default 8787), `DB_PATH` (default `server/data/chc.db`),
`CORS_ORIGINS` (comma-separated, default the Vite dev server on :5173).

## API (phase 1)

All bodies are JSON. Errors return `{ "error": "...", "field": "value" }` with status 400 or 404.

| Method | Path            | Notes                                                                 |
| ------ | --------------- | --------------------------------------------------------------------- |
| GET    | `/health`       | `{ ok: true, time }`                                                  |
| GET    | `/readings`     | Query: `indicatorId`, `from`, `to` (ISO, inclusive), `includeDeleted` |
| GET    | `/readings/:id` | Also returns soft-deleted readings (with `deletedAt`)                 |
| POST   | `/readings`     | `{ id?, indicatorId, value, timestamp?, note? }` → 201                |
| PATCH  | `/readings/:id` | Any of `{ value, timestamp, note }`; `note: null` clears it           |
| DELETE | `/readings/:id` | Soft delete → 204; the row is kept as a tombstone for sync            |

Rules:

- `value` is checked with the same `validateValue()` the log form uses (whole numbers, SpO2 0–100,
  sleep 0–24, mood 1–5, and so on), against the indicator in `content.json`.
- `id` is optional; the app already generates UUIDs. Re-sending an existing `id` returns the stored
  reading with 200 instead of creating a duplicate, so offline retries are safe.
- A reading's `indicatorId` can't be changed; delete it and create a new one.
- Stored readings add `createdAt`, `updatedAt` and, once deleted, `deletedAt`.

## Phase 3 design (sync)

- `POST /sync { since, changes: StoredReading[] }` applies the device's changes and returns
  `{ changes, serverTime }`: everything updated on the server after `since`.
- Conflicts: the newer `updatedAt` wins. Deletes travel as tombstones.
- Client: `storage.ts` stays the source of truth. Each add, edit and delete also goes into a queue in
  localStorage. A background sync sends the queue when online and merges what comes back.
- For B: a `useSync()` hook returns `{ status: 'offline' | 'syncing' | 'synced', lastSyncedAt }` for a
  small badge. Nothing else changes in the components.
