import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations(db) {
  db.pragma('foreign_keys = ON');

  // Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    return;
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
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
