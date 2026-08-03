import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Roll back the most recently applied migration.
 *
 * A `down` file is optional: SQLite cannot drop or alter most things
 * transactionally, so several migrations here genuinely have no safe inverse.
 * Where one exists it lives beside the migration as `<name>.down.sql`.
 */
export function rollbackLast() {
  const last = db
    .prepare(`SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1`)
    .get();
  if (!last) {
    console.log('Nothing to roll back.');
    return null;
  }

  const downFile = path.join(__dirname, 'migrations', last.name.replace(/\.sql$/, '.down.sql'));
  if (!fs.existsSync(downFile)) {
    console.error(
      `No down migration for ${last.name}.\n` +
      `Create ${path.basename(downFile)} beside it, or restore from a backup.`
    );
    process.exitCode = 1;
    return null;
  }

  const sql = fs.readFileSync(downFile, 'utf8');
  const run = db.transaction(() => {
    db.exec(sql);
    db.prepare(`DELETE FROM schema_migrations WHERE name = ?`).run(last.name);
  });
  run();
  console.log(`Rolled back ${last.name}`);
  return last.name;
}

if (import.meta.url === `file://${process.argv[1]}`) rollbackLast();
