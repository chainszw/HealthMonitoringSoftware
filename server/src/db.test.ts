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
      `INSERT INTO readings (crew_id, id, indicator_id, value, timestamp, created_at, updated_at, seq)
       VALUES ('alpha', 'x', 'mood', 4, 't', 't', 't', 1)`,
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
  it('upgrades a version-2 database: old rows go to crew "local", ids are unique per crew', () => {
    const path = join(dir, 'v2.db');
    const v2 = new DatabaseSync(path);
    v2.exec(MIGRATIONS[0]);
    v2.exec(MIGRATIONS[1]);
    v2.exec('PRAGMA user_version = 2');
    v2.prepare(
      `INSERT INTO readings (id, indicator_id, value, timestamp, created_at, updated_at, seq)
       VALUES ('x', 'mood', 4, 't', 't', 't', 7)`,
    ).run();
    v2.close();

    const db = openDb(path);
    expect(db.prepare('SELECT crew_id, id, seq FROM readings').all()).toEqual([
      { crew_id: 'local', id: 'x', seq: 7 },
    ]);
    db.prepare(
      `INSERT INTO readings (crew_id, id, indicator_id, value, timestamp, created_at, updated_at)
       VALUES ('alpha', 'x', 'mood', 3, 't', 't', 't')`,
    ).run();
    expect(db.prepare('SELECT count(*) AS n FROM readings WHERE id = ?').get('x')).toEqual({
      n: 2,
    });
    db.close();
  });

  it('upgrades a version-3 database: no missions, every existing reading already arrived', () => {
    const path = join(dir, 'v3.db');
    const v3 = new DatabaseSync(path);
    for (const m of MIGRATIONS.slice(0, 3)) v3.exec(m);
    v3.exec('PRAGMA user_version = 3');
    v3.exec(`INSERT INTO crew (id, name, role, token_hash, created_at)
             VALUES ('alpha', 'Alex', 'astronaut', 'h', 't')`);
    v3.exec(`INSERT INTO readings (crew_id, id, indicator_id, value, timestamp, created_at, updated_at)
             VALUES ('alpha', 'x', 'mood', 4, 't', 't', 't')`);
    v3.close();

    const db = openDb(path);
    expect(db.prepare('SELECT mission FROM crew').get()).toEqual({ mission: null });
    expect(db.prepare('SELECT arrives_at FROM readings').get()).toEqual({ arrives_at: null });
    expect(() => db.exec("UPDATE crew SET mission = 'venus'")).toThrow(/CHECK/);
    db.close();
  });
});
