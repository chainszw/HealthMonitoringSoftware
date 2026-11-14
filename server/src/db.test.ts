import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MIGRATIONS, openDb } from './db';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chc-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('openDb', () => {
  it('migrates once and keeps data across reopen', () => {
    const path = join(dir, 'nested', 'test.db');
    const db = openDb(path);
    db.prepare(
      `INSERT INTO readings (id, indicator_id, value, timestamp, created_at, updated_at, seq)
       VALUES ('x', 'mood', 4, 't', 't', 't', 1)`,
    ).run();
    db.close();
    const again = openDb(path);
    expect(again.prepare('PRAGMA user_version').get()).toEqual({
      user_version: MIGRATIONS.length,
    });
    expect(again.prepare('SELECT count(*) AS n FROM readings').get()).toEqual({ n: 1 });
    again.close();
  });

  it('upgrades a version-1 database and numbers existing rows for sync', () => {
    const path = join(dir, 'v1.db');
    const v1 = new DatabaseSync(path);
    v1.exec(MIGRATIONS[0]);
    v1.exec('PRAGMA user_version = 1');
    for (const id of ['a', 'b']) {
      v1.prepare(
        `INSERT INTO readings (id, indicator_id, value, timestamp, created_at, updated_at)
         VALUES (?, 'mood', 4, 't', 't', 't')`,
      ).run(id);
    }
    v1.close();

    const db = openDb(path);
    expect(db.prepare('SELECT id, seq FROM readings ORDER BY seq').all()).toEqual([
      { id: 'a', seq: 1 },
      { id: 'b', seq: 2 },
    ]);
    db.close();
  });
});
