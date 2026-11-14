import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDb } from './db';

describe('openDb', () => {
  it('migrates once and keeps data across reopen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'chc-'));
    try {
      const path = join(dir, 'nested', 'test.db');
      const db = openDb(path);
      db.prepare(
        `INSERT INTO readings (id, indicator_id, value, timestamp, created_at, updated_at)
         VALUES ('x', 'mood', 4, 't', 't', 't')`,
      ).run();
      db.close();
      const again = openDb(path);
      expect(again.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
      expect(again.prepare('SELECT count(*) AS n FROM readings').get()).toEqual({ n: 1 });
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
