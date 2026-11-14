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

Routes: `/` Dashboard, `/log`, `/body`, `/trends` (Trends is lazy-loaded because Recharts is large).
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
- Tailwind classes only (no CSS modules/styled-components). Status colors: `bg-status-green|amber|red|unknown`,
  surfaces: `bg-space-900|800|700`. Recharts needs hex colors; keep them in sync with `index.css`.
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
- [ ] Visual design pass: body illustration, animations, mobile layout (B)
- [ ] Trend chart amber/red markers, date range filter (B)
- [ ] Edit/delete readings, export data (A)
- [ ] Mission comms-delay feature beyond the description card (A/B)
- [ ] Optional: PWA/service worker for true offline install (ask first)

## Changelog

- 2026-11-14: Initial scaffold (Claude session 1).
