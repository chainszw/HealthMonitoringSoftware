# CLAUDE.md: Crew Health Console

NASA Space Apps 2026 hackathon (~24h, 3 people + more than one Claude session working in parallel).
An offline React app for astronauts: log vitals → green/amber/red status + guidance, clickable body
figure, trend charts. **Offline first: data lives in localStorage; static deploy to Vercel.** An optional
API in `server/` stores readings in SQLite; the app must keep working fully without it (it will sync when
reachable). Plan: `docs/backend-roadmap.md`.

## Keep this file current (read first)

Several Claude sessions edit this repo at the same time. This file is the shared source of truth.

- **Before starting:** `git pull` (if there's a remote), read this file and `git log --oneline -15`.
- **In the same commit** as any change to the schema (`src/lib/types.ts`), folder structure, scripts,
  dependencies, storage keys, or conventions, update the matching section here (and README.md if
  user-facing).
- When you finish a notable piece of work, tick it in **Current state** and add one line to the **Changelog**
  (date, owner/session, what changed).
- Stay inside the files your owner owns (see below). If you must touch another owner's file, keep the edit
  minimal and say so in the commit message.
- Don't rewrite or reformat files you aren't otherwise changing. It causes merge conflicts with the other session.

## Commands

```bash
npm run dev        # Vite dev server :5173
npm test           # Vitest (src/**/*.test.ts + server/**/*.test.ts, node env)
npm run lint       # ESLint (flat config, eslint.config.js)
npm run format     # Prettier write (format:check to verify)
npm run build      # tsc -b (app + server) && vite build → dist/
npm run dev:server # API on :8787 (tsx watch); env PORT, DB_PATH (server/data/chc.db), CORS_ORIGINS,
                   # COMMS_DELAY_SCALE (0 = off, 1 = real time, 0.01 = Mars 13.2 s one way)
npm run demo:server # walk through the API (needs env API_TOKEN, optional SURGEON_TOKEN)
npm run demo:comms # comms-delay demo (API_TOKEN of an astronaut on Mars + SURGEON_TOKEN)
npm run build:server # production bundle → dist-server/index.js + crewCli.js (run with plain node)
npm run start:server # node dist-server/index.js (production; see "Deploy" in docs/backend-roadmap.md)
npm run crew -- list|add "<name>" <astronaut|flight_surgeon> [id]|token <id>|mission <id> <iss|lunar|mars|none>|demo
```

Sync is off by default. To turn it on locally: copy `.env.example` to `.env.local`
(`VITE_API_URL=http://localhost:8787`), run `npm run dev:server` next to `npm run dev`, and get a
crew token with `npm run crew -- demo` (a sign-in screen calls `signIn(token)`; for quick local
tests set `VITE_API_TOKEN` instead).

Before committing, run `npm run lint && npm test && npm run build && npm run format:check`.

## Stack & versions

React 19, Vite 8, TypeScript **6.0** (pinned: typescript-eslint doesn't support TS 7 yet), Tailwind 4
via `@tailwindcss/vite` (no tailwind.config; tokens in `src/index.css` `@theme`), Recharts 3,
Motion 14 (`import { motion } from 'motion/react'`), React Router 8 (`import … from 'react-router'`),
Vitest 5, ESLint 10 + Prettier 3, three.js 0.187 (+ `@types/three`, dev) for the ZOĒ 3D device only
(bundled, lazy-loaded with `/zoe`, so the app stays offline and other screens don't load it).
Server: Hono 4 + `@hono/node-server`, SQLite via Node 24's built-in `node:sqlite` (no native module),
run with `tsx`. The server imports `src/lib/*` and `src/data/content.ts` directly, so validation and status
rules are shared, never copied.

## Layout & ownership

| Owner         | Files                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: logic/data | `src/lib/*` (types, status, storage, readings, useReadings, tests), `src/data/seed.ts`, `src/data/content.ts`                                                         |
| B: visual/UX  | `src/components/*`, `src/pages/*`, `src/index.css`, `src/App.tsx`, `public/`                                                                                          |
| C: content    | `src/data/content.json`, README pitch, write-up                                                                                                                       |
| A: backend    | `server/*` (db, readingsRepo, crewRepo, auth, validate, app, index, crewCli, tests, scripts), `docs/backend-roadmap.md`, `Dockerfile`, `.dockerignore`, `render.yaml` |

Routes: `/` Dashboard, `/zoe` ZOĒ device (lazy-loaded, three.js), `/log`, `/body`, `/trends`
(lazy-loaded), `/routine`, `/sources` (sources and credits), `/surgeon` (flight-surgeon console,
lazy-loaded; needs the server and a flight-surgeon token, kept in memory only). A start screen (`StartScreen`, state in `components/startGate.ts`, in memory)
shows before them on every load: it picks the data source (`src/lib/dataSource.ts`: real server data when
the backend answers and you're signed in, else a random spike scenario from `src/data/scenarios.ts`) and
the view (ZOĒ device or Health Console).
The mission profile is owned by `Layout` and passed to pages through `useOutletContext<{ mission }>()`.

## Schema (src/lib/types.ts)

`content.json` (C's format: `meta`, `hazards`, `bodySystems`, `missionProfiles`, `indicators` with
`bands[]` and step arrays, `sources` by id) is converted by `normalizeContent` in `src/data/content.ts`
into the app shape below. Components import `content`, `getIndicator` etc. from `src/data/content`.

- `Indicator`: id, name, unit, howToMeasureInSpace (joined), howToMeasureSteps[], bodySystem,
  `ranges: Record<'green'|'amber'|'red', {min?,max?,label?}[]>`, `actions: Record<level, string>` (joined),
  actionSteps: Record<level, string[]>, sources[] {title,org?,url?}, rangesStatus ("TODO-verify" | "verified"),
  input {min,max,step} (from `INPUT_LIMITS` in `src/lib/validation.ts`), hazards[] (names), and optional
  whyItMatters, spaceflightEffect, escalation, measureFrequency, reviewNote
- `Reading`: id, indicatorId, value: number, timestamp: ISO string, note?, updatedAt? (last local
  add/edit, used by sync; absent on seed data)
- `BodySystem`: id (heart|respiratory|bone|muscle|immune|eyes|mind|sleep|metabolic), name, spaceflightEffects,
  hazards[] (names), indicatorIds[] (derived from each indicator's bodySystem), steps?[] (what to do, for
  systems no indicator covers: eyes, bone, muscle)
- `MissionProfile`: id (iss|lunar|mars), name, description, commsDelaySeconds {min,max} (one-way)
- `Content`: { disclaimer, unknownStatusAction, hazards, indicators, bodySystems, missionProfiles,
  routine: { daily, extra }, moodTags }
- `RoutineTaskContent`: id, time 'HH:MM', title, short?, why (may contain `{delay}`), category, duration?,
  indicatorIds? (task ticks itself once each has a reading that day), showWhen? ('short_sleep').
  `daily` counts for progress/streaks; `extra` is shown under "Also today". `MoodTag`: { id, label }
  (saved in the mood reading's `note`).
- Indicator ids: heart_rate, bp_systolic, bp_diastolic, blood_glucose, body_temp, spo2 (respiratory),
  sleep_hours and mood (1–5) (both mind)
- `getStatus(indicator, value, unknownAction?)` → `{ level: green|amber|red|unknown, action, label? }`.
  Bands are half-open: **min inclusive, max exclusive**; checked green → amber → red, first match wins;
  outside all bands → red.
- `validateValue(indicator, raw)` → `{ ok: true, value } | { ok: false, error }`. Run it before saving a reading.
- localStorage keys: `chc:v1:readings`, `chc:v1:mission`, `chc:v1:outbox` (changes not yet sent to the
  server, latest per id), `chc:v1:sync` ({ cursor, lastSyncedAt }), `chc:v1:session` ({ token, crew }:
  who is signed in for sync), `chc:v1:routine` (routine completions per local day),
  `chc:v1:missionStart` (optional mission start, ISO), `chc:v1:dev` (device-only dev settings, e.g. backdrop). Bump `v1` if the Reading shape changes incompatibly. Old ids
  `glucose`/`temperature` are migrated on load.
- API wire types (`src/lib/syncProtocol.ts`, shared by app and server): `SyncChange` = Reading +
  `updatedAt` + `deletedAt?`; `POST /sync { since, changes, mission? }` → `{ changes, cursor, rejected }`;
  `CrewMember` = { id, name, role: 'astronaut' | 'flight_surgeon', mission?: 'iss' | 'lunar' | 'mars' }.

## Conventions

- **All guidance/medical text lives in `src/data/content.json`, never hardcoded in components.** UI labels are fine.
- Only `src/lib/storage.ts` touches `localStorage`. Components use `useReadings()` / `useMission()`.
- Pure logic goes in `src/lib/` with a colocated `*.test.ts`. Keep `getStatus` pure.
- Function components, **named exports** (no default exports except where `React.lazy` needs adapting).
- Tailwind classes only (no CSS modules/styled-components). Design tokens (v0.6 = the v0.3 palette) in `index.css` `@theme`
  (the start screen alone keeps the v0.5 neon palette via `.chc-theme-neon` on its root):
  surfaces `bg-bg|surface|raised|hover|sunk`, text `text-ink|text|muted|faint`, borders `border-line|line-2`,
  `accent`, status `ok|watch|act` (+ `-t` tints, `act-l` border). Old `status-*`/`space-*` tokens remain for now.
- UI status is a `Tone` (`normal|watch|act`, `src/components/tone.ts`), always shown as shape + word + colour
  (`StatusPill`/`StatusIcon` in `components/ui.tsx`). Map `getStatus` levels green/amber/red → normal/watch/act.
  SVG needs hex colours: use `TONE[t].hex`, kept in sync with `index.css`.
- Icons: inline stroke SVGs in `components/icons.tsx` (no icon library, no emoji).
- TypeScript strict; no `any`. Prettier: single quotes, semicolons, width 100.
- Seed data is deterministic (`generateSeed(days, now, seed)`). Keep scripted amber/red events for the demo.

## Don'ts

- **Don't make the frontend depend on the server.** The API in `server/` is optional sync; every page must
  work offline from localStorage. Components never call `fetch` directly: server access goes through
  `src/lib` (A), behind `useReadings()`.
- Don't add user accounts/OAuth, another database, or new heavy dependencies without asking the team
  (the API uses simple per-crew-member bearer tokens; see `docs/backend-roadmap.md`).
- Don't call external APIs or CDNs at runtime: the app must work fully offline.
- Don't change `types.ts` silently. It's the shared contract (see "Keep this file current").
- Don't push or force-push without being asked.

## Current state

- [x] Scaffold: Vite/React/TS, Tailwind, ESLint/Prettier, Vitest, Vercel config
- [x] Types, content.json (placeholders), getStatus + tests, seed + tests, storage + tests
- [x] Routed shell; functional placeholder components (StatusCard, VitalsForm, BodyFigure, TrendChart, Streak, Disclaimer)
- [ ] Real content and sources in content.json; ranges verified (C)
- [x] Visual design pass from the design canvas: shell, Dashboard, Body, Log, Trends, Routine (B, layout only)
- [x] Trend chart amber/red markers, date range filter (B, on mock data)
- [x] Wire the new screens to real data (`useReadings`, `insights.ts`, content.json), then delete `src/pages/designMock.ts` (B)
- [x] Crew sign-in, sync status and "Send report" (sync now) in the header (B/A)
- [ ] Mobile layout pass (B)
- [x] Edit/delete readings, export data (A): logic done (`useReadings().update/remove`, API PATCH/DELETE,
      `exportDeviceReadings`, `/export.csv|json`); the buttons and screens are B's
- [x] Backend phases 0–1: `server/` skeleton, SQLite, readings CRUD API + tests (A)
- [x] Backend phase 3: `POST /sync` + offline outbox and background sync in `src/lib` (A)
- [x] Backend phase 2: crew members, roles (astronaut, flight surgeon), bearer tokens, `crew` CLI (A)
- [x] Backend phase 4: flight-surgeon crew overview, per-member overview and trend endpoints (A)
- [x] Backend phase 5: CSV/JSON export, shared by the offline app and the API (A)
- [x] Backend phase 6: comms-delay simulation (Earth-side views see data after the mission's delay) (A)
- [ ] Backend phase 7: deploy (A): deploy-ready (bundle, Dockerfile, render.yaml, CI image check,
      hardening); the actual deploy needs the team's GitHub merge, a host account and Vercel's
      `VITE_API_URL`
- [ ] Mission comms-delay feature beyond the description card (A/B): backend done (`inTransit`,
      `commsDelaySeconds` in the overview); showing it is B's
- [ ] Optional: PWA/service worker for true offline install (ask first)

## Changelog

- 2026-11-14: Initial scaffold (Claude session 1).
- 2026-11-15: A: content adapter for C's new content.json; half-open bands; `validateValue`; new ids
  `blood_glucose`/`body_temp`; `respiratory` system; placeholder bodySystems/missionProfiles restored in content.json.
- 2026-11-15: A: optional backend in `server/` (Hono, node:sqlite): readings CRUD API with shared validation,
  soft deletes, idempotent client ids; `dev:server`/`demo:server` scripts; `docs/backend-roadmap.md`.
- 2026-11-15: A: sync (roadmap phase 3): `POST /sync` with a change-counter cursor and last-write-wins;
  offline outbox, edit/delete and background sync in `src/lib`; `useReadings()` gains `update`/`remove`;
  new `useSync()`; storage keys `chc:v1:outbox`, `chc:v1:sync`; `VITE_API_URL` turns sync on.
- 2026-11-15: A: crew and roles (roadmap phase 2): bearer tokens (hashed), astronauts see only their own
  readings, flight surgeons read everyone's (read-only); `GET /me`, `GET /crew`; readings keyed by
  (crew, id); `npm run crew` CLI with a demo crew; `signIn`/`signOut`/`useSession()`; key `chc:v1:session`.
- 2026-11-15: A: flight-surgeon views (roadmap phase 4): `GET /crew/overview`, `/crew/:id/overview`,
  `/crew/:id/trend/:indicatorId` built on the shared insights; typed calls in `src/lib/crewApi.ts`;
  demo crew now shows red/amber/green astronauts.
- 2026-11-15: A: export (roadmap phase 5): `src/lib/exportData.ts` (CSV/JSON, formula-safe CSV, offline
  `exportDeviceReadings`), `GET /export.csv` and `/export.json`, `fetchExport()`; README data schema
  section updated to C's content format.
- 2026-11-15: A: comms delay (roadmap phase 6): `COMMS_DELAY_SCALE`; mission per astronaut (sent by the
  app with each sync, or `npm run crew -- mission`); readings get `arrives_at`; flight-surgeon views
  show only what reached Earth, with `inTransit` and `commsDelaySeconds` in the overview; `demo:comms`.
- 2026-11-15: A: deploy-ready (roadmap phase 7): `build:server` bundle (`dist-server/`), `Dockerfile`,
  `render.yaml`, CI builds the bundle and the image; `CORS_ORIGINS` wildcards; security headers, 64 KB
  body limit on readings, request log, clean shutdown.
- 2026-11-15: B: design v0.3 implemented as layout (mock data, not wired): new shell, all screens, `/routine` route (Claude, B session).
- 2026-11-15: B: mock frontend redesign: all five screens fit 1366×768 laptops up to big monitors without page scroll (healthcare-ui-design skill); `content.ts` cast through `unknown` so the build passes until A reconciles content.json with types.ts (Claude, B session).
- 2026-11-15: A: merged B's redesign into the backend work; `content.ts` keeps A's `normalizeContent` adapter, which replaces B's temporary cast.
- 2026-11-15: A: logic for B's new screens: `src/lib/today.ts` (combined blood pressure, needs-attention list,
  due checks, readiness breakdown, mission day) and `src/lib/routine.ts` (completions, streak, week);
  hooks `useRoutine(tasks)`, `useMissionDay()`; keys `chc:v1:routine`, `chc:v1:missionStart`.
- 2026-11-15: Screens wired to real data (session at the user's request, editing A's, B's and C's files):
  content.json gains `routine`, `moodTags` and body-system `steps` (PLACEHOLDER text for C); `trends.ts`,
  `format.ts`, `requestSync`, `validateBloodPressure`, routine tasks tick from readings; seed ends on amber
  BP after three short nights; every screen reads `useReadings()`; header gets crew sign-in, sync badge and
  "Send report"; `designMock.ts` and `?alert` removed.
- 2026-11-15: Sync fix: local edits/deletes are versioned after the reading's previous version, so a
  same-millisecond edit + delete no longer loses the delete (failing `sync.e2e` test, also on `main`).
- 2026-11-15: Renamed to **Aegis Health Console** (session at the user's request, editing A's and B's files):
  matte blue glass theme (v0.4 tokens), animated body figure (`FigureArt`) with a `model` slot for a 3D
  character, live crew panel on Today, chart draw-in and spike ▲/▼ markers; start screen with data-source
  detection (`dataSource.ts`, `scenarios.ts`, `generateSeed` takes a `SeedScript`, storage
  `applyDemoReadings`/`dropDemoReadings`/`isDemoReading`); ZOĒ 3D device ported from the team's artifact
  (`components/zoe/*`, `pages/Zoe.tsx`), whose simulated finger scan (`lib/zoeScan.ts`) saves pulse, SpO2,
  temperature and glucose as readings that sync. New dependency: three.js.
- 2026-11-15: Neon matrix redesign (v0.5 tokens, same session): flat colours only, **no gradients**
  anywhere; `.bg-surface` panels are frameless HUD plates with neon corner brackets; `MatrixRain` behind
  the app; Today's vitals are floating read-out rows (`VitalRow`, `NeonChart` canvas) instead of tiles;
  charts flow (sliding stream in demo, flowing dashes + sweep on real data); in demo mode the numbers
  change every second (`components/live.ts`, display only, nothing saved); start screen split
  diagonally (ZOĒ vs Console) in a graffiti style. `VitalCard`/`Sparkline` are no longer used on Today.
- 2026-11-15: 3D anatomy + clear-case ZOĒ + calm background (same session): the team's crew-anatomy kit
  is in: `public/models/{male,female}.glb` (~10 MB each, Human Reference Atlas v1.5, **CC BY 4.0, keep
  `public/models/ATTRIBUTION.md`**), viewer in `components/anatomy/` (`AnatomyViewer`, lazy
  `AnatomyStage`, `organs.ts` with organ→body-system map and status tint). Today's crew panel and Body
  view show it (organs tinted Watch/Act by system status; Body view has layers and male/female). ZOĒ is
  ported from the "ZOĒ clear-case sensor model" artifact (see-through case, 19 numbered sensor markers,
  parts list; the tesseract frame is gone). Background is calm flat blue with a breathing dot field
  (`CalmDots`, replaces `MatrixRain`).
- 2026-11-15: B: visual overhaul back to the v0.3 look (session at the user's request): v0.3 tokens
  restored (neon v0.5 scoped to the start screen with `.chc-theme-neon`); mission-sky backdrop and dev
  panel from `b/backdrops` (`components/backdrop/`, `DevPanel`, `?bg=sky|grid|aurora`, `?dev`, key
  `chc:v1:dev`, `loadDevSettings`/`saveDevSetting` in A's `storage.ts`) replace `CalmDots` in the shell;
  Today's vital rows are status-bordered cards with the live charts on a grid panel. No features removed.
- 2026-11-15: B: Today drops the crew 3D panel (anatomy stays on Body view); the six vitals are a 3×2 grid
  of cards with their live charts (`VitalRow`). `CrewCharacter` is unused for now, not deleted.
- 2026-11-15: Placeholders connected (session at the user's request, editing A's, B's and C's files):
  the 29 `PLACEHOLDER:` texts in content.json replaced with final wording (in-place, nothing else
  touched; C may still revise); footer link opens a new `/sources` page (`contentSources`/`contentMeta`
  from `content.ts`, HRA and ZOĒ credits); account menu exports the device's readings as CSV/JSON
  (`components/download.ts`); `/surgeon` flight-surgeon console wires `crewApi.ts` (overview every 15 s,
  per-astronaut trend, server export, comms-delay "in transit" line when `COMMS_DELAY_SCALE` > 0).

## Person B — status

Person B owns visuals and UX. Only Person B's sessions edit this section.

- **Done:** design v0.3 layout for every screen (`/`, `/body`, `/log`, `/trends`, `/routine`) plus the app shell;
  fit-to-screen redesign; all screens wired to real data (done from another session at the user's request,
  branch `wire-screens`): `designMock.ts` deleted.
- **Next:**
  1. Mobile layout pass (no horizontal scroll at 390 px already; layout polish left).
  2. Optional: real timers for "re-measure in 15 min" (content.json has no durations yet, so they were removed).
- **Decisions and gotchas:**
  - Screen view helpers live in `components/vitals.ts`: an "entry" is an indicator id or `'bp'` (systolic +
    diastolic logged together); `entryStatus`, `dueEntries`, short labels/units (`Blood oxygen`, `h`), `logHref`.
  - `/log?i=<entry>` opens that entry's form (used by every "Re-measure"/"Log" link).
  - Unknown status (no current reading) has no tone: `toneOf()` returns null, shown as `NoDataPill`/`TonePill`.
  - "Flag for surgeon" buttons and fake timers are gone: readings reach the flight surgeon through sync, so
    screens say "Your flight surgeon sees this after the next sync" when sync is on. The Trends note is saved
    as the latest reading's `note`.
  - Header: `AccountMenu` (avatar) signs in with a crew token, shows sync state, signs out, resets demo data.
    The "Send report" button calls `requestSync()` and is hidden when sync is off.
  - Body figure is a flat 2D SVG (`BodyFigure.tsx`), not the design's three.js model: no new heavy dependency,
    works offline. Callouts cover mind/eyes/heart/lungs/immune/bone (`components/figure.ts`, short labels);
    metabolic is listed only. Leader lines are measured with a ResizeObserver.
  - Trends uses a hand-drawn SVG chart (matches the design); Recharts and `TrendChart.tsx` are unused now.
  - Fonts: Instrument Sans / DM Mono only if installed locally (no Google Fonts at runtime); bundling needs a dependency, so ask first.
  - Every screen fits with no page scroll from 1280×600 up (1366×768 laptops through big monitors): `.chc-fit*` / `.chc-scroll` in `index.css`. Pages use `xl:min-h-0` chains and put long lists in inner scroll areas. Below that, normal stacked flow.
  - Page headers use the compact `PageHeader` (`components/ui.tsx`); `PageTitle` is unused.
  - Status colour rule: amber/red only for abnormal items; normal text is neutral, only the small pill/icon is green.
  - Demo: the seed ends on amber BP 134/86 after three short nights; log e.g. 160/125 to show Act now.
  - Unused for now, not deleted: `StatusCard`, `VitalsForm`, `Streak`, `TrendChart`, `Disclaimer`.

## Person A — status

Person A owns logic and data. Only Person A's sessions edit this section.

- **Done:**
  - `a/contract`: added `getSystemStatus`, `getTrend` and `getReadiness` in `src/lib/insights.ts`, with tests, plus the CI workflow (lint, build, test on PRs and main).
  - `a/content-adapter`: `normalizeContent` maps C's content.json format to the app types; getStatus uses half-open bands and returns the band label; `validateValue` + `INPUT_LIMITS`; seed retuned to the new bands; stored-id migration.
  - `a/backend-readings` (roadmap phases 0–1): `server/` with `GET /health`, `GET /readings?indicatorId&from&to&includeDeleted`, `GET/PATCH/DELETE /readings/:id`, `POST /readings`. Built on `a/content-adapter`.
  - `a/sync` (roadmap phase 3): `POST /sync`; client outbox and background sync in `src/lib/storage.ts` and `src/lib/sync.ts`; `useReadings()` shared across components via `useSyncExternalStore`; `useSync()`. Built on `a/backend-readings`. Verified live: push, pull of another device's edit, and an offline reading catching up after a server restart.
  - `a/crew-auth` (roadmap phase 2): crew table, hashed bearer tokens, roles, per-crew readings, `GET /me`, `GET /crew`, `npm run crew` CLI, sign-in logic. Built on `a/sync`. Verified live: 401 without a token, astronauts isolated (404/403), flight surgeon reads all crews but gets 403 on writes.
  - `a/surgeon-overview` (roadmap phase 4): `GET /crew/overview` (astronauts most urgent first: status, readiness, per-system status, latest per indicator, overdue checks, amber/red alerts), `GET /crew/:id/overview`, `GET /crew/:id/trend/:indicatorId`; `src/lib/crewApi.ts`. Built on `a/crew-auth`. Verified live with the demo crew: Mira red, Sam amber, Alex green.
  - `a/export` (roadmap phase 5): shared CSV/JSON export builder, `GET /export.csv` and `/export.json` (same access as reading), `exportDeviceReadings()` for offline export, `fetchExport()`. Built on `a/surgeon-overview`. Verified live: surgeon exports Mira's sleep as CSV; astronauts get 403 for others.
  - `a/comms-delay` (roadmap phase 6): mission per astronaut, `arrives_at` on writes from space, Earth-side filtering for flight surgeons, `inTransit` in the overview, `npm run demo:comms`. Built on `a/export`. Verified live at x0.01: Earth saw Mira's 118 bpm only after 13 s.
  - `a/deploy` (roadmap phase 7, deploy-ready): production bundle, Dockerfile, render.yaml, CI image smoke test, wildcard CORS, security headers, body limits, request log, graceful shutdown. Built on `a/comms-delay`. Verified locally: the bundle ran with plain `node`, the bundled crew tool made the demo crew, the full API walkthrough passed, CORS allowed a Vercel preview origin and blocked others, 70 KB body → 413, Ctrl+C closed the database cleanly.
  - `a/frontend-logic`: logic for B's redesigned screens (Today, Routine): `today.ts`, `routine.ts`, `useRoutine`, `useMissionDay`, with tests.
- **In progress:** none.
- **Next:**
  1. Phase 7, the actual deploy (needs the team): get the work onto GitHub `main` (merge #2, then the stacked branches), create the Render service from `render.yaml` (paid instance for the disk), set `CORS_ORIGINS`, create the crew in the Render shell, set `VITE_API_URL` on Vercel.
  - Still open on the logic side: readiness and routine prompts; mission risk emphasis.
- **Decisions and gotchas:**
  - C owns the content.json format; the app-facing types stay stable and `src/data/content.ts` adapts. If C changes the format again, update `RawContent`/`normalizeContent`, not the components.
  - `bodySystems`, `missionProfiles` and `meta.unknownStatusAction` were missing from C's file; A restored them as PLACEHOLDER text for C to rewrite. Body-system `indicatorIds` are derived, not stored. The `sleep` system currently has no indicators (C put `sleep_hours` under `mind`).
  - Input limits (whole numbers, SpO2 0–100, sleep 0–24, mood 1–5) follow C's meta.disclaimer; other bounds only reject impossible values.
  - `getStatus(indicator, value)` keeps its signature and returns `{ level, action, label? }`.
  - A reading counts as current for system status and readiness if it is at most 48h old (`CURRENT_WINDOW_HOURS`).
  - Readiness: green 100, amber 50, red 0, averaged over current indicators. It is 0 when no indicator has a current reading.
  - Server: readings keep the client's UUID, and re-POSTing an existing id returns the stored reading (200) instead of a duplicate, so offline retries are safe. Deletes are soft (`deletedAt` tombstone) so sync can propagate them. Every row has `updatedAt` for sync.
  - Auth: every route except `GET /health` needs `Authorization: Bearer <token>`. Tokens are `chc_` + 32 random bytes; only their SHA-256 hash is stored, so a lost token is replaced (`npm run crew -- token <id>`), never recovered. Crew members are added only with the CLI (no HTTP endpoint for that). Astronauts read and write only their own readings and use `/sync`. Flight surgeons read everyone's (`?crewId=` to filter) and get 403 on any write and on `/sync`.
  - Readings are keyed by (crew_id, id): ids only need to be unique per crew member, and a crewmate's id never reveals their reading. Rows from before phase 2 kept crew `local`, which only flight surgeons can see.
  - Sign-in (client): `signIn(token)` checks the token with `GET /me` and refuses flight-surgeon tokens in the crew app. The first sign-in on a device keeps its readings and outbox (uploaded as that crew member's); switching to another crew member or `signOut()` clears the device's readings. `VITE_API_TOKEN` is a fallback token for local tests and demos only, because it ends up in the public JS bundle.
  - Server schema changes go in `MIGRATIONS` in `server/src/db.ts` (tracked with `PRAGMA user_version`). Never edit an applied migration; append a new one.
  - Comms delay: the server stands for Earth. Each astronaut write gets `arrives_at` = now + the mission's worst-case one-way delay (`commsDelaySeconds.max` in content.json) × `COMMS_DELAY_SCALE`. Flight-surgeon reads (readings, overview, trend, export) only include rows that have arrived; a row whose newest version is still in transit is hidden as a whole (simplification: an edit hides the old version too). The astronaut's own views and `/sync` are not delayed, since their devices are with them. With the scale at 0 (default) nothing changes and the clock is not even read.
  - Sync: every server write takes the next `seq` (change counter); devices send their last `cursor` and get everything with a higher `seq`. Conflicts: the newest `updatedAt` wins, the server wins ties, and a stale change gets the server's version back, so devices converge. A device always versions a change at least 1 ms after the reading's previous version (`nextVersion` in `storage.ts`), so an edit then a delete in the same millisecond, or after the clock steps back, isn't lost to a tie. Device clocks more than 24h ahead are refused.
  - Sync, client side: add/edit/delete write locally first, then queue the latest version per id in the outbox; background sync runs on start, about 1s after a change, every 30s, and on `online`/`focus`. Seed readings are never pushed (each device has its own demo data). Reset and clear are local only: they drop pending changes and set the cursor back to 0, so the next sync pulls the server's copy again. A change the server refuses is dropped from the outbox and reported in `useSync().error`.
  - All browser-only APIs in shared `src/lib` files are typed locally (no DOM types), because the server typechecks those files too.
  - On Windows (`core.autocrlf=true`), `npm run format:check` flags every file for CRLF line endings. Use `npx prettier --check --end-of-line auto .` locally. Git stores LF, so CI is unaffected.
- **Contract (for B):**
  - Import from `src/lib/insights`. Each function takes `readings` as an optional argument, so pass `readings` from `useReadings()` to stay in sync with state.
  - `getSystemStatus(systemId, readings?)` returns `'green' | 'amber' | 'red' | 'unknown'`.
  - `getTrend(indicatorId, days, readings?)` returns `{ timestamp, label, value, level }[]`. Use `label` for the x-axis and `value` for the line; `level` can colour amber/red dots.
  - `getReadiness(readings?)` returns `{ score, streak }`.
  - `validateValue(indicator, raw)` from `src/lib/validation`: call it in VitalsForm before `add()` and show `error` if not ok.
  - New optional detail for UI: `indicator.howToMeasureSteps`, `actionSteps[level]` (render as lists), `whyItMatters`, `escalation`, `status.label`. SpO2 now belongs to the new `respiratory` system, which BodyFigure has no region for yet.
  - `useReadings()` returns `{ readings, add, update, remove, reset, clear }`. New: `update(id, { value?, timestamp?, note? })` and `remove(id)` for edit/delete UI. All components see the same readings, including changes pulled from the server; pages need no changes for sync.
  - `useSync()` (from `src/lib/useReadings`) returns `{ status: 'disabled' | 'signed-out' | 'offline' | 'syncing' | 'synced' | 'error', pending, lastSyncedAt?, error? }`, if B wants to show sync state anywhere. `'disabled'` means no `VITE_API_URL`; `'signed-out'` means no valid crew token.
  - `useSession()` (from `src/lib/useReadings`) returns `{ session, signIn, signOut }` for a sign-in screen. `session` is `{ token, crew: { id, name, role } }` or null. `await signIn(token)` resolves to `{ ok: true, crew }` or `{ ok: false, error }` (a message to show). `signOut()` also clears the device's readings.
  - A frontend outside this repo can call the HTTP API directly (send `Authorization: Bearer <token>`): see `docs/backend-roadmap.md`.
  - Flight-surgeon console: `fetchCrewOverview(apiUrl, token, alertDays?)`, `fetchCrewMemberOverview(...)`, `fetchCrewTrend(apiUrl, token, crewId, indicatorId, days?)` and `fetchMe(...)` from `src/lib/crewApi.ts`. Each resolves to `{ ok: true, data }` or `{ ok: false, status, error }` (never throws). Response types in `src/lib/syncProtocol.ts`; trend points have the same shape as `getTrend()`, so `TrendChart` can draw them.
  - Export: `exportDeviceReadings(readings, 'csv' | 'json', session?.crew)` from `src/lib/exportData.ts` returns `{ filename, mimeType, content }` offline; a console uses `fetchExport(apiUrl, token, format, filters)`. Saving the file (Blob download) is UI.
  - Series and formatting (`src/lib/trends.ts`, `src/lib/format.ts`): `dailySeries`/`bpDailySeries`/`seriesFor(key, days, readings)` → one slot per local day (latest reading or null; BP has `value2` = diastolic and the worse level); `summarizeSeries(slots, tolerance)` → `{ total, inRange, off, worst, latest, direction }`; `chartDomain`, `lastDays`; `formatValue`, `greenBand`, `formatRange` ("60–100"), `formatDelay` ("22 min"), `formatWhen`, `formatClock`.
  - `requestSync()` (`src/lib/sync.ts`) syncs now; returns false when sync is off. `validateBloodPressure(sys, dia, rawSys, rawDia)` in `validation.ts`.
  - Today screen (`src/lib/today.ts`, pass `readings` from `useReadings()`): `bloodPressureStatus(readings)` → `{ level, action, display: '134/86', systolic?, diastolic? }` (worse of the two, per content.json); `getAttention(readings)` → amber/red items, red first, with `name`, `value`, `unit`, `label`, `action`, `actionSteps` (blood pressure as one item, key `'bp'`); `getDueChecks(readings)` → daily checks not yet logged today (glucose is not daily); `getReadinessBreakdown(readings, now?, routine?)` → `{ score, streak, level, vitals: { ok, off }, sleep: { hours?, target, level }, routine? }`; `useMissionDay()` → day number (from `chc:v1:missionStart`, else the first reading).
  - Routine screen: `useRoutine(tasks)` (tasks `{ id, time?: 'HH:MM', indicatorIds?, ...your fields }`, from `content.routine`) → `{ day: { items: [{ task, doneAt?, overdue, fromReadings? }], done, total }, streak, week: [{ day, done: 0–1 }] x7, toggle(taskId) }`. Tasks with `indicatorIds` are done once each indicator has a reading that day. Pass `day.done`/`day.total` to `getReadinessBreakdown` for the Routine part.
  - Comms delay: the app already sends the selected mission with every sync. A flight-surgeon screen can show each astronaut's `commsDelaySeconds` and `inTransit: { count, nextArrivalAt }` from the overview ("1 reading in transit from Mars, arrives in 8 s").
