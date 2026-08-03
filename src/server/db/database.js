import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initSchema as runSchemaInit } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isTest = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('test'));
const defaultDbName = isTest ? `../../../forge_test_${process.pid}.db` : '../../../forge.db';
const dbPath = process.env.DATABASE_URL || path.join(__dirname, defaultDbName);

export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Write-ahead logging lets readers proceed during writes, which matters as
// soon as more than one request is in flight. NORMAL synchronous is the
// standard companion to WAL: durable across app crashes, and only at risk
// in an OS-level crash.
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

export function initSchema() {
  runSchemaInit(db);
}

// Automatically initialize schema for new database instances
initSchema();

if (isTest && !process.env.DATABASE_URL) {
  process.on('exit', () => {
    try {
      db.close();
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    } catch (_) {}
  });
}
