// Shows the comms delay (roadmap phase 6): an astronaut logs a reading and the flight surgeon on
// Earth only sees it after the mission's one-way delay.
//
//   PowerShell: $env:COMMS_DELAY_SCALE = '0.01'; npm run dev:server     (terminal 1)
//               npm run crew -- demo   (Mira Lindqvist is on Mars; prints tokens)
//               $env:API_TOKEN = '<Mira token>'; $env:SURGEON_TOKEN = '<surgeon token>'; npm run demo:comms
//
// API_URL defaults to http://localhost:8787.

const API = process.env.API_URL ?? 'http://localhost:8787';
const TOKEN = process.env.API_TOKEN?.trim();
const SURGEON = process.env.SURGEON_TOKEN?.trim();
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!TOKEN || !SURGEON) {
  console.log(
    yellow('Set API_TOKEN (an astronaut) and SURGEON_TOKEN first: npm run crew -- demo.'),
  );
  process.exit(1);
}

async function call(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${data?.error ?? ''}`);
  return data;
}

try {
  const { crew: astronaut } = await call(TOKEN, 'GET', '/me');
  const first = await call(SURGEON, 'GET', `/crew/${astronaut.id}/overview`);
  const delay = first.overview.commsDelaySeconds;
  console.log(
    `${cyan(astronaut.name)} is on ${astronaut.mission ?? 'no mission'}; ` +
      `comms delay to Earth: ${delay} s (scale x${first.commsDelayScale}).`,
  );
  if (!(delay > 0)) {
    console.log(
      yellow('No delay: start the server with COMMS_DELAY_SCALE=0.01 and set a mission.'),
    );
    process.exit(1);
  }

  const sentAt = Date.now();
  const { reading } = await call(TOKEN, 'POST', '/readings', {
    indicatorId: 'heart_rate',
    value: 118,
    note: 'Comms demo: logged in space',
  });
  console.log(
    `\n${cyan('Astronaut')} logs heart rate 118 bpm. Reaches Earth at ${reading.arrivesAt}.`,
  );
  console.log(`${cyan('Flight surgeon on Earth')} checks every second:`);

  for (;;) {
    await pause(1000);
    const { overview } = await call(SURGEON, 'GET', `/crew/${astronaut.id}/overview`);
    const elapsed = ((Date.now() - sentAt) / 1000).toFixed(0).padStart(3);
    const hr = overview.latest.heart_rate;
    const arrived = hr?.readingId === reading.id;
    if (arrived) {
      console.log(
        `  t+${elapsed}s  ${green('arrived')}: heart rate ${hr.value} bpm (${hr.level}), ` +
          `status ${overview.status}`,
      );
      break;
    }
    const next = overview.inTransit.nextArrivalAt;
    const eta = next ? Math.max(0, (Date.parse(next) - Date.now()) / 1000).toFixed(0) : '?';
    console.log(
      `  t+${elapsed}s  ${yellow('in transit')}: ${overview.inTransit.count} change(s), next in ~${eta}s` +
        ` | latest heart rate on Earth: ${hr ? `${hr.value} bpm` : 'none'}`,
    );
  }
  console.log(green('\nDemo finished: Earth saw the reading only after the light-time delay.'));
} catch (err) {
  console.error(yellow(`Could not complete the demo against ${API}:`), err.message);
  process.exitCode = 1;
}
