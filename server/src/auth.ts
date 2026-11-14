import { createHash, randomBytes } from 'node:crypto';

// Crew tokens are random bearer secrets. Only their SHA-256 hash is stored, so a copy of the
// database does not reveal working tokens. A token is shown once, when it is created.

export const TOKEN_PREFIX = 'chc_';

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The token from an "Authorization: Bearer <token>" header, or undefined. */
export function bearerToken(header: string | undefined): string | undefined {
  return /^Bearer\s+(\S+)\s*$/i.exec(header ?? '')?.[1];
}
