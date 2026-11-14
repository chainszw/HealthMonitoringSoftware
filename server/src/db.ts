import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// SQLite via Node's built-in node:sqlite (no native dependency).
// Schema version lives in PRAGMA user_version; add a new step to MIGRATIONS to change it.

export const MIGRATIONS: string[] = [
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
  // 2: change counter for sync. Every write sets seq to MAX(seq) + 1, so "changed since N" is exact.
  `ALTER TABLE readings ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
   UPDATE readings SET seq = rowid;
   CREATE INDEX readings_seq ON readings (seq);`,
  // 3: crew members with hashed tokens; readings keyed by (crew_id, id) so each crew member's
  // ids are separate. Rows from before this migration keep crew_id 'local'.
  `CREATE TABLE crew (
     id         TEXT PRIMARY KEY,
     name       TEXT NOT NULL,
     role       TEXT NOT NULL CHECK (role IN ('astronaut', 'flight_surgeon')),
     token_hash TEXT NOT NULL UNIQUE,
     created_at TEXT NOT NULL
   );
   CREATE TABLE readings_v3 (
     crew_id      TEXT NOT NULL,
     id           TEXT NOT NULL,
     indicator_id TEXT NOT NULL,
     value        REAL NOT NULL,
     timestamp    TEXT NOT NULL,
     note         TEXT,
     created_at   TEXT NOT NULL,
     updated_at   TEXT NOT NULL,
     deleted_at   TEXT,
     seq          INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (crew_id, id)
   );
   INSERT INTO readings_v3 (crew_id, id, indicator_id, value, timestamp, note,
                            created_at, updated_at, deleted_at, seq)
     SELECT crew_id, id, indicator_id, value, timestamp, note,
            created_at, updated_at, deleted_at, seq
     FROM readings;
   DROP TABLE readings;
   ALTER TABLE readings_v3 RENAME TO readings;
   CREATE INDEX readings_seq ON readings (seq);
   CREATE INDEX readings_crew_seq ON readings (crew_id, seq);
   CREATE INDEX readings_crew_indicator_time ON readings (crew_id, indicator_id, timestamp);`,
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
