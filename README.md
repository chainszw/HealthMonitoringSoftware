# Crew Health Console

**NASA Space Apps Challenge 2026.** An offline web app that helps astronauts log their vitals,
see a **green / amber / red** status with clear guidance, explore a clickable body map of how
spaceflight affects each body system, and view trends over a mission.

On Mars, a message to Earth can take up to 22 minutes each way, so crews will need to read their
own health data. Crew Health Console makes that quick and consistent, and keeps the
flight surgeon informed.

> ⚠️ Crew Health Console **supports flight surgeons; it does not replace them.** It is not a
> medical device. All ranges and guidance are placeholders until verified (`TODO-verify`).

## Stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS 4 (official `@tailwindcss/vite` plugin)
- Recharts (charts), Motion (animation; formerly Framer Motion, `import { motion } from 'motion/react'`)
- React Router 8
- Vitest (unit tests), ESLint + Prettier
- **Offline first.** Data lives in the browser's `localStorage` and the app needs no server. Deployed to
  Vercel as a static site.
- Optional API in `server/` (Hono + Node's built-in SQLite) that the app will sync with when it can reach it.
  See [docs/backend-roadmap.md](docs/backend-roadmap.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run lint         # ESLint
npm run format       # Prettier (write); format:check to verify
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build
npm run dev:server   # optional API on http://localhost:8787 (SQLite file in server/data/)
npm run demo:server  # walk through the API (set API_TOKEN to a crew token first)
npm run crew -- demo # demo crew with tokens: 1 flight surgeon, 3 astronauts
```

Sync is off by default. To try it, copy `.env.example` to `.env.local`, run `npm run dev:server`,
then restart `npm run dev`. Each crew member signs in with a token from `npm run crew`. See
[docs/backend-roadmap.md](docs/backend-roadmap.md).

The app seeds a 30-day demo mission on first load. Use **Reset to demo data** on the Dashboard
to restore it.

**Deploy:** import the repo in Vercel. It detects Vite automatically (build command `npm run build`,
output directory `dist`). `vercel.json` rewrites all routes to `index.html` so client-side routing works.

## Folder map

```
src/
  App.tsx                 routes: / (Dashboard), /log, /body, /trends
  main.tsx, index.css     entry + Tailwind + design tokens (status colors)
  components/
    Layout.tsx            header, nav, mission selector, footer disclaimer
    Disclaimer.tsx        disclaimer text from content.json
    StatusCard.tsx        one indicator: value, status badge, action text
    VitalsForm.tsx        log a reading
    BodyFigure.tsx        clickable body figure → BodySystemId
    TrendChart.tsx        Recharts line chart with green band
    Streak.tsx            consecutive-days-logged badge
  pages/                  Dashboard, Log, Body, Trends (compose components)
  data/
    content.json          ALL guidance text, ranges, body systems, missions
    content.ts            typed access to content.json (getIndicator, ...)
    seed.ts               deterministic 30-day demo mission generator
  lib/
    types.ts              shared data contract
    status.ts             getStatus(indicator, value) → { level, action }
    storage.ts            localStorage load/save/reset (the only localStorage user)
    readings.ts           pure helpers: latestByIndicator, readingsFor, loggingStreak
    useReadings.ts        React hooks over storage (useReadings, useMission)
    *.test.ts             Vitest unit tests
```

## Data schema

Defined in [`src/lib/types.ts`](src/lib/types.ts).

| Type             | Fields                                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Indicator`      | `id`, `name`, `unit`, `howToMeasureInSpace`, `bodySystem`, `ranges {green, amber, red}` (each a list of `{min?, max?}` bands), `actions {green, amber, red}`, `sources[]`, `rangesStatus?`, `input?` |
| `Reading`        | `id`, `indicatorId`, `value` (number), `timestamp` (ISO string), `note?`                                                                                                                             |
| `BodySystem`     | `id` (`heart`, `bone`, `muscle`, `immune`, `eyes`, `mind`, `sleep`, `metabolic`), `name`, `spaceflightEffects`, `hazards[]`, `indicatorIds[]`                                                        |
| `MissionProfile` | `id` (`iss` \| `lunar` \| `mars`), `name`, `description`, `commsDelaySeconds {min, max}` (one-way)                                                                                                   |

Indicators: `heart_rate`, `bp_systolic`, `bp_diastolic`, `glucose`, `temperature`, `sleep_hours`,
`mood` (1–5), `spo2`. Blood pressure is stored as two indicators so every reading is a single number.

**Status rules** (`getStatus`): bands are inclusive and neighbouring bands share their edges.
Levels are checked green → amber → red and the first match wins, so a value on an edge gets the
less severe level. A value outside every band is **red** (conservative). Missing/NaN is **unknown**.

```json
{
  "id": "heart_rate",
  "name": "Resting heart rate",
  "unit": "bpm",
  "bodySystem": "heart",
  "rangesStatus": "TODO-verify",
  "ranges": {
    "green": [{ "min": 50, "max": 90 }],
    "amber": [
      { "min": 40, "max": 50 },
      { "min": 90, "max": 110 }
    ],
    "red": [{ "max": 40 }, { "min": 110 }]
  },
  "actions": { "green": "…", "amber": "…", "red": "…" },
  "sources": [{ "title": "…", "url": "…" }]
}
```

localStorage keys: `chc:v1:readings`, `chc:v1:mission`.

## Team ownership

Each person owns separate files, so we can work in parallel without merge conflicts.

| Owner                     | Owns                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| **A: logic & data**       | `src/lib/*`, `src/data/seed.ts`, `src/data/content.ts`, tests         |
| **B: visual & UX**        | `src/components/*`, `src/pages/*`, `src/index.css`, `public/`         |
| **C: content & write-up** | `src/data/content.json`, README pitch, Space Apps submission write-up |

Changes to `src/lib/types.ts` affect all three owners: agree on them first, then update
`content.json`, README and CLAUDE.md in the same commit.

### The content rule

**All guidance and medical text lives in `src/data/content.json`, never hardcoded in components.**
That covers actions, measurement instructions, body-system descriptions, hazards, mission
descriptions and the disclaimer. Components may only contain UI labels ("Save reading", "Trends").
Before the demo, Owner C replaces every `PLACEHOLDER`, adds real `sources`, and changes
`rangesStatus` from `TODO-verify` to `verified`.
`grep -n "TODO-verify\|PLACEHOLDER" src/data/content.json` shows what's left.

## License

[MIT](LICENSE)
