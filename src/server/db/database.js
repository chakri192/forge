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
