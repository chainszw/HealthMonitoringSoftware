import { clearReadings, loadSession, resetSyncCursor, saveSession } from './storage';
import { defaultFetch, type FetchLike } from './sync';
import type { CrewMember } from './syncProtocol';

// Sign-in for sync. Logic only: a sign-in screen (B) calls signIn() with the token a crew
// member was given (`npm run crew -- add ...` on the server) and shows the error if any.

export type SignInResult = { ok: true; crew: CrewMember } | { ok: false; error: string };

/**
 * Check a crew token with GET /me and store it for sync. Signing in as a different crew member
 * first clears this device's readings, which belong to the previous one. The first sign-in on a
 * device keeps them, so readings logged before signing in are uploaded as this crew member's.
 */
export async function signIn(
  apiUrl: string,
  token: string,
  fetchImpl: FetchLike = defaultFetch,
): Promise<SignInResult> {
  const t = token.trim();
  if (!apiUrl) return { ok: false, error: 'Sync is not set up (VITE_API_URL is empty).' };
  if (!t) return { ok: false, error: 'Enter a crew token.' };

  let res: Response;
  try {
    res = await fetchImpl(`${apiUrl}/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${t}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: 'Cannot reach the sync server. Try again when online.' };
  }
  if (res.status === 401) return { ok: false, error: 'That crew token is not valid.' };
  if (!res.ok) return { ok: false, error: `Server error ${res.status}.` };
  const crew = ((await res.json().catch(() => null)) as { crew?: CrewMember } | null)?.crew;
  if (!crew || typeof crew.id !== 'string') {
    return { ok: false, error: 'Unexpected reply from the sync server.' };
  }
  if (crew.role !== 'astronaut') {
    return {
      ok: false,
      error: 'This is a flight surgeon token. The crew app needs an astronaut token.',
    };
  }

  const current = loadSession();
  if (current && current.crew.id !== crew.id) clearReadings();
  else resetSyncCursor();
  saveSession({ token: t, crew });
  return { ok: true, crew };
}

/** Sign out: forget the token and remove this crew member's readings from the device. */
export function signOut(): void {
  clearReadings();
  saveSession(null);
}
