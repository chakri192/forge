import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} [dir]  overridable so the file-selection rules can be tested
 *                        against a scratch directory rather than the real one
 */
export function runMigrations(db, dir = null) {
  db.pragma('foreign_keys = ON');

  // Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = dir || path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    return;
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    // `.down` files are rollbacks. They live beside their migration and must
    // never be picked up as forward migrations — doing so executes a DROP
    // against a live database.
    //
    // Matched loosely on purpose. An exact `.down.sql` test looks sufficient
    // until a copy appears: macOS and every file-sync tool name duplicates
    // `014_discord_bridge.down 2.sql`, which does not end in `.down.sql`, ran
    // as a forward migration, and dropped six tables from a working database.
    .filter((file) => file.endsWith('.sql') && !/\.down\b/i.test(file))
    // A duplicate of a *forward* migration is just as wrong: it re-runs SQL
    // that has already been applied under a name the ledger does not recognise.
    .filter((file) => {
      if (!/ \d+\.sql$/.test(file)) return true;
      console.warn(`⚠ Skipping duplicate migration file: ${file}`);
      return false;
    })
    .sort();

  const getAppliedStmt = db.prepare('SELECT name FROM schema_migrations WHERE name = ?');
  const recordMigrationStmt = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');

  for (const file of migrationFiles) {
    const isApplied = getAppliedStmt.get(file);
    if (isApplied) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`Running migration: ${file}...`);

    const applyMigration = db.transaction(() => {
      db.exec(sql);
      recordMigrationStmt.run(file);
    });

    try {
      applyMigration();
      console.log(`✓ Applied migration: ${file}`);
    } catch (err) {
      console.error(`❌ Migration failed [${file}]:`, err);
      throw err;
    }
  }
}
