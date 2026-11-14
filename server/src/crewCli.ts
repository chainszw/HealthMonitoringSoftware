import { runCrewCommand } from './crewCommands';
import { openDb } from './db';

// `npm run crew -- <command>`: see USAGE in crewCommands.ts.
const db = openDb(process.env.DB_PATH ?? 'server/data/chc.db');
process.exitCode = runCrewCommand(process.argv.slice(2), db, (line) => console.log(line));
db.close();
