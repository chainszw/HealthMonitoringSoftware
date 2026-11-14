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
npm run dev:server # API on :8787 (tsx watch); env PORT, DB_PATH (server/data/chc.db), CORS_ORIGINS
npm run demo:server # walk through the API against a running server
```

Before committing, run `npm run lint && npm test && npm run build && npm run format:check`.

## Stack & versions

React 19, Vite 8, TypeScript **6.0** (pinned: typescript-eslint doesn't support TS 7 yet), Tailwind 4
via `@tailwindcss/vite` (no tailwind.config; tokens in `src/index.css` `@theme`), Recharts 3,
Motion 14 (`import { motion } from 'motion/react'`), React Router 8 (`import … from 'react-router'`),
Vitest 5, ESLint 10 + Prettier 3.
Server: Hono 4 + `@hono/node-server`, SQLite via Node 24's built-in `node:sqlite` (no native module),
run with `tsx`. The server imports `src/lib/*` and `src/data/content.ts` directly, so validation and status
rules are shared, never copied.

## Layout & ownership

| Owner         | Files                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| A: logic/data | `src/lib/*` (types, status, storage, readings, useReadings, tests), `src/data/seed.ts`, `src/data/content.ts` |
| B: visual/UX  | `src/components/*`, `src/pages/*`, `src/index.css`, `src/App.tsx`, `public/`                                  |
| C: content    | `src/data/content.json`, README pitch, write-up                                                               |
| A: backend    | `server/*` (db, readingsRepo, validate, app, index, tests, scripts), `docs/backend-roadmap.md`                |

Routes: `/` Dashboard, `/log`, `/body`, `/trends` (Trends is lazy-loaded because Recharts is large).
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
- `Reading`: id, indicatorId, value: number, timestamp: ISO string, note?
- `BodySystem`: id (heart|respiratory|bone|muscle|immune|eyes|mind|sleep|metabolic), name, spaceflightEffects,
  hazards[] (names), indicatorIds[] (derived from each indicator's bodySystem)
- `MissionProfile`: id (iss|lunar|mars), name, description, commsDelaySeconds {min,max} (one-way)
- `Content`: { disclaimer, unknownStatusAction, hazards, indicators, bodySystems, missionProfiles }
- Indicator ids: heart_rate, bp_systolic, bp_diastolic, blood_glucose, body_temp, spo2 (respiratory),
  sleep_hours and mood (1–5) (both mind)
- `getStatus(indicator, value, unknownAction?)` → `{ level: green|amber|red|unknown, action, label? }`.
  Bands are half-open: **min inclusive, max exclusive**; checked green → amber → red, first match wins;
  outside all bands → red.
- `validateValue(indicator, raw)` → `{ ok: true, value } | { ok: false, error }`. Run it before saving a reading.
- localStorage keys: `chc:v1:readings`, `chc:v1:mission`. Bump `v1` if the Reading shape changes incompatibly.
  Old ids `glucose`/`temperature` are migrated on load.

## Conventions

- **All guidance/medical text lives in `src/data/content.json`, never hardcoded in components.** UI labels are fine.
- Only `src/lib/storage.ts` touches `localStorage`. Components use `useReadings()` / `useMission()`.
- Pure logic goes in `src/lib/` with a colocated `*.test.ts`. Keep `getStatus` pure.
- Function components, **named exports** (no default exports except where `React.lazy` needs adapting).
- Tailwind classes only (no CSS modules/styled-components). Status colors: `bg-status-green|amber|red|unknown`,
  surfaces: `bg-space-900|800|700`. Recharts needs hex colors; keep them in sync with `index.css`.
- TypeScript strict; no `any`. Prettier: single quotes, semicolons, width 100.
- Seed data is deterministic (`generateSeed(days, now, seed)`). Keep scripted amber/red events for the demo.

## Don'ts

- **Don't make the frontend depend on the server.** The API in `server/` is optional sync; every page must
  work offline from localStorage. Components never call `fetch` directly: server access goes through
  `src/lib` (A), behind `useReadings()`.
- Don't add auth, another database, or new heavy dependencies without asking the team.
- Don't call external APIs or CDNs at runtime: the app must work fully offline.
- Don't change `types.ts` silently. It's the shared contract (see "Keep this file current").
- Don't push or force-push without being asked.

## Current state

- [x] Scaffold: Vite/React/TS, Tailwind, ESLint/Prettier, Vitest, Vercel config
- [x] Types, content.json (placeholders), getStatus + tests, seed + tests, storage + tests
- [x] Routed shell; functional placeholder components (StatusCard, VitalsForm, BodyFigure, TrendChart, Streak, Disclaimer)
- [ ] Real content and sources in content.json; ranges verified (C)
- [ ] Visual design pass: body illustration, animations, mobile layout (B)
- [ ] Trend chart amber/red markers, date range filter (B)
- [ ] Edit/delete readings, export data (A) (server side done: PATCH/DELETE in the API)
- [x] Backend phases 0–1: `server/` skeleton, SQLite, readings CRUD API + tests (A)
- [ ] Backend phases 2–7: crew/roles, sync, flight-surgeon endpoints, export, comms delay, deploy (A)
- [ ] Mission comms-delay feature beyond the description card (A/B)
- [ ] Optional: PWA/service worker for true offline install (ask first)

## Changelog

- 2026-11-14: Initial scaffold (Claude session 1).
- 2026-11-15: A: content adapter for C's new content.json; half-open bands; `validateValue`; new ids
  `blood_glucose`/`body_temp`; `respiratory` system; placeholder bodySystems/missionProfiles restored in content.json.
- 2026-11-15: A: optional backend in `server/` (Hono, node:sqlite): readings CRUD API with shared validation,
  soft deletes, idempotent client ids; `dev:server`/`demo:server` scripts; `docs/backend-roadmap.md`.

## Person A — status

Person A owns logic and data. Only Person A's sessions edit this section.

- **Done:**
  - `a/contract`: added `getSystemStatus`, `getTrend` and `getReadiness` in `src/lib/insights.ts`, with tests, plus the CI workflow (lint, build, test on PRs and main).
  - `a/content-adapter`: `normalizeContent` maps C's content.json format to the app types; getStatus uses half-open bands and returns the band label; `validateValue` + `INPUT_LIMITS`; seed retuned to the new bands; stored-id migration.
  - `a/backend-readings` (roadmap phases 0–1): `server/` with `GET /health`, `GET /readings?indicatorId&from&to&includeDeleted`, `GET/PATCH/DELETE /readings/:id`, `POST /readings`. Built on `a/content-adapter`.
- **In progress:** none.
- **Next:** backend roadmap in `docs/backend-roadmap.md`, one phase at a time:
  1. Phase 2: crew members and roles (astronaut, flight surgeon), simple bearer tokens.
  2. Phase 3: `POST /sync` plus a sync queue behind `storage.ts`/`useReadings`, so B's pages sync with no component changes.
  3. Phases 4–7: flight-surgeon overview, export, comms-delay demo, deploy.
  - Still open on the app side: readiness and routine prompts; edit/delete in the UI; mission risk emphasis.
- **Decisions and gotchas:**
  - C owns the content.json format; the app-facing types stay stable and `src/data/content.ts` adapts. If C changes the format again, update `RawContent`/`normalizeContent`, not the components.
  - `bodySystems`, `missionProfiles` and `meta.unknownStatusAction` were missing from C's file; A restored them as PLACEHOLDER text for C to rewrite. Body-system `indicatorIds` are derived, not stored. The `sleep` system currently has no indicators (C put `sleep_hours` under `mind`).
  - Input limits (whole numbers, SpO2 0–100, sleep 0–24, mood 1–5) follow C's meta.disclaimer; other bounds only reject impossible values.
  - `getStatus(indicator, value)` keeps its signature and returns `{ level, action, label? }`.
  - A reading counts as current for system status and readiness if it is at most 48h old (`CURRENT_WINDOW_HOURS`).
  - Readiness: green 100, amber 50, red 0, averaged over current indicators. It is 0 when no indicator has a current reading.
  - Server: readings keep the client's UUID, and re-POSTing an existing id returns the stored reading (200) instead of a duplicate, so offline retries are safe. Deletes are soft (`deletedAt` tombstone) so sync can propagate them. Every row has `updatedAt` for sync. The `crew_id` column defaults to `'local'` until phase 2.
  - Server schema changes go in `MIGRATIONS` in `server/src/db.ts` (tracked with `PRAGMA user_version`). Never edit an applied migration; append a new one.
  - On Windows (`core.autocrlf=true`), `npm run format:check` flags every file for CRLF line endings. Use `npx prettier --check --end-of-line auto .` locally. Git stores LF, so CI is unaffected.
- **Contract (for B):**
  - Import from `src/lib/insights`. Each function takes `readings` as an optional argument, so pass `readings` from `useReadings()` to stay in sync with state.
  - `getSystemStatus(systemId, readings?)` returns `'green' | 'amber' | 'red' | 'unknown'`.
  - `getTrend(indicatorId, days, readings?)` returns `{ timestamp, label, value, level }[]`. Use `label` for the x-axis and `value` for the line; `level` can colour amber/red dots.
  - `getReadiness(readings?)` returns `{ score, streak }`.
  - `validateValue(indicator, raw)` from `src/lib/validation`: call it in VitalsForm before `add()` and show `error` if not ok.
  - New optional detail for UI: `indicator.howToMeasureSteps`, `actionSteps[level]` (render as lists), `whyItMatters`, `escalation`, `status.label`. SpO2 now belongs to the new `respiratory` system, which BodyFigure has no region for yet.
  - Backend: nothing for B to wire up yet. In phase 3, A adds `useSync()` → `{ status: 'offline' | 'syncing' | 'synced', lastSyncedAt }` for a small status badge; pages keep using `useReadings()`.
