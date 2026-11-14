import { CREW_ROLES, type CrewMember, type CrewRole } from '../../src/lib/syncProtocol';
import { generateToken, hashToken } from './auth';
import type { Db } from './db';

interface Row {
  id: string;
  name: string;
  role: CrewRole;
  token_hash: string;
  created_at: string;
}

const toMember = (r: Row): CrewMember => ({ id: r.id, name: r.name, role: r.role });

export const CREW_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const MAX_NAME_LENGTH = 80;

/** "Dr. Jordan Lee" → "dr-jordan-lee". */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
  return slug || 'crew';
}

/** Data access for crew members. All SQL for the crew table lives here. */
export function crewRepo(db: Db, now: () => string = () => new Date().toISOString()) {
  function get(id: string): CrewMember | undefined {
    const row = db.prepare('SELECT * FROM crew WHERE id = ?').get(id) as Row | undefined;
    return row ? toMember(row) : undefined;
  }

  function findByToken(token: string): CrewMember | undefined {
    const row = db.prepare('SELECT * FROM crew WHERE token_hash = ?').get(hashToken(token)) as
      Row | undefined;
    return row ? toMember(row) : undefined;
  }

  /** Flight surgeons first, then astronauts, each by name. */
  function list(): CrewMember[] {
    const rows = db.prepare('SELECT * FROM crew ORDER BY role DESC, name').all();
    return (rows as unknown as Row[]).map(toMember);
  }

  /**
   * Add a crew member. Returns their token, which is shown only now (only its hash is stored).
   * Without an id, one is made from the name ("Alex Rivera" → "alex-rivera", then "-2", ...).
   */
  function add(input: { name: string; role: CrewRole; id?: string }): {
    member: CrewMember;
    token: string;
  } {
    const name = input.name.trim();
    if (!name || name.length > MAX_NAME_LENGTH) {
      throw new Error(`Name must be 1-${MAX_NAME_LENGTH} characters.`);
    }
    if (!CREW_ROLES.includes(input.role)) {
      throw new Error(`Role must be one of: ${CREW_ROLES.join(', ')}.`);
    }
    let id = input.id;
    if (id === undefined) {
      const base = slugify(name);
      id = base;
      for (let n = 2; get(id); n++) id = `${base}-${n}`;
    } else if (get(id)) {
      throw new Error(`Crew id "${id}" is already taken.`);
    }
    if (!CREW_ID_PATTERN.test(id)) {
      throw new Error('Crew id must be 1-40 lowercase letters, digits or "-".');
    }
    const token = generateToken();
    db.prepare(
      'INSERT INTO crew (id, name, role, token_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, name, input.role, hashToken(token), now());
    return { member: { id, name, role: input.role }, token };
  }

  /** Replace a crew member's token (the old one stops working). Undefined if the id is unknown. */
  function rotateToken(id: string): string | undefined {
    if (!get(id)) return undefined;
    const token = generateToken();
    db.prepare('UPDATE crew SET token_hash = ? WHERE id = ?').run(hashToken(token), id);
    return token;
  }

  return { get, findByToken, list, add, rotateToken };
}

export type CrewRepo = ReturnType<typeof crewRepo>;
