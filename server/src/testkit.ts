import { createApp, type AppOptions } from './app';
import { crewRepo } from './crewRepo';
import { openDb } from './db';

// Test helper (not a test file): an API on an in-memory database with three crew members.

export interface RequestOptions {
  method?: string;
  /** Sent as JSON, unless it is already a string (sent as-is, e.g. malformed JSON). */
  body?: unknown;
  headers?: Record<string, string>;
}

export function setupApi(opts: AppOptions = {}) {
  const db = openDb(':memory:');
  const crew = crewRepo(db);
  const tokens = {
    alpha: crew.add({ id: 'alpha', name: 'Alex Rivera', role: 'astronaut' }).token,
    bravo: crew.add({ id: 'bravo', name: 'Sam Okafor', role: 'astronaut' }).token,
    surgeon: crew.add({ id: 'surgeon', name: 'Dr. Jordan Lee', role: 'flight_surgeon' }).token,
  };
  const app = createApp(db, opts);

  /** Request helper that signs requests with `token` (undefined = no Authorization header). */
  const as =
    (token: string | undefined) =>
    (path: string, { method = 'GET', body, headers = {} }: RequestOptions = {}) =>
      app.request(path, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body:
          body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });

  return { app, db, crew, tokens, as };
}

/** Parse a JSON response body with a type (tests only). */
export async function json<T>(res: Response | Promise<Response>): Promise<T> {
  return (await (await res).json()) as T;
}
