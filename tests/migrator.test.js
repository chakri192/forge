import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The migrator decides which files to execute against a live database, so a
 * mistake here is silent data loss rather than a failing request.
 *
 * This actually happened: a file-sync tool left `014_discord_bridge.down 2.sql`
 * beside the real migration. The filter tested for `.down.sql` exactly, that
 * name ends in `.down 2.sql`, and the rollback ran as a forward migration —
 * dropping six tables from a working database with no error.
 */
describe('Migration file selection', () => {
  let sandbox;
  let runMigrations;

  before(async () => {
    ({ runMigrations } = await import('../src/server/db/migrator.js'));
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-migrator-'));
  });

  after(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  /** Mirrors the migrator's own selection rules against a directory listing. */
  function selected(files) {
    return files
      .filter((file) => file.endsWith('.sql') && !/\.down\b/i.test(file))
      .filter((file) => !/ \d+\.sql$/.test(file))
      .sort();
  }

  it('runs ordinary forward migrations', () => {
    assert.deepEqual(
      selected(['001_initial.sql', '002_next.sql']),
      ['001_initial.sql', '002_next.sql']
    );
  });

  it('never runs a rollback file', () => {
    assert.deepEqual(selected(['001_a.sql', '001_a.down.sql']), ['001_a.sql']);
  });

  it('never runs a *copy* of a rollback file', () => {
    // The exact bug. Every one of these is a rollback and none ends in
    // `.down.sql`.
    for (const copy of [
      '014_discord_bridge.down 2.sql',
      '014_discord_bridge.down 3.sql',
      '014_discord_bridge.down copy.sql',
      '014_discord_bridge.DOWN 2.sql'
    ]) {
      assert.deepEqual(
        selected(['014_discord_bridge.sql', copy]),
        ['014_discord_bridge.sql'],
        `${copy} must not be executed`
      );
    }
  });

  it('never re-runs a copy of a forward migration', () => {
    assert.deepEqual(
      selected(['015_seasons.sql', '015_seasons 2.sql']),
      ['015_seasons.sql']
    );
  });

  it('drops nothing when a stray rollback copy sits in the directory', () => {
    // End to end against a real database: create a table, then leave a
    // rollback copy beside the migration and run again.
    const dir = path.join(sandbox, 'migrations');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '001_thing.sql'), 'CREATE TABLE IF NOT EXISTS thing (id TEXT);');
    fs.writeFileSync(path.join(dir, '001_thing.down 2.sql'), 'DROP TABLE IF EXISTS thing;');

    const dbPath = path.join(sandbox, 'probe.db');
    const db = new Database(dbPath);
    runMigrations(db, dir);

    const exists = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='thing'`)
      .get();
    const applied = db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name);
    db.close();

    assert.ok(exists, 'the stray rollback copy dropped the table it should never have touched');
    assert.equal(
      applied.includes('001_thing.down 2.sql'),
      false,
      'a rollback copy must never be recorded as applied'
    );
  });
});
