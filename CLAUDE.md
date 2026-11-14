# CLAUDE.md: Crew Health Console

NASA Space Apps 2026 hackathon (~24h, 3 people + more than one Claude session working in parallel).
An offline React app for astronauts: log vitals → green/amber/red status + guidance, clickable body
figure, trend charts. **No backend, no auth; data lives in localStorage; static deploy to Vercel.**

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
npm test           # Vitest (src/**/*.test.ts, node env)
npm run lint       # ESLint (flat config, eslint.config.js)
npm run format     # Prettier write (format:check to verify)
npm run build      # tsc -b && vite build → dist/
```

Before committing, run `npm run lint && npm test && npm run build && npm run format:check`.

## Stack & versions

React 19, Vite 8, TypeScript **6.0** (pinned: typescript-eslint doesn't support TS 7 yet), Tailwind 4
via `@tailwindcss/vite` (no tailwind.config; tokens in `src/index.css` `@theme`), Recharts 3,
Motion 14 (`import { motion } from 'motion/react'`), React Router 8 (`import … from 'react-router'`),
Vitest 5, ESLint 10 + Prettier 3.

## Layout & ownership

| Owner         | Files                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| A: logic/data | `src/lib/*` (types, status, storage, readings, useReadings, tests), `src/data/seed.ts`, `src/data/content.ts` |
| B: visual/UX  | `src/components/*`, `src/pages/*`, `src/index.css`, `src/App.tsx`, `public/`                                  |
| C: content    | `src/data/content.json`, README pitch, write-up                                                               |

Routes: `/` Dashboard, `/log`, `/body`, `/trends` (lazy-loaded), `/routine`.
The mission profile is owned by `Layout` and passed to pages through `useOutletContext<{ mission }>()`.

## Schema (src/lib/types.ts)

- `Indicator`: id, name, unit, howToMeasureInSpace, bodySystem, `ranges: Record<'green'|'amber'|'red', {min?,max?}[]>`,
  `actions: Record<level, string>`, sources[], rangesStatus? ("TODO-verify" | "verified"), input? {min,max,step}
- `Reading`: id, indicatorId, value: number, timestamp: ISO string, note?
- `BodySystem`: id (heart|bone|muscle|immune|eyes|mind|sleep|metabolic), name, spaceflightEffects, hazards[], indicatorIds[]
- `MissionProfile`: id (iss|lunar|mars), name, description, commsDelaySeconds {min,max} (one-way)
- `Content`: { disclaimer, unknownStatusAction, indicators, bodySystems, missionProfiles } = shape of content.json
- Indicator ids: heart_rate, bp_systolic, bp_diastolic, glucose, temperature, sleep_hours, mood (1–5), spo2
- `getStatus(indicator, value, unknownAction?)` → `{ level: green|amber|red|unknown, action }`.
  Bands are inclusive and share edges; checked green → amber → red, first match wins; outside all bands → red.
- localStorage keys: `chc:v1:readings`, `chc:v1:mission`. Bump `v1` if the Reading shape changes incompatibly.

## Conventions

- **All guidance/medical text lives in `src/data/content.json`, never hardcoded in components.** UI labels are fine.
- Only `src/lib/storage.ts` touches `localStorage`. Components use `useReadings()` / `useMission()`.
- Pure logic goes in `src/lib/` with a colocated `*.test.ts`. Keep `getStatus` pure.
- Function components, **named exports** (no default exports except where `React.lazy` needs adapting).
- Tailwind classes only (no CSS modules/styled-components). Design tokens (v0.3) in `index.css` `@theme`:
  surfaces `bg-bg|surface|raised|hover|sunk`, text `text-ink|text|muted|faint`, borders `border-line|line-2`,
  `accent`, status `ok|watch|act` (+ `-t` tints, `act-l` border). Old `status-*`/`space-*` tokens remain for now.
- UI status is a `Tone` (`normal|watch|act`, `src/components/tone.ts`), always shown as shape + word + colour
  (`StatusPill`/`StatusIcon` in `components/ui.tsx`). Map `getStatus` levels green/amber/red → normal/watch/act.
  SVG needs hex colours: use `TONE[t].hex`, kept in sync with `index.css`.
- Icons: inline stroke SVGs in `components/icons.tsx` (no icon library, no emoji).
- TypeScript strict; no `any`. Prettier: single quotes, semicolons, width 100.
- Seed data is deterministic (`generateSeed(days, now, seed)`). Keep scripted amber/red events for the demo.

## Don'ts

- **Don't add a backend, auth, database, or new heavy dependencies without asking the team.**
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
- [ ] Wire the new screens to real data (`useReadings`, `insights.ts`, content.json), then delete `src/pages/designMock.ts` (B)
- [ ] Mobile layout pass (B)
- [ ] Edit/delete readings, export data (A)
- [ ] Mission comms-delay feature beyond the description card (A/B)
- [ ] Optional: PWA/service worker for true offline install (ask first)

## Changelog

- 2026-11-14: Initial scaffold (Claude session 1).
- 2026-11-15: B: design v0.3 implemented as layout (mock data, not wired): new shell, all screens, `/routine` route (Claude, B session).

## Person B — status

Person B owns visuals and UX. Only Person B's sessions edit this section.

- **Done:** design v0.3 layout for every screen (`/`, `/body`, `/log`, `/trends`, `/routine`) plus the app shell.
- **In progress:** none.
- **Next:**
  1. Wire screens to `useReadings()`, `getSystemStatus`/`getTrend`/`getReadiness` and content.json; delete `designMock.ts`.
  2. Move guidance/disclaimer text now in pages and `designMock.ts` into content.json (with C).
  3. Mobile layout pass.
- **Decisions and gotchas:**
  - **Screens show mock data on purpose.** `src/pages/designMock.ts` holds everything copied from the design
    (values, thresholds, guidance text). It breaks the "text lives in content.json" rule until wired. Don't build on it.
  - Body figure is a flat 2D SVG (`BodyFigure.tsx`), not the design's three.js model: no new heavy dependency,
    works offline. Callouts cover mind/eyes/heart/immune/bone; leader lines are measured with a ResizeObserver.
  - Trends uses a hand-drawn SVG chart (matches the design); Recharts and `TrendChart.tsx` are unused now.
  - Fonts: Instrument Sans / DM Mono only if installed locally (no Google Fonts at runtime); bundling needs a dependency, so ask first.
  - At ≥1600×1040 the app locks to the viewport (`.chc-fit*`, `.chc-scroll` in `index.css`); panels scroll inside.
  - `?alert` on `/` and `/body` shows the Act-now state.
  - Unused for now, not deleted: `StatusCard`, `VitalsForm`, `Streak`, `TrendChart`, `Disclaimer`.

## Person A — status

Person A owns logic and data. Only Person A's sessions edit this section.

- **Done:**
  - `a/contract`: added `getSystemStatus`, `getTrend` and `getReadiness` in `src/lib/insights.ts`, with tests, plus the CI workflow (lint, build, test on PRs and main).
- **In progress:** none.
- **Next:**
  1. Readiness and routine: daily measurement prompts and a better readiness score.
  2. Edit/delete readings and data export.
  3. Mission profile switch: risk emphasis and comms delay.
- **Decisions and gotchas:**
  - We keep the repo's existing layout and schema rather than the original A brief: `src/lib/types.ts`, `src/data/content.json`, `ranges` per level, and indicator ids `glucose` and `temperature`.
  - `getStatus(indicator, value)` keeps its signature and returns `{ level, action }`.
  - A reading counts as current for system status and readiness if it is at most 48h old (`CURRENT_WINDOW_HOURS`).
  - Readiness: green 100, amber 50, red 0, averaged over current indicators. It is 0 when no indicator has a current reading.
  - On Windows (`core.autocrlf=true`), `npm run format:check` flags every file for CRLF line endings. Use `npx prettier --check --end-of-line auto .` locally. Git stores LF, so CI is unaffected.
- **Contract (for B):**
  - Import from `src/lib/insights`. Each function takes `readings` as an optional argument, so pass `readings` from `useReadings()` to stay in sync with state.
  - `getSystemStatus(systemId, readings?)` returns `'green' | 'amber' | 'red' | 'unknown'`.
  - `getTrend(indicatorId, days, readings?)` returns `{ timestamp, label, value, level }[]`. Use `label` for the x-axis and `value` for the line; `level` can colour amber/red dots.
  - `getReadiness(readings?)` returns `{ score, streak }`.
