// Walks through the Crew Health API (roadmap phase 1) against a running server.
// Usage: `npm run dev:server` in one terminal, then `npm run demo:server` in another.
// Set API_URL to point somewhere other than http://localhost:8787.

const API = process.env.API_URL ?? 'http://localhost:8787';
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function step(title, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const status = res.status >= 400 ? yellow(res.status) : green(res.status);
  console.log(`\n${cyan(`${method} ${path}`)}  ${title}`);
  console.log(status, text ? JSON.stringify(JSON.parse(text), null, 2) : '(no body)');
  await pause(700);
  return text ? JSON.parse(text) : null;
}

const id = crypto.randomUUID();

try {
  await step('server is up', 'GET', '/health');
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
  await step('server generates id and timestamp when missing', 'POST', '/readings', {
    indicatorId: 'mood',
    value: 4,
  });
  await step('rejected: SpO2 above 100', 'POST', '/readings', { indicatorId: 'spo2', value: 101 });
  await step('rejected: heart rate must be a whole number', 'POST', '/readings', {
    indicatorId: 'heart_rate',
    value: 72.5,
  });
  await step('edit the value', 'PATCH', `/readings/${id}`, { value: 140 });
  await step('list heart-rate readings', 'GET', '/readings?indicatorId=heart_rate');
  await step('delete (soft delete)', 'DELETE', `/readings/${id}`);
  await step('deleted reading is kept as a tombstone for sync', 'GET', `/readings/${id}`);
  console.log(
    `\n${green('Demo finished.')} Open ${API}/readings?includeDeleted=true to see all rows.`,
  );
} catch (err) {
  console.error(yellow(`Could not reach ${API}. Is \`npm run dev:server\` running?`), err.message);
  process.exitCode = 1;
}
