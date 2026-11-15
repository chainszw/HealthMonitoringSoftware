import { generateScenario, pickScenario, type ScenarioId } from '../data/scenarios';
import { applyDemoReadings, dropDemoReadings, getSessionSnapshot } from './storage';
import { defaultFetch, type FetchLike } from './sync';

// Owner A: where the app's data comes from, decided on start.
//  - 'live': the backend answers and a crew member is signed in, so the app shows the server's
//    real readings (demo readings are dropped; background sync pulls the rest).
//  - 'sign-in': the backend answers but nobody is signed in; the start screen asks for a crew
//    token, or the user can continue with demo data.
//  - 'offline': signed in, but the backend can't be reached: keep the device's own readings
//    (they sync when the server is back).
//  - 'demo': no backend and nobody signed in: a random spike scenario (src/data/scenarios.ts).

export type DataMode = 'live' | 'sign-in' | 'offline' | 'demo';

/** True if `GET /health` answers OK within `timeoutMs`. Never throws. */
export async function checkBackend(
  apiUrl: string,
  fetchImpl: FetchLike = defaultFetch,
  timeoutMs = 2500,
): Promise<boolean> {
  if (!apiUrl) return false;
  try {
    const res = await fetchImpl(`${apiUrl}/health`, {
      method: 'GET',
      headers: {},
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Pure decision: which mode the app is in. */
export function decideMode(backendUp: boolean, signedIn: boolean): DataMode {
  if (backendUp) return signedIn ? 'live' : 'sign-in';
  return signedIn ? 'offline' : 'demo';
}

/** Load a demo scenario onto the device (random unless `id` is given). Returns its id. */
export function startDemo(
  id: ScenarioId = pickScenario(),
  seed = Math.floor(Math.random() * 1e9),
  now = new Date(),
): ScenarioId {
  applyDemoReadings(generateScenario(id, now, seed));
  return id;
}

/** Switch to the server's real data (call once signed in with the backend up). */
export function startLive(): void {
  dropDemoReadings();
}

/** Check the backend and the session, and return the mode to show on the start screen. */
export async function detectMode(apiUrl: string, fetchImpl?: FetchLike): Promise<DataMode> {
  const up = await checkBackend(apiUrl, fetchImpl);
  return decideMode(up, getSessionSnapshot() !== null);
}
