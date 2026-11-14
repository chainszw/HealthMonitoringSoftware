# Crew Health Console

**NASA Space Apps Challenge 2026.** An offline web app that helps astronauts log their vitals,
see a **green / amber / red** status with clear guidance, explore a clickable body map of how
spaceflight affects each body system, and view trends over a mission.

On Mars, a message to Earth can take up to 22 minutes each way, so crews will need to read their
own health data. Crew Health Console makes that quick and consistent, and keeps the
flight surgeon informed.

> ⚠️ Crew Health Console **supports flight surgeons; it does not replace them.** It is not a
> medical device. Ranges and guidance are not yet approved for flight use (`needsReview` in
> `content.json`).

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
The optional API deploys separately as a Docker container (`Dockerfile`, Render Blueprint in
`render.yaml`); then set `VITE_API_URL` in Vercel. Step by step: "Deploy" in
[docs/backend-roadmap.md](docs/backend-roadmap.md).

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
    status.ts             getStatus(indicator, value) → { level, action, label }
    validation.ts         validateValue(): input limits per indicator
    insights.ts           getSystemStatus, getTrend, getReadiness
    storage.ts            localStorage: readings, sync outbox, session (the only localStorage user)
    readings.ts           pure helpers: latestByIndicator, readingsFor, loggingStreak
    sync.ts, session.ts   background sync with the optional server; crew sign-in
    exportData.ts         CSV/JSON export (offline and server)
    crewApi.ts            typed calls for a flight-surgeon console
    syncProtocol.ts       API wire types shared with the server
    useReadings.ts        React hooks (useReadings, useMission, useSync, useSession)
    *.test.ts             Vitest unit tests
server/                   optional API: Hono + node:sqlite (see docs/backend-roadmap.md)
docs/backend-roadmap.md   backend phases and API reference
```

## Data schema

`src/data/content.json` is written by C in this format; `src/data/content.ts` converts it into the
app's types in [`src/lib/types.ts`](src/lib/types.ts), so components never depend on the file
format. Full field list: CLAUDE.md.

```jsonc
{
  "meta": { "disclaimer": "…", "unknownStatusAction": "…" },
  "hazards": [{ "id": "altered_gravity", "name": "Altered gravity", "summary": "…" }],
  "bodySystems": [
    { "id": "heart", "name": "…", "spaceflightEffects": "…", "hazards": ["altered_gravity"] },
  ],
  "missionProfiles": [
    {
      "id": "mars",
      "name": "…",
      "description": "…",
      "commsDelaySeconds": { "min": 180, "max": 1320 },
    },
  ],
  "indicators": [
    {
      "id": "heart_rate",
      "name": "Heart rate",
      "unit": "bpm",
      "bodySystem": "heart",
      "howToMeasure": ["…", "…"],
      "bands": [
        { "status": "red", "min": null, "max": 41, "label": "Very low resting pulse" },
        { "status": "amber", "min": 41, "max": 60, "label": "Low; check personal baseline" },
        { "status": "green", "min": 60, "max": 101, "label": "Usual adult resting range" },
      ],
      "actions": { "green": ["…"], "amber": ["…"], "red": ["…"] },
      "needsReview": true,
      "sources": ["aha_pulse"],
    },
  ],
  "sources": [{ "id": "aha_pulse", "title": "…", "org": "…", "url": "…" }],
}
```

Indicators: `heart_rate`, `bp_systolic`, `bp_diastolic` (heart), `spo2` (respiratory),
`blood_glucose` (metabolic), `body_temp` (immune), `sleep_hours` and `mood` 1–5 (mind). Blood
pressure is two indicators, so every reading is a single number.

**Status rules** (`getStatus`): a band covers **min inclusive, max exclusive** (`null` = open), so
101 bpm is amber above. A value outside every band is **red** (conservative); a missing value is
**unknown**. `validateValue` rejects impossible input (e.g. SpO2 over 100, decimal heart rates).

A `Reading` is `{ id, indicatorId, value, timestamp, note?, updatedAt? }`. localStorage keys:
`chc:v1:readings`, `chc:v1:mission`, `chc:v1:outbox`, `chc:v1:sync`, `chc:v1:session`.

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
Before the demo, Owner C replaces every `PLACEHOLDER` (body systems and mission profiles), and an
indicator's `needsReview` becomes `false` only once its ranges are approved.
`grep -n 'PLACEHOLDER\|"needsReview": true' src/data/content.json` shows what's left.

## License

[MIT](LICENSE)
