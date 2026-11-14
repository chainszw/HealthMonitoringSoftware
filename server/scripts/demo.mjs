// Walks through the Crew Health API against a running server.
//
//   npm run dev:server                    (terminal 1)
//   npm run crew -- demo                  (prints a token per demo crew member)
//   PowerShell: $env:API_TOKEN = 'chc_...'; $env:SURGEON_TOKEN = 'chc_...'; npm run demo:server
//   bash:       API_TOKEN=chc_... SURGEON_TOKEN=chc_... npm run demo:server
//
// API_TOKEN must belong to an astronaut. SURGEON_TOKEN (optional) adds the flight-surgeon steps.
// Set API_URL to point somewhere other than http://localhost:8787.

const API = process.env.API_URL ?? 'http://localhost:8787';
const TOKEN = process.env.API_TOKEN?.trim();
const SURGEON = process.env.SURGEON_TOKEN?.trim();
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!TOKEN) {
  console.log(
    yellow('Set API_TOKEN to an astronaut token first (npm run crew -- demo prints some).'),
  );
  console.log("PowerShell: $env:API_TOKEN = 'chc_...'; npm run demo:server");
  process.exit(1);
}

async function step(title, method, path, body, token = TOKEN) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const status = res.status >= 400 ? yellow(res.status) : green(res.status);
  const who = token === SURGEON && token ? ' [flight surgeon]' : token ? '' : ' [no token]';
  console.log(`\n${cyan(`${method} ${path}`)}${who}  ${title}`);
  console.log(status, text ? JSON.stringify(JSON.parse(text), null, 2) : '(no body)');
  await pause(700);
  return text ? JSON.parse(text) : null;
}

const id = crypto.randomUUID();

try {
  await step('server is up (no token needed)', 'GET', '/health', undefined, null);
  await step('everything else needs a crew token', 'GET', '/readings', undefined, null);
  const me = await step('who this token belongs to', 'GET', '/me');
  await step('create with a client id (the app already makes UUIDs)', 'POST', '/readings', {
    id,
    indicatorId: 'heart_rate',
    value: 72,
    note: 'demo: after rest',
  });
  await step('same id again: no duplicate (safe to retry offline)', 'POST', '/readings', {
    id,
    indicatorId: 'heart_rate',
    value: 72,
  });
  await step('rejected: SpO2 above 100', 'POST', '/readings', { indicatorId: 'spo2', value: 101 });
  await step('rejected: heart rate must be a whole number', 'POST', '/readings', {
    indicatorId: 'heart_rate',
    value: 72.5,
  });
  await step('edit the value', 'PATCH', `/readings/${id}`, { value: 140 });

  if (SURGEON) {
    const crewId = me?.crew?.id;
    await step('the flight surgeon lists the crew', 'GET', '/crew', undefined, SURGEON);
    await step(
      "the flight surgeon reads this astronaut's reading",
      'GET',
      `/readings/${id}?crewId=${crewId}`,
      undefined,
      SURGEON,
    );
    await step(
      'but cannot change it',
      'PATCH',
      `/readings/${id}?crewId=${crewId}`,
      { value: 60 },
      SURGEON,
    );
  }

  await step('delete (soft delete)', 'DELETE', `/readings/${id}`);
  await step('deleted reading is kept as a tombstone for sync', 'GET', `/readings/${id}`);
  console.log(`\n${green('Demo finished.')}`);
} catch (err) {
  console.error(yellow(`Could not reach ${API}. Is \`npm run dev:server\` running?`), err.message);
  process.exitCode = 1;
}
