import { generateSeed } from '../../src/data/seed';
import { CREW_ROLES, type CrewRole } from '../../src/lib/syncProtocol';
import { crewRepo, type CrewRepo } from './crewRepo';
import type { Db } from './db';
import { readingsRepo } from './readingsRepo';

// Crew administration for whoever runs the server (no HTTP endpoint for this on purpose).
// Entry point: server/src/crewCli.ts (`npm run crew -- <command>`).

export const USAGE = `Manage crew members and their tokens.

  npm run crew -- list
  npm run crew -- add "<name>" <astronaut|flight_surgeon> [id]
  npm run crew -- token <id>   new token for a crew member; the old one stops working
  npm run crew -- demo         demo crew, 30 days of readings per astronaut; prints tokens

Database: DB_PATH (default server/data/chc.db). A token is shown once; only its hash is stored.`;

/** Fictional demo crew. `seed` varies each astronaut's generated readings. */
export const DEMO_CREW: { id: string; name: string; role: CrewRole; seed?: number }[] = [
  { id: 'surgeon', name: 'Dr. Jordan Lee', role: 'flight_surgeon' },
  { id: 'alpha', name: 'Alex Rivera', role: 'astronaut', seed: 1 },
  { id: 'bravo', name: 'Sam Okafor', role: 'astronaut', seed: 2 },
  { id: 'charlie', name: 'Mira Lindqvist', role: 'astronaut', seed: 3 },
];

const isRole = (x: string): x is CrewRole => (CREW_ROLES as string[]).includes(x);

/** Run one command. Returns the process exit code. */
export function runCrewCommand(
  args: string[],
  db: Db,
  print: (line: string) => void,
  now: () => string = () => new Date().toISOString(),
): number {
  const crew = crewRepo(db, now);
  const [command, ...rest] = args;
  try {
    switch (command) {
      case 'list': {
        const all = crew.list();
        if (!all.length) print('No crew yet. Add one: npm run crew -- add "<name>" astronaut');
        for (const m of all) print(`${m.id.padEnd(14)} ${m.role.padEnd(15)} ${m.name}`);
        return 0;
      }
      case 'add': {
        const [name, role, id] = rest;
        if (!name || !role) {
          print(USAGE);
          return 1;
        }
        if (!isRole(role)) {
          print(`Role must be one of: ${CREW_ROLES.join(', ')}.`);
          return 1;
        }
        const { member, token } = crew.add({ name, role, id });
        print(`Added ${member.name} (id ${member.id}, ${member.role}).`);
        print(`Token, shown once: ${token}`);
        return 0;
      }
      case 'token': {
        const [id] = rest;
        const token = id ? crew.rotateToken(id) : undefined;
        if (!token) {
          print(id ? `No crew member with id "${id}".` : USAGE);
          return 1;
        }
        print(`New token for ${id} (the old one no longer works): ${token}`);
        return 0;
      }
      case 'demo':
        return demo(db, crew, print, now);
      case undefined:
      case 'help':
        print(USAGE);
        return 0;
      default:
        print(`Unknown command "${command}".\n\n${USAGE}`);
        return 1;
    }
  } catch (err) {
    print(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

/** Create (or refresh the tokens of) the demo crew and give each astronaut 30 days of readings. */
function demo(db: Db, crew: CrewRepo, print: (line: string) => void, now: () => string): number {
  const readings = readingsRepo(db, now);
  const t = now();
  const lines: string[] = [];
  db.exec('BEGIN');
  try {
    for (const d of DEMO_CREW) {
      const token = crew.get(d.id)
        ? crew.rotateToken(d.id)!
        : crew.add({ id: d.id, name: d.name, role: d.role }).token;
      let added = 0;
      const empty = readings.list({ crewId: d.id, includeDeleted: true }).length === 0;
      if (d.seed !== undefined && empty) {
        for (const r of generateSeed(30, new Date(t), d.seed)) {
          readings.applyChange(d.id, { ...r, updatedAt: t });
          added++;
        }
      }
      const extra = added ? `  (+${added} readings)` : '';
      lines.push(`  ${d.id.padEnd(8)} ${d.name.padEnd(15)} ${d.role.padEnd(15)} ${token}${extra}`);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  print('Demo crew. Tokens are new on every run; earlier demo tokens stop working.');
  lines.forEach((l) => print(l));
  return 0;
}
