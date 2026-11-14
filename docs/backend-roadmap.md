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
| 4     | Flight-surgeon endpoints: crew overview, per-crew trends           | Next   |
| 5     | Export: `GET /export.json`, `GET /export.csv`                      |        |
| 6     | Optional demo: hold sync replies for the mission's comms delay     |        |
| 7     | Deploy (Render or Fly.io), `VITE_API_URL` on Vercel, CORS          |        |

The minimum that demos is phases 0, 1, 3 and 7. Without `VITE_API_URL` the app stays local-only.

## Run it

```bash
npm run dev:server   # http://localhost:8787, SQLite file in server/data/chc.db
npm run crew -- demo # demo crew: 1 flight surgeon + 3 astronauts with 30 days of readings; prints tokens
# then, in PowerShell: $env:API_TOKEN = 'chc_…'; $env:SURGEON_TOKEN = 'chc_…'; npm run demo:server
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

| Method | Path            | Notes                                                                     |
| ------ | --------------- | ------------------------------------------------------------------------- |
| GET    | `/health`       | `{ ok: true, time }`; no token needed                                     |
| GET    | `/me`           | `{ crew: { id, name, role } }` for the token                              |
| GET    | `/crew`         | Flight surgeons: `{ crew: [...] }`                                        |
| GET    | `/readings`     | Query: `crewId` (surgeons), `indicatorId`, `from`, `to`, `includeDeleted` |
| GET    | `/readings/:id` | Includes soft-deleted readings; flight surgeons add `?crewId=`            |
| POST   | `/readings`     | `{ id?, indicatorId, value, timestamp?, note? }` → 201                    |
| PATCH  | `/readings/:id` | Any of `{ value, timestamp, note }`; `note: null` clears it               |
| DELETE | `/readings/:id` | Soft delete → 204; the row is kept as a tombstone for sync                |
| POST   | `/sync`         | Two-way sync for offline devices (see below)                              |

Rules:

- `value` is checked with the same `validateValue()` the log form uses (whole numbers, SpO2 0–100,
  sleep 0–24, mood 1–5, and so on), against the indicator in `content.json`.
- `id` is optional; the app already generates UUIDs. Re-sending an existing `id` returns the stored
  reading with 200 instead of creating a duplicate, so offline retries are safe.
- A reading's `indicatorId` can't be changed; delete it and create a new one.
- Stored readings add `crewId`, `createdAt`, `updatedAt` and, once deleted, `deletedAt`.
- Writes (`POST`, `PATCH`, `DELETE`, `/sync`) always act on the token owner's own readings.

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
