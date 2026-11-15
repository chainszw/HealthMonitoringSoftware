import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// SQLite via Node's built-in node:sqlite (no native dependency).
// Schema version lives in PRAGMA user_version; add a new step to MIGRATIONS to change it.

const MIGRATIONS: string[] = [
  `CREATE TABLE readings (
     id           TEXT PRIMARY KEY,
     crew_id      TEXT NOT NULL DEFAULT 'local',
     indicator_id TEXT NOT NULL,
     value        REAL NOT NULL,
     timestamp    TEXT NOT NULL,
     note         TEXT,
     created_at   TEXT NOT NULL,
     updated_at   TEXT NOT NULL,
     deleted_at   TEXT
   );
   CREATE INDEX readings_indicator_time ON readings (indicator_id, timestamp);
   CREATE INDEX readings_updated ON readings (updated_at);`,
];

export type Db = DatabaseSync;

/** Open (or create) the database and apply pending migrations. Use ':memory:' in tests. */
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    db.exec(MIGRATIONS[v]);
    db.exec(`PRAGMA user_version = ${v + 1}`);
    db.exec('COMMIT');
  }
  return db;
}
